const axios = require("axios");

async function enviarEmailSimplesViaBrevo({ nome, email, subject, htmlContent, tags = [] }) {
  const API_KEY = process.env.BREVO_API_KEY;
  if (!API_KEY) {
    console.error("BREVO_API_KEY ausente");
    return false;
  }

  const data = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || "Canva Espiritual",
      email: process.env.BREVO_SENDER_EMAIL || "suporte@canvaspiritual.com",
    },
    to: [{ email, name: nome || email }],
    subject,
    htmlContent,
    tags,
  };

  try {
    await axios.post("https://api.brevo.com/v3/smtp/email", data, {
      headers: { "api-key": API_KEY, "Content-Type": "application/json" },
      timeout: 15000,
    });
    console.log(`✅ Email enviado: ${email} | assunto: ${subject}`);
    return true;
  } catch (err) {
    console.error(`❌ Falha ao enviar para ${email}:`, err?.response?.data || err.message);
    return false;
  }
}

module.exports = enviarEmailSimplesViaBrevo;
