// enviar.js (rota chamada ao final do quiz, antes do pagamento)

require('dotenv').config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { v4: uuidv4 } = require("uuid"); // para gerar id 

router.post("/", async (req, res) => {
  const { nome, email, telefone, token, respostas } = req.body;

  console.log("🔔 Dados recebidos:", req.body);

  if (!nome || !email || !respostas || respostas.length !== 12) {
    return res.status(400).send("Dados incompletos para gerar o relatório.");
  }

  try {
    // Gera um ID único de sessão (poderia ser o próprio ID da sessão Stripe futuramente)
    const session_id = uuidv4();

    // Define caminho e estrutura de dados
    const pastaTemp = path.join(__dirname, "../../temp");
    if (!fs.existsSync(pastaTemp)) fs.mkdirSync(pastaTemp);

    const caminho = path.join(pastaTemp, `${session_id}.json`);
    const dadosParaSalvar = { nome, email, telefone, respostas };
    fs.writeFileSync(caminho, JSON.stringify(dadosParaSalvar, null, 2), "utf8");

    // Retorna o session_id para ser usado na próxima etapa (pagamento)
    res.json({ session_id });
  } catch (erro) {
    console.error("❌ Erro ao salvar dados temporários:", erro);
    res.status(500).send("Erro interno ao processar os dados.");
  }
});

module.exports = router;
