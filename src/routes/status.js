const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db'); // Acesso ao PostgreSQL

const router = express.Router();

router.get('/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;

  // Verifica se o PDF existe na pasta local (backup)
  const pdfLocalPath = path.join(__dirname, '../../temp/prontos', `${sessionId}.pdf`);
  const existeLocal = fs.existsSync(pdfLocalPath);

  try {
    // Consulta no banco de dados se existe URL do S3
    const { rows } = await pool.query(
      'SELECT pdf_url FROM diagnosticos WHERE session_id = $1',
      [sessionId]
    );

    const pdfUrl = rows[0]?.pdf_url || null;

    res.json({
      pronto: Boolean(pdfUrl || existeLocal),
      pdf_url: pdfUrl
    });

  } catch (err) {
    console.error(`❌ Erro ao consultar status no banco:`, err.message);

    // Mesmo com erro, responde com status baseado no arquivo local
    res.json({
      pronto: existeLocal,
      pdf_url: null
    });
  }
});

module.exports = router;
