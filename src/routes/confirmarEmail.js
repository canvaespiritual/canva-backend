const express = require('express');
const path = require('path');
const fs = require('fs');
const { createTransport } = require('nodemailer');
const router = express.Router();

// Função utilitária para envio de e-mail
async function reenviarPDF(destinatario, nome, sessionId, pdfPath) {
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
    text: `Olá ${nome},\n\nSegue em anexo o seu diagnóstico espiritual solicitado.\n\nCom luz,`,
    attachments: [
      {
        filename: `${sessionId}.pdf`,
        path: pdfPath
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log(`📤 PDF reenviado para ${destinatario}`);
}

// POST /confirmar-email/:session_id
router.post('/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;
  const novoEmail = req.body.email;

  if (!novoEmail || !novoEmail.includes('@')) {
    return res.status(400).json({ erro: 'E-mail inválido' });
  }

  const pendentePath = path.join(__dirname, '../../temp/pendentes', `${sessionId}.json`);
  const processadoPath = path.join(__dirname, '../../temp/processados', `${sessionId}.json`);
  const pdfPath = path.join(__dirname, '../../temp/prontos', `${sessionId}.pdf`);

  let jsonPath = fs.existsSync(pendentePath) ? pendentePath :
                 fs.existsSync(processadoPath) ? processadoPath : null;

  if (!jsonPath || !fs.existsSync(pdfPath)) {
    return res.status(404).json({ erro: 'Sessão ou PDF não encontrado' });
  }

  const session = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  if (session.email_corrigido_enviado) {
    return res.status(409).json({ mensagem: 'Este e-mail já recebeu a cópia anteriormente.' });
  }

  session.email_corrigido = novoEmail;
  session.email_corrigido_enviado = true;
  fs.writeFileSync(jsonPath, JSON.stringify(session, null, 2));

  try {
    await reenviarPDF(novoEmail, session.nome, sessionId, pdfPath);
    res.json({ mensagem: '✅ Cópia do relatório enviada com sucesso para o novo e-mail.' });
  } catch (error) {
    console.error(`❌ Falha ao reenviar e-mail:`, error.message);
    res.status(500).json({ erro: 'Erro ao enviar o e-mail para o novo endereço.' });
  }
});

module.exports = router;
