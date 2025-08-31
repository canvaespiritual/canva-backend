// src/routes/pagamentoEmbed.js
const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// Tabela de produtos usada pelo MP (basico | intermediario | completo)
const PRODUTOS = {
  basico:         { title: "Mapa Base da Alma",              unit_price: 12 },
  intermediario:  { title: "Diagnóstico Intermediário",      unit_price: 21 },
  completo:       { title: "Diagnóstico Corpo-Mente-Espírito", unit_price: 40 },
};

// Helpers
const normalizeProdutoKey = (s) => {
  // nome aceito pela rota do MP para lookup de preço
  s = String(s || "").toLowerCase();
  if (s === "premium" || s === "intermediario") return "intermediario";
  if (s === "completo" || s === "interdimensional") return "completo";
  return "basico"; // "basico" e "essencial" caem aqui
};

const canonicalTipo = (s) => {
  // nome canônico que será salvo em metadata.tipo e, depois, no Postgres
  s = String(s || "").toLowerCase();
  if (s === "premium" || s === "intermediario") return "premium";
  if (s === "completo" || s === "interdimensional") return "completo";
  return "essencial";
};

// ROTA: /pagamento/criar-preferencia-embed/:tipo/:session_id
router.get("/criar-preferencia-embed/:tipo/:session_id", async (req, res) => {
  const tipoParam   = req.params.tipo;
  const session_id  = req.params.session_id;

  const produtoKey  = normalizeProdutoKey(tipoParam);   // basico | intermediario | completo (para preço)
  const produto     = PRODUTOS[produtoKey];
  const tipoCanon   = canonicalTipo(tipoParam);         // essencial | premium | completo (para relatório)

  if (!produto) {
    return res.status(400).json({ erro: `Produto inválido: ${tipoParam}` });
  }

  console.log(`🧭 Criando preferência EMBED | tipoParam=${tipoParam} -> produtoKey=${produtoKey} | tipoCanon=${tipoCanon} | sessão=${session_id}`);

  const preferenceData = {
    items: [
      {
        id: session_id,
        title: produto.title,
        quantity: 1,
        currency_id: "BRL",
        unit_price: produto.unit_price,
      }
    ],
    payer: {
      // Dummy payer para sandbox; em produção use os dados reais do cliente
      email: `${session_id}@canvaespiritual.com`,
      name: "Cliente",
      surname: "Embed",
      identification: {
        type: "CPF",
        number: "12345678909",
      },
    },
    back_urls: {
      success: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
      failure: `https://api.canvaspiritual.com/falha.html`,
      pending: `https://api.canvaspiritual.com/aguarde.html?session_id=${session_id}`,
    },
    auto_return: "approved",
    external_reference: session_id, // ajuda o webhook/polling a localizar a sessão
    metadata: {
      session_id,
      tipo: tipoCanon,              // 🔥 sempre: essencial | premium | completo
    },
  };

  try {
    const resultado = await new Preference(client).create({ body: preferenceData });

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
