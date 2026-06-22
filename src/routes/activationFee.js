// src/routes/activationFee.js
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../db");

const router = express.Router();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const COMMISSION_TERMS_VERSION =
  process.env.COMMISSION_TERMS_VERSION || "2026-06-v1";

const asaas = axios.create({
  baseURL: ASAAS_BASE_URL,
  timeout: 20000,
  headers: {
    "access_token": ASAAS_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

function requireAuth(req, res, next) {
  if (!req.session?.aff?.id) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

function parseAsaasErrors(detail) {
  const errors = Array.isArray(detail?.errors) ? detail.errors : [];
  const text = errors.map(e => String(e.description || "")).join(" | ").toLowerCase();

  return {
    errors,
    text,
    cpfInUse:
      text.includes("cpf") &&
      (text.includes("já está em uso") || text.includes("ja esta em uso") || text.includes("uso")),
    adultLock:
      text.includes("maior de idade") || text.includes("emancipado"),
    emailProblem: text.includes("email") || text.includes("e-mail"),
    phoneProblem: text.includes("celular") || text.includes("telefone"),
    cpfInvalid: text.includes("cpf") && text.includes("inválido"),
  };
}

async function getAffiliate(affId) {
  const { rows } = await pool.query(
    `SELECT id, role, name, email, cpf_cnpj, phone,
            address, address_number, complement, district, city, state, postal_code,
            person_type, birth_date,
            activation_fee_status, activation_fee_payment_id, activation_fee_checkout_url,
            commission_terms_version, commission_terms_accepted_at,
            asaas_account_id, asaas_wallet_id, link_enabled,
            payout_method, pix_key_value,
            bank_number, bank_agency, bank_account, bank_account_digit
       FROM affiliates
      WHERE id = $1
      LIMIT 1`,
    [affId]
  );
  return rows[0] || null;
}

function hasPayout(a) {
  const pixOk = a.payout_method === "pix" && !!String(a.pix_key_value || "").trim();
  const bankOk =
    a.payout_method === "bank" &&
    !!a.bank_number &&
    !!a.bank_agency &&
    !!a.bank_account &&
    !!a.bank_account_digit;

  return pixOk || bankOk;
}

router.get("/me/activation-status", requireAuth, async (req, res) => {
  try {
    const a = await getAffiliate(req.session.aff.id);
    if (!a) return res.status(404).json({ error: "Afiliado não encontrado" });

    const subaccountReady = !!(a.asaas_account_id && a.asaas_wallet_id);
    const feePaid = a.activation_fee_status === "paid";
    const payoutReady = hasPayout(a);
    const active = feePaid && subaccountReady;
    const commissionTermsAccepted =
    a.commission_terms_version === COMMISSION_TERMS_VERSION &&
    !!a.commission_terms_accepted_at;

    return res.json({
      ok: true,
      activation_fee_status: a.activation_fee_status || "not_started",
      activation_fee_payment_id: a.activation_fee_payment_id || null,
      activation_fee_checkout_url: a.activation_fee_checkout_url || null,
      commission_terms_version: a.commission_terms_version || null,
      commission_terms_required_version: COMMISSION_TERMS_VERSION,
      commission_terms_accepted: commissionTermsAccepted,
      subaccount_ready: subaccountReady,
      payout_ready: payoutReady,
      link_enabled: !!a.link_enabled,
      active,
      can_pay_activation_fee: commissionTermsAccepted && !feePaid && !subaccountReady,
      me: {
        id: a.id,
        name: a.name,
        email: a.email,
        cpf_cnpj: a.cpf_cnpj,
        phone: a.phone,
        birth_date: a.birth_date,
        address: a.address,
        address_number: a.address_number,
        complement: a.complement,
        district: a.district,
        city: a.city,
        state: a.state,
        postal_code: a.postal_code,
        person_type: a.person_type || "FISICA",
      },
    });
  } catch (e) {
    console.error("[activation-status] error:", e);
    return res.status(500).json({ error: "Erro ao consultar ativação" });
  }
});
router.get("/me/commission-terms", requireAuth, async (req, res) => {
  try {
    const a = await getAffiliate(req.session.aff.id);
    if (!a) return res.status(404).json({ error: "Afiliado não encontrado" });

    const role = String(a.role || "affiliate").toLowerCase();

    let text;

    if (role === "vendor") {
      text = `
Você está entrando como VENDEDOR do Canva da consciência.

Seu link pessoal gera comissão de 70% sobre a base comissionável de cada venda.

A base comissionável considera o valor pago pelo cliente menos a taxa operacional de R$2,99 por venda.

Você poderá criar afiliados e definir a comissão deles entre 35% e 60%.

Exemplos:
- Se o afiliado receber 60%, você recebe 10%.
- Se o afiliado receber 35%, você recebe 35%.
- A soma vendedor + afiliado respeita o teto de 70%.

A plataforma permanece com 30% da base comissionável.

Você poderá criar até 50 afiliados vinculados à sua conta.
      `.trim();
    } else {
      text = `
Você está entrando como AFILIADO do Canva da consciência.

Sua comissão será definida conforme seu tipo de cadastro ou conforme a regra definida pelo vendedor que criou seu convite.

A comissão é calculada sobre a base comissionável de cada venda, considerando o valor pago pelo cliente menos a taxa operacional de R$2,99 por venda.

Seu link só será liberado após a ativação da conta e criação da integração financeira.
      `.trim();
    }

    return res.json({
      ok: true,
      version: COMMISSION_TERMS_VERSION,
      accepted:
        a.commission_terms_version === COMMISSION_TERMS_VERSION &&
        !!a.commission_terms_accepted_at,
      role,
      text
    });
  } catch (e) {
    console.error("[commission-terms] error:", e);
    return res.status(500).json({ error: "Erro ao consultar termo de comissão" });
  }
});

router.post("/me/commission-terms/accept", requireAuth, async (req, res) => {
  try {
    const affId = req.session.aff.id;

    await pool.query(`
      UPDATE affiliates
         SET commission_terms_version = $1,
             commission_terms_accepted_at = NOW(),
             commission_terms_ip = $2,
             commission_terms_ua = $3,
             updated_at = NOW()
       WHERE id = $4
    `, [
      COMMISSION_TERMS_VERSION,
      req.ip || null,
      req.headers["user-agent"] || null,
      affId
    ]);

    return res.json({
      ok: true,
      version: COMMISSION_TERMS_VERSION
    });
  } catch (e) {
    console.error("[commission-terms/accept] error:", e);
    return res.status(500).json({ error: "Erro ao aceitar termo de comissão" });
  }
});

router.post("/me/asaas/precheck-document", requireAuth, async (req, res) => {
  try {
    const a = await getAffiliate(req.session.aff.id);
    if (!a) return res.status(404).json({ error: "Afiliado não encontrado" });

    const cpfCnpj = onlyDigits(a.cpf_cnpj);
    const phone = onlyDigits(a.phone);

    if (!cpfCnpj) return res.status(400).json({ available: false, reason: "missing_document", error: "CPF/CNPJ ausente." });
    if (!phone) return res.status(400).json({ available: false, reason: "missing_phone", error: "Celular ausente." });

    const uniq = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const tempEmail = `precheck-${a.id.slice(0, 8)}-${uniq}@precheck.canvaspiritual.com`;

    const payload = {
      name: a.name || "Precheck Canva",
      email: tempEmail,
      loginEmail: tempEmail,
      personType: String(a.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA",
      cpfCnpj,
      birthDate: "2099-01-01",
      mobilePhone: phone,
      address: a.address || "Rua Teste",
      addressNumber: String(a.address_number || "1"),
      complement: a.complement || "",
      province: a.district || "Centro",
      city: a.city || "Ceres",
      state: a.state || "GO",
      postalCode: onlyDigits(a.postal_code || "76300000"),
      incomeValue: Number(process.env.AFF_DEFAULT_INCOME || 1500),
    };

    const resp = await asaas.post("/accounts", payload, { validateStatus: () => true });
    const data = resp.data || {};
    const parsed = parseAsaasErrors(data);

    if (resp.status >= 200 && resp.status < 300) {
      return res.status(409).json({
        available: false,
        reason: "unexpected_created_subaccount",
        error: "O precheck criou subconta inesperadamente. Fluxo bloqueado por segurança.",
        asaas: data,
      });
    }

    if (parsed.cpfInUse) {
      await pool.query(
        `UPDATE affiliates
            SET asaas_precheck_status = 'document_in_use',
                updated_at = NOW()
          WHERE id = $1`,
        [a.id]
      ).catch(() => {});

      return res.status(409).json({
        available: false,
        reason: "document_in_use",
        error: "Este CPF/CNPJ já está em uso no Asaas.",
        asaas_errors: parsed.errors,
      });
    }

    if (parsed.adultLock) {
      await pool.query(
        `UPDATE affiliates
            SET asaas_precheck_status = 'available',
                updated_at = NOW()
          WHERE id = $1`,
        [a.id]
      ).catch(() => {});

      return res.json({
        ok: true,
        available: true,
        reason: "document_available",
        message: "CPF/CNPJ disponível para seguir com a adesão.",
      });
    }

    return res.status(400).json({
      available: false,
      reason: "validation_error",
      error: "A Asaas retornou uma pendência de validação. Corrija os dados e tente novamente.",
      asaas_errors: parsed.errors,
    });
  } catch (e) {
    console.error("[precheck-document] error:", e.response?.data || e.message);
    return res.status(500).json({ error: "Erro no precheck Asaas" });
  }
});
router.post("/me/activation-fee/pix", requireAuth, async (req, res) => {
  try {
    const a = await getAffiliate(req.session.aff.id);
    if (!a) return res.status(404).json({ error: "Afiliado não encontrado" });

    const commissionTermsAccepted =
      a.commission_terms_version === COMMISSION_TERMS_VERSION &&
      !!a.commission_terms_accepted_at;

    if (!commissionTermsAccepted) {
      return res.status(403).json({
        error: "É necessário aceitar a ciência de comissionamento antes da adesão."
      });
    }

    if (a.activation_fee_status === "paid" && a.asaas_account_id && a.asaas_wallet_id) {
      return res.json({ ok: true, already_paid: true });
    }

    const externalReference = `activation_fee:${a.id}`;

    const customerResp = await asaas.post("/customers", {
      name: a.name,
      email: a.email,
      cpfCnpj: onlyDigits(a.cpf_cnpj),
      mobilePhone: onlyDigits(a.phone),
    });

    const customerId = customerResp.data.id;

    const payResp = await asaas.post("/payments", {
      customer: customerId,
      billingType: "PIX",
      value: 16.99,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: "Adesão Canva Espiritual - ativação de vendedor/afiliado",
      externalReference,
    });

    const pay = payResp.data || {};

    const qrResp = await asaas.get(`/payments/${pay.id}/pixQrCode`);
    const qr = qrResp.data || {};

    await pool.query(
      `UPDATE affiliates
          SET activation_fee_status = 'pending',
              activation_fee_payment_id = $1,
              activation_fee_checkout_url = NULL,
              updated_at = NOW()
        WHERE id = $2`,
      [pay.id || null, a.id]
    );

    return res.json({
      ok: true,
      payment_id: pay.id,
      value: pay.value,
      qr_code_base64: qr.encodedImage || null,
      qr_code: qr.payload || null,
      expirationDate: qr.expirationDate || null,
    });
  } catch (e) {
    console.error("[activation-fee/pix] error:", e.response?.data || e.message);
    return res.status(400).json({
      error: "Erro ao gerar PIX da adesão",
      detail: e.response?.data || e.message,
    });
  }
});

router.post("/me/activation-fee/start", requireAuth, async (req, res) => {
  try {
    const a = await getAffiliate(req.session.aff.id);
    if (!a) return res.status(404).json({ error: "Afiliado não encontrado" });

    if (a.activation_fee_status === "paid") {
      return res.json({ ok: true, already_paid: true });
    }

    const externalReference = `activation_fee:${a.id}`;

    const payload = {
      customer: undefined,
      billingType: "UNDEFINED",
      value: 16.99,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      description: "Adesão Canva Espiritual - ativação de vendedor/afiliado",
      externalReference,
    };

    // Cria customer simples no Asaas root
    const customerResp = await asaas.post("/customers", {
      name: a.name,
      email: a.email,
      cpfCnpj: onlyDigits(a.cpf_cnpj),
      mobilePhone: onlyDigits(a.phone),
    });

    payload.customer = customerResp.data.id;

    const payResp = await asaas.post("/payments", payload);
    const pay = payResp.data || {};

    await pool.query(
      `UPDATE affiliates
          SET activation_fee_status = 'pending',
              activation_fee_payment_id = $1,
              activation_fee_checkout_url = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [pay.id || null, pay.invoiceUrl || pay.bankSlipUrl || null, a.id]
    );

    return res.json({
      ok: true,
      payment_id: pay.id,
      checkout_url: pay.invoiceUrl || pay.bankSlipUrl || null,
      payment: pay,
    });
  } catch (e) {
    console.error("[activation-fee/start] error:", e.response?.data || e.message);
    return res.status(400).json({
      error: "Erro ao gerar adesão",
      detail: e.response?.data || e.message,
    });
  }
});

module.exports = router;