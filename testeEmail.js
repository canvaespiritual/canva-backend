require('dotenv').config();
const { createTransport } = require('nodemailer');

// 📤 Função de envio do link por e-mail
async function testarEnvio() {
  const destinatario = 'gustavopradoc@gmail.com';
  const nome = 'Gustavo Prado';
  const sessionId = 'sessao-1752805989008';
  const pdfUrl = 'https://meu-bucket-webhooks.s3.us-east-2.amazonaws.com/sessao-1752805989008.pdf';

  console.log('🔍 Preparando transporte SMTP...');

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_REMETENTE,
      pass: process.env.SENHA_EMAIL_APP
    }
  });

  console.log(`📤 Enviando e-mail para ${destinatario} com link: ${pdfUrl}`);

  const mailOptions = {
    from: process.env.EMAIL_REMETENTE,
    to: destinatario,
    subject: 'Seu Relatório Espiritual – Canva Espiritual',
    text: `
Olá ${nome},

Seu diagnóstico espiritual está pronto! Você pode acessar seu relatório diretamente pelo link abaixo:

📄 ${pdfUrl}

Se tiver qualquer dúvida ou desejar reenviar para outro endereço, estamos à disposição.

Com fé, sabedoria e propósito — Canva Espiritual
    `
  };

  try {
    const resultado = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail enviado com sucesso!');
    console.log('📦 Detalhes:', resultado.response);
  } catch (erro) {
    console.error('❌ Erro ao enviar e-mail:', erro.message);
  }
}

testarEnvio().then(() => {
  console.log('🏁 Teste concluído.');
}).catch((err) => {
  console.error('❗ Erro inesperado:', err.message);
});
