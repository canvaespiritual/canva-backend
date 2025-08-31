// LOG de carregamento do arquivo (mostra o caminho exato do arquivo carregado)
console.log("[ASAAS ROUTER LOADED]", __filename);
const axios = require("axios");

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY; // crie no Sandbox

const asaas = axios.create({
  baseURL: ASAAS_BASE_URL,
  timeout: 15000,
  headers: {
    "access_token": ASAAS_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// log de configuração (sem expor a chave)
console.log("[ASAAS CLIENT]", { baseURL: ASAAS_BASE_URL, hasKey: !!ASAAS_API_KEY });

// src/services/asaasSubaccountService.js
const express = require("express");
const router = express.Router();

const pool = require("../db");
const { createRootClient, parseError } = require("./asaasClient");

async function maybeActivateLinks(affiliateId) {
  const { rows } = await pool.query(
    `SELECT asaas_wallet_id, asaas_account_id,
            payout_method, pix_key_value,
            bank_number, bank_agency, bank_account, bank_account_digit
       FROM affiliates
      WHERE id = $1
      LIMIT 1`,
    [affiliateId]
  );
  if (!rows.length) return;

  const a = rows[0];
  const subOk  = !!(a.asaas_wallet_id && a.asaas_account_id);
  const pixOk  = a.payout_method === "pix"  && !!a.pix_key_value;
  const bankOk = a.payout_method === "bank" && !!(a.bank_number && a.bank_agency && a.bank_account && a.bank_account_digit);

  if (subOk && (pixOk || bankOk)) {
    await pool.query(
      `UPDATE affiliate_links
          SET active = TRUE, status = 'active'
        WHERE affiliate_id = $1 AND active = FALSE`,
      [affiliateId]
    );
  }
}


// --- helpers ---
function needAuth(req, res) {
  const aff = req.session?.aff;
  if (!aff?.id) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return aff;
}
function mapStatus(v) {
  if (!v) return "PENDING";
  const s = String(v).toUpperCase();
  return ["APPROVED", "REJECTED", "PENDING"].includes(s) ? s : "PENDING";
}

// monta o payload que o Asaas espera
// asaasSubaccountService.js
function buildAccountPayload(aff) {
 const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
const normDate = (s) => {
  const t = String(s ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;                // YYYY-MM-DD
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);            // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.slice(0, 10);    // corta "T..."
  return ""; // se vier em formato estranho, devolve string vazia
};

  payload.birthDate = normDate(aff.birth_date);

 const personType = String(a.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";

const payload = {
  name: a.name,
  email: a.email,
  cpfCnpj: onlyDigits(a.cpf_cnpj),
  personType,
  mobilePhone: onlyDigits(a.phone),
  address: a.address,
  addressNumber: a.address_number,
  complement: a.complement || "",
  province: a.district || "", // <-- bairro
  state: a.state,             // <-- UF
  city: a.city,
  postalCode: onlyDigits(a.postal_code),
};

if (personType === "FISICA") {
  payload.birthDate = normDate(a.birth_date); // SEM toISOString()
}
if (personType === "FISICA" && !payload.birthDate) {
  return res.status(400).json({ error: "Preencha a data de nascimento (YYYY-MM-DD) antes de criar a subconta." });
}


  return payload;
}

// --- STATUS ---
router.get("/status", async (req, res) => {
  const aff = needAuth(req, res);
  if (!aff) return;

  try {
    const { rows } = await pool.query(
      `SELECT asaas_wallet_id, link_enabled
         FROM affiliates
        WHERE id = $1
        LIMIT 1`,
      [aff.id]
    );

    if (rows.length === 0) {
      return res.json({
        status: { general: "PENDING", bank: "PENDING" },
        link_enabled: false,
      });
    }

    const { asaas_wallet_id, link_enabled } = rows[0];

    if (!asaas_wallet_id) {
      return res.json({
        status: { general: "PENDING", bank: "PENDING" },
        link_enabled: !!link_enabled,
      });
    }

    let general = "PENDING";
    let bank = "PENDING";
    try {
      const api = createRootClient();
      const r = await api.get(`/wallets/${asaas_wallet_id}/status`); // ajuste o endpoint real
      general = mapStatus(r.data?.kycStatus);
      bank = mapStatus(r.data?.bankAccountStatus);
    } catch (e) {
      console.warn("[asaas/status] fallback:", e.response?.data || e.message);
    }

    return res.json({ status: { general, bank }, link_enabled: !!link_enabled });
  } catch (err) {
    console.error("asaas/status error:", err);
    return res.json({
      status: { general: "PENDING", bank: "PENDING" },
      link_enabled: false,
    });
  }
});


// --- CREATE SUBACCOUNT ---
// --- CREATE SUBACCOUNT ---
router.post("/create-subaccount", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  try {
    // 1) SELECT
    const { rows } = await pool.query(
      `SELECT id, name, email, cpf_cnpj, phone,
              address, address_number, complement, district, city, state, postal_code,
              person_type, birth_date, asaas_wallet_id
         FROM affiliates
        WHERE id = $1
        LIMIT 1`,
      [aff.id]
    );
    const a = rows[0] || {};

    // 2) LOG DB
    console.log("[ASAAS DEBUG] row do banco:", {
      id: a.id, person_type: a.person_type, birth_date: a.birth_date,
      typeof_birth_date: typeof a.birth_date, district: a.district,
    });

    // 3) Helpers
    const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
    const normDate = (s) => {
      const t = String(s ?? "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
      const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.slice(0, 10);
      return "";
    };

    // 4) Monta payload base
    const personType = String(a.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";

    const payload = {
      name: a.name,
      email: a.email,
      cpfCnpj: onlyDigits(a.cpf_cnpj),
      personType,
      mobilePhone: onlyDigits(a.phone),
      address: a.address,
      addressNumber: a.address_number,
      complement: a.complement || "",
      province: a.district || "", // bairro
      state: a.state,             // UF
      city: a.city,
      postalCode: onlyDigits(a.postal_code),
    };
    if (personType === "FISICA") {
      payload.birthDate = normDate(a.birth_date);
      if (!payload.birthDate) {
        return res.status(400).json({ error: "Preencha a data de nascimento (YYYY-MM-DD) antes de criar a subconta." });
      }
    }

    // 5) Corpo do /accounts (subconta Asaas)
    const incomeValue = Number(process.env.AFF_DEFAULT_INCOME || 1500);
    const SUB_PATH = "/accounts";
    const body = {
      name: payload.name,
      email: payload.email,
      loginEmail: payload.email,
      personType: payload.personType,
      cpfCnpj: payload.cpfCnpj,
      birthDate: payload.birthDate,
      mobilePhone: payload.mobilePhone,
      address: payload.address,
      addressNumber: payload.addressNumber,
      complement: payload.complement,
      province: payload.province,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
      incomeValue,
    };

    console.log("[ASAAS DEBUG] URL:", (asaas?.defaults?.baseURL || "") + SUB_PATH);
    console.log("[ASAAS DEBUG] body:", JSON.stringify(body));

    const resp = await asaas.post(SUB_PATH, body, { validateStatus: () => true });
    console.log("[ASAAS RESP]", resp.status, resp.data);

    if (resp.status >= 200 && resp.status < 300) {
  const walletId   = resp.data?.walletId || null;   // carteira
  const accountId  = resp.data?.id || null;         // id da subconta
  const apiKey     = resp.data?.apiKey || null;     // só vem agora!

  const accNum     = resp.data?.accountNumber || {};
  const agency     = accNum?.agency || null;
  const account    = accNum?.account || null;
  const accountDig = accNum?.accountDigit || null;

  const upd = await pool.query(`
    UPDATE affiliates
       SET asaas_wallet_id       = $1,
           wallet_id             = $1,                              -- opcional (legado)
           asaas_account_id      = $2,
           asaas_api_key         = COALESCE($3, asaas_api_key),
           asaas_agency          = COALESCE($4, asaas_agency),
           asaas_account         = COALESCE($5, asaas_account),
           asaas_account_digit   = COALESCE($6, asaas_account_digit),
           asaas_status_general  = 'APPROVED',
           asaas_status_bank     = COALESCE(asaas_status_bank, 'PENDING'),
           updated_at            = NOW()
     WHERE id = $7
     RETURNING asaas_wallet_id, asaas_account_id, asaas_agency, asaas_account,
               asaas_account_digit, asaas_status_general, asaas_status_bank
  `, [walletId, accountId, apiKey, agency, account, accountDig, req.session.aff.id]);

  console.log("[ASAAS DB] update:", {
    asaas_wallet_id:    upd.rows[0]?.asaas_wallet_id,
    asaas_account_id:   upd.rows[0]?.asaas_account_id,
    asaas_agency:       upd.rows[0]?.asaas_agency,
    asaas_account:      upd.rows[0]?.asaas_account,
    asaas_account_digit:upd.rows[0]?.asaas_account_digit,
    asaas_status_general: upd.rows[0]?.asaas_status_general,
    asaas_status_bank:    upd.rows[0]?.asaas_status_bank,
  });
  await maybeActivateLinks(aff.id);
  await pool.query(
  `UPDATE affiliate_links
      SET active = TRUE, status = 'active'
    WHERE affiliate_id = $1
      AND active = FALSE`,
  [req.session.aff.id]
);
  return res.json({
    ok: true,
    asaas_wallet_id: walletId,
    walletId,
    asaas_account_id: accountId,
    accountNumber: accountId ? { agency, account, accountDigit: accountDig } : null,
    hasApiKey: !!apiKey,
    message: "Subconta criada com sucesso.",
  });
}
// ... você já atualizou affiliates com asaas_wallet_id / asaas_account_id
 // ⬅️ ativa links se já tiver payout pronto

// Erro do Asaas → devolve como veio para o front
// Erro do Asaas → formata legível
const data = resp.data || {};
const firstErr = Array.isArray(data.errors) && data.errors.length ? data.errors[0] : null;
return res.status(resp.status || 400).json({
  ok: false,
  error: firstErr?.description || data.message || data.error || "Falha ao criar subconta.",
  code: firstErr?.code || data.code || "asaas_error",
  details: data
});

} catch (err) {
console.error("asaas/create-subaccount error:", err?.response?.data || err);
const { status, data, message } = parseError(err);  // usa helper
const firstErr = Array.isArray(data?.errors) && data.errors.length ? data.errors[0] : null;
return res.status(status || 500).json({
  ok: false,
  error: firstErr?.description || message || "Erro interno",
  code: firstErr?.code || data?.code || "asaas_error",
  details: data || null
});

}

});



// --- DRY-RUN: ver o payload que seria enviado (sem chamar Asaas) ---
router.get("/payload", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
  const normDate = (s) => {
    const t = String(s ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.slice(0, 10);
    return "";
  };

  const { rows } = await pool.query(
    `SELECT id, name, email, cpf_cnpj, phone,
            address, address_number, complement, district, city, state, postal_code,
            person_type, birth_date
       FROM affiliates
      WHERE id = $1
      LIMIT 1`,
    [aff.id]
  );
  const a = rows[0] || {};

  const personType =
    String(a.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";

  const payload = {
    name: a.name,
    email: a.email,
    cpfCnpj: onlyDigits(a.cpf_cnpj),
    personType,
    mobilePhone: onlyDigits(a.phone),
    address: a.address,
    addressNumber: a.address_number,
    complement: a.complement || "",
    province: a.district || "",
    state: a.state,
    city: a.city,
    postalCode: onlyDigits(a.postal_code),
  };

  if (personType === "FISICA") {
    payload.birthDate = normDate(a.birth_date);
  }

  console.log("[ASAAS DEBUG] row do banco:", {
    id: a.id,
    person_type: a.person_type,
    birth_date: a.birth_date,
    typeof_birth_date: typeof a.birth_date,
  });
  console.log("[ASAAS DEBUG] payload (DRY-RUN):", JSON.stringify(payload));

  return res.json({ payload });
});

// ping: confirma mount path real
router.get("/_ping", (_req, res) => {
  res.json({ ok: true, from: "asaasSubaccountService.js" });
});
// --- STATUS DA SUBCONTA ---
// --- STATUS DA SUBCONTA ---
// --- STATUS DA SUBCONTA (auto-liga o link quando seguro) ---
router.get("/status", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  try {
    const { rows } = await pool.query(
      `SELECT
         asaas_wallet_id,
         asaas_account_id,
         link_enabled,
         payout_method,
         pix_key_value,
         bank_number, bank_agency, bank_account, bank_account_digit
       FROM affiliates
       WHERE id = $1
       LIMIT 1`,
      [aff.id]
    );

    const r = rows[0] || {};

    // Geral (KYC): aprovado se subconta existe
    const hasSubaccount = !!r.asaas_wallet_id && !!r.asaas_account_id;
    const general = hasSubaccount ? "APPROVED" : "MISSING";

    // Bancário: aprovado se PIX com chave OU conta bancária completa
    const pixOK = r.payout_method === "pix" && !!String(r.pix_key_value || "").trim();
    const bankOK = r.payout_method === "bank" &&
      !!r.bank_number && !!r.bank_agency && !!r.bank_account && !!r.bank_account_digit;
    const bank = (pixOK || bankOK) ? "APPROVED" : "PENDING";

    let linkEnabled = !!r.link_enabled;

    // 🔒 auto-enable só quando os DOIS estiverem aprovados
    if (!linkEnabled && general === "APPROVED" && bank === "APPROVED") {
      await pool.query(
        `UPDATE affiliates SET link_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
        [aff.id]
      );
      linkEnabled = true;
    }
    // 👉 ao liberar o link para o afiliado (KYC + saque), ativa links do vendedor
await pool.query(
  `UPDATE affiliate_links
      SET active = TRUE, status = 'active'
    WHERE affiliate_id = $1
      AND active = FALSE`,
  [aff.id]
);

    return res.json({
      ok: true,
      status: { general, bank },   // o front lê assim
      link_enabled: linkEnabled,   // isso destrava o link na UI
      wallet_id: r.asaas_wallet_id || null
    });
  } catch (e) {
    console.error("[/affiliates/me/asaas/status] error:", e);
    return res.status(500).json({ ok: false, error: "Erro ao consultar status" });
  }
});

// ... aqui em cima você já tem:
// router.post("/create-subaccount", ...)
// router.get("/status", ...)

// --- HABILITAR LINK DO AFILIADO ---
router.post("/link/enable", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  const { rows } = await pool.query(
    `SELECT asaas_wallet_id, payout_method, pix_key_value,
            bank_number, bank_agency, bank_account, bank_account_digit
       FROM affiliates
      WHERE id = $1
      LIMIT 1`,
    [aff.id]
  );
  const r = rows[0] || {};
  const generalOK = !!r.asaas_wallet_id;
  const bankOK =
    (r.payout_method === "pix"  && !!r.pix_key_value) ||
    (r.payout_method === "bank" &&
      r.bank_number && r.bank_agency && r.bank_account && r.bank_account_digit);

  if (!generalOK || !bankOK) {
    return res.status(400).json({
      ok: false,
      error: "Finalize KYC e o método de saque antes de liberar o link."
    });
  }

  await pool.query(
    `UPDATE affiliates SET link_enabled = TRUE, updated_at = NOW() WHERE id = $1`,
    [aff.id]
  );

  res.json({ ok: true, link_enabled: true });
});

// --- DESABILITAR LINK DO AFILIADO ---
router.post("/link/disable", async (req, res) => {
  const aff = req.session?.aff;
  if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

  await pool.query(
    `UPDATE affiliates SET link_enabled = FALSE, updated_at = NOW() WHERE id = $1`,
    [aff.id]
  );

  res.json({ ok: true, link_enabled: false });
});

// (se você tiver o ping, pode deixar aqui embaixo ou acima — tanto faz)
// router.get("/_ping", ...);





module.exports = router;
