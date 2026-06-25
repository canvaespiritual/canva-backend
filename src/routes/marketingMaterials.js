// src/routes/marketingMaterials.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

function requireLogin(req, res, next) {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });
  next();
}

function requireAdmin(req, res, next) {
  if (req.session?.adminAutenticado) return next();

  const role = String(req.session?.aff?.role || "").toLowerCase();
  if (role === "admin") return next();

  return res.status(403).json({ error: "Acesso restrito ao admin/master." });
}

function normalizeMaterial(body = {}) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const category = String(body.category || "").trim();
  const product_key = String(body.product_key || "").trim();
  const type = String(body.type || "").trim();
  const audience = String(body.audience || "both").trim();
  const status = String(body.status || "active").trim();
  const sort_order = Number.isFinite(Number(body.sort_order))
    ? Number(body.sort_order)
    : 0;
  const cover_url = String(body.cover_url || "").trim();

return {
    title,
    description,
    category,
    product_key,
    type,
    audience,
    status,
    sort_order,
    cover_url
};
}

// Leitura pública para vendedor/afiliado logado
// GET /marketing-materials?audience=vendor
// GET /marketing-materials?audience=affiliate
router.get("/", requireLogin, async (req, res) => {
  try {
    const audience = String(req.query.audience || "").toLowerCase();

    let params = [];
    let audienceWhere = "";

    if (audience === "vendor" || audience === "affiliate") {
      params.push(audience);
      audienceWhere = `AND m.audience IN ($${params.length}, 'both')`;
    }

    const q = await pool.query(
      `
      SELECT
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.id,
              'file_url', f.file_url,
              'download_url', f.download_url,
              'thumbnail_url', f.thumbnail_url,
              'file_name', f.file_name,
              'file_size_bytes', f.file_size_bytes,
              'mime_type', f.mime_type,
              'file_kind', f.file_kind,
              'sort_order', f.sort_order
            )
            ORDER BY f.sort_order ASC, f.created_at ASC
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'
        ) AS files
      FROM marketing_materials m
      LEFT JOIN marketing_files f ON f.material_id = m.id
      WHERE m.status = 'active'
      ${audienceWhere}
      GROUP BY m.id
      ORDER BY m.sort_order ASC, m.created_at DESC
      `,
      params
    );

    res.json({ items: q.rows });
  } catch (e) {
    console.error("[GET /marketing-materials] error:", e);
    res.status(500).json({ error: "Erro ao listar materiais." });
  }
});

// Admin lista tudo
// GET /marketing-materials/admin
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const q = await pool.query(
      `
      SELECT
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.id,
              'file_url', f.file_url,
              'download_url', f.download_url,
              'thumbnail_url', f.thumbnail_url,
              'file_name', f.file_name,
              'file_size_bytes', f.file_size_bytes,
              'mime_type', f.mime_type,
              'file_kind', f.file_kind,
              'sort_order', f.sort_order
            )
            ORDER BY f.sort_order ASC, f.created_at ASC
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'
        ) AS files
      FROM marketing_materials m
      LEFT JOIN marketing_files f ON f.material_id = m.id
      GROUP BY m.id
      ORDER BY m.sort_order ASC, m.created_at DESC
      `
    );

    res.json({ items: q.rows });
  } catch (e) {
    console.error("[GET /marketing-materials/admin] error:", e);
    res.status(500).json({ error: "Erro ao listar materiais no admin." });
  }
});

// Admin cria material
// POST /marketing-materials/admin
router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const m = normalizeMaterial(req.body);

    const createdBy =
      req.session?.aff?.id ||
      req.session?.adminEmail ||
      "admin";

    const q = await pool.query(
  `
  INSERT INTO marketing_materials (
    title,
    description,
    category,
    product_key,
    type,
    audience,
    status,
    sort_order,
    cover_url,
    button_text,
    layout,
    featured,
    created_by,
    created_at,
    updated_at
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
  RETURNING *
  `,
  [
    m.title,
    m.description || null,
    m.category || null,
    m.product_key || null,
    m.type,
    m.audience,
    m.status,
    m.sort_order,
    m.cover_url || null,
    "Abrir",
    "grid",
    false,
    createdBy,
  ]
);

    res.status(201).json({ ok: true, item: q.rows[0] });
  } catch (e) {
    console.error("[POST /marketing-materials/admin] error:", e);
    res.status(400).json({ error: e.message || "Erro ao criar material." });
  }
});
// Admin adiciona arquivo a um material
// POST /marketing-materials/admin/:id/files
router.post("/admin/:id/files", requireAdmin, async (req, res) => {
  try {
    const materialId = String(req.params.id || "").trim();

    const file_url = String(req.body.file_url || "").trim();
    const download_url = String(req.body.download_url || file_url).trim();
    const thumbnail_url = String(req.body.thumbnail_url || "").trim();
    const file_name = String(req.body.file_name || "").trim();
    const mime_type = String(req.body.mime_type || "").trim();
    const file_kind = String(req.body.file_kind || "asset").trim();
    const sort_order = Number.isFinite(Number(req.body.sort_order))
      ? Number(req.body.sort_order)
      : 0;

    const file_size_bytes = Number.isFinite(Number(req.body.file_size_bytes))
      ? Number(req.body.file_size_bytes)
      : null;

    if (!file_url) {
      return res.status(400).json({ error: "Informe a URL do arquivo." });
    }

    const exists = await pool.query(
      `SELECT id FROM marketing_materials WHERE id = $1 LIMIT 1`,
      [materialId]
    );

    if (!exists.rowCount) {
      return res.status(404).json({ error: "Material não encontrado." });
    }

    const q = await pool.query(
      `
      INSERT INTO marketing_files (
        material_id,
        file_url,
        download_url,
        thumbnail_url,
        file_name,
        file_size_bytes,
        mime_type,
        file_kind,
        sort_order,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      RETURNING *
      `,
      [
        materialId,
        file_url,
        download_url || file_url,
        thumbnail_url || null,
        file_name || null,
        file_size_bytes,
        mime_type || null,
        file_kind,
        sort_order,
      ]
    );

    res.status(201).json({ ok: true, file: q.rows[0] });
  } catch (e) {
    console.error("[POST /marketing-materials/admin/:id/files] error:", e);
    res.status(400).json({ error: e.message || "Erro ao adicionar arquivo." });
  }
});
// Admin edita material
// PUT /marketing-materials/admin/:id
router.put("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const m = normalizeMaterial(req.body);

    const q = await pool.query(
  `
  UPDATE marketing_materials
     SET title = $1,
         description = $2,
         category = $3,
         product_key = $4,
         type = $5,
         audience = $6,
         status = $7,
         sort_order = $8,
         cover_url = $9,
         updated_at = NOW()
   WHERE id = $10
   RETURNING *
  `,
  [
    m.title,
    m.description || null,
    m.category || null,
    m.product_key || null,
    m.type,
    m.audience,
    m.status,
    m.sort_order,
    m.cover_url || null,
    id,
  ]
);

    if (!q.rowCount) return res.status(404).json({ error: "Material não encontrado." });

    res.json({ ok: true, item: q.rows[0] });
  } catch (e) {
    console.error("[PUT /marketing-materials/admin/:id] error:", e);
    res.status(400).json({ error: e.message || "Erro ao editar material." });
  }
});

// Admin ativa/inativa
// PATCH /marketing-materials/admin/:id/status
router.patch("/admin/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const status = String(req.body.status || "").trim();

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const q = await pool.query(
      `
      UPDATE marketing_materials
         SET status = $1,
             updated_at = NOW()
       WHERE id = $2
       RETURNING *
      `,
      [status, id]
    );

    if (!q.rowCount) return res.status(404).json({ error: "Material não encontrado." });

    res.json({ ok: true, item: q.rows[0] });
  } catch (e) {
    console.error("[PATCH /marketing-materials/admin/:id/status] error:", e);
    res.status(500).json({ error: "Erro ao alterar status." });
  }
});

// Admin remove material
// DELETE /marketing-materials/admin/:id
router.delete("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();

    const q = await pool.query(
      `DELETE FROM marketing_materials WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!q.rowCount) return res.status(404).json({ error: "Material não encontrado." });

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /marketing-materials/admin/:id] error:", e);
    res.status(500).json({ error: "Erro ao remover material." });
  }
});
// Admin remove arquivo
// DELETE /marketing-materials/admin/files/:fileId
router.delete("/admin/files/:fileId", requireAdmin, async (req, res) => {
  try {
    const fileId = String(req.params.fileId || "").trim();

    const q = await pool.query(
      `DELETE FROM marketing_files WHERE id = $1 RETURNING id`,
      [fileId]
    );

    if (!q.rowCount) {
      return res.status(404).json({ error: "Arquivo não encontrado." });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /marketing-materials/admin/files/:fileId] error:", e);
    res.status(500).json({ error: "Erro ao remover arquivo." });
  }
});
module.exports = router;