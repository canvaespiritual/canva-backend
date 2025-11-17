require('dotenv').config();
const path = require('path');
const AWS = require('aws-sdk');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { createPdfFromHtml } = require('../services/relatorioPDF');
const pool = require('../db');
const enviarEmailViaBrevo = require('../utils/enviarEmailViaBrevo');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

console.log('🧠 WORKER BullMQ ATIVO – VERSÃO SEGURA 28/07\n');

const worker = new Worker('relatorios', async job => {
  const { session_id } = job.data;
  console.log(`🌀 Job recebido para sessão: ${session_id}`);

  if (process.env.PAUSAR_EXECUCAO === 'true') {
  console.log("🚫 Execução pausada por variável de ambiente.");
  return;
}
  try {
    // 🚧 Verifica se relatório já foi processado
    const { rows: [check] } = await pool.query(
      `SELECT status_processo FROM diagnosticos WHERE session_id = $1`,
      [session_id]
    );
    if (check?.status_processo === 'enviado') {
  console.warn(`🔄 Sessão ${session_id} já havia sido processada. Reprocessando mesmo assim.`);
}


    // 🔍 Busca dados no banco
    const session = await buscarDadosDoBanco(session_id);
    if (!session) {
      console.warn(`⚠️ Sessão ${session_id} não encontrada no banco.`);
      return;
    }

    // 🛡️ Protege contra template zumbi dentro do PDF
    const buffer = await createPdfFromHtml(session, session.tipoRelatorio || 'essencial');

    // ☁️ Upload para o S3
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

    // 📧 Envio principal — se falhar, NÃO impede salvar pdf_url
try {
  await enviarEmailViaBrevo({
    email: session.email,
    nome: session.nome,
    sessionId: session_id,
    linkPdf: s3Url,
    idioma: session.idioma
  });
} catch (err) {
  console.warn(`⚠️ Falha ao enviar e-mail principal: ${err.message}`);
  // aqui você já grava email_erro no enviarEmailViaBrevo, então só registra aviso
}

// 📤 Envio opcional para e-mail corrigido
if (
  session.email_corrigido &&
  session.email_corrigido !== session.email &&
  !session.email_corrigido_enviado
) {
  try {
    console.log(`📤 Enviando cópia para o e-mail corrigido: ${session.email_corrigido}`);
    await enviarEmailViaBrevo({
      email: session.email_corrigido,
      nome: session.nome,
      sessionId: session_id,
      linkPdf: s3Url,
      idioma: session.idioma
    });

    await pool.query(`
      UPDATE diagnosticos
      SET email_corrigido_enviado = true
      WHERE session_id = $1
    `, [session_id]);
  } catch (err) {
    console.warn(`⚠️ Falha ao enviar cópia para e-mail corrigido: ${err.message}`);
  }
}

    // 🗃️ Atualiza status no banco
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

    console.log(`✅ Relatório da sessão ${session_id} enviado com sucesso!\n`);

  } catch (error) {
    console.error(`❌ Erro ao processar relatório da sessão ${session_id}:`, error.message);
    // (opcional) lançar erro para reprocessamento ou registrar em logs externos
  }
}, { connection });


// 🔍 Função auxiliar
async function buscarDadosDoBanco(sessionId) {
  const { rows: [diagnostico] } = await pool.query(
  `SELECT session_id, nome, email, email_corrigido, email_corrigido_enviado,
          tipo_relatorio, codigo_arquetipo, respostas_codificadas,
          respostas_numericas, idioma
   FROM diagnosticos
   WHERE session_id = $1`,
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
     respostas_numericas: diagnostico.respostas_numericas, 
    session_id: diagnostico.session_id,
    idioma: diagnostico.idioma,
  };
  console.log("🌐 Idioma vindo do banco:", diagnostico.idioma);
    console.log("📌 Tipo de relatório recebido:", diagnostico.tipo_relatorio);
  console.log("📄 Template final usado:", diagnostico.tipo_relatorio || 'essencial');

  if (arquetipo.rows.length > 0) {
    Object.assign(dados, {
      tecnico: arquetipo.rows[0].tecnico,
      simbolico: arquetipo.rows[0].simbolico,
      diagnostico: arquetipo.rows[0].diagnostico,
      simbolico_texto: arquetipo.rows[0].simbolico_texto,
      mensagem: arquetipo.rows[0].mensagem,
      gatilho_tatil: arquetipo.rows[0].gatilho_tatil,
      gatilho_olfato: arquetipo.rows[0].gatilho_olfato,
      gatilho_audicao: arquetipo.rows[0].gatilho_audicao,
      gatilho_visao: arquetipo.rows[0].gatilho_visao,
      gatilho_paladar: arquetipo.rows[0].gatilho_paladar
    });
  }

  return dados;
}
