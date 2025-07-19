require('dotenv').config();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const { createPdfFromHtml } = require('./src/services/relatorioPDF');
const pool = require('./src/db'); // ✅ se worker.js estiver na raiz

const pastaPendentes = path.join(__dirname, 'temp', 'pendentes');
const pastaProntos = path.join(__dirname, 'temp', 'prontos');
const pastaProcessados = path.join(__dirname, 'temp', 'processados');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

console.log('🌀 Worker iniciado. Verificando fila de relatórios a cada 10 segundos...\n');

setInterval(async () => {
  try {
    const arquivos = fs.readdirSync(pastaPendentes).filter(arq => arq.endsWith('.json'));

    if (arquivos.length === 0) {
      console.log('📭 Nenhum relatório pendente no momento.');
      return;
    }

    arquivos.sort((a, b) => {
      const statA = fs.statSync(path.join(pastaPendentes, a)).birthtimeMs;
      const statB = fs.statSync(path.join(pastaPendentes, b)).birthtimeMs;
      return statA - statB;
    });

    for (const arquivo of arquivos) {
      const sessionId = path.basename(arquivo, '.json');
      const jsonPath = path.join(pastaPendentes, arquivo);
      const lockedPath = path.join(pastaPendentes, `${arquivo}.lock`);
      const pdfPath = path.join(pastaProntos, `${sessionId}.pdf`);
      const processadoPath = path.join(pastaProcessados, `${sessionId}.json`);

      if (fs.existsSync(lockedPath)) continue;

      try {
        fs.renameSync(jsonPath, lockedPath);

        const session = JSON.parse(fs.readFileSync(lockedPath, 'utf8'));
        const tipo = session.tipoRelatorio || 'essencial';

        console.log(`⚙️  Gerando PDF da fila: ${sessionId} (${tipo})`);

        const buffer = await createPdfFromHtml(session, tipo);
        fs.writeFileSync(pdfPath, buffer);

        // Upload para S3
        const uploadResult = await s3.upload({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `${sessionId}.pdf`,
          Body: buffer,
          ContentType: 'application/pdf',
        }).promise();

        const s3Url = uploadResult.Location;
        session.pdf_url = s3Url; // <- 🔥 ESSA LINHA É ESSENCIAL
        session.pdfGerado = true;
        session.dataGeracao = new Date().toISOString();

        await enviarEmail(session.email, session.nome, sessionId, s3Url);

        if (session.email_corrigido && session.email_corrigido !== session.email && !session.email_corrigido_enviado) {
          console.log(`📤 Enviando cópia para o e-mail corrigido: ${session.email_corrigido}`);
          await enviarEmail(session.email_corrigido, session.nome, sessionId, s3Url);
          session.email_corrigido_enviado = true;
        }

        fs.writeFileSync(processadoPath, JSON.stringify(session, null, 2));
        fs.unlinkSync(lockedPath);

        // Atualiza o PostgreSQL com URL correta do S3
        try {
          await pool.query(`
            UPDATE diagnosticos
            SET
              status_processo = $1,
              data_envio_relatorio = $2,
              modelo_pdf = $3,
              tipo_relatorio = $4,
              pdf_url = $5
            WHERE session_id = $6
          `, [
            'enviado',
            new Date(),
            'modelo_padrao',
            session.tipoRelatorio || 'essencial',
            s3Url,
            sessionId
          ]);

          console.log(`📌 PostgreSQL atualizado com status 'enviado' e URL do S3 para sessão ${sessionId}`);
        } catch (erroPg) {
          console.error(`⚠️ Erro ao atualizar PostgreSQL para sessão ${sessionId}:`, erroPg.message);
        }

        console.log(`✅ PDF pronto e salvo: ${pdfPath}`);
      } catch (err) {
        console.error(`❌ Erro ao processar ${sessionId}:`, err.message);
        if (fs.existsSync(lockedPath)) fs.renameSync(lockedPath, jsonPath);
      }
    }
  } catch (erro) {
    console.error('🔥 Erro geral no worker:', erro.message);
  }

  console.log('🔁 Aguardando próxima verificação...\n');
}, 10000);

async function enviarEmail(destinatario, nome, sessionId, pdfUrl) {
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
      html: `
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Seu diagnóstico espiritual está pronto!</p>
        <p><a href="${pdfUrl}" target="_blank" style="
            background-color: #0d6efd;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
          ">📥 Baixar Relatório</a></p>
        <br>
        <p>Com luz,<br><em>Equipe Canva Espiritual</em></p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`📨 Link enviado com sucesso para ${destinatario}`);
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${destinatario}:`, error.message);
  }
}
