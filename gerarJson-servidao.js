const fs = require('fs');
const csv = require('csv-parser');

const resultados = {};

fs.createReadStream('servidao-detalhes.csv')
  .pipe(csv())
  .on('data', (row) => {
    const codigo = row['codigo']?.trim();
    if (codigo) {
      resultados[codigo] = {
        estado: row['estado']?.trim() || "",
        sinal: row['comportamento']?.trim() || "",
        familiar: row['familiar']?.trim() || "",
        social: row['social']?.trim() || "",
        profissional: row['profissional']?.trim() || "",
        individual: row['individual']?.trim() || ""
      };
    } else {
      console.warn("⚠️ Linha ignorada (sem código):", row);
    }
  })
  .on('end', () => {
    fs.writeFileSync('public/servidao-detalhes.js', 'const detalhesServidao = ' + JSON.stringify(resultados, null, 2) + ';\n\nexport default detalhesServidao;');
    console.log("✅ Arquivo servidao-detalhes.js gerado com sucesso!");
  });
