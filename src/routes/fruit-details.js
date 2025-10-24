// src/routes/fruit-details.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * GET /api/fruit-details?lang=en
 * -> { "PC01": { description: "...", diagnostic: "..." }, ... }
 */
router.get('/api/fruit-details', async (req, res) => {
  const lang = (req.query.lang || 'en').slice(0,2);

  const sql = `
    SELECT entity_id AS code,
           MAX(CASE WHEN field='descricao_estado_da_alma' THEN text END) AS description,
           MAX(CASE WHEN field='diagnostico_emocional'  THEN text END) AS diagnostic
    FROM i18n_translations
    WHERE entity='mapa_da_alma' AND lang=$1
    GROUP BY entity_id
    ORDER BY entity_id
  `;

  try {
    const { rows } = await pool.query(sql, [lang]);

    // fallback PT se não houver nessa língua (opcional)
    let list = rows;
    if (!rows || rows.length === 0) {
      const fb = await pool.query(sql, ['pt']);
      list = fb.rows;
    }

    const out = {};
    for (const r of list) {
      out[r.code] = {
        description: r.description || '',
        diagnostic:  r.diagnostic  || ''
      };
    }
    res.json(out);
  } catch (err) {
    console.error('fruit-details error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
