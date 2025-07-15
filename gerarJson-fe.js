const fs = require('fs');
const csv = require('csv-parser');

const resultados = {};

fs.createReadStream('fe-detalhes.csv')
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
      'public/fe-detalhes.js',
      'const detalhesFe = ' + JSON.stringify(resultados, null, 2) + ';\n\nexport default detalhesFe;'
    );
    console.log("✅ Arquivo fe-detalhes.js gerado com sucesso!");
  });
