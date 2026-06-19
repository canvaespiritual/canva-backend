const express = require("express");
const pool = require("../db");
const filaRelatorios = require("../../filaRelatorios");
const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function gerarSessionId() {
  return "sessao-" + Date.now();
}
function calcularMedia(respostas) {
  const soma = respostas.reduce((acc, val) => acc + Number(val || 0), 0);
  return parseFloat((soma / respostas.length).toFixed(2));
}

function definirZona(respostas) {
  const media = calcularMedia(respostas);
  if (media >= 9) return "virtude";
  if (media >= 5) return "transição";
  return "degradação";
}

const codigosPorPergunta = [
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

function codificarRespostas(respostas) {
  return respostas.map((valor, index) => {
    return codigosPorPergunta[index][Number(valor) - 1];
  });
}

function gerarCodigoArquetipo(respostas) {
  let R = 0, Y = 0, B = 0;

  for (const nota of respostas) {
    if (nota >= 8) R++;
    else if (nota >= 5) Y++;
    else B++;
  }

  return `R${R}Y${Y}B${B}`;
}

// POST /api/prepaid/verificar-email
router.post("/verificar-email", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({
        ok: false,
        motivo: "email_obrigatorio",
        mensagem: "Informe seu e-mail para continuar."
      });
    }

    const creditosQ = await pool.query(`
      SELECT *
      FROM prepaid_quiz_credits
      WHERE lower(email) = lower($1)
        AND status = 'paid'
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
    `, [email]);

    const creditos = creditosQ.rows || [];

    const disponiveis = creditos.filter(c =>
      Number(c.uses_done || 0) < Number(c.uses_allowed || 0)
    );

    const relatoriosQ = await pool.query(`
      SELECT
        session_id,
        nome,
        email,
        pdf_url,
        tipo_relatorio,
        data_quiz,
        data_pagamento,
        criado_em
      FROM diagnosticos
      WHERE lower(email) = lower($1)
        AND status_pagamento = 'pago'
      ORDER BY COALESCE(data_pagamento, criado_em) DESC
      LIMIT 20
    `, [email]);

    if (disponiveis.length > 0) {
      return res.json({
        ok: true,
        tem_credito: true,
        creditos_disponiveis: disponiveis.length,
        email,
        nome: disponiveis[0].nome || "",
        relatorios: relatoriosQ.rows || []
      });
    }

    if (creditos.length > 0) {
      return res.json({
        ok: true,
        tem_credito: false,
        motivo: "ja_usado",
        email,
        relatorios: relatoriosQ.rows || []
      });
    }

    return res.json({
      ok: true,
      tem_credito: false,
      motivo: "sem_pagamento",
      email,
      relatorios: relatoriosQ.rows || []
    });

  } catch (err) {
    console.error("[prepaid/verificar-email] erro:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao verificar acesso."
    });
  }
});

// POST /api/prepaid/salvar-quiz-pago
router.post("/salvar-quiz-pago", async (req, res) => {
  const client = await pool.connect();

  try {
    const email = normalizeEmail(req.body?.email);
    const nome = String(req.body?.nome || "Cliente").trim();
    const respostas = Array.isArray(req.body?.respostas) ? req.body.respostas : [];
    const quizTipo = String(req.body?.quiz_tipo || "geral").trim().toLowerCase();

    if (!email || !respostas.length) {
      return res.status(400).json({
        ok: false,
        erro: "Email e respostas são obrigatórios."
      });
    }

    await client.query("BEGIN");

    const creditoQ = await client.query(`
      SELECT *
      FROM prepaid_quiz_credits
      WHERE lower(email) = lower($1)
        AND status = 'paid'
        AND uses_done < uses_allowed
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
      LIMIT 1
      FOR UPDATE
    `, [email]);

    if (!creditoQ.rowCount) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        ok: false,
        erro: "Nenhum crédito disponível para este e-mail."
      });
    }

    const credito = creditoQ.rows[0];
    const session_id = gerarSessionId();
    const respostasCodificadas = codificarRespostas(respostas);
    const media = calcularMedia(respostas);
    const zona = definirZona(respostas);
    const codigoArquetipo = gerarCodigoArquetipo(respostas);

    await client.query(`
      INSERT INTO diagnosticos (
        session_id,
        nome,
        email,
        respostas_numericas,
        respostas_codificadas,
        media_vibracional,
        zona_predominante,
        codigo_arquetipo,
        status_pagamento,
        tipo_pagamento,
        valor_pago,
        moeda,
        data_quiz,
        data_pagamento,
        criado_em,
        status_processo,
        gateway,
        tipo_relatorio,
        affiliate_ref,
        updated_at
        )
     VALUES (
        $1, $2, $3, $4::jsonb,
        $5::jsonb,
        $6,
        $7,
        $8,
        'pago',
        'prepaid',
        0,
        'BRL',
        NOW(),
        NOW(),
        NOW(),
        'pendente',
        $9,
        'completo',
        $10,
        NOW()
        )
    `, [
        session_id,
        nome,
        email,
        JSON.stringify(respostas),
        JSON.stringify(respostasCodificadas),
        media,
        zona,
        codigoArquetipo,
        credito.gateway || "prepaid",
        credito.affiliate_ref || null
        ]);

    await client.query(`
      UPDATE prepaid_quiz_credits
      SET uses_done = uses_done + 1
      WHERE id = $1
    `, [credito.id]);

    await client.query("COMMIT");
    await filaRelatorios.add("gerar-relatorio", { session_id });

console.log("[prepaid] relatório enfileirado:", session_id);

    return res.json({
      ok: true,
      session_id,
      redirect: `/aguarde.html?session_id=${encodeURIComponent(session_id)}`
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[prepaid/salvar-quiz-pago] erro:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao salvar quiz pré-pago."
    });
  } finally {
    client.release();
  }
});
router.get("/teste", async (req, res) => {

  const email = "primeirogod@gmail.com";

  const creditosQ = await pool.query(`
    SELECT *
    FROM prepaid_quiz_credits
    WHERE lower(email) = lower($1)
  `, [email]);

  return res.json({
    total: creditosQ.rowCount,
    registros: creditosQ.rows
  });

});
module.exports = router;