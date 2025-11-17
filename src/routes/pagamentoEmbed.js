// src/routes/pagamentoEmbed.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// tabela base
const PRODUTOS = {
  basico:        { title: "Mapa Base da Alma",                 unit_price: 12 },
  intermediario: { title: "Diagnóstico Interdimensional",      unit_price: 21 },
  completo:      { title: "Diagnóstico Corpo-Mente-Espírito",  unit_price: 29 },
};

// normalizações
const normalizeProdutoKey = (s) => {
  s = String(s || "").toLowerCase();
  if (s === "premium" || s === "intermediario") return "intermediario";
  if (s === "completo" || s === "interdimensional") return "completo";
  return "basico";
};
const canonicalTipo = (s) => {
  s = String(s || "").toLowerCase();
  if (s === "premium" || s === "intermediario") return "premium";
  if (s === "completo" || s === "interdimensional") return "completo";
  return "essencial";
};

// limites do solidário (iguais ao PIX)
const VALOR_MINIMO = 10;
const VALOR_MAXIMO = 500;

router.get("/criar-preferencia-embed/:tipo/:session_id", async (req, res) => {
  const tipoParam  = req.params.tipo;
  const session_id = req.params.session_id;
  const produtoKey = normalizeProdutoKey(tipoParam);   // basico | intermediario | completo
  const produto    = PRODUTOS[produtoKey];
  const tipoCanon  = canonicalTipo(tipoParam);         // essencial | premium | completo

  if (!produto) return res.status(400).json({ erro: `Produto inválido: ${tipoParam}` });

  // override opcional via ?valor
  let valor = req.query.valor ? parseFloat(String(req.query.valor).replace(',', '.')) : null;
  if (isNaN(valor)) valor = null;
  if (valor != null) {
    if (!isFinite(valor)) valor = null;
    else valor = Math.min(Math.max(valor, VALOR_MINIMO), VALOR_MAXIMO);
  }
  const unitPrice = valor != null ? Number(valor.toFixed(2)) : produto.unit_price;

  const preferenceData = {
    items: [{
      id: session_id,
      title: produto.title,
      quantity: 1,
      currency_id: "BRL",
      unit_price: unitPrice,       // << aplica preço solidário
    }],
    payer: {
      email: `${session_id}@canvaespiritual.com`,
      name: "Cliente",
      surname: "Embed",
      identification: { type: "CPF", number: "12345678909" },
    },
    back_urls: {
      success: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
      failure: `https://api.canvaspiritual.com/falha.html`,
      pending: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
    },
    auto_return: "approved",
    external_reference: session_id,
    metadata: {
      session_id,
      tipo: tipoCanon,
      valor_solidario: unitPrice,  // << útil para relatórios
    },
  };

  try {
    const resultado = await new Preference(client).create({ body: preferenceData });
    const preferenceId = resultado?.id || resultado?.body?.id;
    if (!preferenceId) return res.status(500).json({ erro: "Erro ao gerar preferência." });
    res.json({ preferenceId });
  } catch (error) {
    console.error("❌ Erro ao criar preferência para embed:", error);
    res.status(500).json({ erro: "Erro ao criar pagamento com cartão." });
  }
});

module.exports = router;
