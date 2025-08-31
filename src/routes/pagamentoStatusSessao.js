const express = require("express");
const pool = require("../db");
const router = express.Router();

router.get("/status-por-sessao/:session_id", async (req, res) => {
  try {
    const { session_id } = req.params;
    const { rows } = await pool.query(
      "SELECT status_pagamento FROM diagnosticos WHERE session_id = $1 LIMIT 1",
      [session_id]
    );
    if (!rows.length) return res.status(404).json({ aprovado: false, status: null });
    const status = String(rows[0].status_pagamento || "").toLowerCase();
    res.json({ aprovado: status === "pago", status: rows[0].status_pagamento || null });
  } catch (e) {
    res.status(500).json({ aprovado: false, status: null });
  }
});

module.exports = router;
