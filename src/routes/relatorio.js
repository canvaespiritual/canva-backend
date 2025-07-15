const express = require('express');
const path = require('path');
const fs = require('fs');
const { gerarJsonRelatorio } = require('../utils/processador');
const { createPdfFromHtml } = require('../services/relatorioPDF');

const router = express.Router();

router.post('/', async (req, res) => {
  console.log('🚨 Rota /gerar-relatorio foi chamada');

  const respostas = req.body.respostas;
  const nome = req.body.nome || 'Usuário Anônimo';
  const tipoRelatorio = req.body.tipoRelatorio || 'essencial'; // 👈 Aqui pegamos o tipo

  if (!respostas || !Array.isArray(respostas) || respostas.length !== 12) {
    return res.status(400).send('❌ Corpo da requisição inválido. Envie um array com 12 respostas.');
  }

  try {
    const json = gerarJsonRelatorio(respostas, nome);

    // Passa o tipo para a função de geração de PDF
    const pdfBuffer = await createPdfFromHtml(json, tipoRelatorio);

    const filename = `relatorio_${nome.replace(/\s/g, '_')}_${Date.now()}.pdf`;
    const savePath = path.join(__dirname, '../../relatorios', filename);

    // Salva no disco
    fs.writeFileSync(savePath, pdfBuffer);

    console.log(`✅ PDF salvo em: ${savePath}`);

    res.json({
      mensagem: 'PDF gerado com sucesso!',
      caminho: `/relatorios/${filename}`
    });

  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).send('Erro ao gerar o PDF.');
  }
});

module.exports = router;
