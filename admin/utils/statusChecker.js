const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '..', '..', 'temp');

const lerArquivos = (pasta) => {
  const dir = path.join(basePath, pasta);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(arquivo => arquivo.endsWith('.json') || arquivo.endsWith('.pdf'));
};

const mapearSessao = nome => nome.replace('.json', '').replace('.pdf', '');

function gerarRelatorioDeStatus() {
  const respondidos = lerArquivos('respondidos').map(mapearSessao);
  const pendentesNomes = lerArquivos('pendentes');
  const pendentes = pendentesNomes.map(mapearSessao);
  const prontos = lerArquivos('prontos').map(mapearSessao);

  const todasSessoes = new Set([...respondidos, ...pendentes, ...prontos]);
  const agora = Date.now();

  const relatorio = [];

  todasSessoes.forEach(sessionId => {
    const status = {
      sessionId,
      respondido: respondidos.includes(sessionId),
      pendente: pendentes.includes(sessionId),
      pronto: prontos.includes(sessionId),
      alerta: '🔍 Em transição ou estado incompleto',
      email: 'Desconhecido',
      nome: 'Desconhecido',
      tipo: 'Desconhecido',
      tipoFiltrado: 'desconhecido',
      criado_em: null,
      data_confirmacao: null,
      dataGeracao: null,
      minutosAguardando: null
    };

    let jsonPath = null;
    if (respondidos.includes(sessionId)) {
      jsonPath = path.join(basePath, 'respondidos', `${sessionId}.json`);
    } else if (pendentes.includes(sessionId)) {
      jsonPath = path.join(basePath, 'pendentes', `${sessionId}.json`);
    } else if (prontos.includes(sessionId)) {
      jsonPath = path.join(basePath, 'prontos', `${sessionId}.json`);
    }

    if (jsonPath && fs.existsSync(jsonPath)) {
      try {
        const conteudo = fs.readFileSync(jsonPath, "utf-8");
        const json = JSON.parse(conteudo);

        status.email = json.email || "N/D";
        status.nome = json.nome || "N/D";
        status.tipo = json.tipoRelatorio || json.tipo || "N/D";

        // 🔠 Normaliza tipo para filtro
        const tipoRaw = (json.tipoRelatorio || json.tipo || "").toLowerCase();
        if (["basico", "intermediario", "completo"].includes(tipoRaw)) {
          status.tipoFiltrado = tipoRaw;
        }

        // ⏱️ Datas
        status.criado_em = json.criado_em || null;
        status.data_confirmacao = json.data_confirmacao || null;
        status.dataGeracao = json.dataGeracao || null;

        // ⏳ Tempo de espera
        const criadoEm = new Date(json.criado_em || fs.statSync(jsonPath).mtime);
        const minutos = Math.round((agora - criadoEm.getTime()) / 60000);
        status.minutosAguardando = minutos;

        // 🟢 Caso tenha PDF gerado
        if (json.pdfGerado) {
          status.pronto = true;
        }

      } catch (e) {
        status.email = "Erro ao ler";
        status.nome = "Erro ao ler";
        status.tipo = "Erro ao ler";
      }
    }

    // Lógica de alerta
    if (status.respondido && !status.pendente && !status.pronto) {
      status.alerta = '⚠️ Respondido, mas ainda não processado';
    }

    if (status.pendente && !status.pronto) {
      const arquivo = pendentesNomes.find(f => f.includes(sessionId));
      if (arquivo) {
        const caminho = path.join(basePath, 'pendentes', `${arquivo}`);
        const stats = fs.statSync(caminho);
        const minutosDesdeModificacao = (Date.now() - stats.mtimeMs) / 60000;

        if (minutosDesdeModificacao > 30) {
          status.alerta = '🛑 Travado: aguardando PDF há +30min';
          status.travado = true;
        } else {
          status.alerta = '⏳ Processando... aguardando PDF';
        }

        status.minutosAguardando = Math.round(minutosDesdeModificacao);
      }
    }

    if (status.pronto && !status.respondido) {
      status.alerta = '📬 PDF pronto, mas e-mail pode não ter sido enviado';
    }

    if (status.pronto && status.respondido && !status.pendente) {
      status.alerta = '✅ PDF gerado e e-mail enviado com sucesso';
    }

    relatorio.push(status);
  });

  return relatorio.sort((a, b) => {
    if (b.travado && !a.travado) return 1;
    if (a.travado && !b.travado) return -1;
    return b.sessionId.localeCompare(a.sessionId);
  });
}

module.exports = gerarRelatorioDeStatus;
