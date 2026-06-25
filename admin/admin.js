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
  const relatoriosCards = document.getElementById("relatoriosCards");

document.querySelectorAll(".master-nav").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".master-nav").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".master-view").forEach(v => v.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`)?.classList.add("active");
  });
});
const btnMasterMenu = document.getElementById("btnMasterMenu");
const masterScrim = document.getElementById("masterScrim");

function closeMasterMenu() {
  document.body.classList.remove("master-menu-open");
}

function toggleMasterMenu() {
  document.body.classList.toggle("master-menu-open");
}

if (btnMasterMenu) {
  btnMasterMenu.addEventListener("click", toggleMasterMenu);
}

if (masterScrim) {
  masterScrim.addEventListener("click", closeMasterMenu);
}

document.querySelectorAll(".master-nav").forEach((btn) => {
  btn.addEventListener("click", closeMasterMenu);
});
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
      const whatsapp = (item.whatsapp || "").toLowerCase();
      const tipo = item.tipo || "";

      const passaTipo = tipoSelecionado === "todos" || tipo === tipoSelecionado;
      const passaBusca =
        nome.includes(termoBusca) ||
        email.includes(termoBusca) ||
        whatsapp.includes(termoBusca);


      let passaStatus = true;
      if (statusSelecionado === "pronto") passaStatus = item.pronto;
      else if (statusSelecionado === "respondido") passaStatus = item.respondido && !item.pronto && !item.pendente;
      else if (statusSelecionado === "pendente") passaStatus = item.pendente && !item.travado;
      else if (statusSelecionado === "travado") passaStatus = item.travado;
      else if (statusSelecionado === "concluido") passaStatus = item.pronto && item.respondido;

      return passaTipo && passaBusca && passaStatus;
    });
  }
  function criarLinkWhatsapp(numero) {
    if (!numero) return "—";

    // remove tudo que não for dígito
    const limpo = numero.toString().replace(/\D/g, "");
    if (!limpo) return "—";

    const url = `https://wa.me/${limpo}`; // abre WhatsApp Web ou app no celular
    return `<a href="${url}" target="_blank">📱 ${numero}</a>`;
  }

function renderizarTabela() {
  const listaFiltrada = aplicarFiltros();
  const itensPorPagina = parseInt(itensPorPaginaSelect.value);
  const totalPaginas = Math.ceil(listaFiltrada.length / itensPorPagina);

  paginaAtual = Math.min(paginaAtual, totalPaginas || 1);

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

  relatoriosCards.innerHTML = "";

  if (!dadosPagina.length) {
    relatoriosCards.innerHTML = `<div class="relatorio-card"><em>Nenhum relatório encontrado.</em></div>`;
  }

  dadosPagina.forEach((item) => {
    let botoes = "";
    if (item.pronto) botoes += `<button onclick="reenviar('${item.sessionId}')">📤 Reenviar</button>`;
    if (item.travado && item.pendente) {
      botoes += `<button onclick="reprocessar('${item.sessionId}')">♻️ Reprocessar</button>`;
      botoes += `<button onclick="reembolsar('${item.sessionId}')">💸 Reembolsar</button>`;
    }
    if (!botoes) botoes = `<span class="muted">Sem ações</span>`;

    const card = document.createElement("article");
    card.className = item.travado ? "relatorio-card travado" : "relatorio-card";

    card.innerHTML = `
      <div class="relatorio-main">
        <div>
          <h3>${item.nome || "Sem nome"}</h3>
          <p>${item.email || "—"} · ${criarLinkWhatsapp(item.whatsapp)}</p>
          <small>Session: ${item.sessionId}</small>
        </div>

        <div class="relatorio-status">
          <strong>${item.alerta || "—"}</strong>
          <span>${item.tipo || "—"}</span>
        </div>
      </div>

      <div class="relatorio-grid">
        <div><span>Espera</span><strong>${item.minutosAguardando ? item.minutosAguardando + " min" : "—"}</strong></div>
        <div><span>Respondido</span><strong>${formatarData(item.criado_em)}</strong></div>
        <div><span>Pagamento</span><strong>${formatarData(item.data_confirmacao)}</strong></div>
        <div><span>PDF</span><strong>${item.pdf_url ? `<a href="${item.pdf_url}" target="_blank">Abrir PDF</a>` : "—"}</strong></div>
        <div><span>Enviado</span><strong>${formatarData(item.email_enviado_em)}</strong></div>
        <div><span>Entregue</span><strong>${item.email_entregue ? "✅" : "—"}</strong></div>
        <div><span>Aberto</span><strong>${item.email_aberto ? "👁️" : "—"}</strong></div>
        <div><span>Clicado</span><strong>${item.email_clicado ? "🔗" : "—"}</strong></div>
      </div>

      ${item.email_erro ? `<div class="erro-box">⚠️ ${item.email_erro}</div>` : ""}

      <div class="relatorio-actions">
        ${botoes}
      </div>
    `;

    relatoriosCards.appendChild(card);
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
const marketingGrid = document.getElementById("marketingMasterGrid");
const modalMaterial = document.getElementById("modalMaterial");
let marketingItems = [];

async function carregarMarketingMaster() {
  if (!marketingGrid) return;

  marketingGrid.innerHTML = "<em>Carregando materiais...</em>";

  try {
    const r = await fetch("/marketing-materials/admin");
    const data = await r.json();

    marketingItems = data.items || [];

    if (!marketingItems.length) {
      marketingGrid.innerHTML = "<em>Nenhum material cadastrado ainda.</em>";
      return;
    }

    marketingGrid.innerHTML = "";

    marketingItems.forEach((item) => {
      const firstFile = Array.isArray(item.files) ? item.files[0] : null;
      const thumb = item.cover_url || firstFile?.thumbnail_url || firstFile?.file_url || "";

      const card = document.createElement("article");
      card.className = "marketing-master-card";

      card.innerHTML = `
        ${
          thumb
            ? `<a href="${firstFile?.download_url || firstFile?.file_url || thumb}" target="_blank">
                 <img src="${thumb}" alt="${item.title}" class="marketing-thumb">
               </a>`
            : `<div class="marketing-thumb marketing-thumb-empty">Sem imagem</div>`
        }

        <h3>${item.title}</h3>
        <p>${item.description || "—"}</p>
        <small>${item.category || "Sem categoria"} · ${item.type} · ${item.audience}</small>

        <div style="margin-top:12px;">
          <strong>Status:</strong> ${item.status}
        </div>

        <div style="margin-top:12px;">
          <button data-edit="${item.id}">Editar</button>
          <button data-status="${item.id}" data-current="${item.status}">
            ${item.status === "active" ? "Inativar" : "Ativar"}
          </button>
          <button data-delete="${item.id}" style="background:#dc2626;">
            Excluir
          </button>
        </div>
      `;

      marketingGrid.appendChild(card);
    });
  } catch (e) {
    marketingGrid.innerHTML = "<em>Erro ao carregar materiais.</em>";
  }
}

function abrirModalMaterial(item = null) {
  document.getElementById("materialId").value = item?.id || "";
  document.getElementById("modalMaterialTitle").textContent = item ? "Editar Material" : "Novo Material";

  document.getElementById("matTitle").value = item?.title || "";
  document.getElementById("matDescription").value = item?.description || "";
  document.getElementById("matCategory").value = item?.category || "Ideias de Divulgação";
  document.getElementById("matProduct").value = item?.product_key || "";
  document.getElementById("matType").value = item?.type || "image";
  document.getElementById("matAudience").value = item?.audience || "both";
  document.getElementById("matStatus").value = item?.status || "active";
  document.getElementById("matSort").value = item?.sort_order || 0;
  document.getElementById("matCover").value = item?.cover_url || "";
  document.getElementById("matFileUrl").value = "";
  document.getElementById("matPreviewUrl").value = "";

  const fileInput = document.getElementById("matFileUpload");
  if (fileInput) fileInput.value = "";

  modalMaterial?.classList.remove("hide");
}

function fecharModalMaterial() {
  modalMaterial?.classList.add("hide");
}

async function salvarMaterial() {
  const materialId = document.getElementById("materialId").value;

  const payload = {
    title: document.getElementById("matTitle").value,
    description: document.getElementById("matDescription").value,
    category: document.getElementById("matCategory").value,
    product_key: document.getElementById("matProduct").value,
    type: document.getElementById("matType").value,
    audience: document.getElementById("matAudience").value,
    status: document.getElementById("matStatus").value,
    sort_order: Number(document.getElementById("matSort").value || 0),
    cover_url: document.getElementById("matCover").value,
  };

  let fileUrl = document.getElementById("matFileUrl").value.trim();
  const fileInput = document.getElementById("matFileUpload");
  const previewUrl = document.getElementById("matPreviewUrl").value.trim();

  if (!payload.title.trim()) {
    alert("Informe o título.");
    return;
  }

  if (fileInput?.files?.length) {
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("folder", "marketing");

    const uploadRes = await fetch("/marketing-upload", {
      method: "POST",
      body: formData,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      alert(uploadData.error || "Erro ao enviar arquivo.");
      return;
    }

    fileUrl = uploadData.file_url;
  }

  const method = materialId ? "PUT" : "POST";
  const url = materialId
    ? `/marketing-materials/admin/${materialId}`
    : "/marketing-materials/admin";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar material.");
    return;
  }

  const savedId = materialId || data.item.id;

  if (fileUrl) {
    await fetch(`/marketing-materials/admin/${savedId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: previewUrl || fileUrl,
        download_url: fileUrl,
        thumbnail_url: payload.cover_url || fileUrl,
        file_kind: "asset",
        sort_order: 0,
      }),
    });
  }

  fecharModalMaterial();
  await carregarMarketingMaster();
}

document.getElementById("btnNovoMaterial")?.addEventListener("click", abrirModalMaterial);
document.getElementById("btnCancelarMaterial")?.addEventListener("click", fecharModalMaterial);
document.getElementById("btnSalvarMaterial")?.addEventListener("click", salvarMaterial);
document.getElementById("btnAtualizarMarketing")?.addEventListener("click", carregarMarketingMaster);
marketingGrid?.addEventListener("click", async (e) => {
  const editId = e.target.getAttribute("data-edit");
  const statusId = e.target.getAttribute("data-status");
  const deleteId = e.target.getAttribute("data-delete");

  if (editId) {
    const item = marketingItems.find(i => i.id === editId);
    if (item) abrirModalMaterial(item);
    return;
  }

  if (statusId) {
    const current = e.target.getAttribute("data-current");
    const nextStatus = current === "active" ? "inactive" : "active";

    const res = await fetch(`/marketing-materials/admin/${statusId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (!res.ok) {
      alert("Erro ao alterar status.");
      return;
    }

    await carregarMarketingMaster();
    return;
  }

  if (deleteId) {
    if (!confirm("Excluir este material? Essa ação removerá também os arquivos vinculados no banco.")) {
      return;
    }

    const res = await fetch(`/marketing-materials/admin/${deleteId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      alert("Erro ao excluir material.");
      return;
    }

    await carregarMarketingMaster();
  }
});
carregarMarketingMaster();

  carregarStatus();
  setTimeout(configurarCliquesNosResumo, 100); // garante que o DOM foi renderizado

  setInterval(carregarStatus, 60000);
});
