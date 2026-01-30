const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

function normalizeEmail(v) {
  return (v || "").toString().trim().toLowerCase();
}

// ✅ aceita Buffer OU objeto
function parsePayload(body) {
  if (!body) return null;

  // se já veio como objeto (porque algum parser mexeu), retorna
  if (typeof body === "object" && !Buffer.isBuffer(body)) return body;

  // se veio raw buffer
  if (Buffer.isBuffer(body)) {
    const txt = body.toString("utf8");
    try {
      return JSON.parse(txt);
    } catch {
      return { _raw: txt }; // não perde o conteúdo
    }
  }

  // fallback
  try {
    return JSON.parse(String(body));
  } catch {
    return null;
  }
}

function getIncomingToken(req) {
  return (
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    req.query?.token ||
    ""
  ).toString().trim();
}

function isPaidEvent({ eventName, status }) {
  const e = String(eventName || "").toLowerCase();
  const s = String(status || "").toLowerCase();

  if (
    e.includes("compra_aprovada") ||
    e.includes("purchase_approved") ||
    e.includes("paid") ||
    e.includes("approved") ||
    e.includes("completed")
  ) return true;

  if (["paid", "approved", "completed", "aprovado", "pago"].includes(s)) return true;

  return false;
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

router.post("/", async (req, res) => {
  // ✅ LOG IMPOSSÍVEL DE NÃO APARECER
  console.log("[kiwify] HIT", {
    at: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    contentType: req.headers["content-type"],
    hasBody: !!req.body,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
  });

  const payload = parsePayload(req.body);

  if (!payload) {
    console.log("[kiwify] invalid payload (null)");
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  // ✅ valida token
  if (KIWIFY_WEBHOOK_TOKEN) {
    const incoming = getIncomingToken(req).replace(/^bearer\s+/i, "");
    if (incoming !== KIWIFY_WEBHOOK_TOKEN) {
      console.log("[kiwify] token inválido", { incoming });
      return res.status(401).json({ ok: false, error: "invalid_webhook_token" });
    }
  }

  const eventName = payload?.event || payload?.type || payload?.name || "unknown";
  const eventId   = payload?.id || payload?.event_id || payload?.eventId || null;

  const email = normalizeEmail(payload?.customer?.email || payload?.email);
  const name  = payload?.customer?.name || payload?.name || null;
  const phone = payload?.customer?.phone || payload?.phone || null;

  const orderId =
    payload?.order_id ||
    payload?.order?.id ||
    payload?.transaction_id ||
    payload?.purchase_id ||
    payload?.id ||
    null;

  const status =
    payload?.status ||
    payload?.order?.status ||
    payload?.payment_status ||
    payload?.payment?.status ||
    "unknown";

  const paid = isPaidEvent({ eventName, status });

  console.log("[kiwify] parsed", { eventName, eventId, orderId, status, email, paid });

  try {
    // 1) evento
    if (eventId) {
      await pool.query(
        `INSERT INTO kiwify_events (event_id, event_name, payload)
         VALUES ($1,$2,$3)
         ON CONFLICT (event_id) DO NOTHING`,
        [String(eventId), String(eventName), payload]
      );
    }

    // 2) purchases
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
    }

    // 3) marca lead como pago (se existir)
    if (paid && email) {
      const r = await pool.query(
        `UPDATE leads_precheckout
         SET pago = TRUE,
             pago_em = COALESCE(pago_em, NOW())
         WHERE LOWER(email) = LOWER($1)
         RETURNING email`,
        [email]
      );
      console.log("[kiwify] leads updated", { count: r.rowCount });
    }

    // 4) brevo
    if (email) {
      await brevoUpsertPaidContact({ email, name, phone, paid });
      console.log("[kiwify] brevo ok");
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[kiwify] ERROR:", e?.response?.data || e.message);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
