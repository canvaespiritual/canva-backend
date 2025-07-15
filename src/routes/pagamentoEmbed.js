const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const PRODUTOS = {
  basico: { title: "Mapa Base da Alma", unit_price: 1 },
  intermediario: { title: "Diagnóstico Interdimensional", unit_price: 1.1 },
  completo: { title: "Diagnóstico Corpo-Mente-Espírito", unit_price: 1.2 },
};

// ROTA: /pagamento/criar-preferencia-embed/:tipo/:session_id
router.get("/criar-preferencia-embed/:tipo/:session_id", async (req, res) => {
  const { tipo, session_id } = req.params;
  const produto = PRODUTOS[tipo];

  if (!produto) {
    return res.status(400).json({ erro: "Produto inválido" });
  }

  console.log(`🧭 Criando preferência EMBED para tipo: ${tipo} | sessão: ${session_id}`);

  const preferenceData = {
    items: [
      {
        title: produto.title,
        quantity: 1,
        currency_id: "BRL",
        unit_price: produto.unit_price,
      }
    ],
    payer: {
      email: `${session_id}@canvaespiritual.com`,
      name: "Cliente",
      surname: "Embed",
    },
    back_urls: {
      success: "https://www.canvaspiritual.com/sucesso",
      failure: "https://www.canvaspiritual.com/falha",
      pending: "https://www.canvaspiritual.com/pendente",
    },
    auto_return: "approved",
    metadata: { session_id, tipo },
  };

  try {
    const resultado = await new Preference(client).create({ body: preferenceData });

    // ⚠️ Loga tudo que a API respondeu:
    console.log("📦 Resposta bruta da API Mercado Pago:", resultado);

    const preferenceId = resultado?.id || resultado?.body?.id;

    if (!preferenceId) {
      console.error("❌ Preferência criada, mas ID ausente:", resultado?.body || resultado);
      return res.status(500).json({ erro: "Erro ao gerar preferência." });
    }

    console.log("✅ Preferência criada para embed:", preferenceId);
    res.json({ preferenceId });

  } catch (error) {
    console.error("❌ Erro ao criar preferência para embed:", error);
    res.status(500).json({ erro: "Erro ao criar pagamento com cartão." });
  }
});

module.exports = router;
