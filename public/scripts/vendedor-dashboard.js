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
const PRODUCTS = [
  {
    key: "geral",
    name: "Checkup Emocional Geral",
    path: "/quiz-geral.html",
    desc: "Diagnóstico emocional completo.",
    logo: "/assets/branding/logo-checkup-emocional.webp",
  },
  {
    key: "profissional",
    name: "Checkup Profissional",
    path: "/quiz-profissional.html",
    desc: "Trabalho, carreira e rotina.",
    logo: "/assets/branding/logo-checkup-emocional.webp",
  },
  {
    key: "social",
    name: "Checkup Social",
    path: "/quiz-social.html",
    desc: "Relações, convivência e vínculos.",
    logo: "/assets/branding/logo-checkup-emocional.webp",
  },
  {
    key: "familiar",
    name: "Checkup Familiar",
    path: "/quiz-familiar.html",
    desc: "Ciclos emocionais no ambiente familiar.",
    logo: "/assets/branding/logo-checkup-emocional.webp",
  },
  {
    key: "prepago",
    name: "Checkup Pré-pago",
    path: "/landing-prepago.html",
    desc: "Pagamento antes do diagnóstico.",
    logo: "/assets/branding/logo-checkup-emocional.webp",
  },
];
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
  supervisorPct: 0,        // supervisor fixo 5%
  forceCapPct: 70,         // teto força de venda (afiliado + vendedor)
  bonusCapPct: 5,          // bônus estratégico (não usado agora)
  sales: { page: 1, pageSize: 10, total: 0, items: [], type: "direct" },
  links: [],
  affiliateSalesCount: {},
affiliateFilters: {
  search: "",
  status: "all",
  sort: "sales_desc",
  page: 1,
  pageSize: 8,
},
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
  loadSales(1, "all").catch(()=>{});
  
}


  if (sel === "#view-materials") initMaterials();
  if (sel === "#view-links") {
  renderProductLinks();
  refreshLinks().catch(()=>{});
}
    if (sel === "#view-profile")  loadProfile().catch(()=>{});

}

function routeFromHash(){
  const h = (location.hash || "#inicio").toLowerCase();
  if (h.indexOf("#verificacao") === 0) return showView("#view-verify");
  if (h.indexOf("#links") === 0)       return showView("#view-links");
    if (h.indexOf("#cadastro") === 0)    return showView("#view-profile");
  if (h.indexOf("#afiliados") === 0) return showView("#view-team");
  if (h.indexOf("#materiais") === 0 || h.indexOf("#marketing") === 0) {
  return showView("#view-materials");
}
  if (h.indexOf("#vendas") === 0)      return showView("#view-sales");
  if (h.indexOf("#treinamento") === 0) return showView("#view-training");
  if (h.indexOf("#suporte") === 0)     return showView("#view-support");
  if (h.indexOf("#sair") === 0)        return doLogout();
  return showView("#view-home");
}
// Banner inicial abre diretamente Marketing
const heroMarketing = document.getElementById("heroMarketing");

if (heroMarketing) {
  heroMarketing.style.cursor = "pointer";

  heroMarketing.addEventListener("click", () => {

    location.hash = "#marketing";

    showView("#view-materials");

  });
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
renderProductLinks();
}
function buildProductUrl(path) {
  if (!APP.personalLink) return "";

  try {
    const base = new URL(APP.personalLink, location.origin);
    const url = new URL(path, location.origin);

    base.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  } catch {
    return location.origin + path;
  }
}

function renderProductLinks() {
  const grid = $("#productLinksGrid");
  if (!grid) return;

  if (!APP.linkEnabled || !APP.personalLink) {
    grid.innerHTML = `<p class="muted">Seus links serão exibidos quando sua conta estiver ativa.</p>`;
    return;
  }

  grid.innerHTML = "";

  PRODUCTS.forEach((p) => {
    const url = buildProductUrl(p.path);

    const card = document.createElement("div");
    card.className = "product-link-card";
    card.innerHTML = `
      <img src="${p.logo}" alt="${p.name}" class="product-logo" />
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="link-box product-link-text">${url}</div>
        <div class="row mt-12">
          <button class="btn" data-copy="${url}">Copiar</button>
          <a class="btn secondary" href="${url}" target="_blank" rel="noopener">Abrir</a>
          <button class="btn secondary" data-qr="${url}">QR</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await copyToClipboard(btn.getAttribute("data-copy"));
      btn.textContent = "Copiado!";
      setTimeout(() => btn.textContent = "Copiar", 1400);
    });
  });

  grid.querySelectorAll("[data-qr]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-qr");
      const w = window.open("", "_blank", "width=380,height=440");
      if (w) {
        w.document.write(`<title>QR Code</title><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif"></body>`);
        drawQR(w.document.body, url, 320);
      }
    });
  });
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
function calcVendorPct(affPct, cap = 70){
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
  const aff = Math.min(60, Math.max(35, Number(pctAff.value || 50)));
  pctAff.value = aff;

  const vend = calcVendorPct(aff, APP.forceCapPct);

  if (pctVend) pctVend.textContent = vend + "%";
  if (pctVend) pctVend.value = vend;

  const modalAff = $("#modalAffPct");
  if (modalAff) modalAff.textContent = aff + "%";

  const previewAff = $("#previewAffPct");
  const previewVend = $("#previewVendPct");
  if (previewAff) previewAff.textContent = aff + "%";
  if (previewVend) previewVend.textContent = vend + "%";

  if (pctTot) pctTot.value = APP.forceCapPct;
  if (pctSup) pctSup.value = 0;
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
    if (pctA < 35 || pctA > 60) {
  alert("A % do afiliado deve estar entre 35 e 60.");
  return;
}
    // CAP da força de venda: A + V ≤ 60 (supervisor é aplicado na venda)
    if (pctA + pctV > APP.forceCapPct) {
  alert("Teto de 70% excedido. Ajuste os percentuais.");
  return;
}


    try{
      const r = await jfetch("/vendors/links", {
        method: "POST",
        body: JSON.stringify({ email, pct_affiliate: pctA, pct_vendor: pctV, pct_supervisor: 0 })
      });
      modal?.classList.add("hide"); modal?.setAttribute("aria-hidden","true");
      await refreshLinks();
      alert("Link criado e convite enviado para o afiliado.");
    }catch(e){ alert(e.message || "Erro ao criar link."); }
  });
}
function buildAffiliateProductLinks(it){
  const code = it.code || it.token || "";
  const origin = window.location.origin;

  if (!code) return [];

  return PRODUCTS.map(p => ({
    name: p.name,
    url: `${origin}${p.path}?aff=${encodeURIComponent(code)}`
  }));
}
function getAffiliateSalesCount(it){
  const keys = [
    it.id,
    it.affiliate_link_id,
    it.affiliate_id,
    it.affiliate?.id,
    it.affiliate_email,
    it.affiliate?.email,
    it.affiliate_name,
    it.affiliate?.name
  ].filter(Boolean).map(String);

  for (const k of keys) {
    if (APP.affiliateSalesCount[k]) return APP.affiliateSalesCount[k];
  }

  return 0;
}
function getAffiliatePaidAmount(it){
  const keys = getAffiliateSalesKeys(it);

  for (const k of keys) {
    if (APP.affiliateSalesAmount[k]) return APP.affiliateSalesAmount[k];
  }

  return 0;
}

function getAffiliateVendorAmount(it){
  const keys = getAffiliateSalesKeys(it);

  for (const k of keys) {
    if (APP.affiliateVendorAmount[k]) return APP.affiliateVendorAmount[k];
  }

  return 0;
}

function getAffiliateSalesKeys(it){
  return [
    it.id,
    it.affiliate_link_id,
    it.affiliate_id,
    it.affiliate?.id,
    it.affiliate_email,
    it.affiliate?.email,
    it.affiliate_name,
    it.affiliate?.name
  ].filter(Boolean).map(String);
}
function renderLinks(list){
  const activeGrid = $("#activeAffiliatesGrid");
  const pendingGrid = $("#pendingAffiliatesGrid");

  if (!activeGrid || !pendingGrid) return;

  activeGrid.innerHTML = "";
  pendingGrid.innerHTML = "";

  const items = Array.isArray(list) ? list : [];

  const isAffiliateReady = (it) => {
  const status = String(it.status || "").toLowerCase();
  const hasAffiliateIdentity = Boolean(it.affiliate_id || it.affiliate?.id);
  const hasActivationDate = Boolean(it.accepted_at || it.affiliate?.accepted_at);
  const hasActivatedStatus = (
    status === "accepted" ||
    status === "active" ||
    status === "activated" ||
    status === "approved"
  );

  return Boolean(
    it.affiliate_ready ||
    hasAffiliateIdentity ||
    hasActivationDate ||
    hasActivatedStatus
  );
};

const activeItems = items.filter(isAffiliateReady);
const pendingItems = items.filter(it => !isAffiliateReady(it));

  if (!activeItems.length) {
    activeGrid.innerHTML = '<p class="muted">Nenhum afiliado ativo ainda.</p>';
  }

  if (!pendingItems.length) {
    pendingGrid.innerHTML = '<p class="muted">Nenhum convite aguardando ativação.</p>';
  }

  activeItems.forEach(it => {
    const card = document.createElement("article");
    card.className = "affiliate-card affiliate-card--active";

    const name = it.affiliate?.name || it.affiliate_name || "Afiliado";
    const email = it.affiliate?.email || it.affiliate_email || it.invite_email || "—";
    const affPct = isFinite(Number(it.pct_aff)) ? Number(it.pct_aff) : 0;
    const vendPct = isFinite(Number(it.pct_vendor)) ? Number(it.pct_vendor) : 0;
    const productLinks = buildAffiliateProductLinks(it);
    card.innerHTML = `
      <div class="affiliate-card__top">
        <div>
          <h3>${name}</h3>
          <p>${email}</p>
        </div>
        <span class="affiliate-status ${
  it.active
    ? "affiliate-status--active"
    : "affiliate-status--pending"
}">
  ${it.active ? "Ativo" : "Pausado"}
</span>
      </div>

      <div class="affiliate-metrics">
  <div>
    <span>% Afiliado</span>
    <strong>${affPct}%</strong>
  </div>
  <div>
    <span>% Você</span>
    <strong>${vendPct}%</strong>
  </div>
  <div>
    <span>Vendas</span>
    <strong>${getAffiliateSalesCount(it)}</strong>
  </div>
  <div>
    <span>Cliques</span>
    <strong>${it.clicks ?? 0}</strong>
  </div>
  <div>
  <span>Pago ao afiliado</span>
  <strong>${BRL(getAffiliatePaidAmount(it))}</strong>
</div>
<div>
  <span>Seu lucro</span>
  <strong>${BRL(getAffiliateVendorAmount(it))}</strong>
</div>
</div>

<div class="affiliate-products-list">
  ${productLinks.map(link => `
    <div class="affiliate-product-link">
      <div>
        <strong>${link.name}</strong>
        <span>${link.url}</span>
      </div>
      <div class="row">
        <button class="btn ghost" data-act="copy" data-url="${link.url}">Copiar</button>
        <button class="btn ghost" data-act="qr" data-url="${link.url}">QR</button>
      </div>
    </div>
  `).join("")}
</div>

<div class="row mt-12">
  <button class="btn ghost" data-act="toggle" data-id="${it.id}">
  ${it.active ? "Pausar afiliado" : "Reativar afiliado"}
</button>
</div>
    `;

    activeGrid.appendChild(card);
  });

  pendingItems.forEach(it => {
    const card = document.createElement("article");
    card.className = "affiliate-card affiliate-card--pending";

    const name = it.affiliate?.name || it.affiliate_name || "Convite enviado";
    const email = it.affiliate?.email || it.affiliate_email || it.invite_email || "—";
    const affPct = isFinite(Number(it.pct_aff)) ? Number(it.pct_aff) : 0;
    const vendPct = isFinite(Number(it.pct_vendor)) ? Number(it.pct_vendor) : 0;

    card.innerHTML = `
      <div class="affiliate-card__top">
        <div>
          <h3>${name}</h3>
          <p>${email}</p>
        </div>
        <span class="affiliate-status affiliate-status--pending">Aguardando ativação</span>
      </div>

      <div class="affiliate-metrics">
        <div>
          <span>% Afiliado</span>
          <strong>${affPct}%</strong>
        </div>
        <div>
          <span>% Você</span>
          <strong>${vendPct}%</strong>
        </div>
      </div>

      <p class="muted mt-12">
        O link e o QR Code serão liberados depois que o afiliado concluir a ativação.
      </p>

      <div class="row mt-12">
        <button class="btn ghost" data-act="resend" data-id="${it.id}">
          Reenviar convite
        </button>
      </div>
    `;

    pendingGrid.appendChild(card);
  });

  [activeGrid, pendingGrid].forEach(root => {
    root.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
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
            drawQR(w.document.body, url, 320);
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
  });
}
async function loadAffiliateSalesCounts(){
  APP.affiliateSalesCount = {};
APP.affiliateSalesAmount = {};
APP.affiliateVendorAmount = {};

  try {
    const r = await jfetch("/vendors/sales?type=override&limit=500&offset=0");
    const items = Array.isArray(r.items) ? r.items : [];

    items.forEach(sale => {
      if (!sale.is_affiliate_sale) return;

      const keys = [
        sale.affiliate_link_id,
        sale.affiliate_id,
        sale.affiliate_email,
        sale.affiliate_name
      ].filter(Boolean).map(String);

      keys.forEach(k => {
        APP.affiliateSalesCount[k] = (APP.affiliateSalesCount[k] || 0) + 1;
      const netAmount = Number(
  sale.net_amount ||
  (sale.net_amount_cents ? sale.net_amount_cents / 100 : 0) ||
  sale.amount ||
  0
);

const affiliateAmount = Number(sale.affiliate_amount || 0);

const vendorAmount = typeof sale.vendor_amount === "number"
  ? sale.vendor_amount
  : Math.max(0, netAmount - affiliateAmount);

APP.affiliateSalesAmount[k] = (APP.affiliateSalesAmount[k] || 0) + affiliateAmount;
APP.affiliateVendorAmount[k] = (APP.affiliateVendorAmount[k] || 0) + vendorAmount;
});
    });
  } catch(e) {
    APP.affiliateSalesCount = {};
  }
}
function renderFilteredAffiliates(){
  let items = Array.isArray(APP.links) ? [...APP.links] : [];

  const search = ($("#affiliateSearch")?.value || "").trim().toLowerCase();
  const status = $("#affiliateStatusFilter")?.value || "all";
  const sort = $("#affiliateSortFilter")?.value || "sales_desc";

  const isReady = (it) => {
    const st = String(it.status || "").toLowerCase();
    return Boolean(
      it.affiliate_ready ||
      it.affiliate_id ||
      it.affiliate?.id ||
      it.accepted_at ||
      it.affiliate?.accepted_at ||
      st === "accepted" ||
      st === "active" ||
      st === "activated" ||
      st === "approved"
    );
  };

  if (search) {
    items = items.filter(it => {
      const hay = [
        it.affiliate?.name,
        it.affiliate_name,
        it.affiliate?.email,
        it.affiliate_email,
        it.invite_email
      ].filter(Boolean).join(" ").toLowerCase();

      return hay.includes(search);
    });
  }

  if (status !== "all") {
    items = items.filter(it => {
      const ready = isReady(it);

      if (status === "pending") return !ready;
      if (status === "active") return ready && !!it.active;
      if (status === "paused") return ready && !it.active;

      return true;
    });
  }

  items.sort((a, b) => {
    if (sort === "sales_desc") return getAffiliateSalesCount(b) - getAffiliateSalesCount(a);
    if (sort === "sales_asc") return getAffiliateSalesCount(a) - getAffiliateSalesCount(b);

    if (sort === "name_asc") {
      const an = (a.affiliate?.name || a.affiliate_name || a.invite_email || "").toLowerCase();
      const bn = (b.affiliate?.name || b.affiliate_name || b.invite_email || "").toLowerCase();
      return an.localeCompare(bn);
    }

    if (sort === "created_desc") {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }

    return 0;
  });

  const pageSize = APP.affiliateFilters.pageSize || 8;
  const maxPage = Math.max(1, Math.ceil(items.length / pageSize));

  APP.affiliateFilters.page = Math.min(APP.affiliateFilters.page || 1, maxPage);

  const page = APP.affiliateFilters.page;
  const offset = (page - 1) * pageSize;
  const pagedItems = items.slice(offset, offset + pageSize);

  renderLinks(pagedItems);

  setText($("#affiliatePage"), String(page));
  setText($("#affiliateMsg"), items.length ? `Total: ${items.length}` : "");
}
async function refreshLinks(){
  try {
    await loadAffiliateSalesCounts();

    const r = await jfetch("/vendors/links");
    APP.links = Array.isArray(r) ? r : (r.items || []);
    renderFilteredAffiliates();
  } catch(e){
    APP.links = [];
renderFilteredAffiliates();
  }
}

/* =========================================================
 * marketing / materiais comerciais
 * =======================================================*/
const MARKETING = {
  loaded: false,
  items: [],
};

const MARKETING_TYPE_LABELS = {
  image: "Imagem/Banner",
  video: "Vídeo",
  pdf: "PDF",
  external_link: "Link externo",
  message_template: "Template de mensagem",
  playbook: "Playbook",
};

const MARKETING_PRODUCT_LABELS = {
  geral: "Checkup Geral",
  profissional: "Checkup Profissional",
  social: "Checkup Social",
  familiar: "Checkup Familiar",
  prepago: "Checkup Pré-pago",
};

function marketingTypeLabel(type) {
  return MARKETING_TYPE_LABELS[type] || type || "Material";
}

function marketingProductLabel(productKey) {
  return MARKETING_PRODUCT_LABELS[productKey] || productKey || "Geral";
}

function marketingIcon(type) {
  if (type === "image") return "🖼️";
  if (type === "video") return "🎬";
  if (type === "pdf") return "📄";
  if (type === "message_template") return "💬";
  if (type === "playbook") return "📘";
  return "🔗";
}

function fillMarketingFilters(items) {
  const productSelect = $("#marketingProduct");
  const categorySelect = $("#marketingCategory");
  const typeSelect = $("#marketingType");

  if (!productSelect || !categorySelect || !typeSelect) return;

  const products = [...new Set(items.map(i => i.product_key).filter(Boolean))];
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const types = [...new Set(items.map(i => i.type).filter(Boolean))];

  productSelect.innerHTML = `<option value="">Todos os produtos</option>`;
  products.forEach(p => {
    productSelect.innerHTML += `<option value="${p}">${marketingProductLabel(p)}</option>`;
  });

  categorySelect.innerHTML = `<option value="">Todas categorias</option>`;
  categories.forEach(c => {
    categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
  });

  typeSelect.innerHTML = `<option value="">Todos os tipos</option>`;
  types.forEach(t => {
    typeSelect.innerHTML += `<option value="${t}">${marketingTypeLabel(t)}</option>`;
  });
}

function getFilteredMarketingItems() {
  const product = $("#marketingProduct")?.value || "";
  const category = $("#marketingCategory")?.value || "";
  const type = $("#marketingType")?.value || "";
  const search = ($("#marketingSearch")?.value || "").trim().toLowerCase();

  return MARKETING.items.filter(item => {
    const passProduct = !product || item.product_key === product;
    const passCategory = !category || item.category === category;
    const passType = !type || item.type === type;

    const hay = [
      item.title,
      item.description,
      item.category,
      item.product_key,
      item.type,
    ].filter(Boolean).join(" ").toLowerCase();

    const passSearch = !search || hay.includes(search);

    return passProduct && passCategory && passType && passSearch;
  });
}

function renderMarketingCards() {
  const grid = $("#marketingCards");
  if (!grid) return;

  const items = getFilteredMarketingItems();

  if (!items.length) {
    grid.innerHTML = `
      <div class="marketing-empty">
        <h3>Nenhum material encontrado</h3>
        <p class="muted">Tente trocar os filtros ou atualizar a página.</p>
      </div>
    `;
    return;
  }

  const inspirations = items.filter(i =>
    String(i.category || "").toLowerCase().includes("ideias") ||
    String(i.category || "").toLowerCase().includes("inspiração") ||
    String(i.category || "").toLowerCase().includes("inspiracao")
  );

  const templates = items.filter(i =>
    !inspirations.includes(i) &&
    ["image", "external_link"].includes(i.type)
  );

  const videos = items.filter(i => i.type === "video");
  const playbooks = items.filter(i => i.type === "playbook" || i.type === "pdf");
  const messages = items.filter(i => i.type === "message_template");

  grid.innerHTML = `
    ${renderMarketingSection("✨ Inspire-se", "Ideias práticas para divulgar em lugares reais.", inspirations)}
    ${renderMarketingSection("🎨 Templates e Banners", "Artes prontas para publicar, imprimir ou divulgar.", templates)}
    ${renderMarketingSection("🎬 Vídeos", "Vídeos para assistir, baixar e usar em campanhas.", videos)}
    ${renderMarketingSection("📘 Playbooks e PDFs", "Guias rápidos, argumentos e materiais de apoio.", playbooks)}
    ${renderMarketingSection("💬 Mensagens prontas", "Textos para WhatsApp, Instagram e abordagem.", messages)}
  `;

  wireMarketingCardActions(grid);
}
function getMarketingFirstFile(item) {
  return Array.isArray(item.files) && item.files.length ? item.files[0] : null;
}

function getMarketingThumb(item) {
  const file = getMarketingFirstFile(item);
  return (
    item.cover_url ||
    file?.thumbnail_url ||
    (item.type === "image" ? file?.file_url : "") ||
    ""
  );
}

function getMarketingOpenUrl(item) {
  const file = getMarketingFirstFile(item);
  return file?.file_url || item.url || item.cover_url || "";
}

function getMarketingDownloadUrl(item) {
  const file = getMarketingFirstFile(item);
  return file?.download_url || file?.file_url || item.url || "";
}

function renderMarketingSection(title, subtitle, items) {
  if (!items.length) return "";

  return `
    <section class="marketing-shelf">
      <div class="marketing-shelf__head">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
      </div>

      <div class="marketing-shelf__row">
        ${items.map(renderMarketingCard).join("")}
      </div>
    </section>
  `;
}

function renderMarketingCard(item) {
  const thumb = getMarketingThumb(item);
  const openUrl = getMarketingOpenUrl(item);
  const downloadUrl = getMarketingDownloadUrl(item);

  const isImage = item.type === "image";
  const isVideo = item.type === "video";
  const isTemplate = item.type === "message_template";

  const primaryLabel = isVideo ? "Assistir" : isTemplate ? "Copiar" : "Visualizar";

  return `
    <article class="marketing-netflix-card">
      <div class="marketing-netflix-thumb">
        ${
          thumb
            ? `<img src="${thumb}" alt="${item.title}" loading="lazy">`
            : `<div class="marketing-netflix-icon">${marketingIcon(item.type)}</div>`
        }

        <div class="marketing-netflix-overlay">
          ${
            openUrl
              ? `<a class="btn" href="${openUrl}" target="_blank" rel="noopener">${primaryLabel}</a>`
              : ""
          }

          ${
            downloadUrl
              ? `<a class="btn secondary" href="${downloadUrl}" target="_blank" rel="noopener" download>Baixar</a>`
              : ""
          }

          ${
            openUrl || downloadUrl
              ? `<button class="btn secondary" data-marketing-copy="${downloadUrl || openUrl}">Copiar link</button>`
              : ""
          }
        </div>
      </div>

      <div class="marketing-netflix-body">
        <div class="marketing-card-tags">
          <span>${marketingTypeLabel(item.type)}</span>
          ${item.category ? `<span>${item.category}</span>` : ""}
        </div>

        <h3>${item.title}</h3>
        ${item.description ? `<p>${item.description}</p>` : ""}
      </div>
    </article>
  `;
}

function wireMarketingCardActions(root) {
  root.querySelectorAll("[data-marketing-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const text = btn.getAttribute("data-marketing-copy") || "";
      if (!text) return;

      await copyToClipboard(text);

      const old = btn.textContent;
      btn.textContent = "Copiado!";
      setTimeout(() => {
        btn.textContent = old;
      }, 1400);
    });
  });
}
async function loadMarketing() {
  const grid = $("#marketingCards");
  if (grid) {
    grid.innerHTML = `<p class="muted">Carregando materiais...</p>`;
  }

  try {
    const r = await jfetch("/marketing-materials?audience=vendor");
    MARKETING.items = Array.isArray(r.items) ? r.items : [];

    fillMarketingFilters(MARKETING.items);
    renderMarketingCards();

    MARKETING.loaded = true;
  } catch (e) {
    if (grid) {
      grid.innerHTML = `
        <div class="card">
          <p class="muted">Não foi possível carregar os materiais.</p>
        </div>
      `;
    }
  }
}

function wireMarketingFilters() {
  ["marketingProduct", "marketingCategory", "marketingType", "marketingSearch"].forEach(id => {
    const el = $("#" + id);
    if (!el) return;

    const eventName = el.tagName === "INPUT" ? "input" : "change";

    el.addEventListener(eventName, () => {
      renderMarketingCards();
    });
  });

  const reload = $("#btnReloadMarketing");
  if (reload) {
    reload.addEventListener("click", () => {
      loadMarketing().catch(() => {});
    });
  }
}

function initMaterials() {
  wireMarketingFilters();

  if (!MARKETING.loaded) {
    loadMarketing().catch(() => {});
  } else {
    renderMarketingCards();
  }
}

/* =========================================================
 * vendas (diretas / override)
 * =======================================================*/
function renderSales(items){
  const container = $("#salesCards");
  const msg = $("#salesMsg");

  if (!container) return;

  container.innerHTML = "";

  if (!items || !items.length) {
    container.innerHTML = `
      <div class="sale-card">
        <div class="muted">Nenhuma venda encontrada.</div>
      </div>
    `;
    if (msg) msg.textContent = "";
    return;
  }

  items.forEach(it => {
    const isAffiliate = !!it.is_affiliate_sale;

    const pct = isFinite(Number(it.pct_vendor))
      ? Number(it.pct_vendor)
      : 0;

    const commission =
      typeof it.vendor_amount === "number"
        ? it.vendor_amount
        : (isFinite(it.amount) ? (it.amount * pct / 100) : 0);

    const affiliateName = isAffiliate
      ? (it.affiliate_name || it.affiliate_email || null)
      : null;

    const card = document.createElement("div");
    card.className = "sale-card";

    card.innerHTML = `
      <div class="sale-header">
        <div>
          <div class="sale-product">Checkup Emocional</div>

          <div class="sale-type ${isAffiliate ? "affiliate" : "direct"}">
            ${isAffiliate ? "VENDA DE AFILIADO" : "VENDA PRÓPRIA"}
          </div>
        </div>

        <div>
          <div class="sale-amount">${BRL(commission)}</div>
          <div style="font-size:12px;color:#94a3b8;text-align:right;">
            Seu ganho
          </div>
        </div>
      </div>

      ${
        affiliateName
          ? `<div class="sale-affiliate">Afiliado: <strong>${affiliateName}</strong></div>`
          : ""
      }

      ${
        isAffiliate && typeof it.affiliate_amount === "number" && it.affiliate_amount > 0
          ? `<div class="sale-affiliate">Afiliado recebeu: <strong>${BRL(it.affiliate_amount)}</strong></div>`
          : ""
      }

      <div class="sale-footer">
        <div>Venda líquida: ${BRL(it.amount || 0)}</div>
        <div>Comissão: ${pct}%</div>
        <div>${fmtDate(it.created_at)}</div>
      </div>
    `;

    container.appendChild(card);
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
function updateSalesTotalsFromItems(items){
  const safeItems = Array.isArray(items) ? items : [];

  const totalMine = safeItems.reduce((sum, it) => {
    const pct = isFinite(Number(it.pct_vendor)) ? Number(it.pct_vendor) : 0;

    const commission =
      typeof it.vendor_amount === "number"
        ? it.vendor_amount
        : (isFinite(Number(it.amount)) ? (Number(it.amount) * pct / 100) : 0);

    return sum + Number(commission || 0);
  }, 0);

  setText($("#balAvailVend"), BRL(totalMine));
  setText($("#balPendVend"), BRL(0));
}
async function loadSales(page = 1, type = "all"){
  APP.sales.type = type;

  const limit  = APP.sales.pageSize;
  const pageEl = $("#salesPage");
  const msg    = $("#salesMsg");

  const search = ($("#salesSearch")?.value || "").trim().toLowerCase();
  const start  = $("#salesStart")?.value || "";
  const end    = $("#salesEnd")?.value || "";

  if (msg) msg.textContent = "Carregando…";

  try {
    let allItems = [];

    const r = await jfetch(`/vendors/sales?type=override&limit=500&offset=0`);

const sourceItems = r.items || [];

const directItems = sourceItems.filter(it => !it.is_affiliate_sale);
const affiliateItems = sourceItems.filter(it => !!it.is_affiliate_sale);

if (type === "direct") {
  allItems = directItems;
} else if (type === "override") {
  allItems = affiliateItems;
} else {
  allItems = sourceItems;
}

    if (search) {
      allItems = allItems.filter(it => {
        const hay = [
          it.affiliate_name,
          it.affiliate_email,
          it.customer_name,
          it.customer_email,
          it.buyer_name,
          it.buyer_email,
          it.order_id,
          it.payment_id
        ].filter(Boolean).join(" ").toLowerCase();

        return hay.includes(search);
      });
    }

    if (start) {
      const startDate = new Date(start + "T00:00:00");
      allItems = allItems.filter(it => new Date(it.created_at) >= startDate);
    }

    if (end) {
      const endDate = new Date(end + "T23:59:59");
      allItems = allItems.filter(it => new Date(it.created_at) <= endDate);
    }

    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    APP.sales.total = allItems.length;
    APP.sales.page = page;

    const offset = (page - 1) * limit;
    updateSalesTotalsFromItems(allItems);

APP.sales.items = allItems.slice(offset, offset + limit);

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
      

    });
  });
const applyFilters = $("#btnApplySalesFilters");
if (applyFilters) {
  applyFilters.addEventListener("click", () => {
    loadSales(1, APP.sales.type || "all").catch(()=>{});
    
  });
}

const clearFilters = $("#btnClearSalesFilters");
if (clearFilters) {
  clearFilters.addEventListener("click", () => {
    if ($("#salesSearch")) $("#salesSearch").value = "";
    if ($("#salesStart")) $("#salesStart").value = "";
    if ($("#salesEnd")) $("#salesEnd").value = "";

    loadSales(1, APP.sales.type || "all").catch(()=>{});
    loadVendorTotals(APP.sales.type || "all").catch(()=>{});
  });
}

["salesSearch", "salesStart", "salesEnd"].forEach(id => {
  const el = $("#" + id);
  if (!el) return;

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      loadSales(1, APP.sales.type || "all").catch(()=>{});
      loadVendorTotals(APP.sales.type || "all").catch(()=>{});
    }
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
function wireAffiliateFilters(){
  const apply = $("#btnApplyAffiliateFilters");
  const clear = $("#btnClearAffiliateFilters");
  const prev = $("#prevAffiliates");
  const next = $("#nextAffiliates");

  if (apply) {
    apply.addEventListener("click", () => {
      APP.affiliateFilters.page = 1;
      renderFilteredAffiliates();
    });
  }

  if (clear) {
    clear.addEventListener("click", () => {
      if ($("#affiliateSearch")) $("#affiliateSearch").value = "";
      if ($("#affiliateStatusFilter")) $("#affiliateStatusFilter").value = "all";
      if ($("#affiliateSortFilter")) $("#affiliateSortFilter").value = "sales_desc";

      APP.affiliateFilters.page = 1;
      renderFilteredAffiliates();
    });
  }

  ["affiliateSearch", "affiliateStatusFilter", "affiliateSortFilter"].forEach(id => {
    const el = $("#" + id);
    if (!el) return;

    const ev = el.tagName === "INPUT" ? "input" : "change";
    el.addEventListener(ev, () => {
      APP.affiliateFilters.page = 1;
      renderFilteredAffiliates();
    });
  });

  if (prev) {
    prev.addEventListener("click", () => {
      APP.affiliateFilters.page = Math.max(1, APP.affiliateFilters.page - 1);
      renderFilteredAffiliates();
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      APP.affiliateFilters.page += 1;
      renderFilteredAffiliates();
    });
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
  wireAffiliateFilters();

  // carrega dados iniciais
  await fetchPersonalLink().catch(()=>{});
  await updateStatus().catch(()=>{});
  await refreshLinks().catch(()=>{});
});
