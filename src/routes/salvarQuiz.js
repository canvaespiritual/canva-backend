const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../db"); // ajuste o caminho conforme sua estrutura

const router = express.Router();
const cadastrarLeadNoBrevo = require("../utils/cadastrarLeadNoBrevo");
const enviarEmailSimplesViaBrevo = require("../utils/enviarEmailSimplesViaBrevo");


// Função para calcular média
function calcularMedia(respostas) {
  const soma = respostas.reduce((acc, val) => acc + val, 0);
  return parseFloat((soma / respostas.length).toFixed(2));
}

// Função para definir zona
function definirZona(respostas) {
  const media = calcularMedia(respostas);
  if (media >= 9) return "virtude";
  if (media >= 5) return "transição";
  return "degradação";
}

router.post("/", async (req, res) => {
  try {
    const dados = req.body;
    // 🌍 Detecta idioma pela URL de origem (referer) ou pelo body
let idioma = 'pt'; // padrão seguro
try {
  const ref = req.get('referer') || ''; // URL de onde veio o POST
  if (ref.includes('/en/')) idioma = 'en';
  else if (ref.includes('/es/')) idioma = 'es';
  else if (ref.includes('/fr/')) idioma = 'fr';
  else if (ref.includes('/it/')) idioma = 'it';
  else if (dados.lang) idioma = dados.lang; // fallback se vier explícito no body
} catch (e) {
  idioma = 'pt';
}

// normalização simples (opcional, se já vem pronto do front pode manter)
let telefone = dados.telefone || null;
if (telefone) {
  telefone = String(telefone).replace(/\D/g, '');
  if (telefone && !telefone.startsWith('55')) telefone = '55' + telefone;
}

    // 🔽 ADD: captura a referência do afiliado da sessão/cookie
  // 🔽 Captura a referência do afiliado (várias fontes)
const vendorRef =
  req.body?.vendor_ref ||
  req.query?.vend ||
  req.session?.vendor_ref ||
  null;

const affiliateRef =
  req.session?.aff_ref ||
  req.cookies?.aff_ref ||
  req.body?.affiliate_ref ||
  req.query?.aff ||
  req.query?.ref ||
  vendorRef ||
  null;


    if (!dados.session_id || !dados.nome || !dados.email || !dados.respostas) {
      return res.status(400).send("Dados incompletos.");
    }

    const arquivo = `${dados.session_id}.json`;
    const caminho = path.join(__dirname, "../../temp/respondidos", arquivo);

    const codigosPorPergunta = [
      ["PC01", "PC02", "PC03", "PC04", "PC05", "PC06", "PC07", "PC08", "PC09", "PC10", "PC11", "PC12"],
      ["AL01", "AL02", "AL03", "AL04", "AL05", "AL06", "AL07", "AL08", "AL09", "AL10", "AL11", "AL12"],
      ["PA01", "PA02", "PA03", "PA04", "PA05", "PA06", "PA07", "PA08", "PA09", "PA10", "PA11", "PA12"],
      ["CA01", "CA02", "CA03", "CA04", "CA05", "CA06", "CA07", "CA08", "CA09", "CA10", "CA11", "CA12"],
      ["CO01", "CO02", "CO03", "CO04", "CO05", "CO06", "CO07", "CO08", "CO09", "CO10", "CO11", "CO12"],
      ["MA01", "MA02", "MA03", "MA04", "MA05", "MA06", "MA07", "MA08", "MA09", "MA10", "MA11", "MA12"],
      ["MO01", "MO02", "MO03", "MO04", "MO05", "MO06", "MO07", "MO08", "MO09", "MO10", "MO11", "MO12"],
      ["FI01", "FI02", "FI03", "FI04", "FI05", "FI06", "FI07", "FI08", "FI09", "FI10", "FI11", "FI12"],
      ["AM01", "AM02", "AM03", "AM04", "AM05", "AM06", "AM07", "AM08", "AM09", "AM10", "AM11", "AM12"],
      ["BE01", "BE02", "BE03", "BE04", "BE05", "BE06", "BE07", "BE08", "BE09", "BE10", "BE11", "BE12"],
      ["BO01", "BO02", "BO03", "BO04", "BO05", "BO06", "BO07", "BO08", "BO09", "BO10", "BO11", "BO12"],
      ["LO01", "LO02", "LO03", "LO04", "LO05", "LO06", "LO07", "LO08", "LO09", "LO10", "LO11", "LO12"]
    ];

    const respostasCodificadas = dados.respostas.map((valor, index) => {
      return codigosPorPergunta[index][valor - 1];
    });

    let R = 0, Y = 0, B = 0;
    for (const nota of dados.respostas) {
      if (nota >= 8) R++;
      else if (nota >= 5) Y++;
      else B++;
    }
    const codigoArquetipo = `R${R}Y${Y}B${B}`;
    const media = calcularMedia(dados.respostas);
    const zona = definirZona(dados.respostas);

    const dadosCompletos = {
      session_id: dados.session_id,
      nome: dados.nome,
      email: dados.email,
      telefone: telefone || null,  
      respostas: dados.respostas,
      respostas_codificadas: respostasCodificadas,
      media_vibracional: media,
      zona_predominante: zona,
      codigo_arquetipo: codigoArquetipo,
      tipoRelatorio: null,
      payment_id: null,
      status_pagamento: "pendente",
      criado_em: new Date().toISOString(),
      affiliate_ref: affiliateRef

    };
    
    // Gravação no PostgreSQL
    try {
    await pool.query(`
  INSERT INTO diagnosticos (
    session_id, nome, email, telefone,
    respostas_numericas, respostas_codificadas,
    status_pagamento, status_processo, criado_em,
    media_vibracional, zona_predominante, codigo_arquetipo, affiliate_ref, idioma
  ) VALUES (
    $1, $2, $3, $4,
    $5, $6,
    $7, $8, $9,
    $10, $11, $12, $13, $14
  )
  ON CONFLICT (session_id) DO UPDATE SET
    nome                 = EXCLUDED.nome,
    email                = EXCLUDED.email,
    telefone             = COALESCE(EXCLUDED.telefone, diagnosticos.telefone),
    respostas_numericas  = EXCLUDED.respostas_numericas,
    respostas_codificadas= EXCLUDED.respostas_codificadas,
    media_vibracional    = EXCLUDED.media_vibracional,
    zona_predominante    = EXCLUDED.zona_predominante,
    codigo_arquetipo     = EXCLUDED.codigo_arquetipo,
    affiliate_ref        = COALESCE(EXCLUDED.affiliate_ref, diagnosticos.affiliate_ref),
    idioma               = COALESCE(EXCLUDED.idioma, diagnosticos.idioma),
    updated_at           = NOW();
`, [
  dadosCompletos.session_id,
  dadosCompletos.nome,
  dadosCompletos.email,
  dadosCompletos.telefone,                 // $4
  JSON.stringify(dadosCompletos.respostas),           // $5
  JSON.stringify(dadosCompletos.respostas_codificadas), // $6
  "pendente",                               // $7
  "iniciado",                               // $8
  new Date(),                               // $9
  media,                                    // $10
  zona,                                     // $11
  codigoArquetipo,                          // $12
  affiliateRef,                             // $13
  idioma                                    // $14 ✅ novo
]);


       console.log(`📥 Diagnóstico ${dadosCompletos.session_id} registrado no PostgreSQL.`);
} catch (erroPg) {
  console.error("❌ Falha ao gravar no PostgreSQL:", erroPg);
  return res.status(500).send("Erro ao salvar no banco de dados.");
}

// (fora do try do DB) — falhas aqui não devem travar sua sessão
try {
  await cadastrarLeadNoBrevo({
  email: dadosCompletos.email,
  nome: dadosCompletos.nome,
  idioma, // vem da detecção do referer
  atributos: { QUIZ: true }
});

} catch (e) {
  console.warn("⚠️ Não foi possível cadastrar no Brevo agora:", e.message || e);
}

        // Só grava o JSON após sucesso no banco
    await fs.promises.writeFile(
      caminho,
      JSON.stringify(dadosCompletos, null, 2),
      "utf8"
    );

    // ---------------------------
    // ✉️ E-mail pós-quiz (remarketing leve)
    // ---------------------------
    try {
      const delayMs = 60 * 1000; // 1 minuto

      setTimeout(async () => {
        try {
          const lang = String(idioma || "pt").toLowerCase();
          const isEn = lang.startsWith("en");

          // Domínio base (produção)
          const rawBaseUrl =
            process.env.FRONT_URL || "https://api.canvaspiritual.com";

          // remove barra final se tiver
          const baseUrl = rawBaseUrl.replace(/\/$/, "");

          const sessionId = dadosCompletos.session_id;
          const affiliateRef = dadosCompletos.affiliate_ref || null;

          // monta parte do ?ref=... se tiver afiliado
          const refPart = affiliateRef
            ? `&ref=${encodeURIComponent(String(affiliateRef))}`
            : "";

          // 🔗 Links finais que você me passou:
          // PT: https://api.canvaspiritual.com/pagar-mini.html?tipo=completo&session_id=sessao-...
          // EN: https://api.canvaspiritual.com/en/pay.html?session_id=sess-...
          const linkVsl = isEn
            ? `${baseUrl}/en/pay.html?session_id=${encodeURIComponent(
                sessionId
              )}${refPart}`
            : `${baseUrl}/pagar-mini.html?tipo=completo&session_id=${encodeURIComponent(
                sessionId
              )}${refPart}`;

          const nome = dadosCompletos.nome;
          const email = dadosCompletos.email;

          const subject = isEn
            ? "Your Soul Map is almost ready…"
            : "Seu Mapa da Alma está quase pronto…";

          const htmlContent = isEn
            ? `
              <p>Hi <strong>${nome}</strong>,</p>
              <p>You’ve just completed your Soul Map quiz. Your personalized report is almost ready on our side.</p>
              <p>While the system processes your answers, here is your access link to revisit the explanation and unlock your full report when it’s the right moment for you:</p>
              <p style="margin:20px 0;">
                <a href="${linkVsl}" target="_blank"
                   style="background:#16a34a;color:#fff;padding:12px 22px;text-decoration:none;border-radius:999px;font-weight:700;">
                  👉 Access your spiritual reading
                </a>
              </p>
              <p>If the button doesn’t work, copy and paste this link into your browser:<br>
              <span style="font-size:13px;color:#6b7280;">${linkVsl}</span></p>
              <p>Keep this email. You can return anytime and continue your inner journey.</p>
              <p>With light,<br>Canva Espiritual</p>
            `
            : `
              <p>Olá <strong>${nome}</strong>,</p>
              <p>Você acabou de concluir o seu autodiagnóstico espiritual. Seu Mapa da Alma já está quase pronto do nosso lado.</p>
              <p>Enquanto o sistema organiza tudo, deixo aqui o seu link de acesso para rever a explicação e liberar o relatório completo quando for o melhor momento pra você:</p>
              <p style="margin:20px 0%;">
                <a href="${linkVsl}" target="_blank"
                   style="background:#16a34a;color:#fff;padding:12px 22px;text-decoration:none;border-radius:999px;font-weight:700;">
                  👉 Acessar sua leitura espiritual
                </a>
              </p>
              <p>Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <span style="font-size:13px;color:#9ca3af;">${linkVsl}</span></p>
              <p>Guarde este e-mail. Assim você pode voltar quando quiser e continuar a travessia interior.</p>
              <p>Com luz,<br>Canva Espiritual</p>
            `;

          await enviarEmailSimplesViaBrevo({
            nome,
            email,
            subject,
            htmlContent,
            tags: ["pos_quiz", "vsl_reminder"],
            });
        } catch (e) {
          console.error("❌ Erro ao enviar e-mail pós-quiz:", e.message || e);
        }
        }, delayMs);
    } catch (e) {
      console.error("⚠️ Falha ao agendar e-mail pós-quiz:", e.message || e);
     }

      console.log(`✅ Sessão ${dados.session_id} salva com sucesso.`);
    res.status(200).send("Sessão salva com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao salvar sessão:", error);
    res.status(500).send("Erro ao salvar sessão.");
  }
});

module.exports = router;
