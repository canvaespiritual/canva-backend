document.addEventListener("DOMContentLoaded", () => {
  const corpoTabela = document.getElementById("corpo-tabela");
  const filtroSelect = document.getElementById("filtro");
  const filtroStatus = document.getElementById("filtro-status");
  const campoBusca = document.getElementById("busca");
  const painelResumo = document.getElementById("painel-resumo");
  const itensPorPaginaSelect = document.getElementById("itensPorPagina");
  const botaoAnterior = document.getElementById("paginaAnterior");
  const botaoProxima = document.getElementById("paginaProxima");
  const infoPaginacao = document.getElementById("infoPaginacao");

  let dadosBrutos = [];
  let paginaAtual = 1;
  let ordenacaoAtual = { campo: null, asc: true };

  async function carregarStatus() {
    try {
      const resposta = await fetch("/admin/status-completo");
      dadosBrutos = await resposta.json();
      preencherFiltroDinamico(dadosBrutos);
      paginaAtual = 1;
      renderizarTabela();
      atualizarEstatisticas();
    } catch (err) {
      console.error("Erro ao carregar status:", err);
      corpoTabela.innerHTML = "<tr><td colspan='10'>Erro ao carregar dados.</td></tr>";
    }
  }

  function preencherFiltroDinamico(lista) {
    const tipos = new Set(lista.map(item => item.tipo));
    filtroSelect.innerHTML = '<option value="todos">Todos</option>';
    tipos.forEach(tipo => {
      if (tipo) {
        const option = document.createElement("option");
        option.value = tipo;
        option.textContent = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        filtroSelect.appendChild(option);
      }
    });
  }

  function atualizarEstatisticas() {
    const total = dadosBrutos.length;
    const prontos = dadosBrutos.filter(d => d.pronto).length;
    const pendentes = dadosBrutos.filter(d => d.pendente && !d.pronto).length;
    const travados = dadosBrutos.filter(d => d.travado).length;
    const respondidos = dadosBrutos.filter(d => d.respondido).length;

    painelResumo.innerHTML = `
      <div class="painel-box">📦 Total: <strong>${total}</strong></div>
      <div class="painel-box">✅ Prontos: <strong>${prontos}</strong></div>
      <div class="painel-box">⏳ Aguardando: <strong>${pendentes}</strong></div>
      <div class="painel-box">🛑 Travados: <strong>${travados}</strong></div>
      <div class="painel-box">📥 Respondidos: <strong>${respondidos}</strong></div>
    `;
  }

  function aplicarFiltros() {
    const termoBusca = campoBusca.value.toLowerCase();
    const tipoSelecionado = filtroSelect.value;
    const statusSelecionado = filtroStatus.value;

    return dadosBrutos.filter(item => {
      const nome = (item.nome || "").toLowerCase();
      const email = (item.email || "").toLowerCase();
      const tipo = item.tipo || "";

      const passaTipo = tipoSelecionado === "todos" || tipo === tipoSelecionado;
      const passaBusca = nome.includes(termoBusca) || email.includes(termoBusca);

      let passaStatus = true;
      if (statusSelecionado === "pronto") passaStatus = item.pronto;
      else if (statusSelecionado === "respondido") passaStatus = item.respondido && !item.pronto && !item.pendente;
      else if (statusSelecionado === "pendente") passaStatus = item.pendente && !item.travado;
      else if (statusSelecionado === "travado") passaStatus = item.travado;
      else if (statusSelecionado === "concluido") passaStatus = item.pronto && item.respondido;

      return passaTipo && passaBusca && passaStatus;
    });
  }

  function renderizarTabela() {
    const listaFiltrada = aplicarFiltros();
    const itensPorPagina = parseInt(itensPorPaginaSelect.value);
    const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina);

    paginaAtual = Math.min(paginaAtual, totalPaginas);
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const dadosPagina = listaFiltrada.slice(inicio, fim);

    if (ordenacaoAtual.campo) {
      dadosPagina.sort((a, b) => {
        const valA = a[ordenacaoAtual.campo];
        const valB = b[ordenacaoAtual.campo];
        if (!valA || !valB) return 0;
        const dataA = new Date(valA);
        const dataB = new Date(valB);
        return ordenacaoAtual.asc ? dataA - dataB : dataB - dataA;
      });
    }

    corpoTabela.innerHTML = "";
    dadosPagina.forEach((item) => {
      const linha = document.createElement("tr");
      const alertaStyle = item.travado ? "style='color: red; font-weight: bold;'" : "";

      let botoes = "";
      if (item.pronto) botoes += `<button onclick="reenviar('${item.sessionId}')">📤</button> `;
      if (item.travado && item.pendente) {
        botoes += `<button onclick="reprocessar('${item.sessionId}')">♻️</button> `;
        botoes += `<button onclick="reembolsar('${item.sessionId}')">💸</button>`;
      }
      if (!botoes) botoes = "—";

      linha.innerHTML = `
        <td>${item.sessionId}</td>
        <td>${item.nome || "—"}</td>
        <td>${item.email || "—"}</td>
        <td>${item.tipo || "—"}</td>
        <td ${alertaStyle}>${item.alerta}</td>
        <td>${item.minutosAguardando ? item.minutosAguardando + " min" : "—"}</td>
        <td>${formatarData(item.criado_em)}</td>
        <td>${
  item.pdf_url
    ? `<a href="${item.pdf_url}" target="_blank" style="color: green; font-weight: bold;">📄 Abrir</a>`
    : "—"
}</td>

        <td>${formatarData(item.dataGeracao)}</td>
        <td>${formatarData(item.email_enviado_em)}</td>
         <td>${item.email_entregue ? '✅' : '—'}</td>
        <td>${item.email_aberto ? '👁️' : '—'}</td>
        <td>${item.email_clicado ? '🔗' : '—'}</td>
        <td>${item.email_erro ? `<span style="color: red;">${item.email_erro}</span>` : "—"}</td>
        <td>${botoes}</td>
      `;

      corpoTabela.appendChild(linha);
    });

    infoPaginacao.textContent = `Página ${paginaAtual} de ${totalPaginas || 1}`;
    botaoAnterior.disabled = paginaAtual <= 1;
    botaoProxima.disabled = paginaAtual >= totalPaginas;
  }

  function formatarData(data) {
    if (!data) return "—";
    const d = new Date(data);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
  }

  window.ordenarPor = (campo) => {
    if (ordenacaoAtual.campo === campo) ordenacaoAtual.asc = !ordenacaoAtual.asc;
    else ordenacaoAtual = { campo, asc: true };
    renderizarTabela();
  };

  campoBusca.addEventListener("input", renderizarTabela);
  filtroSelect.addEventListener("change", renderizarTabela);
  filtroStatus.addEventListener("change", renderizarTabela);
  itensPorPaginaSelect.addEventListener("change", () => {
    paginaAtual = 1;
    renderizarTabela();
  });
  botaoAnterior.addEventListener("click", () => {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderizarTabela();
    }
  });
  botaoProxima.addEventListener("click", () => {
    paginaAtual++;
    renderizarTabela();
  });

  window.reenviar = async (sessionId) => {
    if (!confirm(`Deseja reenviar o relatório da sessão ${sessionId}?`)) return;
    try {
      const resposta = await fetch(`/admin/reenviar/${sessionId}`, { method: "POST" });
      alert(await resposta.text());
    } catch {
      alert("Erro ao reenviar.");
    }
  };

  window.reprocessar = async (sessionId) => {
    if (!confirm(`Reprocessar o PDF da sessão ${sessionId}?`)) return;
    try {
      const resposta = await fetch(`/admin/reprocessar/${sessionId}`, { method: "POST" });
      alert(await resposta.text());
    } catch {
      alert("Erro ao reprocessar.");
    }
  };

  window.reembolsar = async (sessionId) => {
    if (!confirm(`Confirmar reembolso da sessão ${sessionId}?`)) return;
    try {
      const resposta = await fetch(`/admin/reembolsar/${sessionId}`, { method: "POST" });
      alert(await resposta.text());
    } catch {
      alert("Erro ao processar reembolso.");
    }
  };
  function configurarCliquesNosResumo() {
  document.querySelectorAll(".painel-box").forEach((box) => {
    box.style.cursor = "pointer";

    box.addEventListener("click", () => {
      const texto = box.textContent;

      if (texto.includes("Prontos")) {
        filtroStatus.value = "pronto";
      } else if (texto.includes("Aguardando")) {
        filtroStatus.value = "pendente";
      } else if (texto.includes("Travados")) {
        filtroStatus.value = "travado";
      } else if (texto.includes("Respondidos")) {
        filtroStatus.value = "respondido";
      } else {
        filtroStatus.value = "todos";
      }

      paginaAtual = 1;
      renderizarTabela();
    });
  });
}


  carregarStatus();
  setTimeout(configurarCliquesNosResumo, 100); // garante que o DOM foi renderizado

  setInterval(carregarStatus, 60000);
});
