// 📁 src/routes/statusRedirect.js
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const pool = require("../db"); // ← IMPORTAÇÃO DO POSTGRES
const filaRelatorios = require('../queue/filaRelatorios');



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
       // ✅ Atualiza o PostgreSQL
      try {
        await pool.query(`
          UPDATE diagnosticos
          SET
            status_pagamento = $1,
            tipo_pagamento = $2,
            data_pagamento = $3,
            payment_id = $4,
            status_processo = $5,
            brevo_sincronizado = false
          WHERE session_id = $6
        `, [
          'pago',
          'pix',
          new Date(),
          paymentId,
          'pago',
          session_id
        ]);

         
        // ✅ Após atualizar o banco, envia para a fila:
  await filaRelatorios.add('gerar-relatorio', { session_id: sessionId });

  console.log(`📨 Job enviado para fila BullMQ: ${sessionId}`);

        console.log(`🧾 PostgreSQL atualizado via redirect para sessão ${session_id}`);
      } catch (pgError) {
        console.error(`❌ Erro ao atualizar PostgreSQL para sessão ${session_id}:`, pgError.message);
      }
    } else {
      console.warn("⏳ Pagamento ainda não aprovado:", paymentId);
    }
  } catch (err) {
    console.error("❌ Erro ao consultar pagamento por ID:", err.message);
  }

  return res.redirect(`/aguarde.html?session_id=${session_id}`);
});

module.exports = router;
