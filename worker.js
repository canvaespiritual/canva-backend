const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { createPdfFromHtml } = require('./src/services/relatorioPDF');

const pastaPendentes = path.join(__dirname, 'temp', 'pendentes');
const pastaProntos = path.join(__dirname, 'temp', 'prontos');
const pastaProcessados = path.join(__dirname, 'temp', 'processados');

console.log('🌀 Worker iniciado. Verificando fila de relatórios a cada 10 segundos...\n');

setInterval(async () => {
  try {
    const arquivos = fs.readdirSync(pastaPendentes).filter(arq => arq.endsWith('.json'));

    if (arquivos.length === 0) {
      console.log('📭 Nenhum relatório pendente no momento.');
      return;
    }

    // Ordena por data de criação
    arquivos.sort((a, b) => {
      const statA = fs.statSync(path.join(pastaPendentes, a)).birthtimeMs;
      const statB = fs.statSync(path.join(pastaPendentes, b)).birthtimeMs;
      return statA - statB;
    });

    for (const arquivo of arquivos) {
      const sessionId = path.basename(arquivo, '.json');
      const jsonPath = path.join(pastaPendentes, arquivo);
      const pdfPath = path.join(pastaProntos, `${sessionId}.pdf`);
      const processadoPath = path.join(pastaProcessados, `${sessionId}.json`);

      const session = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const tipo = session.tipoRelatorio || 'essencial';

      console.log(`⚙️  Gerando PDF da fila: ${sessionId} (${tipo})`);

      try {
        const buffer = await createPdfFromHtml(session, tipo);
        fs.writeFileSync(pdfPath, buffer);

        session.pdfGerado = true;
        session.dataGeracao = new Date().toISOString();

        // Enviar para email principal
        await enviarEmail(session.email, session.nome, pdfPath, sessionId);

        // Enviar para email corrigido (se houver e ainda não foi enviado)
        if (
          session.email_corrigido &&
          session.email_corrigido !== session.email &&
          !session.email_corrigido_enviado
        ) {
          console.log(`📤 Enviando cópia para o e-mail corrigido: ${session.email_corrigido}`);
          await enviarEmail(session.email_corrigido, session.nome, pdfPath, sessionId);
          session.email_corrigido_enviado = true;
        }

        // Atualiza JSON completo e move para processados
        fs.writeFileSync(processadoPath, JSON.stringify(session, null, 2));
        fs.unlinkSync(jsonPath);

        console.log(`✅ PDF pronto e salvo: ${pdfPath}`);

      } catch (err) {
        console.error(`❌ Erro ao gerar o PDF de ${sessionId}:`, err.message);
      }
    }

  } catch (erro) {
    console.error('🔥 Erro geral no worker:', erro.message);
  }

  console.log('🔁 Aguardando próxima verificação...\n');
}, 10000); // a cada 10 segundos

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
