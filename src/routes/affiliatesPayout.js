// src/routes/affiliatesPayout.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const axios = require("axios");

// Cliente Asaas (conta-mestra) para TRANSFERÊNCIAS/PIX
const baseURL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const asaas = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "canva-backend",
    "access_token": process.env.ASAAS_API_KEY || ""
  },
  timeout: 20000
});

// precisa estar logado
function requireAuth(req, res, next) {
  if (!req.session?.aff) return res.status(401).json({ error: "Não autenticado" });
  next();
}

/**
 * POST /affiliates/me/payout-method
 * Salva o método de saque do afiliado (PIX ou dados bancários).
 * Body:
 *  - payout_method: 'pix' | 'bank'
 *  - (pix)  pix_key_type: 'CPF'|'CNPJ'|'EMAIL'|'PHONE'|'EVP'
 *         pix_key_value
 *  - (bank) bank_holder_name, bank_cpf_cnpj, bank_number, bank_agency, bank_account, bank_account_digit, bank_account_type
 */
router.post("/me/payout-method", requireAuth, async (req, res) => {
  try {
    const affId = req.session.aff.id;
    const {
      payout_method,
      pix_key_type, pix_key_value,
      bank_holder_name, bank_cpf_cnpj, bank_number,
      bank_agency, bank_account, bank_account_digit, bank_account_type
    } = req.body || {};

    if (payout_method === "pix") {
      if (!pix_key_type || !pix_key_value) {
        return res.status(400).json({ error: "Informe tipo e chave Pix." });
      }
      await pool.query(
        `UPDATE affiliates SET
            payout_method    = 'pix',
            pix_key_type     = $1,
            pix_key_value    = $2,
            bank_holder_name = NULL,
            bank_cpf_cnpj    = NULL,
            bank_number      = NULL,
            bank_agency      = NULL,
            bank_account     = NULL,
            bank_account_digit = NULL,
            bank_account_type  = NULL,
            payout_status    = 'PENDING',
            updated_at       = NOW()
          WHERE id = $3`,
        [pix_key_type, pix_key_value, affId]
      );
      return res.json({ ok: true });
    }

    if (payout_method === "bank") {
      const missing = [
        bank_holder_name, bank_cpf_cnpj, bank_number,
        bank_agency, bank_account, bank_account_digit, bank_account_type
      ].some(v => !v);
      if (missing) return res.status(400).json({ error: "Preencha todos os dados bancários." });

      await pool.query(
        `UPDATE affiliates SET
            payout_method    = 'bank',
            pix_key_type     = NULL,
            pix_key_value    = NULL,
            bank_holder_name = $1,
            bank_cpf_cnpj    = $2,
            bank_number      = $3,
            bank_agency      = $4,
            bank_account     = $5,
            bank_account_digit = $6,
            bank_account_type  = $7,
            payout_status    = 'PENDING',
            updated_at       = NOW()
          WHERE id = $8`,
        [
          bank_holder_name, bank_cpf_cnpj, bank_number,
          bank_agency, bank_account, bank_account_digit, bank_account_type, affId
        ]
      );
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: "payout_method inválido (use 'pix' ou 'bank')." });
  } catch (err) {
    console.error("payout-method error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

/**
 * POST /affiliates/me/payout-test
 * Faz uma transferência simbólica (ex.: R$1) para validar dados do afiliado.
 * Usa a conta-mestra. Em produção, você pode exigir aprovação por webhook de transferências.
 * Body opcional: { amount }  // default = 1
 */
router.post("/me/payout-test", requireAuth, async (req, res) => {
  try {
    const affId = req.session.aff.id;
    const amount = Number(req.body?.amount || process.env.PAYOUT_TEST_VALUE || 1);

    const { rows } = await pool.query(`SELECT * FROM affiliates WHERE id = $1 LIMIT 1`, [affId]);
    if (!rows.length) return res.status(404).json({ error: "Afiliado não encontrado" });
    const a = rows[0];

    if (!a.payout_method) {
      return res.status(400).json({ error: "Método de saque não configurado." });
    }

    const payload = { value: amount };

    if (a.payout_method === "pix") {
      payload.pixAddressKeyType = a.pix_key_type;   // 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
      payload.pixAddressKey = a.pix_key_value;
    } else if (a.payout_method === "bank") {
      payload.bankAccount = {
        bank: { code: a.bank_number },              // ex: '237'
        ownerName: a.bank_holder_name,
        cpfCnpj: a.bank_cpf_cnpj,
        agency: a.bank_agency,
        account: a.bank_account,
        accountDigit: a.bank_account_digit,
        bankAccountType: a.bank_account_type        // CHECKING_ACCOUNT | SAVINGS_ACCOUNT
      };
    }

    const r = await asaas.post("/transfers", payload);
    // você pode gravar transfer_id para rastrear por webhook
    const transfer = r.data || {};

    // deixa o status como 'VERIFIED' se deu certo (ou espere webhook TRANSFER_DONE)
    await pool.query(
      `UPDATE affiliates
          SET payout_status = 'VERIFIED',
              updated_at    = NOW()
        WHERE id = $1`,
      [affId]
    );

    return res.json({ ok: true, transfer });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error("payout-test error:", detail);

    await pool.query(
      `UPDATE affiliates
          SET payout_status = 'FAILED',
              updated_at    = NOW()
        WHERE id = $1`,
      [req.session.aff.id]
    );

    return res.status(400).json({ error: "Falha ao solicitar teste de transferência", detail });
  }
});

module.exports = router;
