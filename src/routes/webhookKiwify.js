const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

function nowISO() {
  return new Date().toISOString();
}

function safeJsonParse(buf) {
  try {
    // buf pode ser Buffer (express.raw) ou string
    if (Buffer.isBuffer(buf)) return JSON.parse(buf.toString("utf8"));
    if (typeof buf === "string") return JSON.parse(buf);
    // se por algum motivo já vier objeto
    if (buf && typeof buf === "object") return buf;
    return null;
  } catch {
    return null;
  }
}

function normalizeEmail(v) {
  return (v || "").toString().trim().toLowerCase();
}

function maskToken(t) {
  const s = (t || "").toString();
  if (!s) return "";
  if (s.length <= 6) return "***";
  return s.slice(0, 3) + "***" + s.slice(-3);
}

// Token pode vir em header OU query OU body (Kiwify varia conforme o tipo de teste)
function getIncomingToken(req, payload) {
  const headerToken =
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    "";

  const queryToken = (req.query?.token || req.query?.webhook_token || "").toString();

  const bodyToken =
    (payload?.token || payload?.webhook_token || payload?.secret || "").toString();

  // normaliza "Bearer xxxxx"
  const clean = (v) => String(v || "").trim().replace(/^bearer\s+/i, "");

  return {
    header: clean(headerToken),
    query: clean(queryToken),
    body: clean(bodyToken),
  };
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

// ✅ ping para confirmar que a rota existe (vai funcionar quando montar com app.use("/webhooks/kiwify"...))
router.get("/ping", (req, res) => {
  console.log(`[kiwify] PING HIT ${nowISO()}`);
  res.status(200).send("ok");
});

// POST /webhooks/kiwify  (porque no servidor.js você monta em /webhooks/kiwify)
router.post("/", async (req, res) => {
  // Como você usa express.raw, req.body geralmente é Buffer
  const payload = safeJsonParse(req.body);

  console.log("[kiwify] HIT", {
    at: nowISO(),
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers["content-type"],
    hasBody: !!req.body,
    bodyType: Buffer.isBuffer(req.body) ? "buffer" : typeof req.body,
    query: req.query || {},
  });

  if (!payload) {
    console.log("[kiwify] invalid_json");
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // 0) Validação do token (se existir no env)
  if (KIWIFY_WEBHOOK_TOKEN) {
    const tokens = getIncomingToken(req, payload);

    const incoming =
      tokens.header || tokens.query || tokens.body || "";

    if (!incoming) {
      console.log("[kiwify] token ausente (header/query/body)", {
        header: maskToken(tokens.header),
        query: maskToken(tokens.query),
        body: maskToken(tokens.body),
      });
      return res.status(401).json({ ok: false, error: "missing_webhook_token" });
    }

    if (incoming !== KIWIFY_WEBHOOK_TOKEN) {
      console.log("[kiwify] token inválido", {
        incoming: maskToken(incoming),
      });
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

  console.log("[kiwify] parsed", {
    eventName,
    eventId: eventId ? String(eventId) : null,
    orderId: orderId ? String(orderId) : null,
    email: email || null,
    status: String(status),
    paid,
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
      console.log("[kiwify] kiwify_events OK");
    } else {
      console.log("[kiwify] sem eventId (não gravou kiwify_events)");
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
      console.log("[kiwify] purchases OK");
    } else {
      console.log("[kiwify] sem orderId (não gravou purchases)");
    }

    // 3) Atualiza sua base: leads_precheckout -> pago=true
    if (paid && email) {
      const r = await pool.query(
        `UPDATE leads_precheckout
         SET pago = TRUE,
             pago_em = COALESCE(pago_em, NOW())
         WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      console.log("[kiwify] leads_precheckout UPDATE", {
        rowCount: r.rowCount,
      });
    } else {
      console.log("[kiwify] não atualizou leads_precheckout", { paid, email: email || null });
    }

    // 4) Atualiza Brevo
    if (email) {
      try {
        await brevoUpsertPaidContact({ email, name, phone, paid });
        console.log("[kiwify] brevo upsert OK");
      } catch (e) {
        console.log("[kiwify] brevo falhou", e?.response?.data || e.message);
      }
    } else {
      console.log("[kiwify] sem email (não chamou brevo)");
    }

    return res.json({ ok: true });
  } catch (e) {
    // Isso aqui vai mostrar claramente se o problema é “tabela não existe”, constraint errada, etc.
    console.error("[webhook kiwify] DB error:", {
      message: e.message,
      code: e.code,          // <- MUITO IMPORTANTE (Postgres)
      detail: e.detail,
      table: e.table,
      constraint: e.constraint,
    });
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

module.exports = router;
