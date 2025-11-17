const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Payment } = require("mercadopago");

// ================== AUTENTICAÇÃO MP ==================
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// ================== PRODUTOS (TÍTULOS) ==================
// Mantemos títulos/descrições para aparecerem no checkout do MP.
// Os valores aqui são apenas fallback quando não vier ?valor=.
const PRODUTOS = {
  basico:        { title: "Mapa Base da Alma",                 unit_price: 12 },
  intermediario: { title: "Diagnóstico Interdimensional",      unit_price: 21 },
  completo:      { title: "Diagnóstico Corpo-Mente-Espírito",  unit_price: 29 },
};

// ================== PREÇO SOLIDÁRIO (CONFIG) ==================
const VALOR_MINIMO = 10;   // valor mínimo permitido (R$)
const VALOR_MAXIMO = 500;  // teto de segurança

// ROTA: /pagamento/criar-pix/:tipo/:session_id
// Ex.: /pagamento/criar-pix/completo/sessao-123?valor=37
router.get("/criar-pix/:tipo/:session_id", async (req, res) => {
  const { tipo, session_id } = req.params;
  const valorQuery = parseFloat(req.query.valor); // ?valor=xx (opcional)

  // Produto: se tipo inválido, usamos 'completo' como padrão.
  const produtoBase = PRODUTOS[tipo] || PRODUTOS["completo"];

  // Decide valor final (solidário) com validação
  let valorFinal = produtoBase.unit_price; // fallback padrão
  if (!isNaN(valorQuery)) {
    valorFinal = Math.min(Math.max(valorQuery, VALOR_MINIMO), VALOR_MAXIMO);
  }

  console.log(`🧭 Criando PIX | tipo: ${tipo} | sessão: ${session_id} | valorFinal: R$ ${valorFinal}`);

  try {
    const { id, point_of_interaction } = await new Payment(client).create({
      body: {
        transaction_amount: valorFinal,         // << preço final (R$)
        description: produtoBase.title,         // << título amigável
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
          tipo: (PRODUTOS[tipo] ? tipo : "completo"),
          valor_solidario: valorFinal,          // << útil para relatórios
        },
      },
    });

    const tx = point_of_interaction?.transaction_data;
    if (!tx || !tx.qr_code || !tx.qr_code_base64 || !tx.ticket_url) {
      console.error("❌ Dados de transação incompletos:", tx);
      return res.status(500).json({ erro: "Erro ao extrair dados de pagamento." });
    }

    const retorno = {
      payment_id: id,
      valor_final: valorFinal,
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
