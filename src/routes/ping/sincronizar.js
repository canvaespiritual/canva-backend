const express = require('express');
const sincronizarComBrevo = require('../../utils/sincronizarComBrevo');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    console.log("⏰ Ping de sincronização recebido");
    await sincronizarComBrevo();
    res.status(200).send("✔️ Sincronização com Brevo concluída.");
  } catch (erro) {
    console.error("❌ Falha na sincronização automática:", erro.message);
    res.status(500).send("Erro ao sincronizar com o Brevo.");
  }
});

module.exports = router;
