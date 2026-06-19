const express = require("express");
const axios = require("axios");
const pool = require("../db");

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

module.exports = router;