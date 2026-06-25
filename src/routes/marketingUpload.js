// src/routes/marketingUpload.js
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

function requireAdmin(req, res, next) {
  if (req.session?.adminAutenticado) return next();

  const role = String(req.session?.aff?.role || "").toLowerCase();
  if (role === "admin") return next();

  return res.status(403).json({ error: "Acesso restrito ao admin/master." });
}

function safeName(name = "arquivo") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function publicUrl(bucket, region, key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// POST /marketing-upload
router.post("/", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const bucket = process.env.AWS_BUCKET_NAME;
    const region = process.env.AWS_REGION || "us-east-2";

    if (!bucket) {
      return res.status(500).json({ error: "AWS_BUCKET_NAME não configurado." });
    }

    const original = safeName(file.originalname);
    const ext = path.extname(original);
    const base = path.basename(original, ext);
    const hash = crypto.randomBytes(8).toString("hex");

    const folder = String(req.body.folder || "marketing").replace(/[^a-zA-Z0-9/_-]/g, "-");

    const key = `${folder}/${Date.now()}-${hash}-${base}${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || "application/octet-stream",
      })
    );

    return res.json({
      ok: true,
      file_url: publicUrl(bucket, region, key),
      download_url: publicUrl(bucket, region, key),
      file_name: file.originalname,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
      s3_key: key,
    });
  } catch (e) {
    console.error("[POST /marketing-upload] error:", e);
    return res.status(500).json({ error: "Erro ao enviar arquivo para S3." });
  }
});

module.exports = router;