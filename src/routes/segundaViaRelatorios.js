// src/routes/segundaViaRelatorios.js
const express = require("express");
const pool = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório." });
    }

    email = String(email).trim().toLowerCase();

    const query = `
      SELECT 
        session_id,
        email,
        pdf_url,
        valor_pago,
        tipo_relatorio,
        moeda,
        criado_em,
        data_pagamento,
        status_pagamento
      FROM diagnosticos
      WHERE email = $1
        AND status_pagamento = 'pago'
        AND pdf_url IS NOT NULL
        AND criado_em >= NOW() - INTERVAL '7 days'
      ORDER BY criado_em DESC
    `;

    const { rows } = await pool.query(query, [email]);

    return res.json({
      email,
      reports: rows,
    });
  } catch (err) {
    console.error("❌ Erro na busca de segunda via:", err);
    return res
      .status(500)
      .json({ error: "Erro ao buscar relatórios. Tente novamente mais tarde." });
  }
});

module.exports = router;
