const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const router = express.Router();

// Configura o client com seu access token
const mercadopagoClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// Produtos disponíveis
const PRODUTOS = {
  basico: { title: "Mapa Base da Alma", unit_price: 12 },
  intermediario: { title: "Diagnóstico Interdimensional", unit_price: 21 },
  completo: { title: "Diagnóstico Corpo-Mente-Espírito", unit_price: 40 },
};

// Rota principal para gerar pagamento com PIX e Cartão
router.get('/criar-pagamento/:tipo/:session_id', async (req, res) => {
  const { tipo, session_id } = req.params;
  console.log(`🧭 Criando pagamento para tipo: ${tipo} | session_id: ${session_id}`);

  const produto = PRODUTOS[tipo];

  if (!produto || !session_id) {
    console.warn("⚠️ Produto inválido ou session_id ausente");
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  const sessionSafe = encodeURIComponent(session_id); // 🔐 proteção extra

  try {
    const preference = {
      items: [
        {
          title: produto.title,
          quantity: 1,
          currency_id: "BRL",
          unit_price: produto.unit_price,
        },
      ],
      back_urls: {
        success: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
        failure: `https://api.canvaspiritual.com/falha.html`,
       pending: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
      },

      //auto_return: "approved",
      metadata: {
        session_id,
        tipo,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" }, // exclui boleto
        ],
        default_payment_method_id: "pix",
        installments: 1,
      }
    };

    const resultado = await new Preference(mercadopagoClient).create({ body: preference });

   if (!resultado || !resultado.body || !resultado.body.init_point) {
  console.error("❌ Preferência inválida retornada:", resultado);
  return res.status(500).json({ erro: "Falha ao criar link de pagamento." });
}

const retorno = {
  init_point: resultado.body.init_point,
  qr_code: resultado.body.point_of_interaction?.transaction_data?.qr_code || null,
  qr_code_base64: resultado.body.point_of_interaction?.transaction_data?.qr_code_base64 || null,
  payment_id: resultado.body.id
};

    console.log("✅ Preferência criada com sucesso:", retorno);

    res.json(retorno);
  } catch (error) {
    console.error("❌ Erro ao criar preferência:", error);
    res.status(500).json({ erro: "Erro ao criar preferência de pagamento." });
  }
});

module.exports = router;
