const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN;

const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

// ========= helpers =========
function safeJsonParse(buf) {
  try {
    // req.body vem como Buffer (express.raw)
    if (Buffer.isBuffer(buf)) return JSON.parse(buf.toString("utf8"));
    // fallback (caso alguém mude middleware)
    if (typeof buf === "string") return JSON.parse(buf);
    if (typeof buf === "object" && buf) return buf;
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
  if (s.length <= 6) return "***";
  return s.slice(0, 3) + "***" + s.slice(-3);
}

// Token pode vir em header OU query (varia por plataforma/config)
function getIncomingToken(req) {
  return (
    req.headers["x-kiwify-token"] ||
    req.headers["x-webhook-token"] ||
    req.headers["authorization"] ||
    req.query?.token ||
    ""
  )
    .toString()
    .trim();
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

  // nomes comuns de evento
  if (
    e.includes("compra_aprovada") ||
    e.includes("purchase_approved") ||
    e.includes("compra_aprov") ||
    e.includes("paid") ||
    e.includes("approved") ||
    e.includes("completed")
  ) {
    return true;
  }

  // status comuns
  if (["paid", "approved", "completed", "aprovado", "pago"].includes(s)) {
    return true;
  }

  return false;
}

// tenta extrair info de produto (não quebra se não existir)
function extractProduct(payload) {
  const productId =
    payload?.product?.id ||
    payload?.product_id ||
    payload?.offer?.product_id ||
    payload?.order?.product_id ||
    payload?.order?.product?.id ||
    null;

  const productName =
    payload?.product?.name ||
    payload?.product_name ||
    payload?.offer?.name ||
    payload?.order?.product?.name ||
    null;

  return { productId, productName };
}

// ========= route =========
router.post("/", async (req, res) => {
  // logs iniciais (debug)
  console.log("[kiwify] webhook hit:", {
    path: req.originalUrl,
    method: req.method,
    contentType: req.headers["content-type"],
  });

  // body parse
  const payload = safeJsonParse(req.body);

  if (!payload) {
    console.log("[kiwify] invalid_json bodyType:", typeof req.body, "isBuffer:", Buffer.isBuffer(req.body));
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  // log reduzido do que chegou (sem vazar payload gigante)
  console.log("[kiwify] incoming meta:", {
    query: req.query,
    hasAuth: !!req.headers["authorization"],
    hasXToken: !!req.headers["x-kiwify-token"] || !!req.headers["x-webhook-token"],
    payloadKeys: Object.keys(payload || {}).slice(0, 30),
  });

  // 0) Validação do token (se existir no env)
  if (KIWIFY_WEBHOOK_TOKEN) {
    const incomingToken = getIncomingToken(req);
    const tokenClean = incomingToken.replace(/^bearer\s+/i, "");

    if (tokenClean !== KIWIFY_WEBHOOK_TOKEN) {
      console.log("[kiwify] token inválido:", {
        received: maskToken(tokenClean),
        expected: maskToken(KIWIFY_WEBHOOK_TOKEN),
        headerAuth: !!req.headers["authorization"],
        headerX: !!req.headers["x-kiwify-token"] || !!req.headers["x-webhook-token"],
        queryToken: !!req.query?.token,
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
  const { productId, productName } = extractProduct(payload);

  console.log("[kiwify] parsed:", {
    eventName,
    eventId: eventId ? String(eventId).slice(0, 18) : null,
    orderId: orderId ? String(orderId).slice(0, 18) : null,
    status,
    paid,
    email: email ? email.replace(/(.{2}).+(@.*)/, "$1***$2") : null,
    productId,
    productName,
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
    }

    // 2) Upsert compra (idempotência por provider+order_id)
    // ⚠️ Isso exige que exista UNIQUE(provider, order_id) na tabela purchases
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
    if (paid && email) {
      const r = await pool.query(
        `UPDATE leads_precheckout
         SET pago = TRUE,
             pago_em = COALESCE(pago_em, NOW())
         WHERE LOWER(email) = LOWER($1)
         RETURNING id, email, pago, pago_em`,
        [email]
      );

      console.log("[kiwify] leads_precheckout updated rows:", r.rowCount, r.rows?.[0] || null);
    }

    // 4) Atualiza Brevo
    if (email) {
      await brevoUpsertPaidContact({ email, name, phone, paid });
      console.log("[kiwify] brevo upsert ok:", { email: email.replace(/(.{2}).+(@.*)/, "$1***$2"), paid });
    }

    return res.json({ ok: true });
  } catch (e) {
    // logs melhores do Postgres + Axios
    console.error("[webhook kiwify] error:", {
      message: e.message,
      code: e.code,
      detail: e.detail,
      constraint: e.constraint,
      table: e.table,
      schema: e.schema,
      where: e.where,
      hint: e.hint,
      axios: e?.response?.data || null,
    });

    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

module.exports = router;
