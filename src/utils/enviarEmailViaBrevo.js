const axios = require('axios');
const pool = require('../db'); // conexão com o banco

async function enviarEmailViaBrevo({ nome, email, sessionId, linkPdf, idioma }) {
  const lang = String(idioma || '').toLowerCase();
  const isEn = lang.startsWith('en');

  const API_KEY = process.env.BREVO_API_KEY;

  // 🔹 Template PT (mantém exatamente seu comportamento atual)
  const htmlContentPt = `
    <p>Olá <strong>${nome}</strong>,</p>
    <p>Seu diagnóstico espiritual foi gerado com base no seu autodiagnóstico.</p>
    <p>
      <a href="${linkPdf}" target="_blank"
         style="background:#1a73e8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">
        📥 Baixar Relatório
      </a>
    </p>
    <p>Com luz,<br>Equipe Canva Espiritual</p>
  `;

  // 🔹 Template EN (versão simples para quem fez em inglês)
  const htmlContentEn = `
    <p>Hi <strong>${nome}</strong>,</p>
    <p>Your spiritual diagnosis has been generated based on your self-assessment.</p>
    <p>You can access your personalized report at the link below:</p>
    <p>
      <a href="${linkPdf}" target="_blank"
         style="background:#1a73e8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">
        📥 Access my report
      </a>
    </p>
    <p>If the button doesn’t work, copy and paste this link into your browser:<br>${linkPdf}</p>
    <p>May this mirror of your soul help you take your next steps with more awareness and peace. 🕊️</p>
  `;

  const htmlContent = isEn ? htmlContentEn : htmlContentPt;

  const data = {
    sender: {
      name: 'Canva Espiritual',
      email: 'suporte@canvaspiritual.com'
    },
    to: [{ email, name: nome }],
    subject: isEn
      ? 'Your Spiritual Report is ready ✨'
      : 'Seu Relatório Espiritual está pronto ✨',
    htmlContent
  };

  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', data, {
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ Email enviado para ${email}`);
    await pool.query(
      `
      UPDATE diagnosticos
      SET email_enviado_em = NOW(),
          email_erro = NULL
      WHERE session_id = $1
    `,
      [sessionId]
    );
    return true;
  } catch (error) {
    console.error(
      `❌ Falha no envio para ${email}:`,
      error.response?.data || error.message
    );

    await pool.query(
      `
      UPDATE diagnosticos
      SET email_erro = $2
      WHERE session_id = $1
    `,
      [sessionId, error.message]
    );
    throw error;
  }
}

module.exports = enviarEmailViaBrevo;
