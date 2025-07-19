const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const pool = require('../db'); 

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

  // 🔍 Buscar arquétipo a partir do código
  let arquetipo = {};
  if (data.codigo_arquetipo) {
    const resultado = await pool.query('SELECT * FROM arquetipos WHERE chave_correspondencia = $1', [data.codigo_arquetipo]);
    if (resultado.rows.length > 0) {
      arquetipo = resultado.rows[0];
    }
  }

  // 🔍 Buscar detalhes dos frutos
  let frutosDetalhados = [];
  if (data.respostas_codificadas && Array.isArray(data.respostas_codificadas)) {
    const perguntas = await pool.query('SELECT * FROM mapa_da_alma WHERE codigo = ANY($1)', [data.respostas_codificadas]);
    frutosDetalhados = perguntas.rows.map((row, i) => ({
      nome_emocao: row.nivel_emocional,
      texto_resposta: row.texto,
      diagnostico: row.diagnostico_emocional,
      descricao_estado: row.descricao_estado_da_alma,
      vida_familiar: row.exemplo_vida_familiar,
      vida_social: row.exemplo_vida_social,
      vida_profissional: row.exemplo_vida_profissional,
      exercicio: row.exercicio_de_elevacao
    }));
  }

  // Substituições
  html = html.replace('{{gatilho_tatil}}', arquetipo.gatilho_tatil || '');
  html = html.replace('{{gatilho_olfato}}', arquetipo.gatilho_olfativo || '');
  html = html.replace('{{gatilho_audicao}}', arquetipo.gatilho_auditivo || '');
  html = html.replace('{{gatilho_visao}}', arquetipo.gatilho_visual || '');
  html = html.replace('{{gatilho_paladar}}', arquetipo.gatilho_paladar || '');

  html = html.replace('{{nome_tecnico}}', arquetipo.nome_tecnico || '');
  html = html.replace('{{nome_simbolico}}', arquetipo.nome_simbolico || '');
  html = html.replace('{{paragrafo_tecnico}}', arquetipo.paragrafo_tecnico || '');
  html = html.replace('{{paragrafo_simbolico}}', arquetipo.paragrafo_simbolico || '');
  html = html.replace('{{mensagem_chave}}', arquetipo.mensagem_chave || '');

  const htmlFrutos = gerarHtmlFrutos(frutosDetalhados);
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
