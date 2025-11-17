// src/routes/stripeWebhook.js
const Stripe = require("stripe");
const pool = require("../db");
const filaRelatorios = require("../queue/filaRelatorios");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// mesmo mapeamento canônico que você usa no MP
function canonicalTipo(tipo = "") {
  const t = String(tipo).toLowerCase();
  if (t === "intermediario" || t === "premium") return "premium";
  if (t === "completo" || t === "interdimensional") return "completo";
  return "essencial";
}

// ⚠️ Exporta UMA FUNÇÃO (handler) — NÃO use express.Router() aqui
module.exports = async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET_LIVE;

  let event;
  try {
    // req.body é Buffer porque usamos express.raw na rota
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const sessionId = session?.metadata?.session_id;
      const tipoCanon = canonicalTipo(session?.metadata?.tipo_relatorio);
      const amountTotal = (session?.amount_total ?? session?.amount_subtotal ?? 0) / 100;
      const currency = (session?.currency || "usd").toLowerCase();
      const paymentIntentId = session?.payment_intent || null;

      if (!sessionId) {
        console.warn("⚠️ checkout.session.completed sem metadata.session_id");
        return res.json({ received: true });
      }

      await pool.query(
        `UPDATE diagnosticos
           SET status_pagamento = 'pago',
               tipo_pagamento   = 'card',
               data_pagamento   = NOW(),
               payment_id       = $1,
               valor_pago       = COALESCE(NULLIF($2,0), valor_pago),
               moeda            = $3,
               tipo_relatorio   = COALESCE(NULLIF($4,''), tipo_relatorio),
               status_processo  = 'pago',
               updated_at       = NOW()
         WHERE session_id = $5`,
        [paymentIntentId, amountTotal, currency, tipoCanon, sessionId]
      );

      await filaRelatorios.add("gerar-relatorio", { session_id: sessionId });
      console.log(`✅ [stripe] pagamento confirmado e job enfileirado: ${sessionId}`);
    }

    // (opcional) payment_intent.succeeded — em geral não precisa se já tratou o de cima
    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Erro ao processar webhook Stripe:", err.message);
    return res.status(500).send("Webhook handler error");
  }
};
