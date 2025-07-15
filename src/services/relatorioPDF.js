const fs = require('fs');
const pdf = require('html-pdf');

function gerarHtmlFrutos(frutos) {
  return frutos.map((f, i) => `
    <div class="bloco">
      <h2>🔎 Fruto ${i + 1}: ${f.nome_emocao}</h2>
      <p><strong>Emoção detectada:</strong> ${f.texto_resposta}</p>
      <p><strong>Diagnóstico:</strong> ${f.diagnostico}</p>
      <p><strong>Descrição do estado da alma:</strong> ${f.descricao_estado}</p>
      <p><strong>🏠 Vida Familiar:</strong> ${f.vida_familiar}</p>
      <p><strong>👥 Vida Social:</strong> ${f.vida_social}</p>
      <p><strong>💼 Vida Profissional:</strong> ${f.vida_profissional}</p>
      <p><strong>🧘 Exercício de Elevação:</strong> ${f.exercicio}</p>
    </div>
  `).join('\n');
}

async function createPdfFromHtml(data, tipo = 'essencial') {
  // Simula demora forçada (usado para testar o modo assíncrono)
  //await new Promise(resolve => setTimeout(resolve, 16000));


  // Define o caminho do template com base no tipo de relatório
  let htmlPath;
  switch (tipo) {
    case 'completo':
      htmlPath = './templates/relatorio_completo.html';
      break;
    case 'premium':
      htmlPath = './templates/relatorio_premium.html';
      break;
    case 'essencial':
    default:
      htmlPath = './templates/relatorio_essencial.html';
      break;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');

  // Substituição direta dos gatilhos espirituais
  html = html.replace('{{gatilho_tatil}}', data.gatilho_tatil || '');
  html = html.replace('{{gatilho_olfato}}', data.gatilho_olfato || '');
  html = html.replace('{{gatilho_audicao}}', data.gatilho_audicao || '');
  html = html.replace('{{gatilho_visao}}', data.gatilho_visao || '');
  html = html.replace('{{gatilho_paladar}}', data.gatilho_paladar || '');

  // Substitui o bloco de frutos gerado manualmente
  const htmlFrutos = gerarHtmlFrutos(data.frutos || []);
  html = html.replace('{{html_frutos}}', htmlFrutos);

  // Substituição de demais campos genéricos
  Object.entries(data).forEach(([chave, valor]) => {
    if (typeof valor === 'string' || typeof valor === 'number') {
      html = html.replaceAll(`{{${chave}}}`, valor);
    }
  });

  return new Promise((resolve, reject) => {
    pdf.create(html, { format: 'A4' }).toBuffer((err, buffer) => {
      if (err) return reject(err);
      resolve(buffer);
    });
  });
}

module.exports = { createPdfFromHtml };
