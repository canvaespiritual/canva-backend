"use strict";

/* =========================================================
 * helpers (mesma “pegada” do afiliado-dashboard.js)
 * =======================================================*/
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function log(...a){ try{ console.log("[vendedor]", ...a); }catch{} }

async function jfetch(url, opts = {}) {
  const r = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  if (!r.ok) {
    let msg = "Erro";
    try { const j = await r.json(); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  try { return await r.json(); } catch { return {}; }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  return Promise.resolve();
}

function drawQR(container, data, size = 180) {
  if (!container) return;
  container.innerHTML = "";
  if (!data) { container.textContent = "QR"; return; }
  const img = new Image();
  img.alt = "QR Code";
  img.width = size; img.height = size;
  img.src = "https://api.qrserver.com/v1/create-qr-code/?size=" + size + "x" + size + "&data=" + encodeURIComponent(data);
  container.appendChild(img);
}

const BRL = (v) => (isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s) => { try { return new Date(s).toLocaleString("pt-BR"); } catch { return s || "—"; } };
function setText(el, text){ if (el) el.textContent = text; }
function setDisplay(el, show){ if (el) el.style.display = show ? "" : "none"; }

/* =========================================================
 * estado
 * =======================================================*/
const APP = {
  me: null,
  role: "vendor",
  personalLink: null,
  linkEnabled: false,
  walletId: "—",
  supervisorPct: 5,        // supervisor fixo 5%
  forceCapPct: 60,         // teto força de venda (afiliado + vendedor)
  bonusCapPct: 5,          // bônus estratégico (não usado agora)
  sales: { page: 1, pageSize: 10, total: 0, items: [], type: "direct" },
  links: [],
};

/* =========================================================
 * auth
 * =======================================================*/
async function ensureAuth() {
  // 1) tenta endpoint de vendedor
  try {
    const r = await jfetch("/vendors/me");
    APP.me = r.me || r;
    APP.role = (APP.me?.role || "vendor").toLowerCase();
    if (APP.role !== "vendor" && APP.role !== "supervisor" && APP.role !== "admin") throw new Error("Acesso restrito");
    return;
  } catch (e) {
    // fallback: usa o mesmo do afiliado, mas precisa bater role no backend, se disponível
    try {
      const r = await jfetch("/affiliates/me"); // mantém compat c/ seu fluxo atual
      APP.me = r.me || r;
      // se o backend já trouxer role, valida; se não, seguimos (você controla no servidor)
      return;
    } catch {
      location.href = "/afiliado/login.html";
      throw new Error("redirect");
    }
  }
}

/* =========================================================
 * navegação
 * =======================================================*/
function showView(sel){
  $$(".view").forEach(v => v.classList.remove("active"));
  const v = $(sel); if (v) v.classList.add("active");

  $$(".nav a.nav-link").forEach(a => a.classList.remove("active"));
  const nav = $('.nav a.nav-link[data-target="'+sel+'"]'); if (nav) nav.classList.add("active");

if (sel === "#view-sales") {
  loadSales(1, "override").catch(()=>{});
  loadVendorTotals("override").catch(()=>{});  // ← soma os cards
}


  if (sel === "#view-materials") initMaterials();
  if (sel === "#view-links") refreshLinks().catch(()=>{});
    if (sel === "#view-profile")  loadProfile().catch(()=>{});

}

function routeFromHash(){
  const h = (location.hash || "#inicio").toLowerCase();
  if (h.indexOf("#verificacao") === 0) return showView("#view-verify");
  if (h.indexOf("#links") === 0)       return showView("#view-links");
    if (h.indexOf("#cadastro") === 0)    return showView("#view-profile");
  if (h.indexOf("#equipe") === 0)      return showView("#view-team");
  if (h.indexOf("#materiais") === 0)   return showView("#view-materials");
  if (h.indexOf("#vendas") === 0)      return showView("#view-sales");
  if (h.indexOf("#treinamento") === 0) return showView("#view-training");
  if (h.indexOf("#suporte") === 0)     return showView("#view-support");
  if (h.indexOf("#sair") === 0)        return doLogout();
  return showView("#view-home");
}

/* =========================================================
 * mensagens
 * =======================================================*/
function jmsg(text, cls){
  const el = $("#msg");
  if (!el) return;
  el.className = (cls || "muted") + " mt-12";
  el.textContent = text;
}

/* =========================================================
 * status (verificação & recebimento) — rótulos amigáveis
 * =======================================================*/
function paintStatus({ identity, payout, link_enabled }) {
  APP.linkEnabled = !!link_enabled;
  const cls = (v) => v === "APPROVED" ? "ok" : (v === "REJECTED" ? "err" : "warn");

  // Home
  const stIHome = $("#stIdentityHome");
  const stPHome = $("#stPayoutHome");
  const stLHome = $("#stLinksHome");
  if (stIHome){ stIHome.textContent = identity || "—"; stIHome.className = cls(identity || "PENDING"); }
  if (stPHome){ stPHome.textContent = payout   || "—"; stPHome.className = cls(payout   || "PENDING"); }
  if (stLHome){ stLHome.textContent = link_enabled ? "Sim" : "Não"; stLHome.className = link_enabled ? "ok" : "warn"; }

  // View verificação
  const stI = $("#stIdentity");
  const stP = $("#stPayout");
  const stL = $("#stLinks");
  if (stI){ stI.textContent = identity || "—"; stI.className = cls(identity || "PENDING"); }
  if (stP){ stP.textContent = payout   || "—"; stP.className = cls(payout   || "PENDING"); }
  if (stL){ stL.textContent = link_enabled ? "Sim" : "Não"; stL.className = link_enabled ? "ok" : "warn"; }

  // áreas de link na Home e Materiais
  paintPersonalLinkArea();
}
// --- Cadastro (somente leitura) ---
async function loadProfile(){
  try {
    // Quem sou eu
    const meResp = await jfetch("/affiliates/me");          // { me: { id, email, name, role } }
    const me = meResp.me || meResp || {};
    setText($("#pf_name"),  me.name  || "—");
    setText($("#pf_email"), me.email || "—");

    // Tipo de pessoa + nascimento
    const pr = await jfetch("/affiliates/me/profile");      // { person_type, birth_date }
    setText($("#pf_ptype"), pr.person_type === "JURIDICA" ? "Jurídica" : "Física");
    setText($("#pf_birth"), pr.birth_date || "—");

    // Campos detalhados (preencheremos quando expormos endpoint de detalhes)
    setText($("#pf_doc"),   "—");
    setText($("#pf_phone"), "—");
    setText($("#pf_addr"),  "—");
    setText($("#pf_cep"),   "—");
  } catch (e) {
    // silencioso por enquanto
  }
}

async function updateStatus(){
  try {
    jmsg("Consultando status…");
    // tenta endpoint de vendor; se não existir, cai para os do afiliado que você já usa
    let r;
    try { r = await jfetch("/vendors/me/status"); }
    catch { r = await jfetch("/affiliates/me/asaas/status"); }
    const s = r.status || {};
    paintStatus({ identity: s.general, payout: s.bank, link_enabled: r.link_enabled });
    jmsg("Status atualizado.", "muted");
  } catch (e) {
    jmsg(e.message, "err");
  }
}

/* =========================================================
 * verificação & recebimento (Pix/Conta)
 * =======================================================*/
function togglePayoutBoxes(){
  const modeEl = document.querySelector("input[name=pmode]:checked");
  const mode = modeEl ? modeEl.value : "pix";
  $("#boxPix")?.classList.toggle("hide", mode !== "pix");
  $("#boxBank")?.classList.toggle("hide", mode !== "bank");
}

async function saveIdentity(){
  try {
    const person = ($("#kycPersonType")?.value || "FISICA").toUpperCase();
    const birth  = $("#kycBirth")?.value || "";
    if (person === "FISICA" && !birth) throw new Error("Informe a data de nascimento.");

    // tenta endpoint de vendor; fallback para o que você já tem
    try {
      await jfetch("/vendors/me/holder", { method: "POST", body: JSON.stringify({ person_type: person, birth_date: birth }) });
    } catch {
      await jfetch("/affiliates/me/holder", { method: "POST", body: JSON.stringify({ person_type: person, birth_date: birth }) });
    }
    jmsg("Dados salvos. Agora você já pode criar a subconta.", "ok");
  } catch (e) {
    jmsg(e.message || "Erro ao salvar dados.", "err");
  }
}

async function createSubaccount(){
  try{
    jmsg("Criando subconta…");
    let r;
    try { r = await jfetch("/vendors/me/create-subaccount", { method: "POST", body: JSON.stringify({}) }); }
    catch { r = await jfetch("/affiliates/me/asaas/create-subaccount", { method: "POST", body: JSON.stringify({}) }); }
    if (r.asaas_wallet_id) { APP.walletId = r.asaas_wallet_id; setText($("#wallet"), APP.walletId); }
    jmsg(r.already ? "Subconta já existia. Clique em 'Atualizar status'." : "Subconta criada. Agora clique em 'Atualizar status'.", "ok");
  }catch(e){ jmsg(e.message, "err"); }
}

async function savePayout(){
  try{
    const mode = (document.querySelector("input[name=pmode]:checked") || {}).value || "pix";
    const payload = { payout_method: mode };
    if (mode === "pix") {
      payload.pix_key_type  = $("#pixType").value;
      payload.pix_key_value = $("#pixValue").value.trim();
      if (!payload.pix_key_value) throw new Error("Informe a chave Pix.");
    } else {
      payload.bank_holder_name   = $("#bnHolder").value.trim();
      payload.bank_cpf_cnpj      = $("#bnDoc").value.trim();
      payload.bank_number        = $("#bnNumber").value.trim();
      payload.bank_agency        = $("#bnAgency").value.trim();
      payload.bank_account       = $("#bnAccount").value.trim();
      payload.bank_account_digit = $("#bnDigit").value.trim();
      payload.bank_account_type  = $("#bnType").value;
      const vals = Object.values(payload); for (let i=0;i<vals.length;i++){ if (vals[i] === "") throw new Error("Preencha todos os dados bancários."); }
    }
    jmsg("Salvando método de saque…");
    try { await jfetch("/vendors/me/payout-method", { method: "POST", body: JSON.stringify(payload) }); }
    catch { await jfetch("/affiliates/me/payout-method", { method: "POST", body: JSON.stringify(payload) }); }
    jmsg("Método de saque salvo.", "ok");
  }catch(e){ jmsg(e.message, "err"); }
}

async function testPayout(){
  try{
    jmsg("Solicitando transferência de teste…");
    try { await jfetch("/vendors/me/payout-test", { method: "POST", body: JSON.stringify({}) }); }
    catch { await jfetch("/affiliates/me/payout-test", { method: "POST", body: JSON.stringify({}) }); }
    jmsg("Solicitada. Aguarde a confirmação pelo PSP (webhook).", "ok");
  }catch(e){ jmsg(e.message, "err"); }
}

/* =========================================================
 * link pessoal (30%) + área da Home/Materials
 * =======================================================*/
function paintPersonalLinkArea(){
  // Home teaser
  const teaser = $("#homePersonalLink");
  setDisplay(teaser, APP.linkEnabled && !!APP.personalLink);

  setText($("#vendorPersonalLink"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "—");
  const btnOpen = $("#btnOpenPersonal");
  if (btnOpen) {
    if (APP.linkEnabled && APP.personalLink) btnOpen.href = APP.personalLink; else btnOpen.removeAttribute("href");
  }
  drawQR($("#qrPersonal"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "", 180);

  // Meus Links / Materials
  setText($("#myPersonalLink"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "—");
  const btnOpen2 = $("#btnOpenMyPersonal");
  if (btnOpen2) {
    if (APP.linkEnabled && APP.personalLink) btnOpen2.href = APP.personalLink; else btnOpen2.removeAttribute("href");
  }
  drawQR($("#qrMyPersonal"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "", 180);
  drawQR($("#qrMaterialsPersonal"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "", 180);
}

async function fetchPersonalLink(){
  try {
    const r = await jfetch("/vendors/me/personal-link"); // ex.: { url: "https://.../quiz?vend=XYZ" }
    APP.personalLink = r.url || null;
    paintPersonalLinkArea();
  } catch {
    // se ainda não existir endpoint, você pode montar no servidor: `${origin}/quiz.html?vend=${APP.me.id}`
    APP.personalLink = null;
  }
}

/* =========================================================
 * links de afiliados (criar/listar)
 * =======================================================*/
function calcVendorPct(affPct, cap = 60){
  affPct = Number(affPct) || 0;
  // vendedor recebe o restante até o CAP da força de venda (A+V ≤ 60), sem supervisor
  const vend = Math.max(0, cap - affPct);
  return Math.round(vend * 100) / 100;
}

function wireCreateLinkModal(){
  const modal = $("#modalCreateLink");
  const open  = $("#btnOpenCreateLink");
  const close = $("#btnCloseCreate");
  const pctAff = $("#pctAffiliate");
  const pctVend = $("#pctVendorAuto");
  const pctSup  = $("#pctSupervisor");
  const pctTot  = $("#pctTotal");

  function refreshAuto(){
    const aff = Math.min(50, Math.max(35, Number(pctAff.value || 40)));
    pctAff.value = aff;
    const vend = calcVendorPct(aff, APP.forceCapPct);
    pctVend.value = vend;
    // Total (força de venda) mostra só A+V (supervisor é política à parte)
    pctTot.value  = Math.min(APP.forceCapPct, aff + vend);

  }

  if (pctAff) pctAff.addEventListener("input", refreshAuto);

  if (open) open.addEventListener("click", () => {
    modal?.classList.remove("hide"); modal?.setAttribute("aria-hidden","false");
    pctSup.value = String(APP.supervisorPct);
    refreshAuto();
  });
  if (close) close.addEventListener("click", () => {
    modal?.classList.add("hide"); modal?.setAttribute("aria-hidden","true");
  });

  const create = $("#btnCreateLink");
  if (create) create.addEventListener("click", async () => {
    const email = ($("#affEmail")?.value || "").trim();
    const pctA  = Number($("#pctAffiliate")?.value || 40);
    const pctV  = Number($("#pctVendorAuto")?.value || 15);
    const pctS  = Number($("#pctSupervisor")?.value || APP.supervisorPct);

    if (!email) { alert("Informe o e-mail do afiliado."); return; }
    if (pctA < 35 || pctA > 50) { alert("A % do afiliado deve estar entre 35 e 50."); return; }
    // CAP da força de venda: A + V ≤ 60 (supervisor é aplicado na venda)
    if (pctA + pctV > APP.forceCapPct) { alert("Teto de 60% (força de venda) excedido. Ajuste os percentuais."); return; }


    try{
      const r = await jfetch("/vendors/links", {
        method: "POST",
        body: JSON.stringify({ email, pct_affiliate: pctA, pct_vendor: pctV, pct_supervisor: pctS })
      });
      modal?.classList.add("hide"); modal?.setAttribute("aria-hidden","true");
      await refreshLinks();
      alert("Link criado e convite enviado para o afiliado.");
    }catch(e){ alert(e.message || "Erro ao criar link."); }
  });
}

function renderLinks(list){
  const tbody = $("#linksRows");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">Nenhum link criado ainda.</td></tr>';
    return;
  }

list.forEach(it => {
  const tr = document.createElement("tr");
  const disabled = it.affiliate_ready ? "" : 'disabled title="Aguardando aprovação da subconta do afiliado"';

  tr.innerHTML =
    `<td>${it.code || "—"}</td>` +
    `<td>${(it.affiliate?.name || it.affiliate_email || "—")}</td>` +
    `<td>${isFinite(it.pct_aff) ? it.pct_aff+"%" : "—"}</td>` +
    `<td>${isFinite(it.pct_vendor) ? it.pct_vendor+"%" : "—"}</td>` +
    `<td>${isFinite(it.pct_supervisor) ? it.pct_supervisor+"%" : "—"}</td>` +
    `<td>${it.clicks ?? "—"}</td>` +
    `<td>${it.sales ?? "—"}</td>` +
    `<td>${it.active ? "Ativo" : "Pausado"}</td>` +
    `<td>
       <button class="btn ghost" data-act="copy"   data-url="${it.url || ""}" ${disabled}>Copiar</button>
       <button class="btn ghost" data-act="qr"     data-url="${it.url || ""}" ${disabled}>QR</button>
       <button class="btn ghost" data-act="toggle" data-id="${it.id}">${it.active ? "Pausar" : "Ativar"}</button>
       <button class="btn ghost" data-act="resend" data-id="${it.id}">Reenviar</button>
     </td>`;

  tbody.appendChild(tr);
});

// ações da tabela
tbody.querySelectorAll("button[data-act]").forEach(btn => {
  btn.addEventListener("click", async () => {
    // se o botão estiver disabled, não faz nada
    if (btn.disabled) return;

    const act = btn.getAttribute("data-act");

    if (act === "copy") {
      const url = btn.getAttribute("data-url");
      if (!url) return alert("Link indisponível.");
      await copyToClipboard(url);
      alert("Link copiado!");
    }

    else if (act === "qr") {
      const url = btn.getAttribute("data-url");
      if (!url) return alert("Link indisponível.");
      const w = window.open("", "_blank", "width=360,height=420");
      if (w) {
        w.document.write(`<title>QR</title><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"></body>`);
        const c = w.document.body;
        drawQR(c, url, 320);
      }
    }

    else if (act === "toggle") {
      const id = btn.getAttribute("data-id");
      try {
        await jfetch(`/vendors/links/${id}/toggle`, {
          method: "POST",
          body: JSON.stringify({})
        });
        await refreshLinks();
      } catch(e){
        alert(e.message || "Erro ao alternar status.");
      }
    }

    else if (act === "resend") {
      const id = btn.getAttribute("data-id");
      try {
        await jfetch(`/vendors/links/${id}/resend`, {
          method: "POST",
          body: JSON.stringify({})
        });
        alert("E-mail de convite reenviado para o afiliado.");
      } catch(e){
        alert(e.message || "Erro ao reenviar e-mail.");
      }
    }
  });
});
}


async function refreshLinks(){
  try {
    const r = await jfetch("/vendors/links"); // retorna array
    APP.links = Array.isArray(r) ? r : (r.items || []);
    renderLinks(APP.links);
  } catch(e){
    renderLinks([]);
  }
}

/* =========================================================
 * materiais
 * =======================================================*/
function initMaterials(){
  // já pinta os QRs do link pessoal
  drawQR($("#qrMaterialsPersonal"), (APP.linkEnabled && APP.personalLink) ? APP.personalLink : "", 180);
  const btnCopy = $("#btnCopyPersonalMat");
  if (btnCopy) btnCopy.addEventListener("click", async () => {
    if (!APP.personalLink) return;
    await copyToClipboard(APP.personalLink);
    alert("Link pessoal copiado!");
  }, { once: true });

  const btnRef = $("#btnRefreshMat");
  if (btnRef) btnRef.addEventListener("click", () => drawQR($("#qrMaterialsPersonal"), APP.personalLink, 180), { once: true });
}

/* =========================================================
 * vendas (diretas / override)
 * =======================================================*/
function renderSales(items){
  const tbody = $("#salesRows");
  const msg   = $("#salesMsg");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!items || !items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Nenhuma venda encontrada.</td></tr>';
    if (msg) msg.textContent = "";
    return;
  }
  items.forEach(it => {
   const isOverride = (APP.sales.type === "override");

// % do vendedor:
const pct = isOverride
  ? (isFinite(Number(it.pct_vendor)) ? Number(it.pct_vendor) : 0)         // vindo do SQL do override
  : 30;                                                                    // Diretas = 30%

// R$ comissão do vendedor:
const vendValue = isOverride
  ? (typeof it.vendor_amount === "number" ? it.vendor_amount : (isFinite(it.amount) ? (it.amount * pct / 100) : 0))
  : (isFinite(it.amount) ? (it.amount * 0.30) : 0);                        // Diretas = 30%

// rótulo de origem:
const origem = isOverride
  ? `Equipe${it.affiliate_name ? " · " + it.affiliate_name : (it.affiliate_email ? " · " + it.affiliate_email : "")}`
  : "Direta (link pessoal)";

const tr = document.createElement("tr");
tr.innerHTML =
  `<td>${fmtDate(it.created_at)}</td>` +
  `<td>${it.gateway_payment_id || "—"}</td>` +
  `<td>${BRL(it.amount)}</td>` +
  `<td>${it.status || "—"}</td>` +
  `<td>${pct}% · ${BRL(vendValue)}</td>` +
  `<td>${origem}</td>` +
  `<td>${(it.gateway || "").toUpperCase()}</td>`;
tbody.appendChild(tr);


  });
  if (msg) msg.textContent = "";
}
// ===== SALDO DO VENDEDOR =====
async function loadVendorBalance(){
  try {
    const b = await jfetch("/vendors/balance");
    setText($("#balAvailVend"), BRL(b.available));
    setText($("#balPendVend"),  BRL(b.pending));
    setText($("#balMsgVend"),   b.next_available_at ? ("Próxima liberação: " + fmtDate(b.next_available_at)) : "");
    const btn = $("#btnWithdrawVend");
    if (btn) btn.disabled = !(b.available > 0);
  } catch(e){
    setText($("#balAvailVend"), "—");
    setText($("#balPendVend"),  "—");
    setText($("#balMsgVend"),   e.message || "");
    const btn = $("#btnWithdrawVend");
    if (btn) btn.disabled = true;
  }
}

// ===== SAQUE DO VENDEDOR =====
async function requestVendorWithdraw(){
  try {
    const r = await jfetch("/vendors/withdraw", { method: "POST", body: JSON.stringify({}) });
    alert("Saque solicitado: R$ " + (r.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    await loadVendorBalance();
  } catch(e){
    alert(e.message || "Falha ao solicitar saque.");
  }
}

async function loadSales(page = 1, type = "direct"){
  APP.sales.type = type;
  const limit  = APP.sales.pageSize;
  const offset = (page - 1) * limit;
  const pageEl = $("#salesPage");
  const msg    = $("#salesMsg");
  if (msg) msg.textContent = "Carregando…";
  try {
    const r = await jfetch(`/vendors/sales?type=${encodeURIComponent(type)}&limit=${limit}&offset=${offset}`);
    APP.sales.items = r.items || [];
    APP.sales.total = r.total || 0;
    APP.sales.page  = page;
    renderSales(APP.sales.items);
    if (pageEl) pageEl.textContent = String(page);
    if (msg) msg.textContent = APP.sales.total ? ("Total: " + APP.sales.total) : "";
  } catch (e) {
    renderSales([]);
    if (msg) msg.textContent = "Listagem ainda não disponível.";
  }
}

function wireSalesControls(){
  const seg = $("#salesType");
  if (seg) seg.querySelectorAll("button[data-type]").forEach(b => {
    b.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const t = b.getAttribute("data-type") || "direct";
      loadSales(1, t).catch(()=>{});
      loadVendorTotals(t).catch(()=>{});

    });
  });

  const prev = $("#prevSales");
  const next = $("#nextSales");
  if (prev) prev.addEventListener("click", () => {
    const p = Math.max(1, APP.sales.page - 1);
    if (p !== APP.sales.page) loadSales(p, APP.sales.type).catch(()=>{});
  });
  if (next) next.addEventListener("click", () => {
    const maxPage = APP.sales.total ? Math.ceil(APP.sales.total / APP.sales.pageSize) : APP.sales.page + 1;
    const p = Math.min(maxPage, APP.sales.page + 1);
    if (p !== APP.sales.page) loadSales(p, APP.sales.type).catch(()=>{});
  });
}

/* =========================================================
 * sidebar mobile + logout
 * =======================================================*/
async function doLogout(){
  try { await jfetch("/affiliates/logout", { method: "POST" }); }
  finally { location.href = "/afiliado/login.html"; }
}
function wireLogout(){
  const b = $("#btnLogout"); if (b) b.addEventListener("click", doLogout);
  const n = $("#navLogout"); if (n) n.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
}
function wireSidebarMobile(){
  const btn   = $("#btnMenu");
  const scrim = $("#scrim");
  function close(){ document.body.classList.remove("sidebar-open"); }
  function toggle(){ document.body.classList.toggle("sidebar-open"); }
  if (btn)   btn.addEventListener("click", toggle);
  if (scrim) scrim.addEventListener("click", close);
  $$(".nav a.nav-link").forEach(a => a.addEventListener("click", close));
}
// soma as comissões do vendedor (override ou diretas)
async function loadVendorTotals(type){
  try {
    const r = await jfetch(`/vendors/summary?type=${encodeURIComponent(type || "override")}`);
    // card "Comissões recebidas"
    setText($("#balAvailVend"), BRL(r.mine || 0));
    // no modo Asaas nativo você pode manter 0 aqui
    setText($("#balPendVend"), BRL(0));
  } catch(e){
    setText($("#balAvailVend"), "—");
    setText($("#balPendVend"), "—");
  }
}


/* =========================================================
 * boot
 * =======================================================*/
document.addEventListener("DOMContentLoaded", async () => {
  log("vendor-dashboard.js carregado");
  try { await ensureAuth(); } catch { return; }

  // rotas
  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();
  // Aviso de saque (Asaas)
try {
  const me = await jfetch("/vendors/me");      // { me: { email, ... } }
  const email = me?.me?.email || "";
  const note = $("#withdrawNoteVend");
  if (note) {
    const asaasLogin = "https://www.asaas.com/login/auth?customerSignUpOriginChannel=HOME";
    note.innerHTML = `Para sacar suas comissões, acesse o <a href="${asaasLogin}" target="_blank" rel="noopener">Painel do Asaas</a> com o e-mail <strong>${email}</strong>.
      <br><small class="muted">Se não tiver senha, clique em <em>“Esqueci minha senha”</em> na página do Asaas.</small>`;
  }
} catch {}

$("#btnWithdrawVend")?.addEventListener("click", requestVendorWithdraw);

  // sidebar / logout
  wireSidebarMobile();
  wireLogout();

  // verificação & recebimento
  $$("#view-verify input[name=pmode]").forEach(r => r.addEventListener("change", togglePayoutBoxes));
  togglePayoutBoxes();

  const btnSaveKyc = $("#btnSaveKyc"); if (btnSaveKyc) btnSaveKyc.addEventListener("click", saveIdentity);
  const btnCreate  = $("#btnCreateSub"); if (btnCreate)  btnCreate.addEventListener("click", createSubaccount);
  const btnCheck   = $("#btnCheckStatus"); if (btnCheck) btnCheck.addEventListener("click", updateStatus);
  const btnSavePay = $("#btnSavePayout"); if (btnSavePay) btnSavePay.addEventListener("click", savePayout);
  const btnTest    = $("#btnTestPayout"); if (btnTest)   btnTest.addEventListener("click", testPayout);
  const btnRefHome = $("#btnRefreshFromHome"); if (btnRefHome) btnRefHome.addEventListener("click", updateStatus);

  // home / materiais / links
  const btnCopyPersonal = $("#btnCopyPersonal"); if (btnCopyPersonal) btnCopyPersonal.addEventListener("click", async () => {
    if (!APP.personalLink) return;
    await copyToClipboard(APP.personalLink); alert("Link copiado!");
  });

  wireCreateLinkModal();

  // vendas
  wireSalesControls();

  // carrega dados iniciais
  await fetchPersonalLink().catch(()=>{});
  await updateStatus().catch(()=>{});
  await refreshLinks().catch(()=>{});
});
