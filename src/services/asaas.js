// src/services/asaas.js
const axios = require("axios");

const ASAAS_ENV = process.env.ASAAS_ENV || "sandbox";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID;

// URL base alterna entre sandbox e produção
const baseURL =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

// Cliente HTTP com autenticação
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    access_token: ASAAS_API_KEY,
  },
});

// Util: remove chaves com null/undefined (Asaas não curte campos nulos)
function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

/**
 * Criar cliente no Asaas
 * @param {string} name  Nome completo do cliente
 * @param {string} email E-mail do cliente
 * @param {string} cpfCnpj CPF ou CNPJ
 * @param {string} phone Celular com DDD (apenas dígitos)
 */
async function createCustomer(name, email, cpfCnpj, phone) {
  try {
    // IMPORTANTE: para celular use "mobilePhone" (não "phone")
    const { data } = await api.post(
      "/customers",
      clean({ name, email, cpfCnpj, mobilePhone: phone })
    );
    return data; // retorna { id, ... }
  } catch (error) {
    console.error("Erro ao criar cliente:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * (SMOKE) Criar cobrança PIX sem split — só para validar comunicação com a API
 * @param {string} customerId ID do cliente comprador
 * @param {number} value Valor total da cobrança
 * @param {string} description Descrição que aparece para o cliente
 */
async function createPixCharge(customerId, value, description) {
  try {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // vence em 2 dias
      .toISOString()
      .split("T")[0];

    const payload = clean({
      customer: customerId,
      billingType: "PIX",
      value,
      description,
      dueDate,
    });

    const { data } = await api.post("/payments", payload);
    return data; // inclui invoiceUrl para abrir o QR
  } catch (error) {
    console.error("Erro ao criar cobrança Pix (smoke):", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Criar cobrança Pix com split para afiliado (com retenção)
 * @param {string} customerId ID do cliente comprador
 * @param {number} value Valor total da cobrança
 * @param {string} description Descrição que aparece para o cliente
 * @param {object} splitConfig { affiliateWalletId, fixedValue, percent, daysToRelease }
 *   - Informe EITHER percent (0–100) OU fixedValue (valor absoluto da comissão do afiliado)
 *   - daysToRelease: dias para liberar a parte do afiliado (retenção). Default: 7
 */
async function createPixChargeWithSplit(customerId, value, description, splitConfig) {
  try {
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const usePercent = typeof splitConfig?.percent === "number";
    const useFixed = typeof splitConfig?.fixedValue === "number";

    // Monta as fatias (evitando campos nulos)
    const platformSlice = clean({
      walletId: ASAAS_WALLET_ID,
      // se usar percent: plataforma fica com (100 - percent)
      percentualValue: usePercent ? 100 - splitConfig.percent : undefined,
      // se usar fixed: plataforma recebe (total - fixed)
      fixedValue: useFixed ? value - splitConfig.fixedValue : undefined,
    });

    const affiliateSlice = clean({
      walletId: splitConfig?.affiliateWalletId,
      percentualValue: usePercent ? splitConfig.percent : undefined,
      fixedValue: useFixed ? splitConfig.fixedValue : undefined,
      daysToRelease: splitConfig?.daysToRelease ?? 7,
    });

    const payload = clean({
      customer: customerId,
      billingType: "PIX",
      value,
      description,
      dueDate,
      split: [platformSlice, affiliateSlice],
    });

    const { data } = await api.post("/payments", payload);
    return data;
  } catch (error) {
    console.error("Erro ao criar cobrança Pix com split:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  createCustomer,
  createPixCharge,           // smoke (sem split)
  createPixChargeWithSplit,  // split + retenção
};
