const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db"); // ajuste o caminho conforme sua estrutura

const router = express.Router();

// Função para calcular média
function calcularMedia(respostas) {
  const soma = respostas.reduce((acc, val) => acc + val, 0);
  return parseFloat((soma / respostas.length).toFixed(2));
}

// Função para definir zona
function definirZona(respostas) {
  const media = calcularMedia(respostas);
  if (media >= 9) return "virtude";
  if (media >= 5) return "transição";
  return "degradação";
}

router.post("/", async (req, res) => {
  try {
    const dados = req.body;

    if (!dados.session_id || !dados.nome || !dados.email || !dados.respostas) {
      return res.status(400).send("Dados incompletos.");
    }

    const arquivo = `${dados.session_id}.json`;
    const caminho = path.join(__dirname, "../../temp/respondidos", arquivo);

    const codigosPorPergunta = [
      ["PC01", "PC02", "PC03", "PC04", "PC05", "PC06", "PC07", "PC08", "PC09", "PC10", "PC11", "PC12"],
      ["AL01", "AL02", "AL03", "AL04", "AL05", "AL06", "AL07", "AL08", "AL09", "AL10", "AL11", "AL12"],
      ["PA01", "PA02", "PA03", "PA04", "PA05", "PA06", "PA07", "PA08", "PA09", "PA10", "PA11", "PA12"],
      ["CA01", "CA02", "CA03", "CA04", "CA05", "CA06", "CA07", "CA08", "CA09", "CA10", "CA11", "CA12"],
      ["CO01", "CO02", "CO03", "CO04", "CO05", "CO06", "CO07", "CO08", "CO09", "CO10", "CO11", "CO12"],
      ["MA01", "MA02", "MA03", "MA04", "MA05", "MA06", "MA07", "MA08", "MA09", "MA10", "MA11", "MA12"],
      ["MO01", "MO02", "MO03", "MO04", "MO05", "MO06", "MO07", "MO08", "MO09", "MO10", "MO11", "MO12"],
      ["FI01", "FI02", "FI03", "FI04", "FI05", "FI06", "FI07", "FI08", "FI09", "FI10", "FI11", "FI12"],
      ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06", "AM07", "AM08", "AM09", "AM10", "AM11", "AM12"],
      ["BE01", "BE02", "BE03", "BE04", "BE05", "BE06", "BE07", "BE08", "BE09", "BE10", "BE11", "BE12"],
      ["BO01", "BO02", "BO03", "BO04", "BO05", "BO06", "BO07", "BO08", "BO09", "BO10", "BO11", "BO12"],
      ["LO01", "LO02", "LO03", "LO04", "LO05", "LO06", "LO07", "LO08", "LO09", "LO10", "LO11", "LO12"]
    ];

    const respostasCodificadas = dados.respostas.map((valor, index) => {
      return codigosPorPergunta[index][valor - 1];
    });

    let R = 0, Y = 0, B = 0;
    for (const nota of dados.respostas) {
      if (nota >= 8) R++;
      else if (nota >= 5) Y++;
      else B++;
    }
    const codigoArquetipo = `R${R}Y${Y}B${B}`;
    const media = calcularMedia(dados.respostas);
    const zona = definirZona(dados.respostas);

    const dadosCompletos = {
      session_id: dados.session_id,
      nome: dados.nome,
      email: dados.email,
      respostas: dados.respostas,
      respostas_codificadas: respostasCodificadas,
      media_vibracional: media,
      zona_predominante: zona,
      codigo_arquetipo: codigoArquetipo,
      tipoRelatorio: null,
      payment_id: null,
      status_pagamento: "pendente",
      criado_em: new Date().toISOString()
    };

    // Gravação no PostgreSQL
    try {
      await pool.query(`
        INSERT INTO diagnosticos (
          session_id, nome, email, respostas_numericas, respostas_codificadas,
          status_pagamento, status_processo, criado_em,
          media_vibracional, zona_predominante, codigo_arquetipo
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11
        )
      `, [
        dadosCompletos.session_id,
        dadosCompletos.nome,
        dadosCompletos.email,
        JSON.stringify(dadosCompletos.respostas),
        JSON.stringify(dadosCompletos.respostas_codificadas),
        "pendente",
        "iniciado",
        new Date(),
        media,
        zona,
        codigoArquetipo
      ]);

      console.log(`📥 Diagnóstico ${dadosCompletos.session_id} registrado no PostgreSQL.`);
    } catch (erroPg) {
      console.error("❌ Falha ao gravar no PostgreSQL. Abandonando fluxo:", erroPg);
      return res.status(500).send("Erro ao salvar no banco de dados.");
    }

    // Só grava o JSON após sucesso no banco
    await fs.promises.writeFile(caminho, JSON.stringify(dadosCompletos, null, 2), "utf8");

    console.log(`✅ Sessão ${dados.session_id} salva com sucesso.`);
    res.status(200).send("Sessão salva com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao salvar sessão:", error);
    res.status(500).send("Erro ao salvar sessão.");
  }
});

module.exports = router;
