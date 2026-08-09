
const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;
const {
  notificarCentral,
} = require("../utils/notificarCentral");

function safeJsonParse(buf) {
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

function normalizeEmail(v) {
  return (v || "").toString().trim().toLowerCase();
}

function getIncomingToken(req) {
  return (
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    req.query?.token ||        // ✅ token na URL
    req.query?.signature ||    // ✅ fallback (testes)
    ""
  ).toString().trim();
}

async function brevoUpsertPaidContact({ email, name, phone, paid }) {
  if (!BREVO_API_KEY || !email) return;

  const body = {
    email,
    attributes: {
      NOME: name || "",
      TELEFONE: phone || "",
      PAGO: !!paid,
    },
    listIds: paid ? [LIST_CLIENTES] : [LIST_PRECHECKOUT],
    updateEnabled: true,
  };

  await axios.post("https://api.brevo.com/v3/contacts", body, {
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    timeout: 8000,
  });
}

function isPaidEvent({ eventName, status }) {
  const e = String(eventName || "").toLowerCase();
  const s = String(status || "").toLowerCase();

  if (
    e.includes("compra_aprovada") ||
    e.includes("purchase_approved") ||
    e.includes("approved") ||
    e.includes("paid") ||
    e.includes("completed")
  ) return true;

  if (["paid", "approved", "completed", "aprovado", "pago"].includes(s)) return true;

  return false;
}

router.post("/", async (req, res) => {
  const now = new Date().toISOString();

  console.log("[kiwify] HIT", {
    at: now,
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers["content-type"],
    hasBody: !!req.body,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
    bodySize: Buffer.isBuffer(req.body) ? req.body.length : undefined,
    query: req.query,
    headers: {
      "x-kiwify-token": req.headers["x-kiwify-token"] || "",
      "x-webhook-token": req.headers["x-webhook-token"] || "",
      authorization: req.headers["authorization"] || "",
    },
  });

  const payload = safeJsonParse(req.body);
  if (!payload) {
    console.log("[kiwify] invalid_json");
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  console.log("[kiwify] payload keys", {
    at: now,
    keys: Object.keys(payload || {}),
    sample: {
      webhook_event_type: payload?.webhook_event_type || null,
      order_status: payload?.order_status || null,
      email: payload?.Customer?.email || payload?.customer?.email || null,
    },
  });

  // 0) Validação do token (se setado no Railway)
  if (KIWIFY_WEBHOOK_TOKEN) {
    const incomingToken = getIncomingToken(req);
    const tokenClean = incomingToken.replace(/^bearer\s+/i, "");

    if (!tokenClean) {
      console.log("[kiwify] token ausente (header/query/body)", {
        at: now,
        header:
          (req.headers["x-kiwify-token"] || req.headers["x-webhook-token"] || req.headers["authorization"] || "").toString(),
        query: (req.query?.token || "").toString(),
        signature: (req.query?.signature || "").toString(),
      });
      return res.status(401).json({ ok: false, error: "missing_webhook_token" });
    }

    if (tokenClean !== KIWIFY_WEBHOOK_TOKEN) {
      console.log("[kiwify] token inválido", { at: now, tokenClean });
      return res.status(401).json({ ok: false, error: "invalid_webhook_token" });
    }
  }

  // Campos reais (Kiwify)
  const eventName =
    payload?.webhook_event_type ||
    payload?.event ||
    payload?.type ||
    payload?.name ||
    "unknown";

  const eventId =
  payload?.id ||
  payload?.event_id ||
  payload?.eventId ||
  (req.query?.signature ? String(req.query.signature) : null) ||
  null;


  const email = normalizeEmail(
    payload?.Customer?.email ||
    payload?.customer?.email ||
    payload?.email
  );

  const name =
    payload?.Customer?.full_name ||
    payload?.Customer?.name ||
    payload?.customer?.name ||
    payload?.name ||
    null;

 const phone =
  payload?.Customer?.mobile ||
  payload?.Customer?.phone ||
  payload?.customer?.mobile ||
  payload?.customer?.phone ||
  payload?.phone ||
  null;

  const orderId =
    payload?.order_id ||
    payload?.order?.id ||
    payload?.transaction_id ||
    payload?.purchase_id ||
    payload?.id ||
    null;

  const status =
    payload?.order_status ||
    payload?.status ||
    payload?.order?.status ||
    payload?.payment_status ||
    payload?.payment?.status ||
    "unknown";

  const paid = isPaidEvent({ eventName, status });

  console.log("[kiwify] parsed", {
    at: now,
    eventName,
    eventId,
    orderId,
    status,
    paid,
    email,
  });
const statusForDatabase =
  status &&
  String(status).toLowerCase() !== "unknown"
    ? String(status)
    : null;
  try {
    // 1) Log de evento
    if (eventId) {
      await pool.query(
        `INSERT INTO kiwify_events (event_id, event_name, payload)
         VALUES ($1,$2,$3)
         ON CONFLICT (event_id) DO NOTHING`,
        [String(eventId), String(eventName), payload]
      );
      console.log("[kiwify] kiwify_events inserted/ignored", { eventId });
    } else {
      console.log("[kiwify] eventId ausente, pulando kiwify_events");
    }

    // 2) Upsert compra
    if (orderId) {
      await pool.query(
        `INSERT INTO purchases (provider, order_id, email, status, payload)
         VALUES ('kiwify', $1, $2, $3, $4)
         ON CONFLICT (provider, order_id)
         DO UPDATE SET
           status = EXCLUDED.status,
           email  = COALESCE(EXCLUDED.email, purchases.email),
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [String(orderId), email || null, String(status), payload]
      );
      console.log("[kiwify] purchases upsert ok", { orderId });
    } else {
      console.log("[kiwify] orderId ausente, pulando purchases");
    }

    // 3) Marca lead como pago
    // 3) Atualiza o lead com os dados recebidos da Kiwify
let updatedLead = null;

if (email) {
  const result = await pool.query(
    `
    UPDATE leads_precheckout

    SET
      kiwify_order_id = COALESCE(
        $2,
        kiwify_order_id
      ),

      kiwify_status = COALESCE(
        $3,
        kiwify_status
      ),

      pago = CASE
        WHEN $4::boolean IS TRUE
          THEN TRUE
        ELSE pago
      END,

      pago_em = CASE
        WHEN $4::boolean IS TRUE
          THEN COALESCE(
            pago_em,
            NOW()
          )
        ELSE pago_em
      END,

      paid_at = CASE
        WHEN $4::boolean IS TRUE
          THEN COALESCE(
            paid_at,
            NOW()
          )
        ELSE paid_at
      END,

      updated_at = NOW()

    WHERE LOWER(email) = LOWER($1)

    RETURNING *
    `,
    [
      email,
      orderId
        ? String(orderId)
        : null,
      statusForDatabase,
      paid,
    ],
  );

  updatedLead =
    result.rows[0] || null;

  console.log(
    "[kiwify] leads_precheckout atualizado",
    {
      email,
      rows: result.rowCount,
      paid,
      orderId,
      status,
    },
  );

  if (updatedLead) {
    void notificarCentral({
      eventType: paid
        ? "payment_approved"
        : "status_changed",

      source: "kiwify_webhook",

      checkoutLeadId:
        updatedLead.id,

      /*
       * Impede que o reenvio do mesmo webhook
       * gere notificações duplicadas.
       */
      externalEventId:
        eventId
          ? String(eventId)
          : null,

      providerEvent: {
        eventName:
          String(eventName),
        eventId:
          eventId
            ? String(eventId)
            : null,
      },

      customer: {
        name:
          updatedLead.name ||
          name ||
          "",

        email:
          updatedLead.email ||
          email,

        phone:
          updatedLead.phone ||
          phone ||
          "",
      },

      checkout: {
        status:
          updatedLead.status,

        paid:
          updatedLead.pago === true,

        kiwifyOrderId:
          updatedLead
            .kiwify_order_id ||
          null,

        kiwifyStatus:
          updatedLead
            .kiwify_status ||
          null,

        paidAt:
          updatedLead.pago_em ||
          updatedLead.paid_at ||
          null,

        createdAt:
          updatedLead.created_at,

        updatedAt:
          updatedLead.updated_at,
      },

      tracking: {
        source:
          updatedLead.utm_source,

        medium:
          updatedLead.utm_medium,

        campaignId:
          updatedLead.utm_campaign,

        adId:
          updatedLead.utm_content,

        adsetId:
          updatedLead.utm_term,

        pageUrl:
          updatedLead.page_url,

        referrer:
          updatedLead.referrer,
      },
    });
  }
} else {
  console.log(
    "[kiwify] email ausente; lead não atualizado",
    {
      eventName,
      eventId,
      orderId,
      status,
      paid,
    },
  );
}
// 4) Registra venda aprovada no financeiro
if (paid && updatedLead && orderId) {
  const commissions = payload?.Commissions || {};
  const product = payload?.Product || {};

  const grossAmount =
    commissions?.charge_amount != null
      ? Number(commissions.charge_amount) / 100
      : null;

  const netAmount =
    commissions?.my_commission != null
      ? Number(commissions.my_commission) / 100
      : null;

  const kiwifyFee =
    commissions?.kiwify_fee != null
      ? Number(commissions.kiwify_fee) / 100
      : null;

  const installments =
    payload?.installments != null
      ? Number(payload.installments)
      : 1;

  const checkoutUrl =
    payload?.checkout_link
      ? `https://pay.kiwify.com.br/${payload.checkout_link}`
      : null;

  await pool.query(
    `
      INSERT INTO checkout_sales (
        checkout_lead_id,
        source,
        status,

        gross_amount,
        net_amount,
        currency,

        payment_method,
        installments,
        sale_date,

        kiwify_order_id,
        kiwify_order_ref,
        kiwify_fee,

        product_id,
        product_name,

        checkout_url,
        access_url,

        raw_payload
      )
      VALUES (
        $1,
        'kiwify',
        'paid',

        $2,
        $3,
        $4,

        $5,
        $6,
        COALESCE(
          $7::timestamp AT TIME ZONE 'America/Sao_Paulo',
          NOW()
        ),

        $8,
        $9,
        $10,

        $11,
        $12,

        $13,
        $14,

        $15
      )

      ON CONFLICT (kiwify_order_id)
      WHERE kiwify_order_id IS NOT NULL

      DO UPDATE SET
        status = EXCLUDED.status,
        gross_amount = EXCLUDED.gross_amount,
        net_amount = EXCLUDED.net_amount,
        currency = EXCLUDED.currency,
        payment_method = EXCLUDED.payment_method,
        installments = EXCLUDED.installments,
        kiwify_fee = EXCLUDED.kiwify_fee,
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        checkout_url = EXCLUDED.checkout_url,
        access_url = EXCLUDED.access_url,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `,
    [
      updatedLead.id,
      grossAmount,
      netAmount,
      commissions?.currency || "BRL",
      payload?.payment_method || null,
      installments,
      payload?.approved_date || null,
      String(orderId),
      payload?.order_ref || null,
      kiwifyFee,
      product?.product_id || null,
      product?.product_name || null,
      checkoutUrl,
      payload?.access_url || null,
      payload
    ]
  );

  console.log("[kiwify] checkout_sales upsert ok", {
    orderId,
    checkoutLeadId: updatedLead.id,
    grossAmount,
    netAmount,
    paymentMethod: payload?.payment_method || null,
    installments
  });
}
    // 5) Brevo
    if (email) {
      await brevoUpsertPaidContact({ email, name, phone, paid });
      console.log("[kiwify] brevo upsert ok", { email, paid });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[webhook kiwify] error:", e?.response?.data || e.message);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
