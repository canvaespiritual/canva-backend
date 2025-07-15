const express = require('express');
const fs = require('fs');
const path = require('path');
const { createPdfFromHtml } = require('../services/relatorioPDF');

const router = express.Router();

router.get('/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;

  console.log(`⚙️ Iniciando geração para sessão: ${sessionId}`);

  // Caminho do JSON com os dados da sessão
  const sessionPath = path.join(__dirname, '../../temp', `${sessionId}.json`);

  if (!fs.existsSync(sessionPath)) {
    return res.status(404).send('❌ Sessão não encontrada.');
  }

  // Lê os dados da sessão
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const tipo = session.tipoRelatorio || 'essencial';

  // Define o caminho do PDF pronto
  const pdfPath = path.join(__dirname, '../../temp/prontos', `${sessionId}.pdf`);

  // Tenta gerar o PDF em até 15s
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject('timeout'), 15000)
  );

  const gerarPDF = createPdfFromHtml(session, tipo).then(buffer => {
    fs.writeFileSync(pdfPath, buffer);
    return true;
  });

  try {
    await Promise.race([timeout, gerarPDF]);

    // Se chegou aqui, foi gerado a tempo
    console.log(`✅ PDF gerado no tempo para: ${sessionId}`);
    res.redirect(`/relatorios/${sessionId}.pdf`);
  } catch (e) {
    console.warn(`⚠️ Gerando em segundo plano: ${sessionId}`);

    // Salva pedido na fila
    const pendentePath = path.join(__dirname, '../../temp/pendentes', `${sessionId}.json`);
    fs.writeFileSync(pendentePath, JSON.stringify(session, null, 2));

    // Redireciona para a página de aguardo
    res.redirect(`/aguarde/${sessionId}`);
  }
});

module.exports = router;
