require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../src/db");

async function gerar() {
  try {

    const { rows } = await pool.query(`
      SELECT
        codigo,
        descricao_estado_da_alma,
        diagnostico_emocional,
        exemplo_vida_familiar,
        exemplo_vida_social,
        exemplo_vida_profissional
      FROM mapa_da_alma
      ORDER BY codigo
    `);

    const dados = {};

    rows.forEach(row => {
      dados[row.codigo] = {
        descricao: row.descricao_estado_da_alma || "",
        diagnostico: row.diagnostico_emocional || "",
        familiar: row.exemplo_vida_familiar || "",
        social: row.exemplo_vida_social || "",
        profissional: row.exemplo_vida_profissional || ""
      };
    });

    const conteudo =
`window.detalhesFrutosContextos = ${JSON.stringify(dados, null, 2)};`;

    const destino = path.join(
      __dirname,
      "..",
      "public",
      "frutos-contextos.js"
    );

    fs.writeFileSync(destino, conteudo, "utf8");

    console.log(
      `✅ Arquivo gerado com ${rows.length} registros:`,
      destino
    );

    process.exit(0);

  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  }
}

gerar();