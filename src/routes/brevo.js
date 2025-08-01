// routes/brevo.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// 👉 Brevo acessa isso para capturar contatos
router.get("/contatos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT nome, email, pagamento_confirmado, relatorio_gerado
      FROM diagnosticos
      WHERE email IS NOT NULL
    `);
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar contatos:", err);
    res.status(500).send("Erro interno");
  }
});

// 👉 Webhook antigo (ainda funciona, mas será substituído pelo mais completo abaixo)
router.post("/email-falha", async (req, res) => {
  const { email, reason } = req.body;
  try {
    await pool.query(
      `UPDATE diagnosticos SET email_erro = $1 WHERE email = $2`,
      [reason || 'desconhecido', email]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao registrar erro de envio:", err);
    res.status(500).send("Erro interno");
  }
});

// 👉 Webhook completo para todos os eventos do Brevo (falha, entrega, abertura, clique)
router.post("/evento-email", async (req, res) => {
  const { email, event } = req.body;

  console.log("📩 Evento recebido do Brevo:", event, "| Email:", email);

  try {
    let campo = null;
    let valor = null;

    switch (event) {
      case 'hard_bounce':
      case 'soft_bounce':
      case 'blocked':
      case 'invalid_email':
        campo = "email_erro";
        valor = event;
        break;
      case 'delivered':
        campo = "email_entregue";
        valor = true;
        break;
      case 'opened':
        campo = "email_aberto";
        valor = true;
        break;
      case 'click':
        campo = "email_clicado";
        valor = true;
        break;
      default:
        console.warn("❓ Evento não tratado:", event);
        return res.sendStatus(204);
    }

    await pool.query(
      `UPDATE diagnosticos SET ${campo} = $1 WHERE email = $2`,
      [valor, email]
    );

    console.log(`✅ Evento '${event}' salvo com sucesso para ${email}`);
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Erro ao salvar evento do Brevo:", err.message);
    res.status(500).send("Erro interno");
  }
});

module.exports = router;
