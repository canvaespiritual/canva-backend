const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function carregarPlanilha(abas = ['Sheet1']) {
  const caminho = path.join(__dirname, '../../data/planilhas/Mapa_da_Alma.xlsx');
  const planilha = xlsx.readFile(caminho);
  const resultado = {};
  abas.forEach(nomeAba => {
    const sheet = planilha.Sheets[nomeAba];
    resultado[nomeAba] = xlsx.utils.sheet_to_json(sheet);
  });
  return resultado;
}

function carregarArquetiposJson() {
  const caminho = path.join(__dirname, '../../data/json/arquetipos_reorganizados_v2.json');
  const conteudo = fs.readFileSync(caminho, 'utf8');
  return JSON.parse(conteudo);
}

function gerarGraficoVibracional(frutos) {
  const labels = frutos.map(f => f.fruto_nome || f.nome_emocao || 'Fruto');
  const data = frutos.map(f => {
    const match = f.codigo.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  });
  const backgroundColors = frutos.map(f => {
    if (f.zona === '🔴') return '#EF4444';
    if (f.zona === '⚪') return '#FACC15';
    if (f.zona === '🔵') return '#3B82F6';
    return '#999999';
  });

  const chart = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Nível Vibracional',
        data: data,
        backgroundColor: backgroundColors
      }]
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}`;
}

function gerarGraficoPercentual(mediaPercentual) {
  const valor = parseInt(mediaPercentual);
  const zona = valor < 45 ? '#EF4444' : valor > 55 ? '#3B82F6' : '#FACC15';

  const chart = {
    type: 'bar',
    data: {
      labels: ['Média Vibracional'],
      datasets: [{
        label: '% entre 1 a 13',
        data: [valor],
        backgroundColor: [zona]
      }]
    },
    options: {
      scales: {
        y: { max: 100, min: 0 }
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}`;
}

function normalizar(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function gerarJsonRelatorio(respostasUsuario, nomeUsuario = "Usuário Anônimo") {
  const { Sheet1: baseFrutos } = carregarPlanilha();
  const arquetipos = carregarArquetiposJson();

  const frutos = respostasUsuario.map((codigo) => {
    const linha = baseFrutos.find((item) => item.codigo === codigo);
    if (!linha) return null;

    return {
      codigo: linha.codigo,
      nome_emocao: linha["Nível Emocional"],
      texto_resposta: linha["text"],
      diagnostico: linha["Diagnóstico Emocional"],
      descricao_estado: linha["Descrição do Estado da Alma"],
      vida_familiar: linha["Exemplo Vida Familiar"],
      vida_social: linha["Exemplo Vida Social"],
      vida_profissional: linha["Exemplo Vida Profissional"],
      exercicio: linha["Exercício de Elevação"],
      zona: linha["Zona"],
      fruto_nome: linha["Fruto"] || linha["Nível Emocional"] || "Fruto"
    };
  }).filter(Boolean);

  // Garante que todos os níveis sejam válidos
  const zonas = frutos.map(f => {
    const match = f.codigo.match(/\d+/);
    const nivel = match ? parseInt(match[0]) : 0;
    if (nivel >= 1 && nivel <= 4) return '🔴';
    if (nivel >= 5 && nivel <= 8) return '⚪';
    if (nivel >= 9 && nivel <= 13) return '🔵';
    return '⚪'; // padrão neutro se inválido
  });

  const contagem = {
    R: zonas.filter(z => z === '🔴').length,
    Y: zonas.filter(z => z === '⚪').length,
    B: zonas.filter(z => z === '🔵').length
  };

  const chave = `R${contagem.R}Y${contagem.Y}B${contagem.B}`;
  const chaveNormalizada = normalizar(chave);
  console.log('🔑 Chave gerada:', chaveNormalizada);

  const arquétipo = arquetipos[chaveNormalizada] || {
    codigo: "N/A",
    tecnico: "Desconhecido",
    simbolico: "Desconhecido",
    diagnostico: "Não foi possível identificar um arquétipo.",
    simbolico_texto: "",
    mensagem: "Tente novamente com respostas válidas.",
    gatilho_tatil: "",
    gatilho_olfato: "",
    gatilho_audicao: "",
    gatilho_visao: "",
    gatilho_paladar: ""
  };

  const niveis = frutos.map(f => {
    const match = f.codigo.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  });
  const mediaNumerica = niveis.reduce((acc, val) => acc + val, 0) / niveis.length;
  const mediaPercentual = Math.round((mediaNumerica - 1) / 12 * 100);

  let zonaMedia = 'Neutra';
  if (mediaPercentual < 45) zonaMedia = 'Degradante';
  else if (mediaPercentual > 55) zonaMedia = 'Virtuosa';

  return {
    nome: nomeUsuario,
    data: new Date().toLocaleDateString(),
    media_vibracional: mediaNumerica.toFixed(2),
    media_percentual: `${mediaPercentual}%`,
    zona: zonaMedia,
    chave_correspondencia: chave,
    arquétipo_tecnico: arquétipo.tecnico,
    arquétipo_simbolico: arquétipo.simbolico,
    mensagem_zona: arquétipo.mensagem,
    diagnostico_arquétipo: arquétipo.diagnostico,
    reflexao_simbolica: arquétipo.simbolico_texto,
     gatilho_tatil: arquétipo.gatilho_tatil,
    gatilho_olfato: arquétipo.gatilho_olfato,
    gatilho_audicao: arquétipo.gatilho_audicao,
    gatilho_visao: arquétipo.gatilho_visao,
    gatilho_paladar: arquétipo.gatilho_paladar,
    
    frutos,
    grafico_vibracional_url: gerarGraficoVibracional(frutos),
    grafico_percentual_url: gerarGraficoPercentual(mediaPercentual)
  };
}

module.exports = { carregarPlanilha, gerarJsonRelatorio };
