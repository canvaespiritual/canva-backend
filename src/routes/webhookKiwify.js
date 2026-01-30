const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(buf) {
  try {
    // express.raw => Buffer
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

function normalizeEmail(v) {
  return (v || "").toString().trim().toLowerCase();
}

// Token pode vir em header OU query OU body (varia por plataforma/config)
function getIncomingToken(req, payload) {
  const headerToken =
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    "";

  const queryToken = req.query?.token || "";

  // muitos provedores mandam token dentro do JSON
  const bodyToken =
    payload?.token ||
    payload?.webhook_token ||
    payload?.webhookToken ||
    payload?.kiwify_token ||
    "";

  const pick = (v) => (v || "").toString().trim();

  return {
    header: pick(headerToken),
    query: pick(queryToken),
    body: pick(bodyToken),
  };
}

function cleanBearer(v) {
  return (v || "").toString().trim().replace(/^bearer\s+/i, "");
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
    e.includes("paid") ||
    e.includes("approved") ||
    e.includes("completed")
  ) return true;

  if (["paid", "approved", "completed", "aprovado", "pago"].includes(s)) return true;

  return false;
}

// ✅ rota de diagnóstico
router.get("/ping", (req, res) => {
  console.log(`[kiwify] PING HIT ${nowIso()}`, {
    path: req.originalUrl,
    ip: req.ip,
  });
  res.status(200).json({ ok: true, pong: true, at: nowIso() });
});

router.post("/", async (req, res) => {
  const at = nowIso();

  // === LOG BÁSICO DO HIT (antes de qualquer coisa)
  console.log("[kiwify] HIT", {
    at,
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers["content-type"] || null,
    hasBody: !!req.body,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
    bodySize: Buffer.isBuffer(req.body) ? req.body.length : null,
    query: req.query || {},
    headers: {
      // só os relevantes, pra não vazar tudo
      "x-kiwify-token": req.headers["x-kiwify-token"] || "",
      "x-webhook-token": req.headers["x-webhook-token"] || "",
      "authorization": req.headers["authorization"] || "",
      "user-agent": req.headers["user-agent"] || "",
    },
  });

  // express.raw => Buffer
  const payload = safeJsonParse(req.body);

  if (!payload) {
    console.log("[kiwify] invalid_json");
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // === LOG DO PAYLOAD (resumido)
  console.log("[kiwify] payload keys", {
    at,
    keys: Object.keys(payload || {}),
    sample: {
      event: payload?.event || payload?.type || payload?.name || null,
      status: payload?.status || payload?.order?.status || payload?.payment_status || null,
      email: payload?.customer?.email || payload?.email || null,
    },
  });

  // 0) Validação do token (se existir env)
  if (KIWIFY_WEBHOOK_TOKEN) {
    const t = getIncomingToken(req, payload);

    const headerClean = cleanBearer(t.header);
    const queryClean = cleanBearer(t.query);
    const bodyClean = cleanBearer(t.body);

    const incoming = headerClean || queryClean || bodyClean;

    if (!incoming) {
      console.log("[kiwify] token ausente (header/query/body)", {
        at,
        header: t.header ? "PRESENTE" : "",
        query: t.query ? "PRESENTE" : "",
        body: t.body ? "PRESENTE" : "",
        queryObj: req.query || {},
      });
      return res.status(401).json({ ok: false, error: "missing_webhook_token" });
    }

    if (incoming !== KIWIFY_WEBHOOK_TOKEN) {
      console.log("[kiwify] token inválido", {
        at,
        incomingMasked: incoming.slice(0, 4) + "..." + incoming.slice(-3),
      });
      return res.status(401).json({ ok: false, error: "invalid_webhook_token" });
    }
  }

  // Campos genéricos
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

  console.log("[kiwify] parsed", {
    at,
    eventName,
    eventId,
    orderId,
    status,
    paid,
    email,
  });

  try {
    // 1) Log de evento (idempotência por event_id)
    if (eventId) {
      await pool.query(
        `INSERT INTO kiwify_events (event_id, event_name, payload)
         VALUES ($1,$2,$3)
         ON CONFLICT (event_id) DO NOTHING`,
        [String(eventId), String(eventName), payload]
      );
      console.log("[kiwify] kiwify_events inserted/ignored", { at, eventId });
    } else {
      console.log("[kiwify] sem eventId -> não gravou kiwify_events", { at });
    }

    // 2) Upsert compra (precisa UNIQUE (provider, order_id) no banco!)
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
      console.log("[kiwify] purchases upsert OK", { at, orderId });
    } else {
      console.log("[kiwify] sem orderId -> não gravou purchases", { at });
    }

    // 3) Atualiza leads_precheckout
    if (paid && email) {
      const r = await pool.query(
        `UPDATE leads_precheckout
           SET pago = TRUE,
               pago_em = COALESCE(pago_em, NOW())
         WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      console.log("[kiwify] leads_precheckout updated", { at, email, rowCount: r.rowCount });
    }

    // 4) Atualiza Brevo
    if (email) {
      try {
        await brevoUpsertPaidContact({ email, name, phone, paid });
        console.log("[kiwify] brevo upsert OK", { at, email, paid });
      } catch (e) {
        console.log("[kiwify] brevo FAIL", { at, err: e?.response?.data || e.message });
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    const msg = e?.response?.data || e?.message || String(e);
    console.error("[webhook kiwify] error:", msg);

    // 🔥 dica automática quando o problema é constraint do ON CONFLICT
    if (String(msg).toLowerCase().includes("there is no unique") ||
        String(msg).toLowerCase().includes("no unique") ||
        String(msg).toLowerCase().includes("constraint")) {
      console.error("[kiwify] DICA: falta UNIQUE (provider, order_id) na tabela purchases.");
    }

    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
