// src/routes/stripeCheckout.js
const express = require("express");
const Stripe = require("stripe");
const pool = require("../db"); // conexão PostgreSQL
const filaRelatorios = require("../queue/filaRelatorios");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// helper pra manter compatibilidade com o worker
function canonicalTipo(tipo = "") {
  const t = tipo.toLowerCase();
  if (t === "intermediario" || t === "premium") return "premium";
  if (t === "completo" || t === "interdimensional") return "completo";
  return "essencial";
}

// ===================
// POST /api/stripe/create-checkout-session
// ===================
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { session_id, amount, tipo = "essencial", locale = "en", ref } = req.body;

    if (!session_id || !amount) {
      return res.status(400).json({ error: "Missing session_id or amount" });
    }

    const tipoCanon = canonicalTipo(tipo);

    await pool.query(
      `UPDATE diagnosticos
          SET gateway = 'stripe',
              tipo_relatorio = $1,
              valor_pago = $2,
              moeda = 'usd',
              updated_at = NOW()
        WHERE session_id = $3`,
      [tipoCanon, amount, session_id]
    );

    // 🔗 base da URL e escolha da página de aguardo
    const base =
      process.env.PUBLIC_BASE_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    // se locale === 'en' -> aguarde-en.html, senão aguarde.html
    const successPage = (locale === "en") ? "aguarde-en.html" : "aguarde.html";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: `Soul Map Report – ${tipoCanon}`,
              description: `Personalized Soul Map (${tipoCanon})`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/${successPage}?session_id=${session_id}`,
      cancel_url: `${base}/pay.html?session_id=${session_id}`,
      locale,
      metadata: {
        session_id,
        tipo_relatorio: tipoCanon,
        valor_pago: amount,
        moeda: "usd",
        aff_ref: ref || null,
      },
    });

    console.log(`✅ Stripe checkout criado para ${session_id}`);
    return res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Erro Stripe checkout:", err.message);
    return res.status(500).json({ error: "Stripe checkout failed" });
  }
});


module.exports = router;
