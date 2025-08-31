// src/services/sliptService.js
"use strict";

const pool = require("../db");
const { v4: uuid } = require("uuid");

// util: resto para plataforma
function rest(total, ...parts) {
  const used = parts.reduce((s, v) => s + (Number(v) || 0), 0);
  return Math.max(0, total - used);
}

/**
 * Aplica split e persiste em sales + partner_ledger (idempotente por sale_id).
 */
async function applySplit({
  session_id,
  amount_cents,
  net_amount_cents,
  gateway,
  gateway_payment_id,
  status,
  bonus_vendor_pct = 0,
  vendor_id: vendor_id_param
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const NET = Number.isFinite(net_amount_cents) ? Number(net_amount_cents) : Number(amount_cents);

    // 1) Atribuição por link de afiliado ATIVO
    const att = await client.query(
      `
      SELECT a.affiliate_link_id, al.vendor_id, al.affiliate_id, al.pct_aff
        FROM attribution a
        JOIN affiliate_links al ON al.id = a.affiliate_link_id
       WHERE a.session_id = $1
         AND al.active = TRUE
       LIMIT 1
      `,
      [session_id]
    );

    let origin = "platform";
    let affiliate_id = null;
    let vendor_id = null;
    let affiliate_link_id = null;
    let pct_aff_link = 0;

    if (att.rowCount) {
      affiliate_link_id = att.rows[0].affiliate_link_id;
      vendor_id         = att.rows[0].vendor_id || null;
      affiliate_id      = att.rows[0].affiliate_id || null;
      pct_aff_link      = Number(att.rows[0].pct_aff || 0);
      origin = affiliate_id ? "affiliate" : "direct";
    } else {
        // se o webhook nos passou vendor_id (venda direta do vendedor)
    if (vendor_id_param) {
      vendor_id = String(vendor_id_param);
      origin = "direct";
    } else {
      origin = "affiliate";
    }
   }

    // 2) Supervisor opcional
    let supervisor_id = null;
    if (vendor_id) {
      try {
        const sv = await client.query(
          `SELECT supervisor_id FROM affiliates WHERE id = $1 LIMIT 1`,
          [vendor_id]
        );
        supervisor_id = (sv.rows[0] && sv.rows[0].supervisor_id) ? String(sv.rows[0].supervisor_id) : null;
      } catch (_) { supervisor_id = null; }
    }

    // 3) Regras de percentuais
    const S = supervisor_id ? 5 : 0;
    const B = Number(bonus_vendor_pct || 0);
    const CAP_FS = 60;
    const CAP_TOTAL = CAP_FS + S + B;

    let pct_aff = 0, pct_vendor = 0, pct_super = 0, pct_platform = 0;

    if (origin === "affiliate") {
      const A = Math.max(0, Math.min(60, Number(pct_aff_link)));
      let V = Math.max(0, CAP_FS - A) + B;
      const sum = A + V + S;
      if (sum > CAP_TOTAL) V = Math.max(0, V - (sum - CAP_TOTAL));
      pct_aff = A; pct_vendor = V; pct_super = S;
      pct_platform = rest(100, pct_aff, pct_vendor, pct_super);

    } else if (origin === "direct" && vendor_id) {
      pct_vendor = 30 + B;
      pct_super  = S;
      pct_platform = rest(100, pct_vendor, pct_super);

    } else {
      pct_platform = 100;
    }
    // ajuste para venda "seco" (afiliado direto: sem affiliate_link e sem vendor)
if (origin === "affiliate" && !affiliate_link_id && !vendor_id) {
  pct_aff = 30;   // padrão do afiliado “seco”
  pct_vendor = 0;
  pct_super = 0;
  pct_platform = rest(100, pct_aff, pct_vendor, pct_super); // 70
}
// se for venda "seco" e ainda não temos affiliate_id, tenta diagnosticos
if (!affiliate_id) {
  try {
    const r = await client.query(
      `SELECT affiliate_ref FROM diagnosticos WHERE session_id = $1 LIMIT 1`,
      [session_id]
    );
    if (r.rowCount && r.rows[0].affiliate_ref) {
      affiliate_id = r.rows[0].affiliate_ref;
    }
  } catch (_) {}
}

    // 4) Persistir 'sales' (idempotente por id UUID)
    const saleId = uuid(); // ⚠️ id UUID para compatibilidade com sua tabela sales
    await client.query(
      `
      INSERT INTO sales
        (id, session_id, created_at, gateway, gateway_payment_id, amount, net_amount_cents,
 status, affiliate_id, vendor_id, affiliate_link_id, origin, commission_percent)
VALUES ($1, $2, NOW(), $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        saleId,
        session_id,
        gateway,
        gateway_payment_id,        // fica registrado aqui (não no id)
        amount_cents,
        NET,
        status,
        affiliate_id,
        vendor_id,
        affiliate_link_id,
        origin,
        origin === "affiliate" ? pct_aff : (origin === "direct" ? pct_vendor : 0)
        
      ]
    );

    // 5) Ledger — já nasce PENDING + D+7
    const PLATFORM_ACCOUNT_ID = process.env.PLATFORM_ACCOUNT_ID || 'PLATFORM';
    let supExists = false;
if (supervisor_id) {
  const chk = await client.query('SELECT 1 FROM affiliates WHERE id=$1 LIMIT 1', [supervisor_id]);
  supExists = chk.rowCount > 0;
}
if (!supExists) { pct_platform += pct_super; pct_super = 0; supervisor_id = null; }


    const addLedger = async (role, partnerId, pct) => {
      const cents = Math.round((NET * Number(pct)) / 100);
      if (!cents) return;
      await client.query(
        `
        INSERT INTO partner_ledger
          (sale_id, partner_id, role, amount_cents, pl_status, available_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '7 days', NOW(), NOW())
        ON CONFLICT DO NOTHING
        `,
        [String(saleId), partnerId, role, cents] // sale_id é TEXT na sua tabela
      );
    };

    if (pct_aff > 0 && affiliate_id)    await addLedger("affiliate",  affiliate_id,   pct_aff);
    if (pct_vendor > 0 && vendor_id)     await addLedger("vendor",     vendor_id,      pct_vendor);
    if (pct_super > 0 && supervisor_id)  await addLedger("supervisor", supervisor_id,  pct_super);
    if (pct_platform > 0)                await addLedger("platform",   PLATFORM_ACCOUNT_ID, pct_platform);

    await client.query("COMMIT");
    return { ok: true, sale_id: saleId, origin, pct_aff, pct_vendor, pct_super, pct_platform };
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[applySplit] error:", e);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { applySplit };
