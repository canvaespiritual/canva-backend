const express = require("express");
const pool = require("../db");
const filaRelatorios = require('../../filaRelatorios');


const router = express.Router();

// Funções auxiliares
function calcularMedia(respostas) {
  const soma = respostas.reduce((acc, val) => acc + val, 0);
  return parseFloat((soma / respostas.length).toFixed(2));
}

function definirZona(respostas) {
  const media = calcularMedia(respostas);
  if (media >= 9) return "virtude";
  if (media >= 5) return "transição";
  return "degradação";
}

function gerarChave(respostas) {
  let R = 0, Y = 0, B = 0;
  for (const nota of respostas) {
    if (nota >= 8) R++;
    else if (nota >= 5) Y++;
    else B++;
  }
  return `R${R}Y${Y}B${B}`;
}

function gerarCodificadas(respostas) {
  const codigos = [
    ["PC01","PC02","PC03","PC04","PC05","PC06","PC07","PC08","PC09","PC10","PC11","PC12"],
    ["AL01","AL02","AL03","AL04","AL05","AL06","AL07","AL08","AL09","AL10","AL11","AL12"],
    ["PA01","PA02","PA03","PA04","PA05","PA06","PA07","PA08","PA09","PA10","PA11","PA12"],
    ["CA01","CA02","CA03","CA04","CA05","CA06","CA07","CA08","CA09","CA10","CA11","CA12"],
    ["CO01","CO02","CO03","CO04","CO05","CO06","CO07","CO08","CO09","CO10","CO11","CO12"],
    ["MA01","MA02","MA03","MA04","MA05","MA06","MA07","MA08","MA09","MA10","MA11","MA12"],
    ["MO01","MO02","MO03","MO04","MO05","MO06","MO07","MO08","MO09","MO10","MO11","MO12"],
    ["FI01","FI02","FI03","FI04","FI05","FI06","FI07","FI08","FI09","FI10","FI11","FI12"],
    ["AM01","AM02","AM03","AM04","AM05","AM06","AM07","AM08","AM09","AM10","AM11","AM12"],
    ["BE01","BE02","BE03","BE04","BE05","BE06","BE07","BE08","BE09","BE10","BE11","BE12"],
    ["BO01","BO02","BO03","BO04","BO05","BO06","BO07","BO08","BO09","BO10","BO11","BO12"],
    ["LO01","LO02","LO03","LO04","LO05","LO06","LO07","LO08","LO09","LO10","LO11","LO12"]
  ];

  return respostas.map((nota, i) => codigos[i][nota - 1]);
}

// 🧪 Rota de simulação
router.post("/simular-pago", async (req, res) => {
  const { session_id, nome, email, respostas } = req.body;

  if (!session_id || !nome || !email || !respostas) {
    return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
  }

  const media = calcularMedia(respostas);
  const zona = definirZona(respostas);
  const chave = gerarChave(respostas);
  const codificadas = gerarCodificadas(respostas);

  try {
    await pool.query(`
      INSERT INTO diagnosticos (
        session_id, nome, email, respostas_numericas, respostas_codificadas,
        status_pagamento, status_processo, criado_em,
        media_vibracional, zona_predominante, codigo_arquetipo,
        tipo_relatorio, modelo_pdf
      ) VALUES (
        $1, $2, $3, $4, $5,
        'pago', 'pendente', NOW(),
        $6, $7, $8,
        'premium', 'modelo_padrao'
      )
    `, [
      session_id, nome, email,
      JSON.stringify(respostas),
      JSON.stringify(codificadas),
      media, zona, chave
    ]);

    // Envia para a fila do BullMQ
    await filaRelatorios.add('gerar-relatorio', { session_id });

    res.json({ mensagem: `✅ Sessão ${session_id} inserida como PAGO e PENDENTE, relatório enviado para a fila.` });
  } catch (error) {
     console.error("❌ Erro ao inserir no banco:", error); // ← ADICIONE ISSO
    res.status(500).json({ erro: "Erro ao inserir no banco." });
  }
});

module.exports = router;
