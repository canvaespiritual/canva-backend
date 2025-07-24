const express = require('express');
const path = require('path');
const fs = require('fs');
const enviarEmailViaBrevo = require('../utils/enviarEmailViaBrevo');
const pool = require('../db'); // ajuste se necessário
const router = express.Router();



// POST /confirmar-email/:session_id
router.post('/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;
  const novoEmail = req.body.email;

  if (!novoEmail || !novoEmail.includes('@')) {
    return res.status(400).json({ erro: 'E-mail inválido' });
  }

 // Busca dados da sessão direto no banco
const { rows: [session] } = await pool.query(
  `SELECT id, nome, email, email_corrigido_enviado FROM diagnosticos WHERE session_id = $1`,
  [sessionId]
);

if (!session) {
  return res.status(404).json({ erro: 'Sessão não encontrada no banco de dados.' });
}


// Agora busca o PDF real no banco
const { rows } = await pool.query(
  `SELECT pdf_url FROM diagnosticos WHERE session_id = $1`,
  [sessionId]
);

const pdf_url = rows[0]?.pdf_url;

if (!pdf_url) {
  console.warn(`⚠️ PDF URL ausente no banco para sessão ${sessionId}`);
  return res.status(400).json({ erro: 'PDF ainda não está disponível.' });
}


  if (session.email_corrigido_enviado) {
    return res.status(409).json({ mensagem: 'Este e-mail já recebeu a cópia anteriormente.' });
  }

  await pool.query(
  `UPDATE diagnosticos SET email_corrigido = $1 WHERE session_id = $2`,
  [novoEmail, sessionId]
);


  try {
    // Envia o link por e-mail
   await enviarEmailViaBrevo({
  email: novoEmail,
  nome: session.nome,
  sessionId,
  linkPdf: pdf_url
});



    // Atualiza no banco: diagnosticos
    await pool.query(
      `UPDATE diagnosticos SET email_corrigido = $1 WHERE session_id = $2`,
      [novoEmail, sessionId]
    );
    console.log(`📌 Banco atualizado com novo e-mail para sessão ${sessionId}`);

    // Insere evento na tabela diagnostico_eventos
    const { rows } = await pool.query(
      `SELECT id FROM diagnosticos WHERE session_id = $1`,
      [sessionId]
    );

    const diagnosticoId = rows[0]?.id;
    if (diagnosticoId) {
      await pool.query(
        `INSERT INTO diagnostico_eventos (diagnostico_id, tipo_evento, observacao)
         VALUES ($1, $2, $3)`,
        [diagnosticoId, 'reenvio_email', `Reenviado para: ${novoEmail}`]
      );
      console.log(`📖 Evento registrado para sessão ${sessionId}`);
    } else {
      console.warn(`⚠️ Diagnóstico não encontrado no banco para sessão ${sessionId}`);
    }

    res.json({
  mensagem: '✅ Cópia do relatório enviada com sucesso para o novo e-mail.',
  pdf_url
});


  } catch (error) {
    console.error(`❌ Erro ao reenviar e/ou atualizar banco:`, error.message);
    res.status(500).json({ erro: 'Erro ao processar o novo envio.' });
  }
});

module.exports = router;
