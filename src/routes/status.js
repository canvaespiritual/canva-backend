const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.get('/:session_id', (req, res) => {
  const sessionId = req.params.session_id;
  const caminho = path.join(__dirname, '../../temp/prontos', `${sessionId}.pdf`);

  const existe = fs.existsSync(caminho);

  res.json({ pronto: existe });
});

module.exports = router;
