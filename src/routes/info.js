const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.get("/:session_id", (req, res) => {
  const sessionId = req.params.session_id;

  const base = path.join(__dirname, "../../temp");
  const caminhos = [
    path.join(base, "processados", `${sessionId}.json`),
    path.join(base, "pendentes", `${sessionId}.json`),
    path.join(base, "respondidos", `${sessionId}.json`)
  ];

  for (const caminho of caminhos) {
    if (fs.existsSync(caminho)) {
      try {
        const json = fs.readFileSync(caminho, "utf8");
        const dados = JSON.parse(json);
        return res.json(dados);
      } catch (err) {
        console.error("❌ Erro ao ler o JSON da sessão:", err);
        return res.status(500).json({ erro: "Erro ao ler dados da sessão." });
      }
    }
  }

  res.status(404).json({ erro: "Sessão não encontrada." });
});

module.exports = router;
