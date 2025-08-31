// src/routes/vendors.js
const express = require("express");
const router = express.Router();
const { v4: uuid } = require("uuid");
const crypto = require("crypto");
const pool = require("../db");
const enviarEmailSimplesViaBrevo = require("../utils/enviarEmailSimplesViaBrevo");
// saldo/saque (usa o partner_ledger)
const {
  refreshAvailability,
  snapshotPayoutMethod,
  lockAvailableForWithdrawTx,
  settleWithdrawalNowTx,
} = require("../services/payoutService");


const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
const QUIZ_PATH  = process.env.PUBLIC_LANDING_PATH || "/quiz.html";

// fetch (Node 18+ tem global.fetch; senão usa node-fetch dinamicamente)
const doFetch = (global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)));

// ------------------------------------------------------
// auth guard (reusa a mesma sessão do /affiliates)
// ------------------------------------------------------
function requireAuth(req, res, next) {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });
  return next();
}

// ------------------------------------------------------
// helper: calcula % do vendedor (CAP força de venda = 60)
// (bônus +5% e supervisor +5% são aplicados NA VENDA, não no link)
// ------------------------------------------------------
function calcVendorPctBase(pctAff) {
  const A = Math.max(0, Math.min(100, Number(pctAff) || 0));
  return Math.max(0, 60 - A); // CAP 60 (afiliado + vendedor)
}

// ------------------------------------------------------
// helper: só PROCURA afiliado por e-mail (NÃO cria)
// ------------------------------------------------------
async function findAffiliateByEmail(email) {
  const e = String(email || "").toLowerCase().trim();
  if (!e) throw new Error("E-mail do afiliado é obrigatório.");
  const q = await pool.query(
    "SELECT id, name, email FROM affiliates WHERE email = $1 LIMIT 1",
    [e]
  );
  return q.rowCount ? q.rows[0] : null;
}

// ------------------------------------------------------
// GET /vendors/links  → lista links do vendedor logado
//   + affiliate_ready: só libera Copiar/QR/Abrir quando subconta+payout ok
//   (agora com LEFT JOIN para exibir convites sem afiliado)
// ------------------------------------------------------
router.get("/links", requireAuth, async (req, res) => {
  try {
    const vendorId = req.session.aff.id;

    const q = await pool.query(
      `
      SELECT
         al.id, al.code, al.url, al.pct_aff, al.pct_vendor, al.pct_supervisor,
       al.clicks, al.sales, al.active, al.status, al.created_at,   
      al.invite_email,
        a.id   AS affiliate_id,
        COALESCE(a.name, '')  AS affiliate_name,
        COALESCE(a.email, '') AS affiliate_email,
        -- sinais PSP do afiliado
        a.asaas_wallet_id, a.asaas_account_id,
        a.payout_method, a.pix_key_value,
        a.bank_number, a.bank_agency, a.bank_account, a.bank_account_digit
      FROM affiliate_links al
      LEFT JOIN affiliates a ON a.id = al.affiliate_id
      WHERE al.vendor_id = $1
      ORDER BY al.created_at DESC
      `,
      [vendorId]
    );

    const items = q.rows.map((r) => {
      const subOk  = !!(r.asaas_wallet_id && r.asaas_account_id);
      const pixOk  = r.payout_method === "pix"  && !!String(r.pix_key_value || "").trim();
      const bankOk = r.payout_method === "bank" && !!r.bank_number && !!r.bank_agency && !!r.bank_account && !!r.bank_account_digit;
      const affiliate_ready = subOk && (pixOk || bankOk);

      return {
        id: r.id,
        code: r.code,
        url: r.url,
        pct_aff: Number(r.pct_aff),
        pct_vendor: Number(r.pct_vendor),
        pct_supervisor: Number(r.pct_supervisor),
        clicks: Number(r.clicks),
        sales: Number(r.sales),
        active: !!r.active,
        status: r.status, 
        created_at: r.created_at,
        affiliate_ready,
         affiliate: {
      id: r.affiliate_id || null,
      name: r.affiliate_name || r.invite_email || r.affiliate_email || "",
      email: r.affiliate_email || r.invite_email || ""
    }
  };
});

    res.json(items);
  } catch (e) {
    console.error("[GET /vendors/links] error:", e);
    res.json([]); // mantém a UI respirando
  }
});

// ------------------------------------------------------
// POST /vendors/links → cria link para afiliado (trava % Afiliado)
// body: { email, pct_affiliate }
//   - CAP força de venda: A + V ≤ 60
//   - Supervisor (5%) e Bônus (5%) aplicam na VENDA (webhook), não aqui
//   - NOVO: não cria afiliado aqui; se não existir, envia e-mail de CADASTRO
// ------------------------------------------------------
router.post("/links", requireAuth, async (req, res) => {
  try {
    const vendorId = req.session.aff.id;

    const emailRaw = String(req.body.email || "");
    const email = emailRaw.toLowerCase().trim();
    const pctA  = Number(req.body.pct_affiliate);

    if (!email) return res.status(400).json({ error: "Informe o e-mail do afiliado." });
    if (!Number.isFinite(pctA) || pctA < 35 || pctA > 50)
      return res.status(400).json({ error: "A % do afiliado deve estar entre 35 e 50." });

    const pctV = calcVendorPctBase(pctA); // CAP 60
    if (pctA + pctV > 60)
      return res.status(400).json({ error: "CAP de 60% (afiliado+vendedor) excedido." });

    const pctS = 5; // supervisor (informativo; aplicado no split final)

    // procura afiliado (NÃO cria)
    const affiliate = await findAffiliateByEmail(email);

    // gera code/url (link de vendas)
    const code = uuid().slice(0, 8).toUpperCase();
    const url  = `${PUBLIC_BASE}${QUIZ_PATH}?aff=${encodeURIComponent(code)}`;
    const token = crypto.randomBytes(24).toString("hex");
    const isActive = false;  // ⬅️ force inativo até a aprovação da subconta
    const status   = affiliate?.id ? 'pending_review' : 'vendors-invite';
    // insere o link (affiliate_id pode ser NULL)
 const ins = await pool.query(`
  INSERT INTO affiliate_links (
    code, url, vendor_id, affiliate_id, pct_aff, pct_vendor, pct_supervisor,
    token, invite_email, status, active, created_at
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,NOW())
  RETURNING id, created_at
`, [
  code, url, vendorId, (affiliate?.id || null), pctA, pctV, pctS,
  token, email,
  (affiliate?.id ? "pending_review" : "vendors-invite"),
  isActive
]);


    // e-mail:
    // - se JÁ existe afiliado → reenvia fluxo de "definir senha" (garante acesso)
    // - se AINDA NÃO existe → envia link de CADASTRO
   if (affiliate?.email) {
  // afiliado já existe → garante acesso
  await doFetch(`${PUBLIC_BASE}/affiliates/password/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: affiliate.email })
  }).catch(()=>{});
} else {
  // afiliado ainda não existe → convite para CADASTRO com token
  const cadastroUrl = `${PUBLIC_BASE}/afiliado/cadastro.html?token=${encodeURIComponent(token)}`;
  await enviarEmailSimplesViaBrevo({
    nome: email.split("@")[0],
    email,
    subject: "Convite para ser afiliado - Canva Espiritual",
    htmlContent: `
      <p>Olá!</p>
      <p>Você foi convidado para ser afiliado. Comissão proposta: <strong>${pctA}%</strong>.</p>
      <p>Complete seu cadastro neste link:</p>
      <p><a href="${cadastroUrl}" target="_blank">Fazer cadastro</a></p>
    `,
    tags: ["affiliate-invite"]
  }).catch(()=>{});
}


    return res.status(201).json({
      id: ins.rows[0].id,
      code,
      url,
      pct_aff: pctA,
      pct_vendor: pctV,
      pct_supervisor: pctS,
      clicks: 0,
      sales: 0,
      active: isActive,                
      status: (affiliate?.id ? "pending_review" : "vendors-invite"), 
      created_at: ins.rows[0].created_at,
      affiliate_ready: false, // recém criado; se não houver afiliado, vai ficar aguardando cadastro/subconta
      affiliate: affiliate ? { id: affiliate.id, name: affiliate.name || email, email } : null
    });
  } catch (e) {
    console.error("[POST /vendors/links] error:", e);
    return res.status(500).json({ error: "Erro ao criar link" });
  }
});

// ------------------------------------------------------
// POST /vendors/links/:id/toggle → pausa/ativa
//   - a atribuição (?aff=CODE) só grava se active=TRUE (middleware no servidor.js)
// ------------------------------------------------------
router.post("/links/:id/toggle", requireAuth, async (req, res) => {
  try {
    const vendorId = req.session.aff.id;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID inválido" });

    const upd = await pool.query(
  `UPDATE affiliate_links
      SET active = NOT active,
          status = CASE WHEN active THEN 'paused' ELSE 'active' END
    WHERE id = $1 AND vendor_id = $2
    RETURNING active, status`,
  [id, vendorId]
);
    if (!upd.rowCount) return res.status(404).json({ error: "Link não encontrado" });

    res.json({ ok: true, active: !!upd.rows[0].active, status: upd.rows[0].status });

  } catch (e) {
    console.error("[POST /vendors/links/:id/toggle] error:", e);
    res.status(500).json({ error: "Erro ao alternar status" });
  }
});

// ------------------------------------------------------
// POST /vendors/links/:id/resend → REENVIAR e-mail de definir senha
//   (funciona para links que já têm affiliate_id)
//   (se ainda não tem afiliado, o botão fica desabilitado no front)
// ------------------------------------------------------
router.post("/links/:id/resend", requireAuth, async (req, res) => {
  try {
    const vendorId = req.session.aff.id;
    const id = req.params.id;

    const q = await pool.query(
      `
      SELECT a.email
      FROM affiliate_links al
      JOIN affiliates a ON a.id = al.affiliate_id
      WHERE al.id = $1 AND al.vendor_id = $2
      LIMIT 1
      `,
      [id, vendorId]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Link não encontrado" });

    const email = q.rows[0].email;

    const resp = await doFetch(`${PUBLIC_BASE}/affiliates/password/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      return res.status(500).json({ error: j.error || "Falha ao reenviar e-mail" });
    }

    res.json({ ok: true, message: "E-mail reenviado." });
  } catch (e) {
    console.error("[POST /vendors/links/:id/resend] error:", e);
    res.status(500).json({ error: "Erro ao reenviar e-mail" });
  }
});

// ------------------------------------------------------
// GET /vendors/me/personal-link  (link pessoal do vendedor)
// ------------------------------------------------------
router.get("/me/personal-link", (req, res) => {
  const me = req.session?.aff;
  if (!me?.id) return res.status(401).json({ error: "Não autenticado" });

  const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  const QUIZ_PATH   = process.env.PUBLIC_LANDING_PATH || "/quiz.html";
  const url = `${PUBLIC_BASE}${QUIZ_PATH}?vend=${encodeURIComponent(me.id)}`;
  res.json({ url });
});

// ------------------------------------------------------
// GET /vendors/sales?type=direct|override&limit=&offset=
//  - direct: vendas do link pessoal (origin='direct')
//  - override: usa partner_ledger (papel 'vendor')
// ------------------------------------------------------
router.get("/sales", requireAuth, async (req, res) => {
  try {
    const vendorId = req.session.aff.id;
    const type = String(req.query.type || "direct").toLowerCase();
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const offset = Math.max(0, parseInt(req.query.offset || "0", 10));

    if (type === "direct") {
     const [list, count] = await Promise.all([
  pool.query(
    `SELECT
        s.created_at,
        s.gateway,
        s.gateway_payment_id,
        s.status,
        s.net_amount_cents,
        30.00::numeric AS pct_vendor      -- link pessoal = 30%
      FROM sales s
     WHERE s.vendor_id = $1
       AND s.origin = 'direct'
       AND s.affiliate_link_id IS NULL    -- garante que não é venda de afiliado
     ORDER BY s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [vendorId, limit, offset]
  ),
  pool.query(
    `SELECT COUNT(*)::int AS total
       FROM sales s
      WHERE s.vendor_id = $1
        AND s.origin = 'direct'
        AND s.affiliate_link_id IS NULL`,
    [vendorId]
  )
]);


      const items = list.rows.map(r => ({
  created_at: r.created_at,
  gateway: r.gateway,
  gateway_payment_id: r.gateway_payment_id,
  amount: Number(r.net_amount_cents || 0) / 100,     // líquido da venda
  status: r.status,
  pct_vendor: Number(r.pct_vendor || 30),            // % do vendedor (30)
  origin: "direct"
}));

      return res.json({ items, total: count.rows?.[0]?.total || 0 });

    } else if (type === "override") {
  const [list, count] = await Promise.all([
    pool.query(
      `SELECT
         s.created_at,
         s.gateway,
         s.gateway_payment_id,
         s.status,
         s.net_amount_cents,
         pl.amount_cents AS vendor_amount_cents,
         ROUND( (pl.amount_cents::numeric / NULLIF(s.net_amount_cents,0)) * 100, 2) AS pct_vendor,
         a.name  AS affiliate_name,
         a.email AS affiliate_email
       FROM partner_ledger pl
       JOIN sales s           ON s.id::text = pl.sale_id
       LEFT JOIN affiliates a ON a.id = s.affiliate_id
      WHERE pl.partner_id = $1
        AND pl.role = 'vendor'
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3`,
      [vendorId, limit, offset]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total
         FROM partner_ledger
        WHERE partner_id = $1 AND role = 'vendor'`,
      [vendorId]
    )
  ]);

  const items = list.rows.map(r => ({
    created_at: r.created_at,
    gateway: r.gateway,
    gateway_payment_id: r.gateway_payment_id,
    amount: Number(r.net_amount_cents || 0) / 100,      // líquido da venda
    status: r.status,
    // entregamos os dois valores prontos:
    pct_vendor: Number(r.pct_vendor || 0),              // % do vendedor
    vendor_amount: Number(r.vendor_amount_cents || 0) / 100,  // R$ do vendedor
    affiliate_name: r.affiliate_name || null,
    affiliate_email: r.affiliate_email || null,
    origin: "override"
  }));

  return res.json({ items, total: count.rows?.[0]?.total || 0 });
}


    return res.status(400).json({ error: "type inválido (direct|override)" });
  } catch (e) {
    console.error("[GET /vendors/sales] error:", e);
    res.status(500).json({ error: "Erro ao listar vendas" });
  }
});

// RESUMO: total da comissão do vendedor (override ou diretas)
router.get("/summary", requireAuth, async (req, res) => {
  const vendorId = req.session.aff.id;
  const type = String(req.query.type || "override").toLowerCase();

  try {
    if (type === "override") {
      // Equipe (override) a partir do ledger (já pago)
      const q = await pool.query(
        `SELECT COALESCE(SUM(pl.amount_cents),0)::bigint AS mine_cents,
                COUNT(*)::int AS qtd
           FROM partner_ledger pl
           JOIN sales s ON s.id::text = pl.sale_id
          WHERE pl.partner_id = $1
            AND pl.role = 'vendor'`,
        [vendorId]
      );
      const r = q.rows[0];
      return res.json({
        mine: Number(r.mine_cents || 0) / 100,
        count: r.qtd || 0
      });
    } else if (type === "direct") {
      // Diretas do link pessoal: 30% do líquido
      const q = await pool.query(
        `SELECT
           COALESCE(SUM(ROUND((s.net_amount_cents::numeric * 30)/100)),0)::bigint AS mine_cents,
           COUNT(*)::int AS qtd
         FROM sales s
        WHERE s.vendor_id = $1
          AND s.origin = 'direct'
          AND s.affiliate_link_id IS NULL`,
        [vendorId]
      );
      const r = q.rows[0];
      return res.json({
        mine: Number(r.mine_cents || 0) / 100,
        count: r.qtd || 0
      });
    }
    return res.status(400).json({ error: "type inválido (override|direct)" });
  } catch (e) {
    console.error("[GET /vendors/summary] error:", e);
    return res.status(500).json({ error: "Falha ao calcular resumo" });
  }
});

// === SALDO DO VENDEDOR (disponível/pendente/D+7) ===
router.get("/balance", requireAuth, async (req, res) => {
  const vendorId = req.session.aff.id;
  try {
    // move 'pending' → 'available' quando já passou D+7
    await refreshAvailability(vendorId, "vendor");

    const q = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN pl_status='pending'     THEN amount_cents END),0)::int  AS pending_cents,
        COALESCE(SUM(CASE WHEN pl_status='available'   THEN amount_cents END),0)::int  AS available_cents,
        COALESCE(SUM(CASE WHEN pl_status='withdrawing' THEN amount_cents END),0)::int  AS withdrawing_cents,
        COALESCE(SUM(CASE WHEN pl_status='paid'        THEN amount_cents END),0)::int  AS paid_cents,
        MIN(CASE WHEN pl_status='pending' THEN available_at END)                       AS next_available_at
      FROM partner_ledger
      WHERE partner_id=$1 AND role='vendor'
    `, [vendorId]);

    const r = q.rows[0] || {};
    res.json({
      pending:      (r.pending_cents      || 0) / 100,
      available:    (r.available_cents    || 0) / 100,
      withdrawing:  (r.withdrawing_cents  || 0) / 100,
      paid:         (r.paid_cents         || 0) / 100,
      next_available_at: r.next_available_at
    });
  } catch (e) {
    console.error("[GET /vendors/balance]", e);
    res.status(500).json({ error: "Falha ao consultar saldo." });
  }
});

// === SOLICITAR SAQUE DO VENDEDOR (saca TUDO available) ===
router.post("/withdraw", requireAuth, async (req, res) => {
  const vendorId = req.session.aff.id;
  const client = await pool.connect();
  try {
    await refreshAvailability(vendorId, "vendor");

    // snapshot do método do vendedor (Pix/Conta)
    const method = await snapshotPayoutMethod(vendorId);

    await client.query("BEGIN");
    const withdrawalId = uuid();

    // move available → withdrawing
    const lockedCents = await lockAvailableForWithdrawTx(client, vendorId, "vendor", withdrawalId);
    if (!lockedCents) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nenhum valor disponível para saque." });
    }

    await client.query(`
      INSERT INTO withdrawals (id, partner_id, role, amount_cents, method, status)
      VALUES ($1,$2,'vendor',$3,$4::jsonb,'requested')
    `, [withdrawalId, vendorId, lockedCents, JSON.stringify(method)]);

    // sandbox: liquida na hora
    await settleWithdrawalNowTx(client, withdrawalId);

    await client.query("COMMIT");
    res.json({ ok: true, withdrawal_id: withdrawalId, amount: lockedCents / 100, status: "paid" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[POST /vendors/withdraw]", e);
    res.status(500).json({ error: "Falha ao solicitar saque." });
  } finally {
    client.release();
  }
});

// === HISTÓRICO DE SAQUES DO VENDEDOR ===
router.get("/withdrawals", requireAuth, async (req, res) => {
  const vendorId = req.session.aff.id;
  try {
    const { rows } = await pool.query(`
      SELECT id, amount_cents, status, created_at, updated_at
        FROM withdrawals
       WHERE partner_id=$1 AND role='vendor'
       ORDER BY created_at DESC
       LIMIT 50
    `, [vendorId]);

    res.json(rows.map(r => ({
      id: r.id,
      amount: Number(r.amount_cents || 0) / 100,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at
    })));
  } catch (e) {
    console.error("[GET /vendors/withdrawals]", e);
    res.status(500).json({ error: "Falha ao consultar saques." });
  }
});

module.exports = router;
