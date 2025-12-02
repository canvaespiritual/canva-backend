const pool = require("../../../src/db");

function calcularMinutosEspera(dataInicial) {
  if (!dataInicial) return null;
  const diff = Date.now() - new Date(dataInicial).getTime();
  return Math.round(diff / 60000);
}

function definirAlerta(row) {
  const { status_processo, data_envio_relatorio, data_pagamento, criado_em } = row;

  const pronto = !!data_envio_relatorio;
  const respondido = !!criado_em;
  const pendente = status_processo === "pendente";
  const travado = pendente && calcularMinutosEspera(data_pagamento) > 30;

  if (travado) return "🛑 Travado: aguardando PDF há +30min";
  if (pronto && respondido && !pendente) return "✅ PDF gerado e e-mail enviado com sucesso";
  if (pronto && !respondido) return "📬 PDF pronto, mas e-mail pode não ter sido enviado";
  if (respondido && !pronto && !pendente) return "⚠️ Respondido, mas ainda não processado";
  if (pendente && !pronto) return "⏳ Processando... aguardando PDF";
  return "🔍 Em transição ou estado incompleto";
}

module.exports = async function getStatusFromDB() {
  const query = `
    SELECT
      session_id,
      nome,
      email,
      tipo_relatorio AS tipo,
      criado_em,
      data_pagamento AS data_confirmacao,
      data_envio_relatorio AS "dataGeracao",
      status_processo,
      data_quiz,
      pdf_url,
      email_enviado_em,
      email_erro,
      email_entregue,
      email_aberto,
      email_clicado,
      telefone
    FROM diagnosticos
    ORDER BY criado_em DESC
  `;

  const { rows } = await pool.query(query);
  const agora = Date.now();

  return rows.map(row => {
    const minutosAguardando = calcularMinutosEspera(row.data_pagamento || row.criado_em);
    const alerta = definirAlerta(row);

    return {
      sessionId: row.session_id,
      nome: row.nome || "—",
      email: row.email || "—",
      tipo: row.tipo || "—",
      criado_em: row.criado_em,
      data_confirmacao: row.data_confirmacao,
      dataGeracao: row.dataGeracao,
      minutosAguardando,
      alerta,
      respondido: !!row.criado_em,
      pronto: !!row.dataGeracao,
      pendente: row.status_processo === "pendente",
      travado: alerta.includes("Travado"),
      pdf_url: row.pdf_url || null,
      email_enviado_em: row.email_enviado_em || null,
      email_erro: row.email_erro || null,
      email_entregue: row.email_entregue || false,
      email_aberto: row.email_aberto || false,
      email_clicado: row.email_clicado || false,
      whatsapp: row.telefone || null

    };
  });
};
