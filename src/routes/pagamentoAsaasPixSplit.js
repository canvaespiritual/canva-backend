const express = require("express");
const axios = require("axios");
const pool = require("../db");

const router = express.Router();

const ASAAS_ENV =
  String(process.env.ASAAS_ENV || "sandbox")
    .trim()
    .toLowerCase();

const IS_PROD = ASAAS_ENV === "production";

const ASAAS_BASE = IS_PROD
  ? "https://api.asaas.com/v3"
  : "https://api-sandbox.asaas.com/v3";

const asaas = axios.create({
  baseURL: ASAAS_BASE,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    "access_token": process.env.ASAAS_API_KEY || "",
  },
});

console.log("[ASAAS PIX SPLIT LOADED]", {
  ASAAS_ENV,
  ASAAS_BASE,
  rootKeyPrefix: String(process.env.ASAAS_API_KEY || "").slice(0, 20),
  hasKey: !!process.env.ASAAS_API_KEY,
});

const VALOR_MINIMO = 12;
const VALOR_MAXIMO = 500;

function normalizeTipo(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "intermediario" || t === "premium") return "premium";
  if (t === "completo" || t === "interdimensional") return "completo";
  return "basico";
}

function mapPreco(tipo) {
  switch (normalizeTipo(tipo)) {
    case "basico": return 12;
    case "premium": return 21;
    case "completo": return 40;
    default: return 12;
  }
}

function clampValor(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, VALOR_MINIMO), VALOR_MAXIMO);
}

function clampPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function money2(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

function baseComissionavel(valorFinal) {
  return money2(Math.max(0, Number(valorFinal || 0) - 2.99));
}

function splitFixo(walletId, pct, base) {
  const value = money2((Number(base || 0) * Number(pct || 0)) / 100);
  if (!walletId || value <= 0) return null;
  return { walletId, fixedValue: value };
}

function normalizeAsaasEnv(v) {
  const env = String(v || "").trim().toLowerCase();
  if (env === "prod") return "production";
  if (env === "hmlg" || env === "homolog" || env === "homologacao") return "sandbox";
  return env;
}

function inferAsaasEnvFromApiKeyPrefix(prefix) {
  const p = String(prefix || "");
  if (p.startsWith("$aact_prod_")) return "production";
  if (p.startsWith("$aact_hmlg_")) return "sandbox";
  return "";
}

function resolveWalletEnv(row, envField, keyField) {
  return normalizeAsaasEnv(row?.[envField]) ||
    inferAsaasEnvFromApiKeyPrefix(row?.[keyField]);
}

function assertWalletEnv({ label, walletId, walletEnv, ownerId }) {
  if (!walletId) return;

  const env = normalizeAsaasEnv(walletEnv);

  if (!env) {
    const err = new Error(`Ambiente Asaas não definido para ${label}.`);
    err.statusCode = 409;
    err.code = "ASAAS_ENV_MISSING";
    err.details = {
      label,
      ownerId,
      walletId,
      currentEnv: ASAAS_ENV,
    };
    throw err;
  }

  if (env !== ASAAS_ENV) {
    const err = new Error(
      `Conta de comissão ${label} pertence a ${env}, mas o checkout atual está em ${ASAAS_ENV}.`
    );
    err.statusCode = 409;
    err.code = "ASAAS_ENV_MISMATCH";
    err.details = {
      label,
      ownerId,
      walletId,
      walletEnv: env,
      currentEnv: ASAAS_ENV,
    };
    throw err;
  }
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function dueDateTomorrow() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function vincularAttributionPorRef(sessionId, ref) {
  const maybeCode = String(ref || "").trim();

  if (!maybeCode) return;

  try {
    const lk = await pool.query(
      `SELECT id FROM affiliate_links WHERE code = $1 AND active = TRUE LIMIT 1`,
      [maybeCode]
    );

    if (lk.rowCount) {
      const linkId = lk.rows[0].id;

      await pool.query(`
        INSERT INTO attribution (session_id, affiliate_link_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (session_id)
        DO UPDATE SET affiliate_link_id = EXCLUDED.affiliate_link_id
      `, [sessionId, linkId]);

      console.log("[ASAAS PIX SPLIT] attribution vinculada pelo code:", maybeCode);
    }
  } catch (err) {
    console.warn("[ASAAS PIX SPLIT] falha ao vincular attribution:", err.message);
  }
}

async function buildSplitsForSession(sessionId, ref, baseSplit, vend) {
  await vincularAttributionPorRef(sessionId, ref);

  const q = await pool.query(`
    SELECT
  al.pct_aff,
  al.pct_vendor,
  al.pct_supervisor,
  al.affiliate_id,
  al.vendor_id,
  v.supervisor_id,
  a.asaas_wallet_id AS aff_wallet,
  a.asaas_env AS aff_env,
  LEFT(a.asaas_api_key, 20) AS aff_key_prefix,
  v.asaas_wallet_id AS vend_wallet,
  v.asaas_env AS vend_env,
  LEFT(v.asaas_api_key, 20) AS vend_key_prefix,
  s.asaas_wallet_id AS sup_wallet,
  s.asaas_env AS sup_env,
  LEFT(s.asaas_api_key, 20) AS sup_key_prefix
    FROM attribution at
    JOIN affiliate_links al ON al.id = at.affiliate_link_id
    LEFT JOIN affiliates a ON a.id = al.affiliate_id
    LEFT JOIN affiliates v ON v.id = al.vendor_id
    LEFT JOIN affiliates s ON s.id = v.supervisor_id
    WHERE at.session_id = $1
      AND al.active = TRUE
    LIMIT 1
  `, [sessionId]);

  if (q.rowCount) {
    const r = q.rows[0];
    console.log("[ASAAS PIX SPLIT DEBUG] affiliate_link encontrado:", {
  sessionId,
  ref,
  vendor_id: r.vendor_id,
  affiliate_id: r.affiliate_id,
  aff_wallet: r.aff_wallet,
  vend_wallet: r.vend_wallet,
  pct_aff: r.pct_aff,
  pct_vendor: r.pct_vendor,
  ASAAS_ENV,
  ASAAS_BASE,
});

    const A = clampPct(r.pct_aff || 0);
const V = clampPct(r.pct_vendor || 0);
const S = clampPct(r.pct_supervisor || 0);

const affEnv = resolveWalletEnv(r, "aff_env", "aff_key_prefix");
const vendEnv = resolveWalletEnv(r, "vend_env", "vend_key_prefix");
const supEnv = resolveWalletEnv(r, "sup_env", "sup_key_prefix");

if (A > 0 && r.aff_wallet) {
  assertWalletEnv({
    label: "afiliado",
    walletId: r.aff_wallet,
    walletEnv: affEnv,
    ownerId: r.affiliate_id,
  });
}

if (V > 0 && r.vend_wallet) {
  assertWalletEnv({
    label: "vendedor",
    walletId: r.vend_wallet,
    walletEnv: vendEnv,
    ownerId: r.vendor_id,
  });
}

if (S > 0 && r.sup_wallet) {
  assertWalletEnv({
    label: "supervisor",
    walletId: r.sup_wallet,
    walletEnv: supEnv,
    ownerId: r.supervisor_id,
  });
}

console.log("[ASAAS PIX SPLIT ENV CHECK]", {
  ASAAS_ENV,
  affiliate_id: r.affiliate_id,
  aff_wallet: r.aff_wallet,
  aff_env: affEnv,
  vendor_id: r.vendor_id,
  vend_wallet: r.vend_wallet,
  vend_env: vendEnv,
  supervisor_id: r.supervisor_id,
  sup_wallet: r.sup_wallet,
  sup_env: supEnv,
});

const split = [];

    if (A > 0 && r.aff_wallet) {
  const sp = splitFixo(r.aff_wallet, A, baseSplit);
  if (sp) split.push(sp);
}

if (V > 0 && r.vend_wallet) {
  const sp = splitFixo(r.vend_wallet, V, baseSplit);
  if (sp) split.push(sp);
}
console.log("[ASAAS PIX SPLIT DEBUG] split final affiliate_link:", split);
    return split;
  }
const vendorId = String(vend || "").trim();

if (vendorId) {
  const vendQ = await pool.query(`
    SELECT
  asaas_wallet_id,
  asaas_env,
  LEFT(asaas_api_key, 20) AS api_key_prefix
FROM affiliates
WHERE id = $1
  AND role = 'vendor'
LIMIT 1
  `, [vendorId]);

  if (vendQ.rowCount && vendQ.rows[0].asaas_wallet_id) {
  const r = vendQ.rows[0];
  const walletEnv = resolveWalletEnv(r, "asaas_env", "api_key_prefix");

  assertWalletEnv({
    label: "vendedor",
    walletId: r.asaas_wallet_id,
    walletEnv,
    ownerId: vendorId,
  });

  const sp = splitFixo(r.asaas_wallet_id, 70, baseSplit);
  return sp ? [sp] : [];
}
}
  const affiliateId = String(ref || "").trim();

  if (affiliateId) {
    const aff = await pool.query(`
      SELECT
  asaas_wallet_id,
  asaas_env,
  LEFT(asaas_api_key, 20) AS api_key_prefix,
  commission_percent
FROM affiliates
WHERE id = $1
LIMIT 1
    `, [affiliateId]);

   if (aff.rowCount && aff.rows[0].asaas_wallet_id) {
  const r = aff.rows[0];
  const pct = clampPct(r.commission_percent || 30);
  const walletEnv = resolveWalletEnv(r, "asaas_env", "api_key_prefix");

  assertWalletEnv({
    label: "afiliado",
    walletId: r.asaas_wallet_id,
    walletEnv,
    ownerId: affiliateId,
  });

  const sp = splitFixo(r.asaas_wallet_id, pct, baseSplit);
  return sp ? [sp] : [];
}
  }

  return [];
}

async function getOrCreateCustomer({ sessionId, nome, email, telefone, cpfCnpj }) {
  const payload = {
    name: nome || "Cliente Canva",
    email: email || `${sessionId}@canvaspiritual.com`,
    cpfCnpj: onlyDigits(cpfCnpj),
    mobilePhone: onlyDigits(telefone) || undefined,
  };

  const resp = await asaas.post("/customers", payload);
  const customerId = resp.data?.id;

  if (!customerId) {
    throw new Error("Cliente Asaas criado sem ID.");
  }

  return customerId;
}

// GET /pagamento/asaas/criar-pix-split/:tipo/:session_id?valor=12&ref=CODIGO
router.get("/criar-pix-split/:tipo/:session_id", async (req, res) => {
  const { tipo, session_id } = req.params;
  const ref = (req.query.ref || req.query.aff || "").trim();
  const vend = (req.query.vend || "").trim();

  const tipoNorm = normalizeTipo(tipo);
  const valorFinal = clampValor(req.query.valor, mapPreco(tipoNorm));

  console.log("[ASAAS PIX SPLIT] criando PIX", {
    tipo: tipoNorm,
    session_id,
    ref,
    valorFinal,
  });

  try {
    const diagQ = await pool.query(`
      SELECT session_id, nome, email, telefone, status_pagamento
      FROM diagnosticos
      WHERE session_id = $1
      LIMIT 1
    `, [session_id]);

    if (!diagQ.rowCount) {
      return res.status(404).json({ erro: "Sessão não encontrada." });
    }

    const diag = diagQ.rows[0];

    if (String(diag.status_pagamento || "").toLowerCase() === "pago") {
      return res.json({
        alreadyPaid: true,
        redirect: `/aguarde.html?session_id=${encodeURIComponent(session_id)}`,
      });
    }
    const baseSplit = baseComissionavel(valorFinal);
    const split = await buildSplitsForSession(session_id, ref, baseSplit, vend);

    if (!split.length) {
      return res.status(400).json({
        erro: "Nenhum split válido encontrado para esta sessão/ref.",
      });
    }

const cpfCnpj = onlyDigits(req.query.cpf || req.query.cpfCnpj);

if (!cpfCnpj) {
  return res.status(400).json({
    erro: "CPF/CNPJ é obrigatório para gerar PIX Asaas.",
  });
}

const customerId = await getOrCreateCustomer({
  sessionId: session_id,
  nome: diag.nome,
  email: diag.email,
  telefone: diag.telefone,
  cpfCnpj,
});

    const paymentPayload = {
      customer: customerId,
      billingType: "PIX",
      value: valorFinal,
      dueDate: dueDateTomorrow(),
      description: `Checkup Emocional - ${session_id}`,
      externalReference: session_id,
      split,
    };

    console.log("[ASAAS PIX SPLIT] payload:", JSON.stringify(paymentPayload));
console.log("[ASAAS PIX SPLIT DEBUG] antes de criar payment:", {
  ASAAS_ENV,
  ASAAS_BASE,
  session_id,
  ref,
  vend,
  split,
  paymentPayload,
});
    const paymentResp = await asaas.post("/payments", paymentPayload);
    const payment = paymentResp.data || {};
    const paymentId = payment.id;

    if (!paymentId) {
      throw new Error("Cobrança Asaas criada sem ID.");
    }

    try {
      await pool.query(`
       UPDATE diagnosticos
SET gateway = 'asaas',
    tipo_relatorio = $1,
    asaas_payment_id = $2,
    valor_pago = $3,
    tipo_pagamento = 'pix',
    cpf_cnpj = $4,
    affiliate_ref = $5,
    updated_at = NOW()
WHERE session_id = $6
      `, [
  tipoNorm === "basico" ? "essencial" : tipoNorm,
  paymentId,
  valorFinal,
  cpfCnpj,
  ref || null,
  session_id
]);
    } catch (e) {
      console.warn("[ASAAS PIX SPLIT] falha parcial ao atualizar diagnosticos:", e.message);
    }

    const qrResp = await asaas.get(`/payments/${paymentId}/pixQrCode`);
    const qr = qrResp.data || {};

    return res.json({
      gateway: "asaas",
      payment_id: paymentId,
      valor_final: valorFinal,
      qr_code: qr.payload || qr.qrCode || null,
      qr_code_base64: qr.encodedImage || qr.qrCodeBase64 || null,
      init_point: payment.invoiceUrl || null,
      invoice_url: payment.invoiceUrl || null,
    });

  } catch (err) {
    const apiErr = err.response?.data || err.message;
    console.error("[ASAAS PIX SPLIT] erro:", apiErr);
    return res.status(err.statusCode || 500).json({
  erro:
    err.code === "ASAAS_ENV_MISMATCH" || err.code === "ASAAS_ENV_MISSING"
      ? err.message
      : "Erro ao gerar PIX Asaas com split.",
  code: err.code || "ASAAS_PIX_SPLIT_ERROR",
  detalhe: err.details || apiErr,
});
  }
});

module.exports = router;