// src/routes/affiliatesAsaas.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

// Cliente Asaas (conta-mestra)
const baseURL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const asaasRoot = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "canva-backend",
    "access_token": process.env.ASAAS_API_KEY || ""
  },
  timeout: 20000
});

// helper: precisa estar logado como afiliado
function requireAuth(req, res, next) {
  if (!req.session?.aff) return res.status(401).json({ error: "Não autenticado" });
  next();
}

// helper: cria cliente Asaas com apiKey da SUBCONTA
function asaasForSub(apiKey) {
  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "canva-backend-sub",
      "access_token": apiKey
    },
    timeout: 20000
  });
}

/**
 * POST /affiliates/me/asaas/create-subaccount
 * Cria uma SUBCONTA no Asaas para o afiliado logado (KYC).
 * Guarda: asaas_account_id, asaas_wallet_id, asaas_api_key e marca link_enabled=false (aguarda aprovação).
 */
router.post("/me/asaas/create-subaccount", requireAuth, async (req, res) => {
  try {
    const affId = req.session.aff.id;

    // pega dados do afiliado para preencher subconta
    const { rows } = await pool.query(
      `SELECT id, name, email, cpf_cnpj, phone,
              address, address_number, district, city, state, postal_code,
              asaas_account_id, asaas_wallet_id, asaas_api_key
         FROM affiliates
        WHERE id = $1
        LIMIT 1`,
      [affId]
    );
    if (!rows.length) return res.status(404).json({ error: "Afiliado não encontrado" });
    const a = rows[0];

    // se já tem subconta criada, só retorna os dados
    if (a.asaas_account_id && a.asaas_wallet_id && a.asaas_api_key) {
      return res.json({
        ok: true,
        already: true,
        asaas_account_id: a.asaas_account_id,
        asaas_wallet_id: a.asaas_wallet_id
      });
    }

    // monta payload básico para criação de subconta
    // (ajuste campos conforme necessidade/KYC)
    const payload = {
      name: a.name,
      email: a.email,
      cpfCnpj: a.cpf_cnpj,
      phone: a.phone,
      postalCode: a.postal_code,
      address: a.address,
      addressNumber: String(a.address_number || ""),
      complement: "",
      province: a.district,
      city: a.city,
      state: a.state
    };

    // cria subconta
    const resp = await asaasRoot.post("/accounts", payload);
    const data = resp.data || {};
    // respostas usuais: id (da subconta), apiKey (da subconta), walletId (carteira da subconta)
    const accountId = data.id;
    const walletId = data.walletId || data.wallet?.id;
    const apiKey = data.apiKey;

    if (!accountId || !apiKey || !walletId) {
      return res.status(502).json({ error: "Retorno inesperado do Asaas ao criar subconta." });
    }

    await pool.query(
      `UPDATE affiliates
          SET asaas_account_id = $1,
              asaas_wallet_id  = $2,
              asaas_api_key    = $3,
              link_enabled     = false,
              updated_at       = NOW()
        WHERE id = $4`,
      [accountId, walletId, apiKey, affId]
    );

    return res.json({
      ok: true,
      asaas_account_id: accountId,
      asaas_wallet_id: walletId
    });
  } catch (err) {
    // tenta expor erro do Asaas se vier
    const apiErr = err.response?.data || err.message;
    console.error("create-subaccount error:", apiErr);
    return res.status(400).json({ error: "Falha ao criar subconta Asaas", detail: apiErr });
  }
});

/**
 * GET /affiliates/me/asaas/status
 * Consulta a SITUAÇÃO cadastral da subconta (usando a apiKey da subconta).
 * Se estiver APPROVED (geral e conta bancária), habilita o link (link_enabled=true).
 */
router.get("/me/asaas/status", requireAuth, async (req, res) => {
  try {
    const affId = req.session.aff.id;

    const { rows } = await pool.query(
      `SELECT id, asaas_api_key, link_enabled
         FROM affiliates
        WHERE id = $1
        LIMIT 1`,
      [affId]
    );
    if (!rows.length) return res.status(404).json({ error: "Afiliado não encontrado" });
    const a = rows[0];

    if (!a.asaas_api_key) {
      return res.status(400).json({ error: "Subconta não criada ainda" });
    }

    const subClient = asaasForSub(a.asaas_api_key);
    // status da própria subconta
    const r = await subClient.get("/myAccount/status");
    const st = r.data || {};

    // mapeia campos (ajuste conforme retorno real do Asaas)
    const general = st.generalApprovalStatus || st.generalStatus || "PENDING";
    const bank    = st.bankAccountInfoStatus || st.bankStatus || "PENDING";

    // atualiza no banco
    await pool.query(
      `UPDATE affiliates
          SET asaas_status_general = $1,
              asaas_status_bank    = $2,
              updated_at           = NOW()
        WHERE id = $3`,
      [general, bank, affId]
    );

    // habilita link quando tudo aprovado
    let linkEnabled = a.link_enabled;
    if (general === "APPROVED" && bank === "APPROVED" && !a.link_enabled) {
      await pool.query(
        `UPDATE affiliates SET link_enabled = true, updated_at = NOW() WHERE id = $1`,
        [affId]
      );
      linkEnabled = true;
    }

    return res.json({
      ok: true,
      status: { general, bank },
      link_enabled: linkEnabled
    });
  } catch (err) {
    const apiErr = err.response?.data || err.message;
    console.error("subaccount status error:", apiErr);
    return res.status(400).json({ error: "Falha ao consultar status da subconta", detail: apiErr });
  }
});

module.exports = router;
