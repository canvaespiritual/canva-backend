// 📂 src/worker/workerRelatorios.js
require('dotenv').config();
const path = require('path');
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { createPdfFromHtml } = require('../services/relatorioPDF');
const pool = require('../db');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

console.log('🧠 Worker BullMQ ativo e escutando fila de relatórios...\n');

const worker = new Worker('relatorios', async job => {

  const { session_id } = job.data;
  console.log(`🌀 Job recebido para sessão: ${session_id}`);

  try {
    const session = await buscarDadosDoBanco(session_id);
    if (!session) {
      console.warn(`⚠️ Sessão ${session_id} não encontrada.`);
      return;
    }

    const buffer = await createPdfFromHtml(session, session.tipoRelatorio || 'essencial');

    const uploadResult = await s3.upload({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${session_id}.pdf`,
      Body: buffer,
      ContentType: 'application/pdf',
    }).promise();

    const s3Url = uploadResult.Location;
    session.pdf_url = s3Url;
    session.pdfGerado = true;
    session.dataGeracao = new Date().toISOString();

    await enviarEmail(session.email, session.nome, session_id, s3Url);

    if (
      session.email_corrigido &&
      session.email_corrigido !== session.email &&
      !session.email_corrigido_enviado
    ) {
      console.log(`📤 Enviando cópia para o e-mail corrigido: ${session.email_corrigido}`);
      await enviarEmail(session.email_corrigido, session.nome, session_id, s3Url);

      await pool.query(`
        UPDATE diagnosticos
        SET email_corrigido_enviado = true
        WHERE session_id = $1
      `, [session_id]);
    }

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
      session_id
    ]);

    console.log(`✅ Relatório da sessão ${session_id} enviado com sucesso!`);

  } catch (error) {
    console.error(`❌ Erro ao processar relatório da sessão ${session_id}:`, error.message);
  }
},
  {
    connection
  }

);


// 🔍 Função auxiliar para montar objeto completo de sessão com dados do banco
async function buscarDadosDoBanco(sessionId) {
  const { rows: [diagnostico] } = await pool.query(
    `SELECT session_id, nome, email, email_corrigido, email_corrigido_enviado, tipo_relatorio, codigo_arquetipo, respostas_codificadas
     FROM diagnosticos WHERE session_id = $1`,
    [sessionId]
  );
  if (!diagnostico) return null;

  const arquetipo = diagnostico.codigo_arquetipo
    ? await pool.query(`SELECT * FROM arquetipos WHERE chave_correspondencia = $1`, [diagnostico.codigo_arquetipo])
    : { rows: [] };

  const dados = {
    nome: diagnostico.nome,
    email: diagnostico.email,
    email_corrigido: diagnostico.email_corrigido,
    tipoRelatorio: diagnostico.tipo_relatorio || 'essencial',
    codigo_arquetipo: diagnostico.codigo_arquetipo,
    respostas_codificadas: diagnostico.respostas_codificadas,
    session_id: diagnostico.session_id,
  };

  if (arquetipo.rows.length > 0) {
    Object.assign(dados, {
      tecnico: arquetipo.rows[0].tecnico,
      simbolico: arquetipo.rows[0].simbolico,
      diagnostico: arquetipo.rows[0].diagnostico,
      simbolico_texto: arquetipo.rows[0].simbolico_texto,
      mensagem: arquetipo.rows[0].mensagem,
      gatilho_tatil: arquetipo.rows[0].gatilho_tatil,
      gatilho_olfato: arquetipo.rows[0].gatilho_olfativo,
      gatilho_audicao: arquetipo.rows[0].gatilho_auditivo,
      gatilho_visao: arquetipo.rows[0].gatilho_visual,
      gatilho_paladar: arquetipo.rows[0].gatilho_paladar
    });
  }

  return dados;
}


// 📧 Função de envio de e-mail com link do PDF
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

    await pool.query(`
      UPDATE diagnosticos
      SET email_enviado_em = NOW(),
          email_erro = NULL
      WHERE session_id = $1
    `, [sessionId]);

  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${destinatario}:`, error.message);

    await pool.query(`
      UPDATE diagnosticos
      SET email_erro = $2
      WHERE session_id = $1
    `, [sessionId, error.message]);
  }
}