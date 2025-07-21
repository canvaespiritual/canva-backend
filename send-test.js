require("dotenv").config();
const nodemailer = require("nodemailer");

// Verifica se .env está carregando corretamente
console.log("📦 SMTP HOST:", process.env.EMAIL_SERVIDOR);
console.log("📨 Remetente:", process.env.EMAIL_REMETENTE);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVIDOR,
  port: parseInt(process.env.EMAIL_PORTA),
  secure: process.env.EMAIL_SEGURANCA === "ssl", // true se porta 465
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASS
  }
});

const mailOptions = {
  from: `"Canva Espiritual" <${process.env.EMAIL_REMETENTE}>`,
  to: "gustavo_poc@hotmail.com", // 👈 Troque para seu e-mail real
  subject: "📬 Teste de envio via Amazon SES",
  text: "Este é um teste de envio simples via Amazon SES. Tudo funcionando com fé e código! 🙌✨"
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("❌ Erro ao enviar:", error);
  } else {
    console.log("✅ E-mail enviado com sucesso!");
    console.log("📨 Resposta:", info.response);
  }
});
