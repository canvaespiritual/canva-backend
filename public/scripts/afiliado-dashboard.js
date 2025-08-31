"use strict";

/* =========================================================
 * helpers
 * =======================================================*/
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function log(...a){ try{ console.log("[affiliado]", ...a); }catch{} }

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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
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
  link: null,
  linkEnabled: false,
  walletId: "—",
  sales: { page: 1, pageSize: 10, total: 0, items: [] }
};

/* =========================================================
 * auth + link
 * =======================================================*/
async function ensureAuth() {
  const r = await jfetch("/affiliates/me");
  if (!r || !r.me) {
    location.href = "/afiliado/login.html";
    throw new Error("redirect");
  }
  APP.me = r.me;
  // caminho do destino (use /quiz.html em prod e também pode usar no dev)
const LANDING_PATH = "/quiz.html";

APP.link = `${location.origin}${LANDING_PATH}/?ref=${APP.me.id}`;

}

// === [ADD] Carrega visão efetiva (usa link/comissão de vendedor se existir)
async function loadAffiliateOverview() {
  try {
    const ov = await jfetch("/affiliates/me/overview"); // { link, commission_percent, vendor_contact? }

    // sobrescreve o link "padrão ?ref=" pelo link travado do vendedor (se houver)
   if (ov.link) {
  APP.link = ov.link;
}
const linkStr = ov.link || APP.link || "—";

// pinta #meu-link e #comissao
const elLink = document.querySelector("#meu-link");
const elCom  = document.querySelector("#commission");

if (elLink) {
  if ("value" in elLink) elLink.value = linkStr;  // input/textarea
  else elLink.textContent = linkStr;             // span/div etc.
}
if (elCom) {
  const pct = (ov.commission_percent != null ? Number(ov.commission_percent) : null);
  elCom.textContent = (pct != null ? `${pct}%` : "—");
}

// 1) QR + botão “Abrir” usando o MESMO link
drawQR($("#qrLink"), linkStr || "", 180);
const btnOpen = $("#btnOpenLink");
if (btnOpen) {
  if (linkStr && linkStr !== "—") btnOpen.href = linkStr;
  else btnOpen.removeAttribute("href");
}

// 2) manter o valor final no estado (beneficia outras telas)
APP.link = linkStr;

// 3) gating: se o backend enviar link_enabled=false, avise/desabilite
if (typeof ov.link_enabled !== "undefined") {
  const lock = $("#linkLockedNotice");
  if (lock) lock.style.display = ov.link_enabled ? "none" : "";
  // opcional: desabilitar campo/botões ao bloquear
  if (elLink && "disabled" in elLink) elLink.disabled = !ov.link_enabled;
  const btnCopy = $("#btnCopyLink");
  if (btnCopy) btnCopy.disabled = !ov.link_enabled;
}


    // atualiza áreas que dependem do APP.link (QRs etc.)
    paintLinkAreas();

    // Suporte do vendedor (aparece só para afiliado de vendedor)
    if (ov.vendor_contact) {
      const supBox   = document.querySelector("#supportVendorBox");
      const supName  = document.querySelector("#supportVendorName");
      const supEmail = document.querySelector("#supportVendorEmailLink");
      const supPhone = document.querySelector("#supportVendorPhone");

      if (supBox)   supBox.style.display = "";
      if (supName)  supName.textContent = ov.vendor_contact.name || "—";
      if (supEmail) {
        supEmail.textContent = ov.vendor_contact.email || "—";
        supEmail.href = ov.vendor_contact.email ? `mailto:${ov.vendor_contact.email}` : "#";
      }
      if (supPhone) supPhone.textContent = ov.vendor_contact.phone || "—";
    }
  } catch (err) {
    // silencioso: se der 404/401, mantemos o comportamento padrão (30% + ?ref)
  }
}

/* =========================================================
 * views / navegação
 * =======================================================*/
function showView(sel){
  $$(".view").forEach(v => v.classList.remove("active"));
  const v = $(sel);
  if (v) v.classList.add("active");

  $$(".nav a.nav-link").forEach(a => a.classList.remove("active"));
  const nav = $('.nav a.nav-link[data-target="'+sel+'"]');
  if (nav) nav.classList.add("active");

if (sel === "#view-sales") {
  loadSales(APP.sales.page).catch(()=>{});
  loadTotalsAffiliate().catch(()=>{});
}

  if (sel === "#view-materials") initMaterials();
}

function routeFromHash(){
  const h = (location.hash || "#inicio").toLowerCase();

  if (h.startsWith("#perfil")) {
    showView("#view-profile");
    loadMyProfile().catch(()=>{});
    return;
  }
  if (h.startsWith("#subconta"))   return showView("#view-sub");
  if (h.startsWith("#meu-link"))   return showView("#view-link");
  if (h.startsWith("#materiais"))  return showView("#view-materials");
  if (h.startsWith("#vendas"))     return showView("#view-sales");
  if (h.startsWith("#suporte"))    return showView("#view-support");
  if (h.startsWith("#sair"))       return doLogout();
  return showView("#view-home");
}

/* =========================================================
 * status subconta
 * =======================================================*/
function paintStatus({ general, bank, link_enabled }) {
  APP.linkEnabled = !!link_enabled;

  const cls = function(v){
    if (v === "APPROVED") return "ok";
    if (v === "REJECTED") return "err";
    return "warn";
  };

  const stGHome = $("#stGeneralHome");
  const stBHome = $("#stBankHome");
  const stLHome = $("#stLinkHome");

  if (stGHome){ stGHome.textContent = general || "—"; stGHome.className = cls(general || "PENDING"); }
  if (stBHome){ stBHome.textContent = bank    || "—"; stBHome.className = cls(bank    || "PENDING"); }
  if (stLHome){ stLHome.textContent = link_enabled ? "Sim" : "Não"; stLHome.className = link_enabled ? "ok" : "warn"; }

  const stG = $("#stGeneral");
  const stB = $("#stBank");
  const stL = $("#stLink");

  if (stG){ stG.textContent = general || "—"; stG.className = cls(general || "PENDING"); }
  if (stB){ stB.textContent = bank    || "—"; stB.className = cls(bank    || "PENDING"); }
  if (stL){ stL.textContent = link_enabled ? "Sim" : "Não"; stL.className = link_enabled ? "ok" : "warn"; }

  paintLinkAreas();
}

async function updateStatus(){
  try {
    jmsg("Consultando status…");
    const r = await jfetch("/affiliates/me/asaas/status");
    if (r.wallet_id) { APP.walletId = r.wallet_id; setText($("#wallet"), APP.walletId); } // ⬅️ add
    const s = r.status || {};
    paintStatus({ general: s.general, bank: s.bank, link_enabled: r.link_enabled });
    // 👉 se liberou o link agora, recarrega o overview para pegar o ?aff=CODE imediatamente
if (r.link_enabled) {
  await loadAffiliateOverview().catch(()=>{});
  paintLinkAreas();
}
// 👉 se liberou o link agora, recarrega o overview…
if (r.link_enabled) {
  await loadAffiliateOverview().catch(()=>{});
  paintLinkAreas();
}

// Avisos vermelhos (corpo certo aqui dentro)
try {
  let email = APP?.me?.email || "";
  if (!email) {
    const meResp = await jfetch("/affiliates/me");
    email = meResp?.me?.email || "";
  }
  const noteHome = $("#asaasLoginWarnHome");
  const noteSub  = $("#asaasLoginWarnSub");
  const asaasLogin = "https://www.asaas.com/login/auth?customerSignUpOriginChannel=HOME";

  const hasWallet = !!r.wallet_id; // aqui r existe
  if (hasWallet) {
    const html = `Sua conta Asaas está criada e precisa ser <strong>ativada</strong> para realizar saques.
      Acesse o <a href="${asaasLogin}" target="_blank" rel="noopener"><strong>Painel Asaas</strong></a> com o e-mail <strong>${email}</strong>.
      Se não tiver senha, clique em <em>"Esqueci minha senha"</em> na página do Asaas.`;
    if (noteHome) { noteHome.innerHTML = html; noteHome.style.display = ""; }
    if (noteSub)  { noteSub.innerHTML  = html; noteSub.style.display  = ""; }
  } else {
    if (noteHome) noteHome.style.display = "none";
    if (noteSub)  noteSub.style.display  = "none";
  }
} catch {}

    jmsg("Status atualizado.", "muted");
  } catch (e) {
    jmsg(e.message, "err");
  }
}
// Avisos vermelhos de ativação/saque no Asaas



function jmsg(text, cls){
  const el = $("#msg");
  if (!el) return;
  el.className = (cls || "muted") + " mt-12";
  el.textContent = text;
}

/* =========================================================
 * link
 * =======================================================*/
function paintLinkAreas(){
  // home teaser
  const teaser = $("#homeLinkTeaser");
  if (teaser) setDisplay(teaser, APP.linkEnabled);

  setText($("#myLinkTeaser"), APP.linkEnabled ? APP.link : "—");
  const btnOpenTeaser = $("#btnOpenTeaser");
  if (btnOpenTeaser) {
    if (APP.linkEnabled) btnOpenTeaser.href = APP.link; else btnOpenTeaser.removeAttribute("href");
  }
  drawQR($("#qrTeaser"), APP.linkEnabled ? APP.link : "", 180);

  // página link
  const lock = $("#linkLockedNotice");
  if (lock) setDisplay(lock, !APP.linkEnabled);
  setText($("#myLink"), APP.linkEnabled ? APP.link : "—");
  const btnOpen = $("#btnOpenLink");
  if (btnOpen) {
    if (APP.linkEnabled) btnOpen.href = APP.link; else btnOpen.removeAttribute("href");
  }
  drawQR($("#qrLink"), APP.linkEnabled ? APP.link : "", 180);

  // wallet KPI
  setText($("#wallet"), APP.walletId || "—");
}

/* =========================================================
 * ações subconta
 * =======================================================*/
async function createSubaccount(){
  const person = ($("#kycPersonType")?.value || "FISICA").toUpperCase();
  const birth  = $("#kycBirth")?.value || "";
  if (person === "FISICA" && !birth) {
  jmsg("Informe a data de nascimento e clique em 'Salvar dados do titular'.", "err");
  return;
  }

  try{
    jmsg("Criando subconta…");
    const r = await jfetch("/affiliates/me/asaas/create-subaccount", { method: "POST", body: JSON.stringify({}) });
    if (r.asaas_wallet_id) { APP.walletId = r.asaas_wallet_id; setText($("#wallet"), APP.walletId); }
    jmsg(r.already ? "Subconta já existia. Clique em 'Atualizar status'." : "Subconta criada. Agora clique em 'Atualizar status'.", "ok");
    await updateStatus().catch(()=>{});
await loadAffiliateOverview().catch(()=>{});
paintLinkAreas();
  }catch(e){ jmsg(e.message, "err"); }
}

function togglePayoutBoxes(){
  const modeEl = document.querySelector("input[name=pmode]:checked");
  const mode = modeEl ? modeEl.value : "pix";
  const pix = $("#boxPix"), bank = $("#boxBank");
  if (pix)  pix.classList.toggle("hide", mode !== "pix");
  if (bank) bank.classList.toggle("hide", mode !== "bank");
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
      const vals = Object.values(payload);
      for (let i=0;i<vals.length;i++){ if (vals[i] === "") throw new Error("Preencha todos os dados bancários."); }
    }
    jmsg("Salvando método de saque…");
    await jfetch("/affiliates/me/payout-method", { method: "POST", body: JSON.stringify(payload) });
    jmsg("Método de saque salvo.", "ok");
  }catch(e){ jmsg(e.message, "err"); }
}

async function testPayout(){
  try{
    jmsg("Solicitando transferência de teste…");
    await jfetch("/affiliates/me/payout-test", { method: "POST", body: JSON.stringify({}) });
    jmsg("Solicitada. Aguarde a confirmação pelo Asaas (webhook).", "ok");
  }catch(e){ jmsg(e.message, "err"); }
}
async function saveKyc(){
  try {
    const person = ($("#kycPersonType")?.value || "FISICA").toUpperCase();
    const birth   = $("#kycBirth")?.value || "";

    if (person === "FISICA" && !birth) throw new Error("Informe a data de nascimento.");

      await jfetch("/affiliates/me/holder", {
   method: "POST",
   body: JSON.stringify({ person_type: person, birth_date: birth })
   });
    jmsg("Dados salvos. Agora você já pode criar a subconta.", "ok");
  } catch (e) {
    jmsg(e.message || "Erro ao salvar dados.", "err");
  }
}
// === perfil: carregar/salvar dados básicos do titular ===
async function loadMyProfile(){
  try{
    const me  = await jfetch("/affiliates/me");         // { me: { name, email } }
    const pr  = await jfetch("/affiliates/me/profile"); // { person_type, birth_date }
    $("#pf_name") && ($("#pf_name").value  = (me?.me?.name  || ""));
    $("#pf_email") && ($("#pf_email").value = (me?.me?.email || ""));
    $("#pf_ptype") && ($("#pf_ptype").value = (pr.person_type || "FISICA"));
    $("#pf_birth") && ($("#pf_birth").value = (pr.birth_date || ""));
    jmsg("Dados carregados.", "muted");
  }catch(e){
    jmsg(e.message || "Falha ao carregar perfil.", "err");
  }
}

async function saveMyProfile(){
  try{
    const body = {
      person_type: ($("#pf_ptype")?.value || "FISICA"),
      birth_date:  $("#pf_birth")?.value || ""
    };
    await jfetch("/affiliates/me/holder", { method:"POST", body: JSON.stringify(body) });
    jmsg("Dados salvos.", "ok");
  }catch(e){
    jmsg(e.message || "Erro ao salvar.", "err");
  }
}

/* =========================================================
 * materiais
 * =======================================================*/
function initMaterials(){
  const canUse = !!(APP.linkEnabled && APP.link);

  const box       = $("#view-materials");             // container da aba (p/ estilo "desabilitado")
  const qr        = $("#qrMaterials");                // canvas/box do QR
  const btnCopy   = $("#btnCopyLinkMat");             // botão "Copiar"
  const btnRef    = $("#btnRefreshMat");              // botão "Atualizar QR"
  const linkTxt   = $("#materialsLink");              // (opcional) span com link em texto, se houver

  // QR só quando puder
  drawQR(qr, canUse ? APP.link : "", 180);

  // Texto do link (se existir um span para isso)
  if (linkTxt) linkTxt.textContent = canUse ? (APP.link || "—")
                                            : "Link disponível após aprovação da subconta.";

  // Botão Copiar travado até liberar
  if (btnCopy) {
    btnCopy.disabled = !canUse;
    btnCopy.title = canUse ? "" : "Disponível após aprovação da subconta e dados de recebimento.";
    btnCopy.onclick = async () => {
      if (!canUse) return;
      await copyToClipboard(APP.link);
      alert("Link copiado!");
    };
  }

  // Atualizar QR respeitando o gating
  if (btnRef) {
    btnRef.onclick = () => drawQR(qr, canUse ? APP.link : "", 180);
  }

  // (opcional) aplica classe visual de bloqueio
  if (box) box.classList.toggle("disabled", !canUse);
}


/* =========================================================
 * vendas
 * =======================================================*/
function renderSales(items){
  const tbody = $("#salesRows");
  const msg   = $("#salesMsg");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (!items || !items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Nenhuma venda encontrada.</td></tr>';
    if (msg) msg.textContent = "";
    return;
  }
  items.forEach(it => {
    const pct = isFinite(it.commission_percent) ? it.commission_percent : 30;
    const amt = isFinite(it.amount) ? (it.amount * pct / 100) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>"+fmtDate(it.created_at)+"</td>" +
      "<td>"+(it.gateway_payment_id || "—")+"</td>" +
      "<td>"+BRL(it.amount)+"</td>" +
      "<td>"+(it.status || "—")+"</td>" +
      "<td>"+pct+"% · "+BRL(amt)+"</td>" +
      "<td>"+((it.gateway || "").toUpperCase())+"</td>" +
     "<td>"+(it.buyer_name || "—")+"<br><small class=\"muted\">"+(it.buyer_email || "")+"</small></td>";
    tbody.appendChild(tr);
  });
  if (msg) msg.textContent = "";
}
// ===== SALDO (disponível / pendente) =====
async function loadBalance(){
  try {
    const b = await jfetch("/affiliates/me/balance");
    setText($("#balAvail"), BRL(b.available));
    setText($("#balPend"),  BRL(b.pending));
    setText($("#balMsg"),   b.next_available_at ? ("Próxima liberação: " + fmtDate(b.next_available_at)) : "");
    const btn = $("#btnWithdraw");
    if (btn) btn.disabled = !(b.available > 0);
  } catch(e){
    setText($("#balAvail"), "—");
    setText($("#balPend"),  "—");
    setText($("#balMsg"),   e.message || "");
    const btn = $("#btnWithdraw");
    if (btn) btn.disabled = true;
  }
}

// ===== SAQUE =====
async function requestWithdraw(){
  try {
    const r = await jfetch("/affiliates/me/withdraw", { method: "POST", body: JSON.stringify({}) });
    alert("Saque solicitado: R$ " + (r.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    await loadBalance();
    await updateStatus(); // reflete mudanças no status/link se houver
  } catch(e){
    alert(e.message || "Falha ao solicitar saque.");
  }
}

async function loadSales(page){
  const limit  = APP.sales.pageSize;
  const offset = (page - 1) * limit;
  const pageEl = $("#salesPage");
  const msg    = $("#salesMsg");
  if (msg) msg.textContent = "Carregando…";
  try {
    const r = await jfetch("/affiliates/me/sales?limit="+limit+"&offset="+offset);
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

// alias opcional (se você quiser chamar de outro lugar com esse nome)
function fetchSalesPage(page = 1){ return loadSales(page); }

function wireSalesPager(){
  const prev = $("#prevSales");
  const next = $("#nextSales");
  if (prev) prev.addEventListener("click", () => {
    const p = Math.max(1, APP.sales.page - 1);
    if (p !== APP.sales.page) loadSales(p).catch(()=>{});
  });
  if (next) next.addEventListener("click", () => {
    const maxPage = APP.sales.total ? Math.ceil(APP.sales.total / APP.sales.pageSize) : APP.sales.page + 1;
    const p = Math.min(maxPage, APP.sales.page + 1);
    if (p !== APP.sales.page) loadSales(p).catch(()=>{});
  });
}

/* =========================================================
 * logout
 * =======================================================*/
async function doLogout(){
  try { await jfetch("/affiliates/logout", { method: "POST" }); }
  finally { location.href = "/afiliado/login.html"; }
}

function wireLogout(){
  const b = $("#btnLogout");
  if (b) b.addEventListener("click", doLogout);
  const n = $("#navLogout");
  if (n) n.addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
}

/* =========================================================
 * sidebar mobile
 * =======================================================*/
function wireSidebarMobile(){
  const btn   = $("#btnMenu");
  const scrim = $("#scrim");
  function close(){ document.body.classList.remove("sidebar-open"); }
  function toggle(){ document.body.classList.toggle("sidebar-open"); }
  if (btn)   btn.addEventListener("click", toggle);
  if (scrim) scrim.addEventListener("click", close);
  $$(".nav a.nav-link").forEach(a => a.addEventListener("click", close));
}
async function loadTotalsAffiliate(){
  try {
    const r = await jfetch("/affiliates/me/summary");
    // usamos o card da esquerda como "Minhas comissões (pago)"
    setText($("#balAvail"), BRL(r.mine || 0));
    // o card do meio estava como "Pendente (D+7)"; no nativo, deixa 0 ou usa r.net se quiser
    setText($("#balPend"), BRL(0));
  } catch(e){
    setText($("#balAvail"), "—");
    setText($("#balPend"), "—");
  }
}
/* =========================================================
 * boot
 * =======================================================*/
document.addEventListener("DOMContentLoaded", async () => {
  log("afiliado-dashboard.js carregado");
  try { await ensureAuth(); } catch { return; }

  // [ADD] sobrescreve link/comissão com overview (se vier de vendedor) e pinta suporte do vendedor
  await loadAffiliateOverview().catch(()=>{});

  // rotas
  window.addEventListener("hashchange", routeFromHash);
  routeFromHash();
// Aviso de saque (Asaas)
try {
  const me = await jfetch("/affiliates/me");
  const email = me?.me?.email || "";
  const note = $("#withdrawNote");
  if (note) {
    const asaasLogin = "https://www.asaas.com/login/auth?customerSignUpOriginChannel=HOME";
    note.innerHTML = `Para sacar seus valores, acesse o <a href="${asaasLogin}" target="_blank" rel="noopener">Painel do Asaas</a> com o e-mail <strong>${email}</strong>.
      <br><small class="muted">Se não tiver senha, clique em <em>“Esqueci minha senha”</em> na página do Asaas.</small>`;
  }
} catch {}


$("#btnLoadProfile")?.addEventListener("click", loadMyProfile);
$("#btnSaveProfile")?.addEventListener("click", saveMyProfile);
$("#btnWithdraw")?.addEventListener("click", requestWithdraw);


  // sidebar mobile
  wireSidebarMobile();

  // logout
  wireLogout();

  // payout radios
  $$("#view-sub input[name=pmode]").forEach(r => r.addEventListener("change", togglePayoutBoxes));
  togglePayoutBoxes();

  // subconta
  const btnCreate = $("#btnCreateSub");
  if (btnCreate) btnCreate.addEventListener("click", createSubaccount);
  const btnCheck = $("#btnCheckStatus");
  if (btnCheck) btnCheck.addEventListener("click", updateStatus);
  const btnSave = $("#btnSavePayout");
  if (btnSave) btnSave.addEventListener("click", savePayout);
  const btnTest = $("#btnTestPayout");
  if (btnTest) btnTest.addEventListener("click", testPayout);
  const btnRefHome = $("#btnRefreshFromHome");
  if (btnRefHome) btnRefHome.addEventListener("click", updateStatus);
  const btnSaveKyc = $("#btnSaveKyc");
  if (btnSaveKyc) btnSaveKyc.addEventListener("click", saveKyc);

  const personSel = $("#kycPersonType");
  if (personSel) personSel.addEventListener("change", () => {
    const isPf = (personSel.value || "FISICA").toUpperCase() === "FISICA";
    $("#boxBirth")?.classList.toggle("hide", !isPf);
  });
  if (personSel) {
    const isPf = (personSel.value || "FISICA").toUpperCase() === "FISICA";
    $("#boxBirth")?.classList.toggle("hide", !isPf);
  }

  // vendas
  wireSalesPager();

  // áreas de link e status
  paintLinkAreas();
  updateStatus().catch(()=>{});
});

