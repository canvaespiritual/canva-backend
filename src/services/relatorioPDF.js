const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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

  html = html.replace('{{gatilho_tatil}}', data.gatilho_tatil || '');
  html = html.replace('{{gatilho_olfato}}', data.gatilho_olfato || '');
  html = html.replace('{{gatilho_audicao}}', data.gatilho_audicao || '');
  html = html.replace('{{gatilho_visao}}', data.gatilho_visao || '');
  html = html.replace('{{gatilho_paladar}}', data.gatilho_paladar || '');

  const htmlFrutos = gerarHtmlFrutos(data.frutos || []);
  html = html.replace('{{html_frutos}}', htmlFrutos);

  Object.entries(data).forEach(([chave, valor]) => {
    if (typeof valor === 'string' || typeof valor === 'number') {
      html = html.replaceAll(`{{${chave}}}`, valor);
    }
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const buffer = await page.pdf({ format: 'A4' });

  await browser.close();
  return buffer;
}

module.exports = { createPdfFromHtml };
