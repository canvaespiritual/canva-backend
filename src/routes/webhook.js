const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('../db'); // ← IMPORTAÇÃO DO POSTGRES

const router = express.Router();

router.post('/', async (req, res) => {
  console.log("🔔 Webhook chamado:", req.body);

  const paymentId = req.body?.data?.id;
  if (!paymentId) return res.sendStatus(400);

  try {
    const resposta = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      }
    });

    const pagamento = resposta.data;
    const status = pagamento.status;
    const sessionId = pagamento.metadata?.session_id;
    const tipo = pagamento.metadata?.tipo;

    if (!sessionId) {
      console.warn("⚠️ Sessão não encontrada na metadata.");
      return res.sendStatus(200);
    }

    if (status === 'approved') {
      const base = path.join(__dirname, '../../temp');
      const origem = path.join(base, 'respondidos', `${sessionId}.json`);
      const destino = path.join(base, 'pendentes', `${sessionId}.json`);

      if (fs.existsSync(origem)) {
        const dados = JSON.parse(fs.readFileSync(origem, 'utf8'));
        dados.status_pagamento = 'approved';
        dados.payment_id = paymentId;
        dados.tipoRelatorio = tipo;
        dados.data_confirmacao = new Date().toISOString();

        fs.writeFileSync(destino, JSON.stringify(dados, null, 2), 'utf8');
        fs.unlinkSync(origem);
        console.log(`✅ JSON movido para pendentes: ${sessionId}`);
      } else {
        console.warn(`⚠️ Arquivo ${sessionId}.json não encontrado em /respondidos`);
      }
    
 // ✅ Atualiza o PostgreSQL com status de pagamento
      try {
        await pool.query(`
          UPDATE diagnosticos
          SET
            status_pagamento = $1,
            tipo_pagamento = $2,
            data_pagamento = $3,
            payment_id = $4,
            tipo_relatorio = $5,
            status_processo = $6
          WHERE session_id = $7
        `, [
          'pago',
          'cartao',
          new Date(),
          paymentId,
          tipo || 'desconhecido',
          'pago',
          sessionId
        ]);

        console.log(`🧾 PostgreSQL atualizado com pagamento APROVADO para sessão ${sessionId}`);
      } catch (pgError) {
        console.error(`❌ Erro ao atualizar PostgreSQL para sessão ${sessionId}:`, pgError.message);
      }
    }
    res.sendStatus(200);
  } catch (erro) {
    console.error("❌ Erro no Webhook:", erro.message);
    res.sendStatus(500);
  }
});

module.exports = router;
