const express = require("express");
const axios = require("axios");
const pool = require("../db");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const router = express.Router();

const ASAAS_ENV =
  String(process.env.ASAAS_ENV || "sandbox")
    .trim()
    .toLowerCase();

const IS_PROD = ASAAS_ENV === "production";

const ASAAS_BASE = IS_PROD
  ? "https://api.asaas.com/v3"
  : "https://api-sandbox.asaas.com/v3";

const ASAAS_CHECKOUT_VIEW = IS_PROD
  ? "https://asaas.com/checkoutSession/show?id="
  : "https://sandbox.asaas.com/checkoutSession/show?id=";

const asaas = axios.create({
  baseURL: ASAAS_BASE,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
    access_token: process.env.ASAAS_API_KEY || "",
  },
});
console.log("[PREPAID CHECKOUT ASAAS LOADED]", {
  ASAAS_ENV,
  ASAAS_BASE,
  ASAAS_CHECKOUT_VIEW,
  rootKeyPrefix: String(process.env.ASAAS_API_KEY || "").slice(0, 20),
  hasKey: !!process.env.ASAAS_API_KEY,
});
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeBaseUrl(u) {
  let s = String(u || "").trim();
  if (!s) return "https://api.canvaspiritual.com";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/^http:\/\//i, "https://").replace(/\/+$/, "");
}

function clampValor(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 40;
  return Math.min(Math.max(n, 12), 500);
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
    err.details = { label, ownerId, walletId, currentEnv: ASAAS_ENV };
    throw err;
  }

  if (env !== ASAAS_ENV) {
    const err = new Error(
      `Conta de comissão ${label} pertence a ${env}, mas o checkout atual está em ${ASAAS_ENV}.`
    );
    err.statusCode = 409;
    err.code = "ASAAS_ENV_MISMATCH";
    err.details = { label, ownerId, walletId, walletEnv: env, currentEnv: ASAAS_ENV };
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

async function getOrCreateCustomer({ nome, email, cpfCnpj }) {
  const payload = {
    name: nome || "Cliente Canva",
    email,
    cpfCnpj: onlyDigits(cpfCnpj),
  };

  const resp = await asaas.post("/customers", payload);
  const customerId = resp.data?.id;

  if (!customerId) {
    throw new Error("Cliente Asaas criado sem ID.");
  }

  return customerId;
}
async function buildSplitsByRef(ref, baseSplit) {
  const code = String(ref || "").trim();
  if (!code) return [];

  const linkQ = await pool.query(`
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
    FROM affiliate_links al
    LEFT JOIN affiliates a ON a.id = al.affiliate_id
    LEFT JOIN affiliates v ON v.id = al.vendor_id
    LEFT JOIN affiliates s ON s.id = v.supervisor_id
    WHERE al.code = $1
      AND al.active = TRUE
    LIMIT 1
  `, [code]);

  if (linkQ.rowCount) {
  const r = linkQ.rows[0];

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

  console.log("[PREPAID CHECKOUT ENV CHECK link]", {
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

  const splits = [];

  if (A > 0 && r.aff_wallet) {
    const sp = splitFixo(r.aff_wallet, A, baseSplit);
    if (sp) splits.push(sp);
  }

  if (V > 0 && r.vend_wallet) {
    const sp = splitFixo(r.vend_wallet, V, baseSplit);
    if (sp) splits.push(sp);
  }

  if (S > 0 && r.sup_wallet) {
    const sp = splitFixo(r.sup_wallet, S, baseSplit);
    if (sp) splits.push(sp);
  }

  return splits;
}

  const affQ = await pool.query(`
    SELECT
  asaas_wallet_id,
  asaas_env,
  LEFT(asaas_api_key, 20) AS api_key_prefix,
  commission_percent
FROM affiliates
WHERE id::text = $1
LIMIT 1
  `, [code]);

  if (affQ.rowCount && affQ.rows[0].asaas_wallet_id) {
  const r = affQ.rows[0];
  const pct = clampPct(r.commission_percent || 30);
  const walletEnv = resolveWalletEnv(r, "asaas_env", "api_key_prefix");

  assertWalletEnv({
    label: "afiliado",
    walletId: r.asaas_wallet_id,
    walletEnv,
    ownerId: code,
  });

  console.log("[PREPAID CHECKOUT ENV CHECK afiliado direto]", {
    ASAAS_ENV,
    affiliate_id: code,
    wallet: r.asaas_wallet_id,
    walletEnv,
  });

  if (pct > 0) {
    const sp = splitFixo(r.asaas_wallet_id, pct, baseSplit);
    return sp ? [sp] : [];
  }
}

  return [];
}

// POST /api/prepaid-checkout/start
router.post("/start", async (req, res) => {
  try {
    const nome = String(req.body?.nome || "Cliente").trim();
    const email = normalizeEmail(req.body?.email);
    const valor = clampValor(req.body?.valor);
const baseSplit = baseComissionavel(valor);
const ref = String(req.body?.ref || req.body?.aff || "").trim();

    if (!email) {
      return res.status(400).json({
        ok: false,
        erro: "Email é obrigatório.",
      });
    }

    if (!process.env.ASAAS_API_KEY) {
      return res.status(500).json({
        ok: false,
        erro: "ASAAS_API_KEY ausente.",
      });
    }

    const creditoQ = await pool.query(`
      INSERT INTO prepaid_quiz_credits (
        email,
        nome,
        status,
        gateway,
        affiliate_ref,
        uses_allowed,
        uses_done,
        created_at
      )
      VALUES ($1, $2, 'pending', 'asaas', $3, 1, 0, NOW())
      RETURNING id
    `, [email, nome, ref || null]);

    const creditoId = creditoQ.rows[0].id;

    const callbackBase = normalizeBaseUrl(
      process.env.APP_URL ||
      process.env.CALLBACK_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      "https://api.canvaspiritual.com"
    );
    if (!ref) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return res.status(500).json({
      ok: false,
      erro: "MERCADOPAGO_ACCESS_TOKEN ausente.",
    });
  }

  const preferenceData = {
    items: [{
      id: `prepaid:${creditoId}`,
      title: "Checkup Emocional Pré-pago",
      quantity: 1,
      currency_id: "BRL",
      unit_price: valor,
    }],
    payer: {
      email,
      name: nome || "Cliente",
    },
    back_urls: {
      success: `${callbackBase}/escolher-quiz.html?email=${encodeURIComponent(email)}`,
      failure: `${callbackBase}/landing-prepago.html?fail=1`,
      pending: `${callbackBase}/escolher-quiz.html?email=${encodeURIComponent(email)}`,
    },
    auto_return: "approved",
    external_reference: `prepaid:${creditoId}`,
    metadata: {
      fluxo: "prepaid_quiz",
      prepaid_credit_id: String(creditoId),
      email,
      nome,
      valor_solidario: valor,
    },
  };

  const pref = await new Preference(mpClient).create({ body: preferenceData });
  const preferenceId = pref?.id || pref?.body?.id;

  if (!preferenceId) {
    throw new Error("Mercado Pago criou preferência sem ID.");
  }

  await pool.query(`
    UPDATE prepaid_quiz_credits
    SET gateway = 'mp',
        gateway_payment_id = $1
    WHERE id = $2
  `, [preferenceId, creditoId]);

  return res.json({
    ok: true,
    gateway: "mp",
    credit_id: creditoId,
    preference_id: preferenceId,
    checkout_url: pref.init_point || pref.sandbox_init_point,
  });
}

    const successUrl = `${callbackBase}/escolher-quiz.html`;
    const cancelUrl = `${callbackBase}/landing-prepago.html?cancel=1`;
    const expiredUrl = `${callbackBase}/landing-prepago.html?exp=1`;

    const splits = await buildSplitsByRef(ref, baseSplit);

    if (ref && !splits.length) {
      return res.status(400).json({
        ok: false,
        erro: "Afiliado/ref informado, mas nenhum split válido foi encontrado.",
      });
    }

    const payload = {
      billingTypes: ["PIX", "CREDIT_CARD"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: 90,
      callback: {
        successUrl,
        cancelUrl,
        expiredUrl,
      },
      items: [{
        name: "Checkup Emocional Pré-pago",
        description: `Crédito pré-pago para ${email}`,
        value: valor,
        quantity: 1,
      }],
      externalReference: `prepaid:${creditoId}`,
    };

    if (splits.length) {
      payload.splits = splits;
    }

    const created = await asaas.post("/checkouts", payload);
    const checkoutId = created?.data?.id;

    if (!checkoutId) {
      throw new Error("Checkout Asaas criado sem ID.");
    }

    await pool.query(`
      UPDATE prepaid_quiz_credits
      SET gateway_payment_id = $1
      WHERE id = $2
    `, [checkoutId, creditoId]);

    return res.json({
      ok: true,
      gateway: "asaas",
      credit_id: creditoId,
      checkout_id: checkoutId,
      checkout_url: `${ASAAS_CHECKOUT_VIEW}${encodeURIComponent(checkoutId)}`,
    });

  } catch (err) {
    console.error("[prepaid-checkout/start] erro:", err.response?.data || err.message);

    return res.status(err.statusCode || 500).json({
  ok: false,
  erro:
    err.code === "ASAAS_ENV_MISMATCH" || err.code === "ASAAS_ENV_MISSING"
      ? err.message
      : "Erro ao iniciar checkout pré-pago.",
  code: err.code || "PREPAID_CHECKOUT_ERROR",
  detalhe: err.details || err.response?.data || err.message,
});
  }
});

// POST /api/prepaid-checkout/criar-pix
router.post("/criar-pix", async (req, res) => {
  try {
    const nome = String(req.body?.nome || "Cliente").trim();
    const email = normalizeEmail(req.body?.email);
    const valor = clampValor(req.body?.valor);
const baseSplit = baseComissionavel(valor);
const ref = String(req.body?.ref || req.body?.aff || "").trim();
const cpfCnpj = onlyDigits(req.body?.cpf || req.body?.cpfCnpj);

    if (!email) {
      return res.status(400).json({ ok: false, erro: "Email é obrigatório." });
    }

    if (!ref) {
      return res.status(400).json({ ok: false, erro: "Ref/afiliado é obrigatório para PIX Asaas pré-pago." });
    }

    if (!cpfCnpj) {
      return res.status(400).json({ ok: false, erro: "CPF é obrigatório para gerar PIX Asaas." });
    }

    const splits = await buildSplitsByRef(ref, baseSplit);

    if (!splits.length) {
      return res.status(400).json({
        ok: false,
        erro: "Afiliado/ref informado, mas nenhum split válido foi encontrado.",
      });
    }

    const creditoQ = await pool.query(`
      INSERT INTO prepaid_quiz_credits (
        email,
        nome,
        status,
        gateway,
        affiliate_ref,
        uses_allowed,
        uses_done,
        created_at
      )
      VALUES ($1, $2, 'pending', 'asaas', $3, 1, 0, NOW())
      RETURNING id
    `, [email, nome, ref]);

    const creditoId = creditoQ.rows[0].id;

    const customerId = await getOrCreateCustomer({
      nome,
      email,
      cpfCnpj,
    });

    const paymentPayload = {
      customer: customerId,
      billingType: "PIX",
      value: valor,
      dueDate: dueDateTomorrow(),
      description: `Checkup Emocional Pré-pago - ${email}`,
      externalReference: `prepaid:${creditoId}`,
      split: splits,
    };

    const paymentResp = await asaas.post("/payments", paymentPayload);
    const payment = paymentResp.data || {};
    const paymentId = payment.id;

    if (!paymentId) {
      throw new Error("Cobrança Asaas criada sem ID.");
    }

    await pool.query(`
      UPDATE prepaid_quiz_credits
      SET gateway_payment_id = $1
      WHERE id = $2
    `, [paymentId, creditoId]);

    const qrResp = await asaas.get(`/payments/${paymentId}/pixQrCode`);
    const qr = qrResp.data || {};

    return res.json({
      ok: true,
      gateway: "asaas",
      credit_id: creditoId,
      payment_id: paymentId,
      valor_final: valor,
      qr_code: qr.payload || qr.qrCode || null,
      qr_code_base64: qr.encodedImage || qr.qrCodeBase64 || null,
      invoice_url: payment.invoiceUrl || null,
    });

  } catch (err) {
    console.error("[prepaid-checkout/criar-pix] erro:", err.response?.data || err.message);

    return res.status(err.statusCode || 500).json({
  ok: false,
  erro:
    err.code === "ASAAS_ENV_MISMATCH" || err.code === "ASAAS_ENV_MISSING"
      ? err.message
      : "Erro ao gerar PIX Asaas pré-pago.",
  code: err.code || "PREPAID_PIX_ERROR",
  detalhe: err.details || err.response?.data || err.message,
});
  }
});
// GET /api/prepaid-checkout/status/:creditId
router.get("/status/:creditId", async (req, res) => {
  try {
    const creditId = String(req.params.creditId || "").trim();

    if (!creditId) {
      return res.status(400).json({
        ok: false,
        erro: "creditId obrigatório.",
      });
    }

    const q = await pool.query(`
      SELECT id, email, status, uses_done, uses_allowed
      FROM prepaid_quiz_credits
      WHERE id = $1
      LIMIT 1
    `, [creditId]);

    if (!q.rowCount) {
      return res.status(404).json({
        ok: false,
        erro: "Crédito não encontrado.",
      });
    }

    const c = q.rows[0];

    return res.json({
      ok: true,
      paid: c.status === "paid",
      status: c.status,
      email: c.email,
      used: Number(c.uses_done || 0) >= Number(c.uses_allowed || 1),
    });

  } catch (err) {
    console.error("[prepaid-checkout/status] erro:", err.message);

    return res.status(500).json({
      ok: false,
      erro: "Erro ao consultar crédito.",
    });
  }
});
module.exports = router;