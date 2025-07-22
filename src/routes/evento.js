const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/evento
router.post('/', async (req, res) => {
  const { diagnostico_id, tipo_evento, observacao } = req.body;

  if (!diagnostico_id || !tipo_evento) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    await pool.query(`
      INSERT INTO diagnostico_evento (diagnostico_id, tipo_evento, observacao, criado_em)
      VALUES ($1, $2, $3, NOW())
    `, [diagnostico_id, tipo_evento, observacao || null]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar evento:', error);
    res.status(500).json({ error: 'Erro interno ao registrar evento.' });
  }
});

module.exports = router;
