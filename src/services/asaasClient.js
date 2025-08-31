// src/services/asaasClient.js
const axios = require("axios");

const BASE_URL = process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3";

/** Client da conta raiz (usa ASAAS_API_KEY) */
function createRootClient() {
  const key = process.env.ASAAS_API_KEY || "";
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "canva-backend",
      "access_token": key
    }
  });
}

/** Client de uma subconta (usa apiKey da subconta) */
function createSubaccountClient(apiKey) {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "canva-backend-sub",
      "access_token": apiKey || ""
    }
  });
}

/** Normaliza erro do Axios/Asaas para algo legível */
function parseError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const asaasMsg =
    data?.errors?.[0]?.description ||
    data?.message ||
    data?.error ||
    null;
  return {
    status: status || 500,
    data: data || null,
    message: asaasMsg || err.message || "Erro desconhecido"
  };
}

module.exports = {
  BASE_URL,
  createRootClient,
  createSubaccountClient,
  parseError
};
