const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

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

// Token pode vir em header OU query (varia por plataforma/config)
// Mantive bem tolerante pra não travar.
function getIncomingToken(req) {
  return (
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    req.query?.token ||
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
    // Obs: se você quiser "tirar" da lista 8 e colocar só na 9,
    // Brevo geralmente mantém o contato nas listas anteriores.
    // Se quiser remover, precisa chamada extra de remove-from-list.
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

  // Aceita vários nomes comuns (você pode ajustar depois que testar o payload real)
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

router.post("/", async (req, res) => {
  // Como você usa express.raw, req.body é Buffer
  const payload = safeJsonParse(req.body);

  if (!payload) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // 0) Validação do token (se você quiser obrigar)
  // Se não bater, recusa (isso evita webhook falso).
  if (KIWIFY_WEBHOOK_TOKEN) {
    const incomingToken = getIncomingToken(req);

    // Se o token vier como "Bearer xxxxx", normaliza
    const tokenClean = incomingToken.replace(/^bearer\s+/i, "");

    if (tokenClean !== KIWIFY_WEBHOOK_TOKEN) {
      return res.status(401).json({ ok: false, error: "invalid_webhook_token" });
    }
  }

  // Campos genéricos (ajuste fino depois com payload real)
  const eventName = payload?.event || payload?.type || payload?.name || "unknown";
  const eventId = payload?.id || payload?.event_id || payload?.eventId || null;

  const email = normalizeEmail(payload?.customer?.email || payload?.email);
  const name = payload?.customer?.name || payload?.name || null;
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

  try {
    // 1) Log de evento (idempotência por event_id)
    if (eventId) {
      await pool.query(
        `INSERT INTO kiwify_events (event_id, event_name, payload)
         VALUES ($1,$2,$3)
         ON CONFLICT (event_id) DO NOTHING`,
        [String(eventId), String(eventName), payload]
      );
    }

    // 2) Upsert compra (idempotência por provider+order_id)
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

    // 3) Atualiza sua base: leads_precheckout -> pago=true
    // Só faz isso quando tiver email + paid.
    if (paid && email) {
      await pool.query(
        `UPDATE leads_precheckout
         SET pago = TRUE,
             pago_em = COALESCE(pago_em, NOW())
         WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
    }

    // 4) Atualiza Brevo
    if (email) {
      await brevoUpsertPaidContact({ email, name, phone, paid });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[webhook kiwify] error:", e?.response?.data || e.message);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
