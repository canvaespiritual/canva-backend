(async function () {
  const $ = (id) => document.getElementById(id);

  const stDados = $("stDados");
  const stPrecheck = $("stPrecheck");
  const stAdesao = $("stAdesao");
  const stSubconta = $("stSubconta");

  const btnPrecheck = $("btnPrecheck");
  const btnPagar = $("btnPagar");
  const btnPainel = $("btnPainel");

  const dadosBox = $("dados");
  const msg = $("msg");

  let statusAtual = null;

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

      dadosBox.textContent = JSON.stringify(data.me, null, 2);
      stDados.textContent = "✓ Dados carregados";

      if (!data.commission_terms_accepted) {
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

      if (data.active) {
        stPrecheck.textContent = "✓ Validado";
        stAdesao.textContent = "✓ Pago";
        stSubconta.textContent = "✓ Conta ativa";

        btnPrecheck.style.display = "none";
        btnPagar.style.display = "none";
        btnPainel.style.display = "inline-block";
        btnPainel.href = painelPorRole((data.me?.role || "").toLowerCase());
        setMsg("Conta ativada com sucesso.", "ok");
        return;
      }

      if (data.activation_fee_status === "pending") {
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
      setMsg("Confirme seus dados e valide o CPF/CNPJ para prosseguir.", "muted");

    } catch (err) {
      console.error(err);
      setMsg(err.message || "Erro ao carregar status", "err");
    }
  }

  async function carregarTermoComissao(acceptedOnly = false) {
    let box = $("commissionBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "commissionBox";
      box.className = "card";
      box.innerHTML = `
        <h2>Ciência de comissionamento</h2>
        <pre id="commissionText">Carregando...</pre>
        <label style="display:flex;gap:10px;align-items:flex-start;margin-top:12px">
          <input id="commissionCheck" type="checkbox" />
          <span>Li e estou ciente das regras de comissão.</span>
        </label>
        <button id="btnAcceptCommission" style="margin-top:14px">Confirmar ciência</button>
      `;
      document.querySelector("main").insertBefore(box, document.querySelector("main").children[1]);
    }

    const t = await getJSON("/affiliates/me/commission-terms");
    $("commissionText").textContent = t.text;

    if (t.accepted || acceptedOnly) {
      $("commissionCheck").checked = true;
      $("commissionCheck").disabled = true;
      $("btnAcceptCommission").disabled = true;
      $("btnAcceptCommission").textContent = "Ciência confirmada";
      return;
    }

    $("btnAcceptCommission").onclick = async () => {
      if (!$("commissionCheck").checked) {
        setMsg("Marque a caixa de ciência para continuar.", "err");
        return;
      }

      $("btnAcceptCommission").disabled = true;
      await postJSON("/affiliates/me/commission-terms/accept");
      setMsg("Ciência de comissionamento confirmada.", "ok");
      await carregarStatus();
    };
  }

  btnPrecheck.addEventListener("click", async () => {
    try {
      btnPrecheck.disabled = true;
      setMsg("Validando dados para integração financeira...");

      await postJSON("/affiliates/me/asaas/precheck-document");

      stPrecheck.textContent = "✓ Dados aprovados para integração";
      btnPagar.disabled = false;

      setMsg("Dados aprovados. Agora gere o PIX da adesão.", "ok");
    } catch (err) {
      btnPrecheck.disabled = false;
      setMsg(err.message || "Falha na validação", "err");
    }
  });

  btnPagar.addEventListener("click", async () => {
    try {
      btnPagar.disabled = true;
      btnPagar.textContent = "Gerando PIX...";
      setMsg("Gerando PIX da adesão...");

      const data = await postJSON("/affiliates/me/activation-fee/pix");

      renderPix(data);

      stAdesao.textContent = "⏳ Aguardando pagamento";
      setMsg("PIX gerado. Após o pagamento, a conta será ativada automaticamente.", "warn");

      iniciarPolling();

    } catch (err) {
      btnPagar.disabled = false;
      btnPagar.textContent = "Pagar adesão";
      setMsg(err.message || "Erro ao gerar PIX", "err");
    }
  });

  function renderPix(data) {
    let pixBox = $("pixBox");

    if (!pixBox) {
      pixBox = document.createElement("div");
      pixBox.id = "pixBox";
      pixBox.className = "card";
      pixBox.innerHTML = `
        <h2>Pagamento da adesão</h2>
        <p class="muted">Escaneie o QR Code ou copie o código PIX.</p>
        <div style="text-align:center;margin-top:16px">
          <img id="pixQrImg" style="max-width:240px;width:100%;border-radius:12px;background:#fff;padding:8px" />
        </div>
        <textarea id="pixCopiaCola" readonly style="width:100%;height:110px;margin-top:14px;border-radius:12px;padding:12px"></textarea>
        <button id="copiarPixBtn" style="margin-top:12px">Copiar código PIX</button>
      `;

      document.querySelector("main").appendChild(pixBox);
    }

    if (data.qr_code_base64) {
      $("pixQrImg").src = `data:image/png;base64,${data.qr_code_base64}`;
    }

    $("pixCopiaCola").value = data.qr_code || "";

    $("copiarPixBtn").onclick = async () => {
      await navigator.clipboard.writeText($("pixCopiaCola").value);
      $("copiarPixBtn").textContent = "Código copiado!";
      setTimeout(() => $("copiarPixBtn").textContent = "Copiar código PIX", 1800);
    };

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

          stAdesao.textContent = "✓ Pago";
          stSubconta.textContent = "✓ Conta ativa";

          btnPainel.style.display = "inline-block";
          btnPainel.href = painelPorRole((data.me?.role || "").toLowerCase());

          setMsg("Pagamento confirmado. Sua conta foi ativada.", "ok");
        }
      } catch (_) {}
    }, 4000);
  }

  await carregarStatus();
})();