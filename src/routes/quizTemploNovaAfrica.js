const express = require("express");
const path = require("node:path");
const pool = require("../db");
const { renderReportHtml } = require("../services/relatorioPDF");
const { niveis } = require("../../public/quiz-templo-nova-africa");

const router = express.Router();
const pagina = "/mapa-da-alma-templo-nova-africa";
const prefixos = ["PC", "AL", "PA", "CA", "CO", "MA", "MO", "FI", "AM", "BE", "BO", "LO"];
const encerramento = Date.parse(
  process.env.QUIZ_TEMPLO_NOVA_AFRICA_ENCERRA_EM || "2026-11-28T00:00:00-03:00"
);
const encerrado = "O acesso ao Mapa da Alma da palestra foi encerrado.";

function verificarAcesso(req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  if (process.env.QUIZ_TEMPLO_NOVA_AFRICA_ATIVO === "false" ||
      !Number.isFinite(encerramento) || Date.now() >= encerramento) {
    return res.status(410).type("text").send(encerrado);
  }
  next();
}

router.get(pagina, verificarAcesso, (req, res) => {
  res.sendFile(path.resolve(__dirname, "../../templates/quiz-templo-nova-africa.html"));
});

router.post(pagina + "/relatorio", verificarAcesso, async (req, res) => {
  const { id, respostas, email = "", telefone = "" } = req.body || {};
  const codigosValidos = Array.isArray(respostas) && respostas.length === prefixos.length &&
    prefixos.every((prefixo, indice) => niveis.some(nivel =>
      respostas[indice] === prefixo + String(nivel).padStart(2, "0")
    ));

  if (!codigosValidos || typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).type("text").send("Complete as 12 perguntas para ver seu relatório.");
  }

  if (typeof email !== "string" || typeof telefone !== "string") {
    return res.status(400).type("text").send("Revise os dados de contato e tente novamente.");
  }

  const emailLimpo = email.trim().toLowerCase();
  const telefoneLimpo = telefone.trim();
  if (emailLimpo && (emailLimpo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo))) {
    return res.status(400).type("text").send("Confira o e-mail ou deixe o campo em branco.");
  }
  if (telefoneLimpo && (telefoneLimpo.length > 40 || !/^[\d()+ .-]+$/.test(telefoneLimpo) ||
      telefoneLimpo.replace(/\D/g, "").length < 8)) {
    return res.status(400).type("text").send("Confira o telefone ou deixe o campo em branco.");
  }

  try {
    const notas = respostas.map(codigo => Number(codigo.slice(-2)));
    const degradantes = notas.filter(nota => nota >= 8).length;
    const virtuosas = notas.filter(nota => nota <= 4).length;
    const neutras = notas.length - degradantes - virtuosas;
    const html = await renderReportHtml({
      nome: "Participante",
      email: "",
      session_id: id,
      tipoRelatorio: "completo",
      respostas_codificadas: respostas,
      codigo_arquetipo: `R${degradantes}Y${neutras}B${virtuosas}`
    }, "completo");

    if (emailLimpo || telefoneLimpo) {
      await pool.query(
        `INSERT INTO quiz_templo_nova_africa_contatos (id, email, telefone)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, telefone = EXCLUDED.telefone`,
        [id, emailLimpo || null, telefoneLimpo || null]
      );
    }

    res.type("html").send(html
      .replace("<meta charset=\"UTF-8\">", '<meta charset="UTF-8"><base href="about:srcdoc"><meta name="viewport" content="width=device-width, initial-scale=1">')
      .replace(/<p[^>]*>(?:Email|Sessão):[^<]*<\/p>/g, "")
      .replace("</style>", "@media (max-width: 600px) { body { padding: 32px 16px; } }</style>")
      .replace(/<a href="https:\/\//g, '<a target="_blank" rel="noopener noreferrer" href="https://'));
  } catch (error) {
    console.error("[quiz-templo-nova-africa] Falha ao preparar relatório:", error.code || error.name);
    res.status(500).type("text").send("Não foi possível abrir o relatório agora. Tente novamente.");
  }
});

module.exports = router;
