const express = require('express');
const path = require('path');
const fs = require('fs');
const { createPdfFromHtml } = require('../services/relatorioPDF');
const nodemailer = require('nodemailer');

const router = express.Router();

router.get('/', async (req, res) => {
  const sessionId = req.query.session_id;

  if (!sessionId) {
    return res.status(400).send('❌ session_id não fornecido.');
  }

  const basePath = path.join(__dirname, '../../temp');
  const pendentePath = path.join(basePath, 'pendentes', `${sessionId}.json`);
  const processadoPath = path.join(basePath, 'processados', `${sessionId}.json`);
  const pdfPath = path.join(basePath, 'prontos', `${sessionId}.pdf`);

  let jsonPath = null;

  if (fs.existsSync(processadoPath)) {
    jsonPath = processadoPath;
  } else if (fs.existsSync(pendentePath)) {
    jsonPath = pendentePath;
  } else {
    return res.status(404).send('❌ Sessão não encontrada.');
  }

  const session = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const tipo = session.tipoRelatorio || 'essencial';

  // 🔒 Se ainda está em `respondidos`, volta pro pagamento (proteção real)
  const caminhoRespondidos = path.join(basePath, 'respondidos', `${sessionId}.json`);
  if (fs.existsSync(caminhoRespondidos)) {
    console.warn(`🚫 Sessão ${sessionId} ainda não paga.`);
    return res.redirect(`/pagamento-opcao.html?session_id=${sessionId}&tipo=${tipo}`);
  }

  // ✅ Se pagamento ainda não foi aprovado, redireciona para aguarde
  if (session.status_pagamento !== 'approved') {
    console.warn(`⛔ Pagamento ainda não aprovado para sessão ${sessionId}.`);
    return res.redirect(`/aguarde.html?session_id=${sessionId}`);
  }

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject('timeout'), 15000);
  });

  const gerar = async () => {
    const buffer = await createPdfFromHtml(session, tipo);
    fs.writeFileSync(pdfPath, buffer);

    session.pdfGerado = true;
    session.dataGeracao = new Date().toISOString();

    fs.writeFileSync(processadoPath, JSON.stringify(session, null, 2));
    return true;
  };

  try {
    await Promise.race([timeout, gerar()]);

    await enviarEmail(session.email, session.nome, pdfPath, sessionId);

    return res.redirect(`/sucesso.html?arquivo=${sessionId}.pdf`);
  } catch (err) {
    console.warn(`⏱️ Tempo excedido para ${sessionId}, caindo para fluxo assíncrono.`);
    return res.redirect(`/aguarde.html?session_id=${sessionId}`);
  }
});

async function enviarEmail(destinatario, nome, pdfPath, sessionId) {
  try {
    const transporter = nodemailer.createTransport({
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
      text: `Olá ${nome},\n\nSegue em anexo o seu diagnóstico espiritual solicitado.\n\nCom luz,`,
      attachments: [
        {
          filename: `${sessionId}.pdf`,
          path: pdfPath
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log(`📨 E-mail enviado com sucesso para ${destinatario}`);
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${destinatario}:`, error.message);
  }
}

module.exports = router;
