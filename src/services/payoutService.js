// src/services/payoutService.js
"use strict";

const { v4: uuid } = require("uuid");
const pool = require("../db");
const { createRootClient, parseError } = require("./asaasClient");

/**
 * 👉 Atualiza o status das linhas do partner_ledger que já passaram da janela D+7.
 * pending → available (filtrando por partner e, opcionalmente, por role)
 */
async function refreshAvailability(partnerId, role /* 'affiliate' | 'vendor' | null */) {
  await pool.query(
    `
    UPDATE partner_ledger
       SET pl_status = 'available'
     WHERE partner_id = $1
       AND ($2::text IS NULL OR role = $2)
       AND pl_status = 'pending'
       AND available_at <= NOW()
  `,
    [partnerId, role || null]
  );
}

/**
 * 👉 Tira um snapshot do método de saque no momento da solicitação.
 * Garante que há PIX ou Conta bancária configurados corretamente.
 * Retorna um objeto (será salvo como JSON na tabela withdrawals.method).
 */
async function snapshotPayoutMethod(partnerId) {
  const { rows } = await pool.query(
    `
    SELECT payout_method, pix_key_type, pix_key_value,
           bank_holder_name, bank_cpf_cnpj,
           bank_number, bank_agency, bank_account, bank_account_digit, bank_account_type
      FROM affiliates
     WHERE id = $1
     LIMIT 1
  `,
    [partnerId]
  );
  const a = rows[0] || {};

  if (!a.payout_method) {
    throw new Error("Defina um método de saque (Pix ou Conta) antes de solicitar.");
  }

  if (a.payout_method === "pix") {
    if (!a.pix_key_type || !a.pix_key_value) {
      throw new Error("Chave Pix incompleta.");
    }
  } else if (a.payout_method === "bank") {
    const ok =
      a.bank_holder_name &&
      a.bank_cpf_cnpj &&
      a.bank_number &&
      a.bank_agency &&
      a.bank_account &&
      a.bank_account_digit &&
      a.bank_account_type;
    if (!ok) throw new Error("Dados bancários incompletos.");
  } else {
    throw new Error("payout_method inválido.");
  }

  return a; // será serializado como JSON
}

/**
 * 👉 Move TODAS as linhas 'available' do parceiro/role para 'withdrawing'
 * e amarra ao withdrawal_id (execute DENTRO de uma transação).
 * Retorna o total em centavos travado para o saque.
 */
async function lockAvailableForWithdrawTx(client, partnerId, role, withdrawalId) {
  const { rows } = await client.query(
    `
    UPDATE partner_ledger
       SET pl_status='withdrawing', withdrawal_id=$3, updated_at=NOW()
     WHERE partner_id = $1
       AND role = $2
       AND pl_status = 'available'
     RETURNING amount_cents
  `,
    [partnerId, role, withdrawalId]
  );

  const total = rows.reduce((sum, r) => sum + Number(r.amount_cents || 0), 0);
  return total;
}

/**
 * 👉 (Sandbox) liquida o saque imediatamente.
 * Em produção, você pode deixar 'processing' e mudar para 'paid' via webhook do gateway.
 */
async function settleWithdrawalNowTx(client, withdrawalId) {
  await client.query(`UPDATE withdrawals SET status='paid', updated_at=NOW() WHERE id=$1`, [withdrawalId]);
  await client.query(`UPDATE partner_ledger SET pl_status='paid', updated_at=NOW() WHERE withdrawal_id=$1`, [withdrawalId]);
}

/**
 * ✔️ Já existente no seu projeto:
 * Dispara uma transferência de teste (ex.: R$1) na raiz ASAAS para validar o método do afiliado.
 */
async function requestTestTransferForAffiliate(affiliateRecord, amount = 1) {
  if (!affiliateRecord?.payout_method) {
    throw new Error("Método de saque não configurado pelo afiliado.");
  }

  const payload = { value: Number(amount) || 1 };

  if (affiliateRecord.payout_method === "pix") {
    if (!affiliateRecord.pix_key_type || !affiliateRecord.pix_key_value) {
      throw new Error("Chave Pix incompleta.");
    }
    payload.pixAddressKeyType = affiliateRecord.pix_key_type; // 'CPF'|'CNPJ'|'EMAIL'|'PHONE'|'EVP'
    payload.pixAddressKey = affiliateRecord.pix_key_value;
  } else if (affiliateRecord.payout_method === "bank") {
    const missing =
      !affiliateRecord.bank_holder_name ||
      !affiliateRecord.bank_cpf_cnpj ||
      !affiliateRecord.bank_number ||
      !affiliateRecord.bank_agency ||
      !affiliateRecord.bank_account ||
      !affiliateRecord.bank_account_digit ||
      !affiliateRecord.bank_account_type;

    if (missing) throw new Error("Dados bancários incompletos.");

    payload.bankAccount = {
      bank: { code: affiliateRecord.bank_number }, // ex: '237'
      ownerName: affiliateRecord.bank_holder_name,
      cpfCnpj: affiliateRecord.bank_cpf_cnpj,
      agency: affiliateRecord.bank_agency,
      account: affiliateRecord.bank_account,
      accountDigit: affiliateRecord.bank_account_digit,
      bankAccountType: affiliateRecord.bank_account_type // CHECKING_ACCOUNT | SAVINGS_ACCOUNT
    };
  } else {
    throw new Error("payout_method inválido.");
  }

  const root = createRootClient();
  try {
    const r = await root.post("/transfers", payload);
    return r.data;
  } catch (err) {
    throw parseError(err);
  }
}

module.exports = {
  // saldo/saque
  refreshAvailability,
  snapshotPayoutMethod,
  lockAvailableForWithdrawTx,
  settleWithdrawalNowTx,

  // teste de transferência existente
  requestTestTransferForAffiliate,
};
