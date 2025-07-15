// 📁 src/routes/statusRedirect.js
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const router = express.Router();
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

const pastaRespondidos = path.join(__dirname, "../../temp/respondidos");
const pastaPendentes = path.join(__dirname, "../../temp/pendentes");

router.get("/status_redirect/:session_id", async (req, res) => {
  const { session_id } = req.params;
  const origemPath = path.join(pastaRespondidos, `${session_id}.json`);
  const destinoPath = path.join(pastaPendentes, `${session_id}.json`);

  if (!fs.existsSync(origemPath)) {
    console.warn("⚠️ JSON da sessão não encontrado:", session_id);
    return res.redirect(`/aguarde.html?session_id=${session_id}`);
  }

  const dados = JSON.parse(fs.readFileSync(origemPath, "utf8"));
  const paymentId = dados.payment_id;

  if (!paymentId) {
    console.warn("⚠️ Nenhum payment_id salvo para essa sessão:", session_id);
    return res.redirect(`/aguarde.html?session_id=${session_id}`);
  }

  try {
    const pagamento = await new Payment(client).get({ id: paymentId });

    if (pagamento.status === "approved") {
      dados.status_pagamento = "approved";
      fs.writeFileSync(destinoPath, JSON.stringify(dados, null, 2));
      fs.unlinkSync(origemPath);
      console.log(`✅ Pagamento confirmado por ID: ${paymentId} | Sessão: ${session_id}`);
    } else {
      console.warn("⏳ Pagamento ainda não aprovado:", paymentId);
    }
  } catch (err) {
    console.error("❌ Erro ao consultar pagamento por ID:", err.message);
  }

  return res.redirect(`/aguarde.html?session_id=${session_id}`);
});

module.exports = router;
