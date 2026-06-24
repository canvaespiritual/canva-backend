(async function () {
  const $ = (id) => document.getElementById(id);

  const stDados = $("stDados");
  const stPrecheck = $("stPrecheck");
  const stAdesao = $("stAdesao");
  const stSubconta = $("stSubconta");
  const stCommission = $("stCommission");

  const btnPrecheck = $("btnPrecheck");
  const btnPagar = $("btnPagar");
  const btnPainel = $("btnPainel");

  const dadosBox = $("dados");
  const msg = $("msg");

  let statusAtual = null;
 function showStep(step) {
  ["Commission", "Validation", "Payment", "Success"].forEach((name) => {
    const el = $(`step${name}`);
    const dot = $(`dot${name}`);
    if (el) el.classList.toggle("active", name === step);
    if (dot) dot.classList.toggle("active", name === step);
  });
}

  function setMsg(text, cls = "muted") {
    if (!msg) return;
    msg.className = cls;
    msg.textContent = text || "";
  }

  function painelPorRole(role) {
    if (role === "vendor") return "/vendedor/dashboard.html";
    if (role === "supervisor") return "/supervisor/dashboard.html";
    if (role === "admin") return "/admin/dashboard.html";
    return "/afiliado/dashboard.html";
  }

  async function getJSON(url) {
    const r = await fetch(url, { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Erro");
    return j;
  }

  async function postJSON(url, body = {}) {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Erro");
    return j;
  }

  async function carregarStatus() {
    try {
      const data = await getJSON("/affiliates/me/activation-status");
      statusAtual = data;
      const me = data.me || {};

if ($("viewName")) $("viewName").textContent = me.name || "—";
if ($("viewDoc")) $("viewDoc").textContent = me.cpf_cnpj || "—";
if ($("viewEmail")) $("viewEmail").textContent = me.email || "—";
      

dadosBox.textContent = [
  `Nome: ${me.name || "—"}`,
  `Email: ${me.email || "—"}`,
  `CPF/CNPJ: ${me.cpf_cnpj || "—"}`,
  `Telefone: ${me.phone || "—"}`,
  `Cidade: ${me.city || "—"}`,
  `Estado: ${me.state || "—"}`,
].join("\n");
      stDados.textContent = "✓ Dados carregados";

      if (!data.commission_terms_accepted) {
        showStep("Commission");
        if (stCommission) stCommission.textContent = "⏳ Aguardando confirmação";
        stPrecheck.textContent = "Aguardando ciência do comissionamento";
        stAdesao.textContent = "Aguardando";
        stSubconta.textContent = "Aguardando";
        btnPrecheck.disabled = true;
        btnPagar.disabled = true;
        setMsg("Leia e aceite a ciência de comissionamento para continuar.", "warn");
        await carregarTermoComissao();
        return;
      }

      await carregarTermoComissao(true);
      showStep("Validation");
      if (stCommission) stCommission.textContent = "✓ Ciência confirmada";
      if (data.active) {
        showStep("Success");
        stPrecheck.textContent = "✓ Validado";
        stAdesao.textContent = "✓ Pago";
        stSubconta.textContent = "✓ Conta ativa";

        btnPrecheck.style.display = "none";
        btnPagar.style.display = "none";
        btnPainel.style.display = "inline-block";
        btnPainel.href = painelPorRole((data.me?.role || "").toLowerCase());
        setMsg("Sua conta foi ativada com sucesso. Seu painel já está liberado.", "ok");
        return;
      }

      if (data.activation_fee_status === "pending") {
        showStep("Payment");
        stPrecheck.textContent = "✓ Validado";
        stAdesao.textContent = "⏳ Pagamento pendente";
        stSubconta.textContent = "Aguardando confirmação";

        btnPrecheck.disabled = true;
        btnPagar.disabled = false;
        btnPagar.textContent = "Gerar PIX novamente";

        setMsg("Pagamento pendente. Se já pagou, aguarde alguns segundos.", "warn");
        iniciarPolling();
        return;
      }

      if (data.activation_fee_status === "paid_subaccount_failed") {
        stPrecheck.textContent = "✓ Validado";
        stAdesao.textContent = "✓ Pago";
        stSubconta.textContent = "Erro na criação da subconta";

        btnPrecheck.disabled = true;
        btnPagar.disabled = true;

        setMsg("Pagamento confirmado, mas houve erro na integração financeira. Fale com o suporte.", "err");
        return;
      }

      btnPrecheck.disabled = false;
      btnPagar.disabled = true;
      setMsg("Confira seus dados e inicie sua ativação financeira.", "muted");

    } catch (err) {
      console.error(err);
      setMsg(err.message || "Erro ao carregar status", "err");
    }
  }

 async function carregarTermoComissao(acceptedOnly = false) {
  const t = await getJSON("/affiliates/me/commission-terms");

  const commissionText = $("commissionText");
  const commissionCheck = $("commissionCheck");
  const btnAcceptCommission = $("btnAcceptCommission");

  if (commissionText) {
    commissionText.textContent = t.text || "Regras de comissão carregadas.";
  }

  if (t.accepted || acceptedOnly) {
    if (commissionCheck) {
      commissionCheck.checked = true;
      commissionCheck.disabled = true;
    }

    if (btnAcceptCommission) {
      btnAcceptCommission.disabled = true;
      btnAcceptCommission.textContent = "Ciência confirmada";
    }

    if (stCommission) stCommission.textContent = "✓ Ciência confirmada";
    return;
  }

  if (btnAcceptCommission) {
    btnAcceptCommission.onclick = async () => {
      if (commissionCheck && !commissionCheck.checked) {
        setMsg("Marque a caixa de ciência para continuar.", "err");
        return;
      }

      btnAcceptCommission.disabled = true;
      btnAcceptCommission.textContent = "Confirmando...";

      await postJSON("/affiliates/me/commission-terms/accept");

      if (stCommission) stCommission.textContent = "✓ Ciência confirmada";
      setMsg("Ciência confirmada. Vamos continuar.", "ok");

      await carregarStatus();
    };
  }
}

  btnPrecheck.addEventListener("click", async () => {
    try {
      btnPrecheck.disabled = true;
      setMsg("Validando seus dados para ativar a integração financeira...");

      await postJSON("/affiliates/me/asaas/precheck-document");

      stPrecheck.textContent = "✓ Dados aprovados para integração";
      btnPagar.disabled = false;

      setMsg("Validação concluída. Agora gere o PIX para finalizar sua ativação.", "ok");
      showStep("Payment");
    } catch (err) {
      btnPrecheck.disabled = false;
      setMsg(err.message || "Falha na validação", "err");
    }
  });

  btnPagar.addEventListener("click", async () => {
    try {
      btnPagar.disabled = true;
      btnPagar.textContent = "Gerando PIX...";
      setMsg("Gerando PIX da ativação financeira...");

      const data = await postJSON("/affiliates/me/activation-fee/pix");

      renderPix(data);

      stAdesao.textContent = "⏳ Aguardando pagamento";
      setMsg("PIX gerado com sucesso. Após a confirmação do pagamento, sua conta será liberada automaticamente.", "warn");

      iniciarPolling();

    } catch (err) {
      btnPagar.disabled = false;
      btnPagar.textContent = "Pagar adesão";
      setMsg(err.message || "Erro ao gerar PIX", "err");
    }
  });

function renderPix(data) {
  showStep("Payment");

  const pixBox = $("pixBox");
  const pixQrImg = $("pixQrImg");
  const pixCopiaCola = $("pixCopiaCola");
  const copiarPixBtn = $("copiarPixBtn");

  if (pixBox) pixBox.classList.add("active");

  if (data.qr_code_base64 && pixQrImg) {
    pixQrImg.src = `data:image/png;base64,${data.qr_code_base64}`;
  }

  if (pixCopiaCola) {
    pixCopiaCola.value = data.qr_code || "";
  }

  if (copiarPixBtn) {
    copiarPixBtn.onclick = async () => {
      await navigator.clipboard.writeText(pixCopiaCola.value);
      copiarPixBtn.textContent = "PIX copiado!";
      setTimeout(() => {
        copiarPixBtn.textContent = "Copiar PIX";
      }, 1800);
    };
  }

  btnPagar.disabled = false;
  btnPagar.textContent = "Gerar PIX novamente";
}

  let polling = null;

  function iniciarPolling() {
    if (polling) return;

    polling = setInterval(async () => {
  try {
    const data = await getJSON("/affiliates/me/activation-status");

    if (data.active) {
      clearInterval(polling);
      polling = null;
      showStep("Success");
      stAdesao.textContent = "✓ Pago";
      stSubconta.textContent = "✓ Conta ativa";

      btnPainel.style.display = "inline-block";
      btnPainel.href = painelPorRole((data.me?.role || "").toLowerCase());

     setMsg("Tudo pronto. Seu painel já está liberado.", "ok");
      return;
    }

    if (data.activation_fee_status === "paid_subaccount_failed") {
      clearInterval(polling);
      polling = null;

      stAdesao.textContent = "✓ Pago";
      stSubconta.textContent = "Erro na integração financeira";

      setMsg("Pagamento confirmado, mas houve erro na criação da subconta. Fale com o suporte.", "err");
      return;
    }

    if (data.activation_fee_status === "paid") {
      stAdesao.textContent = "✓ Pago";
      stSubconta.textContent = "⏳ Criando integração financeira...";
      setMsg("Pagamento confirmado. Finalizando ativação da conta...", "warn");
    }
  } catch (_) {}
}, 4000);
  }

  await carregarStatus();
})();