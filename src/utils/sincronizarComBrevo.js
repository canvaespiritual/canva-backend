const pool = require("../db");
const atualizarLeadNoBrevo = require("./atualizarLeadNoBrevo");

async function sincronizarComBrevo() {
  console.log("🔍 Buscando leads com pagamento confirmado no banco...");

  const { rows } = await pool.query(`
    SELECT session_id, email, nome
    FROM diagnosticos
    WHERE status_pagamento = 'pago' AND brevo_sincronizado = false
  `);

  console.log(`▶️ Resultados da query: ${rows.length} encontrados`);

  for (const lead of rows) {
    const { session_id, email, nome } = lead;
    console.log(`🔁 Atualizando ${email} (sessão ${session_id}) como PAGO: true`);

    const ok = await atualizarLeadNoBrevo({
      email,
      nome,
      atributos: { QUIZ: true, PAGO: true }
    });

    if (ok) {
      await pool.query(
        `UPDATE diagnosticos SET brevo_sincronizado = true WHERE session_id = $1`,
        [session_id]
      );
      console.log(`✅ Atualizado com sucesso: ${email}`);
    } else {
      console.warn(`❌ Falha ao atualizar: ${email}`);
    }
  }

  console.log("🏁 Sincronização finalizada.");
}

module.exports = sincronizarComBrevo;
