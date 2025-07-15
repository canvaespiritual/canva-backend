const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");

// Autenticação
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// Produtos disponíveis
const PRODUTOS = {
  basico: { title: "Mapa Base da Alma", unit_price: 1 },
  intermediario: { title: "Diagnóstico Interdimensional", unit_price: 1.1 },
  completo: { title: "Diagnóstico Corpo-Mente-Espírito", unit_price: 1.2 },
};

// Rota: /pagamento/criar-pix/:tipo/:session_id
router.get("/criar-pix/:tipo/:session_id", async (req, res) => {
  const { tipo, session_id } = req.params;
  console.log(`🧭 Criando PIX para tipo: ${tipo} | sessão: ${session_id}`);

  const produto = PRODUTOS[tipo];
  if (!produto) {
    console.warn("⚠️ Produto inválido:", tipo);
    return res.status(400).json({ erro: "Produto inválido" });
  }

try {
  const { id, point_of_interaction } = await new Payment(client).create({
    body: {
      transaction_amount: produto.unit_price,
      description: produto.title,
      payment_method_id: "pix",
      payer: {
        email: `${session_id}@canvaespiritual.com`,
        first_name: "Cliente",
        last_name: "Canva",
        identification: {
          type: "CPF",
          number: "12345678909",
        },
      },
      metadata: {
        session_id,
        tipo
      }
    },
  });


    const tx = point_of_interaction?.transaction_data;

    if (!tx || !tx.qr_code || !tx.qr_code_base64 || !tx.ticket_url) {
      console.error("❌ Dados de transação incompletos:", tx);
      return res.status(500).json({ erro: "Erro ao extrair dados de pagamento." });
    }

    const retorno = {
      payment_id: id,
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      init_point: tx.ticket_url,
    };

    console.log("✅ PIX gerado com sucesso:", retorno);
    res.json(retorno);

  } catch (error) {
    console.error("❌ Erro ao gerar PIX:", error);
    res.status(500).json({ erro: "Erro interno ao gerar pagamento." });
  }
});

module.exports = router;
