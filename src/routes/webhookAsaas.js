// src/routes/webhookAsaas.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const pool = require("../db");
const filaRelatorios = require("../queue/filaRelatorios");
const { applySplit } = require("../services/sliptService"); // use o mesmo serviço do /debug
const { v4: uuid } = require("uuid");

const router = express.Router();

/** ===== Asaas API client (sandbox x production) ===== */
const IS_PROD = (process.env.ASAAS_ENV || "sandbox").toLowerCase() === "production";
const ASAAS_BASE = IS_PROD ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
const asaas = axios.create({
  baseURL: ASAAS_BASE,
  headers: {
    "Content-Type": "application/json",
    "access_token": process.env.ASAAS_API_KEY || "",
  },
});

/** Eventos que consideramos "pagos" no Asaas */
const PAID_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

/** Mapeia o tipo de pagamento do Asaas para nossos rótulos */
function mapTipoPagamento(billingType) {
  const b = String(billingType || "").toUpperCase();
  if (b === "PIX") return "pix";
  if (b === "CREDIT_CARD") return "cartao";
  if (b === "BOLETO") return "boleto";
  return "desconhecido";
}

/** Extrai o token enviado pelo Asaas (aceitamos algumas variantes) */
function getWebhookToken(req) {
  return (
    req.headers["asaas-access-token"] ||
    req.headers["access_token"] ||
    req.headers["x-asaas-token"] ||
    req.query.token ||
    null
  );
}

/** Consulta pagamento na API (fallback quando o webhook não traz infos suficientes) */
async function fetchPaymentFromAsaas(paymentId) {
  if (!paymentId) return null;
  try {
    const { data } = await asaas.get(`/payments/${paymentId}`);
    return data || null;
  } catch (e) {
    console.warn("[ASAAS WH] Falha no GET /payments/:id:", e?.response?.data || e.message);
    return null;
  }
}
async function marcarPrepaidComoPago(pay) {
  const externalReference = String(pay?.externalReference || "");

  if (!externalReference.startsWith("prepaid:")) {
    return false;
  }



  const creditId = externalReference.replace("prepaid:", "").trim();
  const paymentId = pay?.id || null;

  if (!creditId) {
    console.warn("[ASAAS WH] prepaid sem creditId.");
    return true;
  }

  await pool.query(`
    UPDATE prepaid_quiz_credits
    SET
      status = 'paid',
      gateway_payment_id = COALESCE($1, gateway_payment_id),
      paid_at = NOW()
    WHERE id::text = $2
  `, [paymentId, creditId]);

  console.log("[ASAAS WH] crédito pré-pago liberado:", creditId);

  return true;
}

  async function criarSubcontaRealEAktivacao(affiliateId) {
  const { rows } = await pool.query(`
    SELECT id, name, email, cpf_cnpj, phone,
           address, address_number, complement, district, city, state, postal_code,
           person_type, birth_date,
           asaas_account_id, asaas_wallet_id, asaas_api_key
      FROM affiliates
     WHERE id = $1
     LIMIT 1
  `, [affiliateId]);

  if (!rows.length) throw new Error("Afiliado não encontrado para ativação.");
  const a = rows[0];

  if (a.asaas_account_id && a.asaas_wallet_id) {
  const ASAAS_ENV_CURRENT =
    String(process.env.ASAAS_ENV || "sandbox")
      .trim()
      .toLowerCase();

  await pool.query(`
    UPDATE affiliates
       SET activation_fee_status = 'paid',
           activation_fee_paid_at = COALESCE(activation_fee_paid_at, NOW()),
           asaas_env = COALESCE(NULLIF(asaas_env, ''), $2),
           link_enabled = TRUE,
           updated_at = NOW()
     WHERE id = $1
  `, [affiliateId, ASAAS_ENV_CURRENT]);

    await pool.query(`
      UPDATE affiliate_links
         SET active = TRUE,
             status = 'active'
       WHERE affiliate_id = $1
    `, [affiliateId]);

    return { already: true };
  }

  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const normDate = (s) => {
    const t = String(s || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.slice(0, 10);
    return "";
  };

  const personType = String(a.person_type || "FISICA").toUpperCase() === "JURIDICA" ? "JURIDICA" : "FISICA";

  const body = {
    name: a.name,
    email: a.email,
    loginEmail: a.email,
    personType,
    cpfCnpj: onlyDigits(a.cpf_cnpj),
    mobilePhone: onlyDigits(a.phone),
    address: a.address,
    addressNumber: String(a.address_number || ""),
    complement: a.complement || "",
    province: a.district || "",
    city: a.city,
    state: a.state,
    postalCode: onlyDigits(a.postal_code),
    incomeValue: Number(process.env.AFF_DEFAULT_INCOME || 1500),
  };

  if (personType === "FISICA") {
    body.birthDate = normDate(a.birth_date);
    if (!body.birthDate) throw new Error("Data de nascimento ausente para criar subconta.");
  }

  const resp = await asaas.post("/accounts", body);
  const data = resp.data || {};

  const accountId = data.id || null;
  const walletId = data.walletId || null;
  const apiKey = data.apiKey || data.accessToken?.apiKey || null;

  const accNum = data.accountNumber || {};
  const agency = accNum.agency || null;
  const account = accNum.account || null;
  const accountDigit = accNum.accountDigit || null;

  if (!accountId || !walletId || !apiKey) {
    throw new Error("Retorno inesperado do Asaas ao criar subconta.");
  }
  console.log("[ASAAS SUBACCOUNT CREATED]", {
  env: String(process.env.ASAAS_ENV || "sandbox").trim().toLowerCase(),
  base: ASAAS_BASE,
  rootKeyPrefix: String(process.env.ASAAS_API_KEY || "").slice(0, 20),
  subKeyPrefix: String(apiKey || "").slice(0, 20),
  accountId,
  walletId,
});
const ASAAS_ENV_CURRENT =
  String(process.env.ASAAS_ENV || "sandbox")
    .trim()
    .toLowerCase();

await pool.query(`
UPDATE affiliates
SET
  asaas_account_id = $1,
  asaas_wallet_id = $2,
  wallet_id = $2,
  asaas_api_key = $3,
  asaas_env = $4,
  asaas_agency = $5,
  asaas_account = $6,
  asaas_account_digit = $7,
  activation_fee_status = 'paid',
  activation_fee_paid_at = COALESCE(activation_fee_paid_at, NOW()),
  link_enabled = TRUE,
  updated_at = NOW()
WHERE id = $8
`, [
  accountId,
  walletId,
  apiKey,
  ASAAS_ENV_CURRENT,
  agency,
  account,
  accountDigit,
  affiliateId
]);

  await pool.query(`
    UPDATE affiliate_links
       SET active = TRUE,
           status = 'active'
     WHERE affiliate_id = $1
  `, [affiliateId]);

  return { already: false, accountId, walletId };
}

async function marcarActivationFeeComoPago(pay) {
  const externalReference = String(pay?.externalReference || "");
  if (!externalReference.startsWith("activation_fee:")) return false;

  const affiliateId = externalReference.replace("activation_fee:", "").trim();
  const paymentId = pay?.id || null;

  if (!affiliateId) {
    console.warn("[ASAAS WH] activation_fee sem affiliateId.");
    return true;
  }

  try {
    await pool.query(`
      UPDATE affiliates
         SET activation_fee_status = 'paid',
             activation_fee_payment_id = COALESCE($1, activation_fee_payment_id),
             activation_fee_paid_at = COALESCE(activation_fee_paid_at, NOW()),
             updated_at = NOW()
       WHERE id = $2
    `, [paymentId, affiliateId]);

    const out = await criarSubcontaRealEAktivacao(affiliateId);

    console.log("[ASAAS WH] adesão paga e subconta ativada:", {
      affiliateId,
      paymentId,
      ...out
    });
  } catch (e) {
    console.error("[ASAAS WH] falha ao ativar após adesão:", e.response?.data || e.message);

    await pool.query(`
      UPDATE affiliates
         SET activation_fee_status = 'paid_subaccount_failed',
             activation_fee_payment_id = COALESCE($1, activation_fee_payment_id),
             activation_fee_paid_at = COALESCE(activation_fee_paid_at, NOW()),
             link_enabled = FALSE,
             updated_at = NOW()
       WHERE id = $2
    `, [paymentId, affiliateId]);
  }

  return true;
}
// === Política do link (A/V/S) e wallets ===
// === Política do link (A/V/S) e wallets — com supervisor_id (se houver) ===
async function getPolicyBySession(sessionId) {
  if (!sessionId) return { type: "unknown" };

  const q = await pool.query(`
    SELECT al.id AS link_id, al.pct_aff, al.pct_vendor, al.pct_supervisor,
           al.vendor_id, al.affiliate_id,
           v.supervisor_id,
           a.asaas_wallet_id AS affiliate_wallet,
           v.asaas_wallet_id AS vendor_wallet,
           s.asaas_wallet_id AS supervisor_wallet
      FROM attribution at
      JOIN affiliate_links al ON al.id = at.affiliate_link_id
      LEFT JOIN affiliates a ON a.id = al.affiliate_id
      LEFT JOIN affiliates v ON v.id = al.vendor_id
      LEFT JOIN affiliates s ON s.id = v.supervisor_id
     WHERE at.session_id = $1
     LIMIT 1
  `, [sessionId]);

  if (!q.rowCount) return { type: "unknown" };
  const r = q.rows[0];

  return {
    type: "affiliate_link",
    link_id: r.link_id,
    pct_aff: Number(r.pct_aff || 0),
    pct_vendor: Number(r.pct_vendor || 0),
    pct_super: Number(r.pct_supervisor || 0),
    ids: { affiliate: r.affiliate_id, vendor: r.vendor_id, supervisor: r.supervisor_id },
    wallets: {
      affiliate: r.affiliate_wallet || null,
      vendor:    r.vendor_wallet    || null,
      supervisor:r.supervisor_wallet|| null
    }
  };
}


// === Espelha split nativo do Asaas em sales + partner_ledger ===
async function persistSaleAndLedgerFromAsaasSplit(pay, sessionId) {
  const operationalFeeCents = 299;
const grossCents = Math.round(Number(pay.value || 0) * 100);
const netCents = Math.max(0, grossCents - operationalFeeCents);
  const paymentId  = String(pay.id || uuid());
  const saleId     = uuid();
const meta = await pool.query(`
  SELECT al.id AS link_id, al.vendor_id, al.affiliate_id, al.pct_aff
    FROM attribution at
    JOIN affiliate_links al ON al.id = at.affiliate_link_id
   WHERE at.session_id = $1
   LIMIT 1
`, [sessionId]);

let linkId      = meta.rows[0]?.link_id      || null;
let vendorId    = meta.rows[0]?.vendor_id    || null;
let affiliateId = meta.rows[0]?.affiliate_id || null;
let affPct      = Number(meta.rows[0]?.pct_aff ?? 30);
// (1) se NÃO houve attribution (link do vendedor), tenta o afiliado "seco" pelo diagnosticos
if (!affiliateId) {
  try {
    const diag = await pool.query(
      `SELECT affiliate_ref FROM diagnosticos WHERE session_id = $1 LIMIT 1`,
      [sessionId]
    );
    if (diag.rowCount && diag.rows[0].affiliate_ref) {
      affiliateId = diag.rows[0].affiliate_ref;  // afiliado direto (link ?ref=)
      // % do afiliado "seco" mantém 30 como default, a menos que você tenha outra regra
      affPct = Number.isFinite(affPct) ? affPct : 30;
    }
  } catch (_) {}
}





   // pega splits do webhook ou da API (aceita split ou splits)
  let splits = Array.isArray(pay.split) ? pay.split : (Array.isArray(pay.splits) ? pay.splits : null);
  if (!splits) {
    try {
      const p = await fetchPaymentFromAsaas(paymentId);
      if (Array.isArray(p?.split))  splits = p.split;
      else if (Array.isArray(p?.splits)) splits = p.splits;
    } catch {}
  }
  // (2) se AINDA não temos affiliateId, tenta inferir pelo walletId do split
if (!affiliateId && Array.isArray(splits)) {
  let maxPct = -1, affWallet = null;
  for (const sp of splits) {
    const pct = Number(sp.percentualValue ?? sp.percentageValue ?? 0);
    if (pct > maxPct) { maxPct = pct; affWallet = sp.walletId || sp.wallet || sp.accountWalletId || null; }
  }
  if (affWallet) {
    const qAff = await pool.query(`SELECT id FROM affiliates WHERE asaas_wallet_id = $1 LIMIT 1`, [affWallet]);
    if (qAff.rowCount) affiliateId = qAff.rows[0].id;
    if (maxPct > 0) affPct = maxPct; // usa % real do split como commission_percent
  }
}

  

  await pool.query(`
  INSERT INTO sales
    (id, session_id, created_at, gateway, gateway_payment_id, amount, net_amount_cents,
     status, origin, affiliate_link_id, vendor_id, affiliate_id, commission_percent)
  VALUES ($1, $2, NOW(), 'ASAAS', $3, $4, $5,
          'paid', 'affiliate', $6, $7, $8, $9)
  ON CONFLICT (id) DO NOTHING
`, [
  saleId,                  // $1
  sessionId,               // $2  ← NÃO NULO
  paymentId,               // $3
  Number(pay.value || 0),  // $4  ← REAIS (21.00), para a UI não mostrar 2.100,00
  netCents,                // $5  ← CENTAVOS (2010)
  linkId,                  // $6
  vendorId,                // $7
  affiliateId,             // $8
  affPct                   // $9  ← % do afiliado (40/42/50…)
]);

  // insere ledger como 'paid' (Asaas já repassou)
  let sum = 0;
  for (const sp of splits) {
    const walletId = sp.walletId || sp.wallet || sp.accountWalletId;
    let cents = 0;
    if (sp.percentualValue != null) cents = Math.round(netCents * Number(sp.percentualValue) / 100);
    else if (sp.fixedValue != null) cents = Math.round(Number(sp.fixedValue) * 100);
    if (!cents) continue;

    // mapeia wallet -> partner
    const who = await pool.query(
      `SELECT id, role FROM affiliates WHERE asaas_wallet_id = $1 LIMIT 1`,
      [walletId]
    );
    if (!who.rowCount) continue;
    const partnerId = who.rows[0].id;
    const role = (who.rows[0].role || '').toLowerCase(); // 'affiliate'|'vendor'|'supervisor'|'admin' etc.

    await pool.query(`
      INSERT INTO partner_ledger
        (sale_id, partner_id, role, amount_cents, pl_status, available_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,'paid',NOW(),NOW(),NOW())
      ON CONFLICT DO NOTHING
    `, [String(saleId), partnerId, role, cents]);

    sum += cents;
  }

  // resto → plataforma (fica na wallet raiz Asaas)
  const rest = Math.max(0, netCents - sum);
  if (rest > 0) {
    const PLATFORM_ID = process.env.PLATFORM_ACCOUNT_ID || 'PLATFORM';
    await pool.query(`
      INSERT INTO partner_ledger
        (sale_id, partner_id, role, amount_cents, pl_status, available_at, created_at, updated_at)
      VALUES ($1,$2,'platform',$3,'paid',NOW(),NOW(),NOW())
      ON CONFLICT DO NOTHING
    `, [String(saleId), PLATFORM_ID, rest]);
  }

  return { mirrored: true, saleId };
}

/** Resolve o session_id a partir do evento/payment */
async function resolverSessionId(pay) {
  if (!pay) return null;

  // 0) ✅ PRIORIDADE: id da sessão do checkout vindo no payload do webhook
  const chkFromWebhook =
    pay.checkoutSession || (pay.checkout && (pay.checkout.id || pay.checkout)) || null;
  if (chkFromWebhook) {
    const chkId = String(chkFromWebhook);
    const byChk = await pool.query(
      `SELECT session_id
         FROM diagnosticos
        WHERE asaas_checkout_id = $1
        LIMIT 1`,
      [chkId]
    );
    if (byChk.rows[0]?.session_id) return byChk.rows[0].session_id;
  }

  // 1) externalReference direto do webhook
  if (pay.externalReference) return String(pay.externalReference);

  // 2) description contendo "sessao-########" no webhook
  if (typeof pay.description === "string") {
    const m = pay.description.match(/sessao-\d+/i);
    if (m) return m[0];
  }

  // 3) já amarrado antes via asaas_payment_id?
  if (pay.id) {
    const byPid = await pool.query(
      "SELECT session_id FROM diagnosticos WHERE asaas_payment_id = $1 LIMIT 1",
      [pay.id]
    );
    if (byPid.rows[0]?.session_id) return byPid.rows[0].session_id;
  }

  // 4) Fallback: consulta API do Asaas e tenta várias chaves
  if (pay.id) {
    const p = await fetchPaymentFromAsaas(pay.id);
    if (p) {
      console.log("[ASAAS WH] Payment API fields:", {
        externalReference: p.externalReference,
        description: p.description,
        // alguns ambientes retornam checkoutSession também na API:
        checkoutSession: p.checkoutSession || p.checkoutId || (p.checkout && p.checkout.id) || p.checkout
      });

      if (p.externalReference) return String(p.externalReference);

      if (typeof p.description === "string") {
        const m = p.description.match(/sessao-\d+/i);
        if (m) return m[0];
      }

      // ✅ usa checkoutSession/checkoutId da API (se vier)
      const chkApi = p.checkoutSession || p.checkoutId || (p.checkout && p.checkout.id) || p.checkout;
      if (chkApi) {
        const byChkApi = await pool.query(
          `SELECT session_id
             FROM diagnosticos
            WHERE asaas_checkout_id = $1
            LIMIT 1`,
          [String(chkApi)]
        );
        if (byChkApi.rows[0]?.session_id) return byChkApi.rows[0].session_id;
      }
    }
  }

  return null;
}

/** Move JSON de temp/respondidos -> temp/pendentes e carimba status/infos */
function moverJsonParaPendentes(sessionId, paymentId, tipoPagamento) {
  try {
    const base = path.join(__dirname, "../../temp");
    const origem = path.join(base, "respondidos", `${sessionId}.json`);
    const destino = path.join(base, "pendentes", `${sessionId}.json`);

    if (!fs.existsSync(origem)) {
      console.warn(`⚠️ [ASAAS WH] ${sessionId}.json não encontrado em /respondidos`);
      return;
    }

    const dados = JSON.parse(fs.readFileSync(origem, "utf8"));
    dados.status_pagamento = "pago";
    dados.payment_id = paymentId;
    dados.tipo_pagamento = tipoPagamento;
    dados.data_confirmacao = new Date().toISOString();

    fs.writeFileSync(destino, JSON.stringify(dados, null, 2), "utf8");
    fs.unlinkSync(origem);
    console.log(`✅ [ASAAS WH] JSON movido para pendentes: ${sessionId}`);
  } catch (e) {
    console.warn("[ASAAS WH] Falha ao mover JSON:", e.message || e);
  }
}

/** Atualiza o Postgres para 'pago' */
async function atualizarPgComoPago(sessionId, paymentId, tipoPagamento) {
  try {
    await pool.query(
      `UPDATE diagnosticos
         SET status_pagamento   = $1,
             tipo_pagamento     = $2,
             data_pagamento     = NOW(),
             payment_id         = $3,
             asaas_payment_id   = $3,
             status_processo    = $4,
             brevo_sincronizado = false,
             updated_at         = NOW()
       WHERE session_id = $5`,
      ["pago", tipoPagamento, paymentId, "pago", sessionId]
    );
    console.log(`🧾 [ASAAS WH] PostgreSQL atualizado como PAGO para sessão ${sessionId}`);
  } catch (pgErr) {
    console.error(`[ASAAS WH] Erro ao atualizar PG para ${sessionId}:`, pgErr.message);
  }
}

/** Atualiza o Postgres quando há estorno/chargeback */
async function atualizarPgComoRefunded(sessionId, paymentId) {
  try {
    if (sessionId) {
      await pool.query(
        `UPDATE diagnosticos
            SET status_pagamento = $1,
                updated_at = NOW()
          WHERE session_id = $2`,
        ["refunded", sessionId]
      );
    } else if (paymentId) {
      await pool.query(
        `UPDATE diagnosticos
            SET status_pagamento = $1,
                updated_at = NOW()
          WHERE asaas_payment_id = $2`,
        ["refunded", paymentId]
      );
    }
    console.log(`↩️ [ASAAS WH] Marcado como refunded. Sessão=${sessionId || "-"} Payment=${paymentId || "-"}`);
  } catch (pgErr) {
    console.error("[ASAAS WH] Erro ao marcar refunded:", pgErr.message);
  }
}

/** No PAYMENT_CREATED, tentar vincular o paymentId à sessão o quanto antes */
async function amarrarPaymentIdNaSessao(pay) {
  try {
    if (!pay?.id) return;

    let sessionId = null;

    // a) Primeiro, tenta casar pelo ID da sessão do checkout vindo no webhook
    const chkFromWebhook =
      pay.checkoutSession || (pay.checkout && (pay.checkout.id || pay.checkout)) || null;
    if (chkFromWebhook) {
      const chkId = String(chkFromWebhook);
      const q = await pool.query(
        `SELECT session_id
           FROM diagnosticos
          WHERE asaas_checkout_id = $1
          LIMIT 1`,
        [chkId]
      );
      if (q.rows[0]?.session_id) sessionId = q.rows[0].session_id;
    }

    // b) Se ainda não achou, usa o resolver (externalReference/description/API)
    if (!sessionId) {
      sessionId = await resolverSessionId(pay);
    }

    if (sessionId) {
      await pool.query(
        `UPDATE diagnosticos
            SET asaas_payment_id = $1,
                updated_at = NOW()
          WHERE session_id = $2`,
        [pay.id, sessionId]
      );
      console.log(`[ASAAS WH] Vinculado asaas_payment_id=${pay.id} à sessão ${sessionId}`);
    } else {
      console.warn("[ASAAS WH] Não foi possível amarrar payment à sessão no CREATED.");
    }
  } catch (e) {
    console.warn("[ASAAS WH] Falha ao vincular asaas_payment_id:", e.message || e);
  }
}


router.post("/", async (req, res) => {
  try {
    // 🔐 (opcional) validar segredo
    const secret = process.env.ASAAS_WEBHOOK_SECRET;
    if (secret) {
      const token = getWebhookToken(req);
      if (token !== secret) {
        console.warn("[ASAAS WH] Token inválido");
        return res.sendStatus(401);
      }
    }

    const evt = req.body; // { id, event, payment: {...}, ... }
    if (!evt || !evt.event) return res.sendStatus(200);

    // Log útil para ver TUDO que vem no payload (remova depois de estabilizar)
    console.log("[ASAAS WH] payment bruto ->");
    console.dir(evt.payment, { depth: null });

    // Idempotência
    if (evt.id) {
      try {
        await pool.query(
          "INSERT INTO asaas_webhook_events(id) VALUES ($1) ON CONFLICT DO NOTHING",
          [evt.id]
        );
      } catch (e) {
        // se a tabela não existir, só loga e segue (não quebra o webhook)
        console.warn("[ASAAS WH] aviso: tabela asaas_webhook_events ausente? idempotência desativada.");
      }
    }

    const tipo = String(evt.event || "").toUpperCase();
    const pay = evt.payment || {};
    const paymentId = pay.id || null;
    const tipoPagamento = mapTipoPagamento(pay.billingType);

    console.log("[ASAAS WH] Evento:", tipo, "| paymentId:", paymentId, "| billingType:", pay.billingType);

    if (tipo === "PAYMENT_CREATED") {
      await amarrarPaymentIdNaSessao(pay);
      return res.sendStatus(200);
    }

    // Pago
    if (PAID_EVENTS.has(tipo)) {
      const activationFeeResolvida = await marcarActivationFeeComoPago(pay);

      if (activationFeeResolvida) {
        return res.sendStatus(200);
      }

      const prepaidResolvido = await marcarPrepaidComoPago(pay);

      if (prepaidResolvido) {
        return res.sendStatus(200);
      }
      const sessionId = await resolverSessionId(pay);
      if (!sessionId) {
        console.warn("[ASAAS WH] Sessão não encontrada para payment:", paymentId);
        return res.sendStatus(200);
      }

      moverJsonParaPendentes(sessionId, paymentId, tipoPagamento);
      await atualizarPgComoPago(sessionId, paymentId, tipoPagamento);
      // [ADD] Split determinístico (afiliado/vendedor/supervisor/plataforma)
// [ADD] Split determinístico (afiliado/vendedor/supervisor/plataforma)
// Política do link: usaremos só para auditoria (A/V/S e quem são as carteiras)
// Política do link (opcional, para auditoria/validação)
const policy = await getPolicyBySession(sessionId);

let splitDone = false;

// 1) Tenta espelhar o split que o Asaas aplicou (nativo)
try {
  const out = await persistSaleAndLedgerFromAsaasSplit(pay, sessionId);
  if (out.mirrored) {
    console.log("💸 [ASAAS WH] split nativo espelhado:", out);
    splitDone = true;
  }
} catch (e) {
  console.error("⚠️ [ASAAS WH] falha ao espelhar split nativo:", e.message || e);
}

// 2) Fallback: cobrança sem split → aplica nossa regra interna (dev/sandbox)
if (!splitDone) {
  try {
    const grossCents = Math.round(Number(pay.value || 0) * 100);
const operationalFeeCents = 299;
const netCents = Math.max(0, grossCents - operationalFeeCents);
const bonusVendorPct = Number(process.env.POLICY_BONUS_VENDOR_PCT || 0);

    // venda DIRETA do vendedor (se você gravou vendor_ref no diagnóstico)
    let vendorId = null;
    try {
      const vq = await pool.query(
        "SELECT vendor_ref FROM diagnosticos WHERE session_id = $1 LIMIT 1",
        [sessionId]
      );
      vendorId = vq.rows[0]?.vendor_ref || null;
    } catch {}

    const splitResult = await applySplit({
      session_id: sessionId,
      amount_cents: grossCents,
      net_amount_cents: netCents,
      gateway: "ASAAS",
      gateway_payment_id: pay.id,
      status: "paid",
      bonus_vendor_pct: bonusVendorPct,
      vendor_id: vendorId || undefined
    });
    console.log("💸 [ASAAS WH] split (fallback) aplicado:", splitResult);
  } catch (e) {
    console.error("⚠️ [ASAAS WH] falha ao aplicar split (fallback):", e.message || e);
  }
}

// 3) Sempre enfileire o relatório (independente do tipo de split)
try {
  await filaRelatorios.add("gerar-relatorio", { session_id: sessionId });
  console.log(`📨 [ASAAS WH] Job enfileirado para sessão ${sessionId}`);
} catch (qErr) {
  console.error("[ASAAS WH] Erro ao enfileirar job:", qErr.message);
}

return res.sendStatus(200);
}
    
    // Estorno / chargeback
    if (tipo === "PAYMENT_REFUNDED" || tipo === "PAYMENT_CHARGEBACK") {
      const sessionId = await resolverSessionId(pay);
      await atualizarPgComoRefunded(sessionId, paymentId);
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("[ASAAS WH] ERRO:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
