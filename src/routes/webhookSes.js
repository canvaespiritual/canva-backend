const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
  const evento = req.body;

  try {
    const mail = evento.mail;
    const tipo = evento.eventType;
    const diagnostico_id = mail && mail.tags && mail.tags.diagnostico_id?.[0]; // precisa vir como tag no SES

    if (!diagnostico_id || !tipo) {
      console.warn("Evento ignorado: dados incompletos.", evento);
      return res.status(400).json({ error: 'Evento incompleto.' });
    }

    let observacao = "";

    switch (tipo) {
      case 'Delivery':
        observacao = "E-mail entregue com sucesso pelo SES";
        break;
      case 'Bounce':
        observacao = evento.bounce.bounceType + ": " + evento.bounce.bouncedRecipients[0].diagnosticCode;
        break;
      case 'Complaint':
        observacao = "Usuário marcou como spam";
        break;
      default:
        observacao = "Evento recebido: " + tipo;
    }

    await pool.query(`
      INSERT INTO diagnostico_evento (diagnostico_id, tipo_evento, observacao, criado_em)
      VALUES ($1, $2, $3, NOW())
    `, [diagnostico_id, tipo.toLowerCase(), observacao]);

    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro ao processar webhook SES:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
