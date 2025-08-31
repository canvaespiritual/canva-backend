// public/scripts/afiliado-subconta.js

const $ = (s) => document.querySelector(s);
const msg = (t, cls = "muted") => {
  const el = $("#msg");
  el.className = cls + " mt-12";
  el.textContent = t;
};

async function jfetch(url, opts = {}) {
  const r = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  if (!r.ok) {
    let e = "Erro";
    try { const j = await r.json(); e = j.error || j.message || e; } catch {}
    throw new Error(e);
  }
  try { return await r.json(); } catch { return {}; }
}

function showStatus({ general, bank, link_enabled }) {
  const cls = (v) => v === "APPROVED" ? "ok" : (v === "REJECTED" ? "err" : "warn");
  $("#stGeneral").textContent = general || "—";
  $("#stGeneral").className = cls(general || "PENDING");
  $("#stBank").textContent = bank || "—";
  $("#stBank").className = cls(bank || "PENDING");
  $("#stLink").textContent = link_enabled ? "Sim" : "Não";
  $("#stLink").className = link_enabled ? "ok" : "warn";
}

function togglePayoutBoxes() {
  const mode = document.querySelector("input[name=pmode]:checked").value;
  $("#boxPix").classList.toggle("hide", mode !== "pix");
  $("#boxBank").classList.toggle("hide", mode !== "bank");
}

async function ensureAuth() {
  try {
    const me = await jfetch("/affiliates/me");
    if (!me?.me) throw new Error();
  } catch {
    location.href = "/afiliado/login.html";
  }
}

async function createSub() {
  try {
    msg("Criando subconta…");
    const r = await jfetch("/affiliates/me/asaas/create-subaccount", { method: "POST", body: JSON.stringify({}) });
    msg(r.already ? "Subconta já existia. Atualize o status." : "Subconta criada. Agora clique em Atualizar status.");
  } catch (e) {
    msg(e.message, "err");
  }
}

async function updateStatus() {
  try {
    msg("Consultando status…");
    const r = await jfetch("/affiliates/me/asaas/status");
    showStatus({ ...r.status, link_enabled: r.link_enabled });
    msg("Status atualizado.");
  } catch (e) {
    msg(e.message, "err");
  }
}

async function savePayout() {
  try {
    const mode = document.querySelector("input[name=pmode]:checked").value;
    let payload = { payout_method: mode };

    if (mode === "pix") {
      payload.pix_key_type = $("#pixType").value;
      payload.pix_key_value = $("#pixValue").value.trim();
      if (!payload.pix_key_value) throw new Error("Informe a chave Pix.");
    } else {
      payload.bank_holder_name = $("#bnHolder").value.trim();
      payload.bank_cpf_cnpj    = $("#bnDoc").value.trim();
      payload.bank_number      = $("#bnNumber").value.trim();
      payload.bank_agency      = $("#bnAgency").value.trim();
      payload.bank_account     = $("#bnAccount").value.trim();
      payload.bank_account_digit = $("#bnDigit").value.trim();
      payload.bank_account_type  = $("#bnType").value;
      if (Object.values(payload).some(v => v === "")) throw new Error("Preencha todos os dados bancários.");
    }

    msg("Salvando método de saque…");
    await jfetch("/affiliates/me/payout-method", { method: "POST", body: JSON.stringify(payload) });
    msg("Método de saque salvo.", "ok");
  } catch (e) {
    msg(e.message, "err");
  }
}

async function testPayout() {
  try {
    msg("Solicitando transferência de teste…");
    const r = await jfetch("/affiliates/me/payout-test", { method: "POST", body: JSON.stringify({}) });
    msg("Solicitada. Aguardando confirmação do Asaas (webhook).", "ok");
    console.log("transfer:", r.transfer);
  } catch (e) {
    msg(e.message, "err");
  }
}

async function logout() {
  try {
    await jfetch("/affiliates/logout", { method: "POST" });
  } finally {
    location.href = "/afiliado/login.html";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureAuth();

  togglePayoutBoxes();
  document.querySelectorAll("input[name=pmode]").forEach(r => r.addEventListener("change", togglePayoutBoxes));

  $("#btnCreateSub").addEventListener("click", createSub);
  $("#btnCheckStatus").addEventListener("click", updateStatus);
  $("#btnSavePayout").addEventListener("click", savePayout);
  $("#btnTestPayout").addEventListener("click", testPayout);
  $("#btnLogout").addEventListener("click", logout);

  // tenta carregar status ao abrir
  updateStatus().catch(() => {});
});
