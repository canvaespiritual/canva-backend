// 📁 src/routes/statusRedirect.js

require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const mercadopago = require("mercadopago");

const router = express.Router();

const pastaRespondidos = path.join(__dirname, "../../temp/respondidos");
const pastaPendentes = path.join(__dirname, "../../temp/pendentes");

router.get("/status_redirect/:session_id", async (req, res) => {
  const { session_id } = req.params;
  const emailBusca = `${session_id}@canvaespiritual.com`;

  try {
    // 1. Busca os pagamentos mais recentes associados ao e-mail da sessão
    const searchResult = await mercadopago.payment.search({
      qs: {
        sort: "date_created",
        criteria: "desc",
        email: emailBusca
      },
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    const pagamentos = searchResult.body.results;

    // 2. Localiza o pagamento com status aprovado
    const pagamentoValido = pagamentos.find(
      (p) => p.status === "approved"
    );

    if (!pagamentoValido) {
      console.warn("⚠️ Pagamento ainda não aprovado ou não encontrado para:", session_id);
      return res.redirect(`/aguarde.html?session_id=${session_id}`);
    }

    // 3. Verifica se o JSON da sessão existe em /respondidos
    const arquivoOrigem = path.join(pastaRespondidos, `${session_id}.json`);
    const arquivoDestino = path.join(pastaPendentes, `${session_id}.json`);

    if (!fs.existsSync(arquivoOrigem)) {
      console.warn("⚠️ Arquivo da sessão não encontrado em respondidos.");
      return res.redirect(`/aguarde.html?session_id=${session_id}`);
    }

    // 4. Atualiza os dados da sessão e move para /pendentes
    const dados = JSON.parse(fs.readFileSync(arquivoOrigem, "utf8"));
    dados.status_pagamento = "approved";
    dados.payment_id = pagamentoValido.id;
    dados.tipoRelatorio = dados.tipo || "essencial";

    fs.writeFileSync(arquivoDestino, JSON.stringify(dados, null, 2));
    fs.unlinkSync(arquivoOrigem);

    console.log(`✅ Pagamento confirmado e arquivo movido para pendentes: ${session_id}`);

    return res.redirect(`/aguarde.html?session_id=${session_id}`);
  } catch (error) {
    console.error("❌ Erro ao processar status redirect:", error.message);
    return res.redirect(`/aguarde.html?session_id=${session_id}`);
  }
});

module.exports = router;
