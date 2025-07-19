require('dotenv').config();
const path = require('path');
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const { createPdfFromHtml } = require('./src/services/relatorioPDF');
const pool = require('./src/db'); // ← conexao com PostgreSQL

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

console.log('🌀 Worker iniciado. Verificando fila de relatórios a cada 10 segundos...\n');

setInterval(async () => {
  try {
    const { rows } = await pool.query(`
      SELECT session_id FROM diagnosticos
      WHERE status_processo = 'pago' AND pdf_url IS NULL
      ORDER BY data_criacao ASC
      LIMIT 3
    `);

    if (rows.length === 0) {
      console.log('📭 Nenhum relatório pendente no banco no momento.');
      return;
    }

    for (const { session_id } of rows) {
      try {
        console.log(`⚙️  Processando sessão: ${session_id}`);
        const session = await buscarDadosDoBanco(session_id);
        if (!session) continue;

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

      // ✅ Atualiza o banco para registrar que já foi enviado
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
      } catch (err) {
        console.error(`❌ Erro ao processar sessão ${session_id}:`, err.message);
      }
    }
  } catch (erro) {
    console.error('🔥 Erro geral no worker:', erro.message);
  }

  console.log('🔁 Aguardando próxima verificação...\n');
}, 10000);

// 🔍 Função auxiliar para montar objeto completo de sessão com dados do banco
async function buscarDadosDoBanco(sessionId) {
  const { rows: [diagnostico] } = await pool.query(
  `SELECT session_id, nome, email, email_corrigido, email_corrigido_enviado, tipo_relatorio, codigo_arquetipo, respostas_codificadas
   FROM diagnosticos WHERE session_id = $1`,
  [sessionId]
);
  if (!diagnostico) return null;

  // Carregar arquétipo com base no código da chave de correspondência
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
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${destinatario}:`, error.message);
  }
}
