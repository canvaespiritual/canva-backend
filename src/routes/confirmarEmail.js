const express = require('express');
const path = require('path');
const fs = require('fs');
const { createTransport } = require('nodemailer');
const pool = require('../db'); // ajuste se necessário
const router = express.Router();

// Função para enviar e-mail com o link do relatório
async function reenviarLinkPorEmail(destinatario, nome, sessionId, pdfUrl) {
  const transporter = createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_REMETENTE,
      pass: process.env.SENHA_EMAIL_APP
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_REMETENTE,
    to: destinatario,
    subject: `Seu Relatório Espiritual – Canva Espiritual`,
    text: `Olá ${nome},\n\nSeu diagnóstico espiritual está pronto. Acesse o relatório diretamente pelo link abaixo:\n\n${pdfUrl}\n\nCom fé, sabedoria e propósito — Canva Espiritual.`
  };

  await transporter.sendMail(mailOptions);
  console.log(`📤 Link reenviado com sucesso para ${destinatario}`);
}

// POST /confirmar-email/:session_id
router.post('/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;
  const novoEmail = req.body.email;

  if (!novoEmail || !novoEmail.includes('@')) {
    return res.status(400).json({ erro: 'E-mail inválido' });
  }

  // Verifica onde está o JSON da sessão (pendente ou processado)
  const pendentePath = path.join(__dirname, '../../temp/pendentes', `${sessionId}.json`);
  const processadoPath = path.join(__dirname, '../../temp/processados', `${sessionId}.json`);
  const jsonPath = fs.existsSync(pendentePath) ? pendentePath :
                   fs.existsSync(processadoPath) ? processadoPath : null;

  if (!jsonPath) {
    return res.status(404).json({ erro: 'Sessão não encontrada' });
  }

 // Lê do JSON apenas nome e session_id
const session = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Agora busca o PDF real no banco
const { rows } = await pool.query(
  `SELECT pdf_url FROM diagnosticos WHERE session_id = $1`,
  [sessionId]
);

const pdf_url = rows[0]?.pdf_url;

if (!pdf_url) {
  console.warn(`⚠️ PDF URL ausente no banco para sessão ${sessionId}`);
  return res.status(400).json({ erro: 'PDF ainda não está disponível.' });
}


  if (session.email_corrigido_enviado) {
    return res.status(409).json({ mensagem: 'Este e-mail já recebeu a cópia anteriormente.' });
  }

  // Atualiza sessão local (JSON)
  session.email_corrigido = novoEmail;
  session.email_corrigido_enviado = true;
  fs.writeFileSync(jsonPath, JSON.stringify(session, null, 2));

  try {
    // Envia o link por e-mail
    await reenviarLinkPorEmail(novoEmail, session.nome, sessionId, pdf_url);


    // Atualiza no banco: diagnosticos
    await pool.query(
      `UPDATE diagnosticos SET email_corrigido = $1 WHERE session_id = $2`,
      [novoEmail, sessionId]
    );
    console.log(`📌 Banco atualizado com novo e-mail para sessão ${sessionId}`);

    // Insere evento na tabela diagnostico_eventos
    const { rows } = await pool.query(
      `SELECT id FROM diagnosticos WHERE session_id = $1`,
      [sessionId]
    );

    const diagnosticoId = rows[0]?.id;
    if (diagnosticoId) {
      await pool.query(
        `INSERT INTO diagnostico_eventos (diagnostico_id, tipo_evento, observacao)
         VALUES ($1, $2, $3)`,
        [diagnosticoId, 'reenvio_email', `Reenviado para: ${novoEmail}`]
      );
      console.log(`📖 Evento registrado para sessão ${sessionId}`);
    } else {
      console.warn(`⚠️ Diagnóstico não encontrado no banco para sessão ${sessionId}`);
    }

    res.json({ mensagem: '✅ Cópia do relatório enviada com sucesso para o novo e-mail.' });

  } catch (error) {
    console.error(`❌ Erro ao reenviar e/ou atualizar banco:`, error.message);
    res.status(500).json({ erro: 'Erro ao processar o novo envio.' });
  }
});

module.exports = router;
