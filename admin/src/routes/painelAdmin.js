const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
const router = express.Router();

const getStatusFromDB = require("../services/getStatusFromDB");
const protegerRota = require("../middlewares/authMiddleware");
const pool = require("../../../src/db");

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

// 🎁 Gerar relatório completo como cortesia
router.post("/gerar-cortesia/:session_id", protegerRota, async (req, res) => {
  const sessionId = req.params.session_id;

  let connection;
  let queueEventsConnection;
  let queue;
  let queueEvents;
  let tipoOriginal;

  try {
    // 1. Confirma que a sessão existe
    const { rows } = await pool.query(
      `
        SELECT
          tipo_relatorio,
          data_pagamento,
          data_envio_relatorio
        FROM diagnosticos
        WHERE session_id = $1
      `,
      [sessionId]
    );

    if (!rows.length) {
      return res.status(404).send("Sessão não encontrada.");
    }

    const diagnostico = rows[0];

    // Evita gerar novamente se já existe PDF
    if (diagnostico.data_envio_relatorio) {
      return res.status(409).send("Este relatório já foi gerado.");
    }

    tipoOriginal = diagnostico.tipo_relatorio || "essencial";

    console.log(
      `🎁 Cortesia solicitada para ${sessionId}. Tipo original: ${tipoOriginal}`
    );

    // 2. Temporariamente transforma o relatório em completo
    await pool.query(
      `
        UPDATE diagnosticos
        SET tipo_relatorio = 'completo'
        WHERE session_id = $1
      `,
      [sessionId]
    );

    // 3. Conecta na mesma fila usada pelo disparar-lucy.js
    connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null
    });

    queueEventsConnection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null
    });

    queue = new Queue("relatorios", {
      connection
    });

    queueEvents = new QueueEvents("relatorios", {
      connection: queueEventsConnection
    });

    await queueEvents.waitUntilReady();

    // 4. Enfileira a geração
    const job = await queue.add(
      "gerar_relatorio",
      { session_id: sessionId },
      {
        removeOnComplete: true,
        attempts: 3
      }
    );

    console.log(`🌀 Cortesia enfileirada. Job: ${job.id}`);

    // 5. Espera exatamente como o disparar-lucy.js já faz
    await job.waitUntilFinished(
      queueEvents,
      180000
    );

    console.log(`✅ Cortesia gerada: ${sessionId}`);

    res.send("✅ Relatório completo gerado como cortesia.");

  } catch (error) {
    console.error(
      `❌ Erro ao gerar cortesia ${sessionId}:`,
      error
    );

    if (!res.headersSent) {
      res.status(500).send(
        "❌ Não foi possível gerar o relatório como cortesia."
      );
    }

  } finally {

    // Restaura o tipo que a pessoa tinha originalmente
    if (tipoOriginal) {
      try {
        await pool.query(
          `
            UPDATE diagnosticos
            SET tipo_relatorio = $1
            WHERE session_id = $2
          `,
          [tipoOriginal, sessionId]
        );

        console.log(
          `🔄 Tipo original restaurado: ${tipoOriginal}`
        );
      } catch (erroRestore) {
        console.error(
          "Erro restaurando tipo original:",
          erroRestore
        );
      }
    }

    // Fecha APENAS as conexões criadas para essa cortesia.
    try {
      if (queue) await queue.close();
    } catch {}

    try {
      if (queueEvents) await queueEvents.close();
    } catch {}

    try {
      if (connection) await connection.quit();
    } catch {}

    try {
      if (queueEventsConnection) {
        await queueEventsConnection.quit();
      }
    } catch {}
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
