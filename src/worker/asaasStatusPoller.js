// src/workers/asaasStatusPoller.js
/**
 * Poller simples para atualizar status de subcontas (KYC/bancário).
 * Rode manualmente: node src/workers/asaasStatusPoller.js
 */
require("dotenv").config();
const pool = require("../db");
const { getSubaccountStatus } = require("../services/asaasSubaccountService");

async function runOnce(limit = 50) {
  const { rows } = await pool.query(`
    SELECT id, name, email, asaas_api_key, asaas_status_general, asaas_status_bank, link_enabled
      FROM affiliates
     WHERE asaas_api_key IS NOT NULL
       AND (asaas_status_general IS NULL OR asaas_status_general <> 'APPROVED'
         OR asaas_status_bank IS NULL OR asaas_status_bank <> 'APPROVED'
         OR link_enabled = false)
     ORDER BY updated_at ASC
     LIMIT $1
  `, [limit]);

  if (!rows.length) {
    console.log("Nada para atualizar.");
    return;
  }

  for (const a of rows) {
    try {
      const { general, bank } = await getSubaccountStatus(a.asaas_api_key);

      // habilita link quando ambos aprovados
      const enable = (general === "APPROVED" && bank === "APPROVED");

      await pool.query(
        `UPDATE affiliates
            SET asaas_status_general = $1,
                asaas_status_bank    = $2,
                link_enabled         = CASE WHEN $3 THEN true ELSE link_enabled END,
                updated_at           = NOW()
          WHERE id = $4`,
        [general, bank, enable, a.id]
      );

      console.log(`[OK] ${a.email} -> general=${general} bank=${bank} link_enabled=${enable || a.link_enabled}`);
    } catch (err) {
      console.error(`[ERRO] ${a.email}`, err.message || err);
    }
  }
}

async function main() {
  try {
    await runOnce();
  } catch (e) {
    console.error("Poller falhou:", e);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  main();
}

module.exports = { runOnce };
