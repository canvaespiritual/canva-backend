const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.post("/", (req, res) => {
  try {
    const dados = req.body;

    if (!dados.session_id || !dados.nome || !dados.email || !dados.respostas) {
      return res.status(400).send("Dados incompletos.");
    }

    const arquivo = `${dados.session_id}.json`;
    const caminho = path.join(__dirname, "../../temp/respondidos", arquivo);

    const dadosCompletos = {
      session_id: dados.session_id,
      nome: dados.nome,
      email: dados.email,
      respostas: dados.respostas,
      tipoRelatorio: null,
      payment_id: null,
      status_pagamento: "pendente",
      criado_em: new Date().toISOString()
    };

    fs.writeFileSync(caminho, JSON.stringify(dadosCompletos, null, 2), "utf8");

    res.status(200).send("Sessão salva com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao salvar sessão:", error);
    res.status(500).send("Erro ao salvar sessão.");
  }
});

module.exports = router;
