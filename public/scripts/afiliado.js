// util simples
async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw (await r.json().catch(() => ({ error: r.statusText })));
  return r.json();
}

async function getJSON(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw (await r.json().catch(() => ({ error: r.statusText })));
  return r.json();
}

// helper: pega parâmetro da URL
function getParam(name) {
  try { return new URL(location.href).searchParams.get(name); }
  catch { return null; }
}

/* =========================================================
 * CADASTRO (afiliado OU vendedor OU supervisor)
 * - suporta dois ids de formulário: #form-cadastro (antigo) e #frmRegister (novo)
 * - envia role (default 'affiliate' se não vier do form)
 * - se tiver ?token=, usa /affiliates/accept-invite
 * =======================================================*/
const formCadastro =
  document.querySelector("#form-cadastro") || document.querySelector("#frmRegister");

if (formCadastro) {
  // token do convite (se existir)
  const __inviteToken = getParam("token");

  formCadastro.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(formCadastro);

    // role vindo do <input type="hidden" name="role" ...>
    // Se não vier, assume 'affiliate'
    const role = (fd.get("role") || "affiliate").toLowerCase();

    // tenta pegar o token do hidden também (definido no cadastro.html)
    const invite_token = __inviteToken || fd.get("invite_token") || undefined;

    // monta corpo aproveitando campos existentes; campos ausentes ficam vazios
    const body = {
      role,
      name: fd.get("name"),
      email: fd.get("email"),
      cpf_cnpj: fd.get("cpf_cnpj"),
      phone: fd.get("phone"),
      address: fd.get("address"),
      address_number: fd.get("address_number"),
      district: fd.get("district"),
      city: fd.get("city"),
      state: fd.get("state"),
      postal_code: fd.get("postal_code"),
      complement: fd.get("complement") || "",

      // em alguns cadastros de afiliado você já coleta a %; se não houver, ignora
      commission_percent: Number(fd.get("commission_percent")) || undefined,

      // novos campos
      birth_date: fd.get("birth_date") || undefined, // PF: obrigatório no accept-invite
      invite_token,                                   // identifica o convite

      // termos (checkbox)
      terms: !!fd.get("terms"),
    };

    try {
      const endpoint = invite_token ? "/affiliates/accept-invite" : "/affiliates";
      await postJSON(endpoint, body);
      alert("Conta criada com sucesso! Enviamos um e-mail para você definir a senha.");
      // mantém o mesmo fluxo: usuário vai para o login
      window.location.href = "/afiliado/login.html";
    } catch (err) {
      alert("Erro no cadastro: " + (err.error || JSON.stringify(err)));
    }
  });
}

/* =========================================================
 * LOGIN (pós-login redireciona pelo role retornado em /me)
 * =======================================================*/
const formLogin = document.querySelector("#form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(formLogin);
    try {
      await postJSON("/affiliates/login", {
        email: fd.get("email"),
        password: fd.get("password"),
      });

      // depois de logar, pergunta o /me para saber o role e redirecionar
      const me = await getJSON("/me").catch(async () => {
        // fallback para rota antiga, se existir
        try { return await getJSON("/affiliates/me"); } catch { return {}; }
      });

      const role = (me.role || "").toLowerCase();
      switch (role) {
        case "vendor":
          window.location.href = "/vendedor/dashboard.html";
          break;
        case "supervisor":
          window.location.href = "/supervisor/dashboard.html";
          break;
        case "admin":
          window.location.href = "/admin/dashboard.html";
          break;
        case "affiliate":
        default:
          window.location.href = "/afiliado/dashboard.html";
          break;
      }
    } catch (err) {
      alert("Erro no login: " + (err.error || JSON.stringify(err)));
    }
  });
}

/* =========================================================
 * DASHBOARD do AFILIADO (mantém comportamento atual)
 * - só roda quando estiver na rota /afiliado/dashboard.html
 * =======================================================*/
(function runAffiliateDashboard() {
  // só executa nesta página
  if (!location.pathname.endsWith("/afiliado/dashboard.html")) return;

  (async () => {
    try {
      // usa overview (já traz comissão travada e contato do vendedor, se houver)
      const me = await getJSON("/affiliates/me/overview");

      const elLink = document.querySelector("#meu-link");
      const elCom  = document.querySelector("#comissao");
      const elWal  = document.querySelector("#wallet");
      const elPen  = document.querySelector("#pendentes");
      const elLib  = document.querySelector("#liberadas");
      const elEst  = document.querySelector("#estornadas");
      const btnCpy = document.querySelector("#copiar-link");

      if (elLink) elLink.textContent = me.link || "—";
      if (elCom)  elCom.textContent  = (me.commission_percent != null ? `${me.commission_percent}%` : "—");
      if (elWal)  elWal.textContent  = `Wallet: ${me.wallet_id || "-"}`;
      if (elPen)  elPen.textContent  = me.stats?.pending ?? 0;
      if (elLib)  elLib.textContent  = me.stats?.released ?? 0;
      if (elEst)  elEst.textContent  = me.stats?.refunded ?? 0;

      if (btnCpy) {
        btnCpy.onclick = async () => {
          if (!me.link) return;
          await navigator.clipboard.writeText(me.link);
          alert("Link copiado!");
        };
      }

      // --- suporte: vendedor (se for afiliado de vendedor)
      if (me.vendor_contact) {
        const supBox   = document.querySelector("#supportVendorBox");
        const supName  = document.querySelector("#supportVendorName");
        const supEmail = document.querySelector("#supportVendorEmailLink");
        const supPhone = document.querySelector("#supportVendorPhone");

        if (supBox)   supBox.style.display = "";
        if (supName)  supName.textContent = me.vendor_contact.name || "—";
        if (supEmail) {
          supEmail.textContent = me.vendor_contact.email || "—";
          supEmail.href = me.vendor_contact.email ? `mailto:${me.vendor_contact.email}` : "#";
        }
        if (supPhone) {
          supPhone.textContent = me.vendor_contact.phone || "—";
        }
      }

    } catch (err) {
      alert("Faça login novamente.");
      window.location.href = "/afiliado/login.html";
    }
  })();
})();
