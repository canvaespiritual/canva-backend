const fs = require('fs');
const csv = require('csv-parser');

const resultados = {};

fs.createReadStream('dados.csv') // ou o caminho completo, se necessário
  .pipe(csv())
  .on('data', (row) => {
    const codigo = row['codigo']?.trim();
    const descricao = row['Descrição do Estado da Alma']?.trim();
    const diagnostico = row['Diagnóstico Emocional']?.trim();

    if (codigo && descricao && diagnostico) {
      resultados[codigo] = {
        descricao,
        diagnostico
      };
    } else {
      console.warn(`⚠️ Linha ignorada (faltando campos):`, row);
    }
  })
  .on('end', () => {
    const conteudo = 'const detalhesFrutos = ' + JSON.stringify(resultados, null, 2) + ';\n\nexport default detalhesFrutos;';
    fs.writeFileSync('public/frutos-detalhes.js', conteudo);
    console.log("✅ Arquivo frutos-detalhes.js gerado com sucesso!");
  });
