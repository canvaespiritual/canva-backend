const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const router = express.Router();

const getStatusFromDB = require("../services/getStatusFromDB");
const protegerRota = require("../middlewares/authMiddleware");

const basePath = path.join(__dirname, "..", "..", "temp");
const pastaRespondidos = path.join(basePath, "respondidos");
const pastaPendentes = path.join(basePath, "pendentes");

// 📥 Exportar como XLSX
router.get("/exportar-xlsx", protegerRota, (req, res) => {
  const dados = gerarRelatorioDeStatus();

  const dadosFormatados = dados.map((item) => ({
    "Session ID": item.sessionId,
    Nome: item.nome,
    Email: item.email,
    Tipo: item.tipo,
    Status: item.alerta,
    "Minutos de Espera": item.minutosAguardando || "-",
    "Criado em": item.criado_em || "-",
    "Confirmado em": item.data_confirmacao || "-",
    "Gerado em": item.dataGeracao || "-"
  }));

  const ws = XLSX.utils.json_to_sheet(dadosFormatados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatorios");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=relatorios.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

// 🧠 Página principal protegida
router.get("/admin.html", protegerRota, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "admin.html"));
});

// 📊 Dados de status
router.get("/status-completo", protegerRota, async (req, res) => {
  try {
    const lista = await getStatusFromDB();
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar dados do banco" });
  }
});


// 📤 Reenviar relatório
router.post("/reenviar/:session_id", protegerRota, (req, res) => {
  const sessionId = req.params.session_id;
  const caminho = path.join(pastaRespondidos, `${sessionId}.json`);

  if (!fs.existsSync(caminho)) {
    return res.status(404).send("Relatório não encontrado.");
  }

  console.log(`📧 Reenvio simulado para sessão: ${sessionId}`);
  res.send("✅ Reenvio executado (simulação).");
});

// ♻️ Reprocessar PDF
router.post("/reprocessar/:session_id", protegerRota, (req, res) => {
  const sessionId = req.params.session_id;
  const origem = path.join(pastaRespondidos, `${sessionId}.json`);
  const destino = path.join(pastaPendentes, `${sessionId}.json`);

  if (!fs.existsSync(origem)) {
    return res.status(404).send("Arquivo respondido não encontrado.");
  }

  try {
    fs.copyFileSync(origem, destino);
    console.log(`♻️ Reprocessado: ${sessionId} movido para pendentes.`);
    res.send("✅ Reprocessamento iniciado com sucesso.");
  } catch (error) {
    console.error("Erro ao reprocessar:", error);
    res.status(500).send("Erro ao reprocessar.");
  }
});

// 💸 Reembolsar
router.post("/reembolsar/:session_id", protegerRota, (req, res) => {
  const sessionId = req.params.session_id;
  console.log(`💸 Reembolso simulado para sessão: ${sessionId}`);
  res.send("✅ Reembolso simulado com sucesso.");
});

module.exports = router;
