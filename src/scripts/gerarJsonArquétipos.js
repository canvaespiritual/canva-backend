const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Caminhos
const caminhoCSV = path.join(__dirname, '../../data/planilhas/arquetipos.csv');
const pastaDestino = path.join(__dirname, '../../data/json');
const caminhoJSON = path.join(pastaDestino, 'arquetipos.json');

// Função utilitária para normalizar campos
const normalizar = (str) =>
  String(str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();

// Lê o CSV
const planilha = xlsx.readFile(caminhoCSV, { type: 'file', raw: false });
const aba = planilha.Sheets[planilha.SheetNames[0]];
const registros = xlsx.utils.sheet_to_json(aba);

// Transforma em dicionário por chave de correspondência
const resultado = {};
registros.forEach((linha) => {
  const chave = normalizar(linha["Chave de Correspondência"]);
  if (!chave) return;

  resultado[chave] = {
    codigo: linha["Código do Arquétipo"],
    tecnico: linha["Nome Técnico"],
    simbolico: linha["Nome Simbólico"],
    diagnostico: linha["Parágrafo Diagnóstico (Técnico)"],
    simbolico_texto: linha["Parágrafo Reflexivo (Simbólico)"],
    mensagem: linha["Mensagem-Chave"],
    gatilho_tatil: linha["Gatilho Tátil"],
    gatilho_olfato: linha["Gatilho Olfato"],
    gatilho_audicao: linha["Gatilho Audição"],
    gatilho_visao: linha["Gatilho Visão"],
    gatilho_paladar: linha["Gatilho Paladar"]
  };
});

// Cria pasta caso não exista
if (!fs.existsSync(pastaDestino)) {
  fs.mkdirSync(pastaDestino, { recursive: true });
}

// Salva como JSON
fs.writeFileSync(caminhoJSON, JSON.stringify(resultado, null, 2), 'utf8');
console.log(`✅ Arquivo arquetipos.json gerado com sucesso com ${Object.keys(resultado).length} arquétipos.`);
