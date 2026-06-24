// src/routes/pagamentoStart.js
const express = require("express");
const axios = require("axios");
const pool = require("../db");

const router = express.Router();

// 🔧 ENV: ASAAS_ENV=sandbox|production, ASAAS_API_KEY, APP_URL (pode vir sem https)
const ASAAS_ENV =
  String(process.env.ASAAS_ENV || "sandbox")
    .trim()
    .toLowerCase();

const IS_PROD = ASAAS_ENV === "production";

const ASAAS_BASE = IS_PROD
  ? "https://api.asaas.com/v3"
  : "https://api-sandbox.asaas.com/v3";

const ASAAS_CHECKOUT_VIEW = IS_PROD
  ? "https://asaas.com/checkoutSession/show?id="
  : "https://sandbox.asaas.com/checkoutSession/show?id=";

const asaas = axios.create({
  baseURL: ASAAS_BASE,
  headers: {
    "Content-Type": "application/json",
    "access_token": process.env.ASAAS_API_KEY || "",
  },
});
console.log("[PAGAMENTO START ASAAS LOADED]", {
  ASAAS_ENV,
  ASAAS_BASE,
  ASAAS_CHECKOUT_VIEW,
  rootKeyPrefix: String(process.env.ASAAS_API_KEY || "").slice(0, 20),
  hasKey: !!process.env.ASAAS_API_KEY,
});
// ===== Helpers =====
function normalizeTipo(tipo) {
  const t = String(tipo || "").toLowerCase();
  // canônicos internos: basico, premium, completo
  if (t === "intermediario" || t === "premium") return "premium";
  if (t === "completo" || t === "interdimensional") return "completo"; // "interdimensional" é só nome comercial do completo
  return "basico"; // "basico" ou "essencial" cai aqui
}

function mapPreco(tipo) {
  switch (normalizeTipo(tipo)) {
    case "basico":   return 12;
    case "premium":  return 21;
    case "completo": return 40;
    default:         return 12;
  }
}

function mapTipoRelatorio(tipo) {
  const t = normalizeTipo(tipo);
  if (t === "premium")  return "premium";
  if (t === "completo") return "completo";
  return "essencial";
}

const VALOR_MINIMO = 12;
const VALOR_MAXIMO = 500;

function clampValor(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, VALOR_MINIMO), VALOR_MAXIMO);
}

const clampPct = (n) => Math.max(0, Math.min(100, Number.isFinite(+n) ? +n : 30));

function money2(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

function baseComissionavel(valorFinal) {
  // cliente paga 14,99; comissões calculam sobre 12,00
  return money2(Math.max(0, Number(valorFinal || 0) - 2.99));
}

function splitFixo(walletId, pct, base) {
  const value = money2((Number(base || 0) * Number(pct || 0)) / 100);
  if (!walletId || value <= 0) return null;
  return { walletId, fixedValue: value };
}
function normalizeAsaasEnv(v) {
  const env = String(v || "").trim().toLowerCase();
  if (env === "prod") return "production";
  if (env === "hmlg" || env === "homolog" || env === "homologacao") return "sandbox";
  return env;
}

function inferAsaasEnvFromApiKeyPrefix(prefix) {
  const p = String(prefix || "");
  if (p.startsWith("$aact_prod_")) return "production";
  if (p.startsWith("$aact_hmlg_")) return "sandbox";
  return "";
}

function resolveWalletEnv(row, envField, keyField) {
  return normalizeAsaasEnv(row?.[envField]) ||
    inferAsaasEnvFromApiKeyPrefix(row?.[keyField]);
}

function assertWalletEnv({ label, walletId, walletEnv, ownerId }) {
  if (!walletId) return;

  const env = normalizeAsaasEnv(walletEnv);

  if (!env) {
    const err = new Error(`Ambiente Asaas não definido para ${label}.`);
    err.statusCode = 409;
    err.code = "ASAAS_ENV_MISSING";
    err.details = { label, ownerId, walletId, currentEnv: ASAAS_ENV };
    throw err;
  }

  if (env !== ASAAS_ENV) {
    const err = new Error(
      `Conta de comissão ${label} pertence a ${env}, mas o checkout atual está em ${ASAAS_ENV}.`
    );
    err.statusCode = 409;
    err.code = "ASAAS_ENV_MISMATCH";
    err.details = { label, ownerId, walletId, walletEnv: env, currentEnv: ASAAS_ENV };
    throw err;
  }
}

function normalizeHttpsBase(u) {
  let s = String(u || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  s = s.replace(/^http:\/\//i, "https://");
  return s.replace(/\/+$/,"");
}
async function buildSplitsForSession(sessionId, baseSplit) {
  if (!sessionId) return [];

  // 1) Link de vendedor (attribution -> affiliate_links)
    const q = await pool.query(`
    SELECT
  al.pct_aff,
  al.pct_vendor,
  al.pct_supervisor,
  al.affiliate_id,
  al.vendor_id,
  v.supervisor_id,
  a.asaas_wallet_id AS aff_wallet,
  a.asaas_env AS aff_env,
  LEFT(a.asaas_api_key, 20) AS aff_key_prefix,
  v.asaas_wallet_id AS vend_wallet,
  v.asaas_env AS vend_env,
  LEFT(v.asaas_api_key, 20) AS vend_key_prefix,
  s.asaas_wallet_id AS sup_wallet,
  s.asaas_env AS sup_env,
  LEFT(s.asaas_api_key, 20) AS sup_key_prefix
  FROM attribution at
  JOIN affiliate_links al ON al.id = at.affiliate_link_id
  LEFT JOIN affiliates a ON a.id = al.affiliate_id
  LEFT JOIN affiliates v ON v.id = al.vendor_id
  LEFT JOIN affiliates s ON s.id = v.supervisor_id
 WHERE at.session_id = $1 AND al.active = TRUE
 LIMIT 1

  `, [sessionId]);

  if (q.rowCount) {
  const r = q.rows[0];

  const A = clampPct(r.pct_aff || 0);
  const V = clampPct(r.pct_vendor || 0);
  const S = clampPct(r.pct_supervisor || 0);

  const affEnv = resolveWalletEnv(r, "aff_env", "aff_key_prefix");
  const vendEnv = resolveWalletEnv(r, "vend_env", "vend_key_prefix");
  const supEnv = resolveWalletEnv(r, "sup_env", "sup_key_prefix");

  if (A > 0 && r.aff_wallet) {
    assertWalletEnv({
      label: "afiliado",
      walletId: r.aff_wallet,
      walletEnv: affEnv,
      ownerId: r.affiliate_id,
    });
  }

  if (V > 0 && r.vend_wallet) {
    assertWalletEnv({
      label: "vendedor",
      walletId: r.vend_wallet,
      walletEnv: vendEnv,
      ownerId: r.vendor_id,
    });
  }

  if (S > 0 && r.sup_wallet) {
    assertWalletEnv({
      label: "supervisor",
      walletId: r.sup_wallet,
      walletEnv: supEnv,
      ownerId: r.supervisor_id,
    });
  }

  console.log("[/pagamento/start] ASAAS ENV CHECK link", {
    ASAAS_ENV,
    affiliate_id: r.affiliate_id,
    aff_wallet: r.aff_wallet,
    aff_env: affEnv,
    vendor_id: r.vendor_id,
    vend_wallet: r.vend_wallet,
    vend_env: vendEnv,
    supervisor_id: r.supervisor_id,
    sup_wallet: r.sup_wallet,
    sup_env: supEnv,
  });

  const splits = [];

  if (A > 0 && r.aff_wallet) {
    const sp = splitFixo(r.aff_wallet, A, baseSplit);
    if (sp) splits.push(sp);
  }

  if (V > 0 && r.vend_wallet) {
    const sp = splitFixo(r.vend_wallet, V, baseSplit);
    if (sp) splits.push(sp);
  }

  return splits;
}

  // 2) Direta do vendedor (se você um dia gravar vendor_ref em diagnosticos)
// (hoje sua tabela não tem vendor_ref; tratamos com try/catch para não quebrar)
let vend = null;
try {
    const vq = await pool.query(
    `SELECT affiliate_ref FROM diagnosticos WHERE session_id = $1 LIMIT 1`,
    [sessionId]
  );

  const maybeVend = vq.rows[0]?.affiliate_ref || null;

  if (maybeVend) {
    const checkVendor = await pool.query(
      `SELECT id FROM affiliates WHERE id = $1 AND role IN ('vendor','supervisor') LIMIT 1`,
      [maybeVend]
    );

    vend = checkVendor.rowCount ? maybeVend : null;
  }
} catch (_) {
  vend = null;
}

if (vend) {
  const vw = await pool.query(`
    SELECT
  v.asaas_wallet_id AS vend_wallet,
  v.asaas_env AS vend_env,
  LEFT(v.asaas_api_key, 20) AS vend_key_prefix,
  s.asaas_wallet_id AS sup_wallet,
  s.asaas_env AS sup_env,
  LEFT(s.asaas_api_key, 20) AS sup_key_prefix,
  v.supervisor_id
      FROM affiliates v
      LEFT JOIN affiliates s ON s.id = v.supervisor_id
     WHERE v.id = $1
     LIMIT 1
  `, [vend]);

  if (vw.rowCount) {
  const rr = vw.rows[0];

  const vendEnv = resolveWalletEnv(rr, "vend_env", "vend_key_prefix");

  if (rr.vend_wallet) {
    assertWalletEnv({
      label: "vendedor",
      walletId: rr.vend_wallet,
      walletEnv: vendEnv,
      ownerId: vend,
    });
  }

  const splits = [];
  const sp = splitFixo(rr.vend_wallet, 70, baseSplit);
  if (sp) splits.push(sp);

  return splits;
}
}


  // 3) Sem split → cai tudo na wallet raiz
  return [];
}

// ===== Rota principal =====
// POST /pagamento/start  { tipo, session_id, ref? }
router.post("/start", async (req, res) => {
  try {
    let { tipo, session_id, ref, vend, valor, strictAsaas } = req.body || {};

      tipo = normalizeTipo(tipo);

      const valorFinal = clampValor(
        valor,
        mapPreco(tipo)
      );
      const baseSplit = baseComissionavel(valorFinal);
    console.log("[/pagamento/start] INICIO", { tipo, session_id, ref });

    if (!tipo || !session_id) {
      return res.status(400).json({ error: "tipo e session_id são obrigatórios" });
    }

    // 1) Carrega sessão
    const { rows } = await pool.query(
      `SELECT session_id, nome, email, affiliate_ref, status_pagamento
         FROM diagnosticos
        WHERE session_id = $1
        LIMIT 1`,
      [session_id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Sessão não encontrada." });
    }
    const diag = rows[0];

    // Já pago?
    if (String(diag.status_pagamento || "").toLowerCase() === "pago") {
      return res.json({
        alreadyPaid: true,
        redirect: `/aguarde.html?session_id=${encodeURIComponent(session_id)}`
      });
    }

    // 2) Descobrir affiliate_ref
    const vendorRef =
  vend ||
  req.body?.vendor_ref ||
  req.query?.vend ||
  req.session?.vendor_ref ||
  null;

let affiliateRef =
  diag.affiliate_ref ||
  req.cookies?.aff_ref ||
  req.session?.aff_ref ||
  req.body?.affiliate_ref ||
  req.query?.aff ||
  req.query?.ref ||
  ref ||
  vendorRef ||
  null;

    if (affiliateRef && affiliateRef !== diag.affiliate_ref) {
      try {
        await pool.query(
          `UPDATE diagnosticos
              SET affiliate_ref = $1, updated_at = NOW()
            WHERE session_id = $2`,
          [affiliateRef, session_id]
        );
      } catch {}
    }
    console.log("[/pagamento/start] affiliateRef:", affiliateRef ? String(affiliateRef) : "(none)");
    // TENTATIVA DE AMARRAR A SESSÃO PELO CÓDIGO DO LINK (ex.: EC85CC09)
try {
  const maybeCode = (affiliateRef || "").trim();
  if (/^[A-Za-z0-9]{6,12}$/.test(maybeCode)) { // aceita seu padrão de code (8 chars etc.)
    const lk = await pool.query(
      `SELECT id FROM affiliate_links WHERE code = $1 AND active = TRUE LIMIT 1`,
      [maybeCode]
    );
    if (lk.rowCount) {
      const linkId = lk.rows[0].id;
      // upsert attribution desta sessão -> link_id
      await pool.query(`
        INSERT INTO attribution (session_id, affiliate_link_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (session_id) DO UPDATE SET affiliate_link_id = EXCLUDED.affiliate_link_id
      `, [session_id, linkId]);
      console.log("[/pagamento/start] attribution vinculada pelo code:", maybeCode);
    }
  }
} catch (bindErr) {
  console.warn("[/pagamento/start] falha ao vincular attribution por code:", bindErr.message);
}

    // 2.1 — SE houver attribution para esta sessão (link de vendedor), monta splits pelo link
const sessionId = session_id; // usamos a mesma session gravada
const linkSplits = await buildSplitsForSession(sessionId, baseSplit);
if (linkSplits.length) {
  if (!process.env.ASAAS_API_KEY) {
    console.warn("[/pagamento/start] ASAAS_API_KEY ausente → fallback MP");
    return useMP({ res, tipo, session_id });
  }

  const callbackBase = normalizeHttpsBase(
    process.env.APP_URL ||
    process.env.CALLBACK_BASE_URL ||
    process.env.PUBLIC_BASE_URL ||
    "https://api.canvaspiritual.com"
  );

  const successUrl = `${callbackBase}/aguarde.html?session_id=${encodeURIComponent(sessionId)}`;
  const cancelUrl  = `${callbackBase}/pagar.html?session_id=${encodeURIComponent(sessionId)}`;
  const expiredUrl = `${callbackBase}/pagar.html?session_id=${encodeURIComponent(sessionId)}&exp=1`;

  const payloadCheckout = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes:  ["DETACHED"],
    minutesToExpire: 90,
    callback: { successUrl, cancelUrl, expiredUrl },
    items: [{
      name: `Diagnostico ${tipo}`,
      description: `Diagnóstico ${tipo} - ${sessionId}`,
      value: valorFinal,
      quantity: 1
    }],
    externalReference: sessionId,
    splits: linkSplits
  };

  try {
    const created = await asaas.post("/checkouts", payloadCheckout);
    const checkoutId = created?.data?.id;
    if (!checkoutId) throw new Error("Checkout criado sem ID.");

    try {
      await pool.query(
        `UPDATE diagnosticos
            SET gateway = 'asaas',
                tipo_relatorio = $1,
                asaas_checkout_id = $2,
                updated_at = NOW()
          WHERE session_id = $3`,
        [mapTipoRelatorio(tipo), checkoutId, sessionId]
      );
    } catch (e) {
      console.warn("[/pagamento/start] coluna asaas_checkout_id ausente? rode a migração abaixo.");
      await pool.query(
        `UPDATE diagnosticos
            SET gateway = 'asaas',
                tipo_relatorio = $1,
                updated_at = NOW()
          WHERE session_id = $2`,
        [mapTipoRelatorio(tipo), sessionId]
      );
    }

    return res.json({
      gateway: "asaas",
      checkout_url: `${ASAAS_CHECKOUT_VIEW}${encodeURIComponent(checkoutId)}`
    });
  } catch (e) {
  console.error("[/pagamento/start] /checkouts (link split) falhou:", e?.response?.data || e.message);

  if (e.code === "ASAAS_ENV_MISMATCH" || e.code === "ASAAS_ENV_MISSING") {
    return res.status(e.statusCode || 409).json({
      error: e.message,
      code: e.code,
      detalhe: e.details || null,
    });
  }

  return useMP({ res, tipo, session_id });
}
}

    // ===== Decisão =====
    if (affiliateRef) {
      if (!process.env.ASAAS_API_KEY) {
        console.warn("[/pagamento/start] ASAAS_API_KEY ausente → fallback MP");
        return useMP({ res, tipo, session_id });
      }

      // 3) Carrega afiliado por ID (UUID vindo no ?ref=)
      const { rows: affRows } = await pool.query(
        `SELECT * FROM affiliates WHERE id::text = $1 LIMIT 1`,
        [affiliateRef]
      );
      const aff = affRows[0] || {};

      console.log("[/pagamento/start] afiliado:", {
        id: affiliateRef,
        link_enabled: aff?.link_enabled,
        status: aff?.status || aff?.asaas_status,
        terms: aff?.terms
      });

      // Campos necessários pro split
      const walletId = aff.asaas_wallet_id || aff.wallet_id || null;
      const walletEnv =
  normalizeAsaasEnv(aff.asaas_env) ||
  inferAsaasEnvFromApiKeyPrefix(String(aff.asaas_api_key || "").slice(0, 20));

if (walletId) {
  assertWalletEnv({
    label: "afiliado",
    walletId,
    walletEnv,
    ownerId: affiliateRef,
  });
}

console.log("[/pagamento/start] ASAAS ENV CHECK afiliado direto", {
  ASAAS_ENV,
  affiliateRef,
  walletId,
  walletEnv,
});
      const cTypeRaw = String(aff.commission_type || "PERCENT").toUpperCase();
      const pctRaw   = Number(aff.commission_percent ?? 30);
      const fixRaw   = Number(aff.commission_value   ?? 0);

      let splits = [];
      let reasons = [];
      if (!walletId) reasons.push("walletId_ausente");

      if (cTypeRaw === "FIXED") {
        if (fixRaw > 0) {
          splits.push({ walletId, fixedValue: fixRaw });
        } else {
          reasons.push("commission_value<=0");
        }
      } else {
        const pct = clampPct(pctRaw);
        if (pct > 0) {
          // 💡 /checkouts espera percentageValue (inglês), não 'percentualValue'
          const sp = splitFixo(walletId, pct, baseSplit);
if (sp) splits.push(sp);
        } else if (fixRaw > 0) {
          splits.push({ walletId, fixedValue: fixRaw });
          reasons.push("usando_fixed_por_percent_zero");
        } else {
          reasons.push("commission_percent<=0");
        }
      }

      if (!splits.length) {
        console.warn(`[/pagamento/start] Split inválido p/ afiliado ${affiliateRef} → fallback MP | motivos: ${reasons.join(",")}`);
        return useMP({ res, tipo, session_id });
      }

      console.log("[/pagamento/start] DECISÃO: ASAAS Checkout com Split", splits);

      // 4) Checkout (split, sem boleto, callback HTTPS) — SEM customerData
      const callbackBase = normalizeHttpsBase(
        process.env.APP_URL ||
        process.env.CALLBACK_BASE_URL ||
        process.env.PUBLIC_BASE_URL ||
        "https://api.canvaspiritual.com"
      );

      const successUrl = `${callbackBase}/aguarde.html?session_id=${encodeURIComponent(session_id)}`;
      const cancelUrl  = `${callbackBase}/pagar.html?session_id=${encodeURIComponent(session_id)}`;
      const expiredUrl = `${callbackBase}/pagar.html?session_id=${encodeURIComponent(session_id)}&exp=1`;

      console.log("[/pagamento/start] callback URLs:", { successUrl, cancelUrl, expiredUrl });

      const payloadCheckout = {
        billingTypes: ["PIX", "CREDIT_CARD"], // sem boleto
        chargeTypes:  ["DETACHED"],
        minutesToExpire: 90,
        callback: { successUrl, cancelUrl, expiredUrl }, // obrigatório
        items: [{
          name: `Diagnostico ${tipo}`,                          // sem acento
          description: `Diagnóstico ${tipo} - ${session_id}`,   // ok com acento
          value: valorFinal,
          quantity: 1
        }],
        externalReference: session_id,
        splits
        // 🔕 SEM customerData: a página do Asaas coleta os dados do comprador
      };

      try {
       const created = await asaas.post("/checkouts", payloadCheckout);
const checkoutId = created?.data?.id;
if (!checkoutId) throw new Error("Checkout criado sem ID.");

try {
  await pool.query(
    `UPDATE diagnosticos
        SET gateway = 'asaas',
            tipo_relatorio = $1,
            asaas_checkout_id = $2,
            updated_at = NOW()
      WHERE session_id = $3`,
    [mapTipoRelatorio(tipo), checkoutId, session_id]
  );
} catch (e) {
  console.warn("[/pagamento/start] coluna asaas_checkout_id ausente? rode a migração abaixo.");
  await pool.query(
    `UPDATE diagnosticos
        SET gateway = 'asaas',
            tipo_relatorio = $1,
            updated_at = NOW()
      WHERE session_id = $2`,
    [mapTipoRelatorio(tipo), session_id]
  );
}


        return res.json({
          gateway: "asaas",
          checkout_url: `${ASAAS_CHECKOUT_VIEW}${encodeURIComponent(checkoutId)}`
        });
      } catch (e) {
  console.error("[/pagamento/start] /checkouts falhou:", e?.response?.data || e.message);

  if (e.code === "ASAAS_ENV_MISMATCH" || e.code === "ASAAS_ENV_MISSING") {
    return res.status(e.statusCode || 409).json({
      error: e.message,
      code: e.code,
      detalhe: e.details || null,
    });
  }

  return useMP({ res, tipo, session_id });
}
    }

    // SEM afiliado => Mercado Pago
    return useMP({ res, tipo, session_id });

  } catch (err) {
    console.error("[/pagamento/start] erro:", err?.response?.data || err.message);
    if (err.code === "ASAAS_ENV_MISMATCH" || err.code === "ASAAS_ENV_MISSING") {
  return res.status(err.statusCode || 409).json({
    error: err.message,
    code: err.code,
    detalhe: err.details || null,
  });
}

return res.status(500).json({ error: "Falha ao iniciar pagamento." });
  }
});

// ===== Fallback MP =====
async function useMP({ res, tipo, session_id }) {
  console.log("[/pagamento/start] DECISÃO: Mercado Pago para", session_id);
  try {
    await pool.query(
      `UPDATE diagnosticos
          SET gateway = 'mp',
              tipo_relatorio = $1,
              updated_at = NOW()
        WHERE session_id = $2`,
      [mapTipoRelatorio(tipo), session_id]
    );
  } catch {}
  return res.json({ gateway: "mp" });
}

module.exports = router;
