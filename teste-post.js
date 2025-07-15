const axios = require('axios');

const data = {
  nome: "Gustavo Prado",
  respostas: ["AM01", "AG05", "BO09", "CD04", "DE05", "EF06", "FG07", "GH08", "HI09", "IJ10", "JK11", "KL12"]
};
console.log('⏳ Enviando requisição para /gerar-relatorio...');

axios.post('http://localhost:3000/gerar-relatorio', data, {
  responseType: 'arraybuffer' // para lidar com o PDF
})
.then(response => {
  const fs = require('fs');
  fs.writeFileSync('teste-relatorio.pdf', response.data);
  console.log('✅ PDF gerado e salvo como teste-relatorio.pdf');
})
.catch(error => {
  console.error('❌ Erro ao fazer POST:', error.message);
});
