const fs = require('fs');
const csv = require('csv-parser');

const resultados = {};

fs.createReadStream('bencao-detalhes.csv')
  .pipe(csv())
  .on('data', (row) => {
    const codigo = row['CÓDIGO']?.trim();

    if (codigo) {
      resultados[codigo] = {
        estado: row['Nível e Estado']?.trim() || "",
        sinal: row['Sinal Comportamental']?.trim() || "",
        familiar: row['Familiar']?.trim() || "",
        social: row['Social/Amizades']?.trim() || "",
        profissional: row['Profissional']?.trim() || "",
        individual: row['Individual/Conjugal']?.trim() || ""
      };
    } else {
      console.warn("⚠️ Linha ignorada (sem código):", row);
    }
  })
  .on('end', () => {
    fs.writeFileSync(
      'public/bencao-detalhes.js',
      'const detalhesBencao = ' + JSON.stringify(resultados, null, 2) + ';\n\nexport default detalhesBencao;'
    );
    console.log("✅ Arquivo bencao-detalhes.js gerado com sucesso!");
  });
