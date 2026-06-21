const express = require("express");
const axios = require("axios");
const pool = require("../db");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const router = express.Router();

const IS_PROD =
  String(process.env.ASAAS_ENV || "sandbox").toLowerCase() === "production";

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
async function buildSplitsByRef(ref) {
  const code = String(ref || "").trim();
  if (!code) return [];

  const linkQ = await pool.query(`
    SELECT
      al.pct_aff,
      al.pct_vendor,
      al.pct_supervisor,
      a.asaas_wallet_id AS aff_wallet,
      v.asaas_wallet_id AS vend_wallet,
      s.asaas_wallet_id AS sup_wallet
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

    const splits = [];

    const A = clampPct(r.pct_aff || 0);
    const V = clampPct(r.pct_vendor || 0);
    const S = clampPct(r.pct_supervisor || 0);

    if (A > 0 && r.aff_wallet) {
      splits.push({ walletId: r.aff_wallet, percentageValue: A });
    }

    if (V > 0 && r.vend_wallet) {
      splits.push({ walletId: r.vend_wallet, percentageValue: V });
    }

    if (S > 0 && r.sup_wallet) {
      splits.push({ walletId: r.sup_wallet, percentageValue: S });
    }

    return splits;
  }

  const affQ = await pool.query(`
    SELECT
      asaas_wallet_id,
      commission_percent
    FROM affiliates
    WHERE id::text = $1
    LIMIT 1
  `, [code]);

  if (affQ.rowCount && affQ.rows[0].asaas_wallet_id) {
    const pct = clampPct(affQ.rows[0].commission_percent || 30);

    if (pct > 0) {
      return [{
        walletId: affQ.rows[0].asaas_wallet_id,
        percentageValue: pct,
      }];
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

    const splits = await buildSplitsByRef(ref);

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

    return res.status(500).json({
      ok: false,
      erro: "Erro ao iniciar checkout pré-pago.",
      detalhe: err.response?.data || err.message,
    });
  }
});

// POST /api/prepaid-checkout/criar-pix
router.post("/criar-pix", async (req, res) => {
  try {
    const nome = String(req.body?.nome || "Cliente").trim();
    const email = normalizeEmail(req.body?.email);
    const valor = clampValor(req.body?.valor);
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

    const splits = await buildSplitsByRef(ref);

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
      split: splits.map(s => ({
        walletId: s.walletId,
        percentualValue: s.percentageValue,
      })),
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

    return res.status(500).json({
      ok: false,
      erro: "Erro ao gerar PIX Asaas pré-pago.",
      detalhe: err.response?.data || err.message,
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