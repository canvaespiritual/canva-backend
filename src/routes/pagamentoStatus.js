// src/routes/pagamentoStatus.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const pool = require('../db'); // ← IMPORTAÇÃO DO POSTGRES
const filaRelatorios = require('../queue/filaRelatorios');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const router = express.Router();

// 👇 Helper: converte tipos do MP para os 3 canônicos que o worker/relatório entendem
const canonicalTipo = (s) => {
  s = String(s || '').toLowerCase();
  if (s === 'intermediario' || s === 'premium') return 'premium';
  if (s === 'completo' || s === 'interdimensional') return 'completo';
  // 'basico' e 'essencial' viram 'essencial'
  return 'essencial';
};

router.get("/status/:payment_id", async (req, res) => {
  const { payment_id } = req.params;

  try {
    const resposta = await new Payment(client).get({ id: payment_id });

    const status = resposta?.body?.status || resposta?.status;
    const body = resposta?.body || resposta;

    console.log("📥 Recebendo consulta para payment_id:", payment_id);
    console.log("📦 pagamento.body:", body);

    if (status === undefined || status === null) {
      console.warn("⚠️ Nenhum status retornado pelo Mercado Pago");
      return res.status(200).json({ aprovado: false, status: null });
    }

    // ✅ Se aprovado, mover JSON da pasta respondidos para pendentes
    if (status === "approved") {
      const sessionId = body?.metadata?.session_id;
      // tipo canônico para salvar no JSON e no Postgres
      const tipoCanon = canonicalTipo(body?.metadata?.tipo);

      if (sessionId) {
        const respondidosPath = path.join(__dirname, "../../temp/respondidos", `${sessionId}.json`);
        const pendentesPath = path.join(__dirname, "../../temp/pendentes", `${sessionId}.json`);

        if (fs.existsSync(respondidosPath)) {
          const dados = JSON.parse(fs.readFileSync(respondidosPath, "utf8"));

          // Atualiza os campos
          dados.payment_id = Number(payment_id);
          dados.status_pagamento = "confirmado";
          dados.tipoRelatorio = tipoCanon; // 👈 agora sempre: essencial | premium | completo
          dados.data_confirmacao = new Date().toISOString();

          // Salva novo JSON e remove o anterior
          fs.writeFileSync(pendentesPath, JSON.stringify(dados, null, 2), "utf8");
          fs.unlinkSync(respondidosPath);

          console.log(`📂 Sessão ${sessionId} movida para /pendentes`);
          // ✅ Atualiza o PostgreSQL com pagamento aprovado
          try {
            await pool.query(`
              UPDATE diagnosticos
              SET
                status_pagamento = $1,
                tipo_pagamento   = $2,
                data_pagamento   = $3,
                payment_id       = $4,
                tipo_relatorio   = $5,
                status_processo  = $6,
                updated_at       = NOW()
              WHERE session_id = $7
            `, [
              'pago',
              'pix',
              new Date(),
              payment_id,
              tipoCanon, // 👈 salva canônico no BD
              'pago',
              sessionId
            ]);

            // ✅ Após atualizar o banco, envia para a fila:
            await filaRelatorios.add('gerar-relatorio', { session_id: sessionId });
            console.log(`📨 Job enviado para fila BullMQ: ${sessionId}`);
            console.log(`🧾 PostgreSQL atualizado com pagamento APROVADO para sessão ${sessionId}`);
          } catch (pgError) {
            console.error(`❌ Erro ao atualizar PostgreSQL para sessão ${sessionId}:`, pgError.message);
          }
        } else {
          console.warn(`⚠️ Sessão ${sessionId} não encontrada em /respondidos`);
        }
      } else {
        console.warn("⚠️ Metadata da sessão não encontrada no body do pagamento.");
      }
    }

    console.log("✅ Status recebido:", status);
    res.json({ aprovado: status === "approved", status });

  } catch (error) {
    console.error("❌ Erro ao verificar status:", error.message);
    res.status(500).json({ erro: "Erro ao verificar status do pagamento." });
  }
});

module.exports = router;
