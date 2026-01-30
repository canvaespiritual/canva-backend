require('dotenv').config();
const express = require('express');
const session = require("express-session");
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const loginRoutes = require("./src/routes/loginRoutes");
const painelAdmin = require("./admin/src/routes/painelAdmin");
const salvarQuizRouter = require("./src/routes/salvarQuiz");
const enviarRouter = require("./routes/enviar");
const relatorioRoutes = require('./src/routes/relatorio');
const mercadopagoRoutes = require('./src/routes/mercadopago');
const pagamentoPixRoutes = require("./src/routes/pagamentoPix");
const pagamentoEmbed = require('./src/routes/pagamentoEmbed');
const pagamentoStatus = require("./src/routes/pagamentoStatus");
const pagamentoStart = require("./src/routes/pagamentoStart");
const statusRedirect = require("./src/routes/statusRedirect");
const infoRoute = require('./src/routes/info');
const testeSimulacaoRouter = require('./src/routes/testeSimulacao');
const confirmarEmailRoute = require('./src/routes/confirmarEmail');
const statusRoute = require('./src/routes/status');
const rotaGerar = require('./src/routes/gerar');
const webhookRoutes = require("./src/routes/webhook");
const webhookSesRoutes = require("./src/routes/webhookSes");
const brevoRoutes = require("./src/routes/brevo"); // ✅ novo
const brevoLeadsRoutes = require("./src/routes/brevo-leads");
const fruitDetailsRoutes = require("./src/routes/fruit-details"); // ✅ NEW (/api/fruit-details)
const pingSincronizar = require("./src/routes/ping/sincronizar");
// 👇 Painel do Afiliado (frontend + API)
const affiliatesRoutes = require("./src/routes/affiliates");

// 🔌 Rotas de teste Asaas (sandbox)
const asaasTestRoutes = require("./src/routes/asaasTest");      // GET /dev/asaas/smoke
const asaasWebhookRoutes = require("./src/routes/webhookAsaas"); // POST /webhooks/asaas
// Afiliado: subconta/status Asaas e método de saque
const affiliatesAsaasRoutes = require("./src/routes/affiliatesAsaas");   // cria subconta, status etc.
const affiliatesPayoutRoutes = require("./src/routes/affiliatesPayout"); // configura PIX/banco e teste
const asaasSubaccountService = require("./src/services/asaasSubaccountService");
const pagamentoStatusSessao = require("./src/routes/pagamentoStatusSessao");
const vendorsRoutes = require("./src/routes/vendors");
const debugRoutes = require("./src/routes/debug"); // ← ADD


// ⬇️ adicione esta linha
const pool = require("./src/db");
const cookieParser = require('cookie-parser');



const emProducao = process.env.RAILWAY_ENVIRONMENT !== undefined;
const app = express();
// ⬇️ importe a função (para evitar o “handler must be a function”)
const stripeWebhook = require("./src/routes/stripeWebhook");

app.set("trust proxy", true);
// ---------------------------
// 🔐 Sessão + JSON
// normaliza /algo.html/ -> /algo.html (preserva querystring)
app.use((req, res, next) => {
  if (req.path.endsWith(".html/")) {
    const clean = req.path.replace(/\/+$/, ""); // remove barra(s) finais
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(301, clean + qs);
  }
  next();
});

// ---------------------------
app.use(session({
  secret: process.env.SEGREDO_SESSAO || "canva_supersecreto",
  resave: false,
  saveUninitialized: false,
  proxy: true, // importante quando usa trust proxy
  cookie: {
    maxAge: 3 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: emProducao // em produção, só envia por HTTPS
  }
}));
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);
app.use(express.json());

// ✅ Health check (pra testar no localhost e no deploy)
app.get("/health", (req, res) => res.status(200).send("ok"));


// ✅ Lead pré-checkout (salva nome/email/whatsapp antes de ir pra Kiwify)
app.post("/api/leads/precheckout", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      page_url,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
    } = req.body || {};

    if (!name || !email || !phone) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // ✅ normaliza email
    const emailNorm = String(email).trim().toLowerCase();

    // ✅ normaliza telefone: só dígitos + garante DDI 55
    let phoneNorm = String(phone).replace(/\D/g, "");
    if (!phoneNorm.startsWith("55")) phoneNorm = "55" + phoneNorm;

    // ✅ salva no banco (DB first) sem apagar tracking com null
    await pool.query(
      `
      INSERT INTO leads_precheckout
        (name, email, phone, page_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,

        page_url = COALESCE(EXCLUDED.page_url, leads_precheckout.page_url),
        referrer = COALESCE(EXCLUDED.referrer, leads_precheckout.referrer),

        utm_source   = COALESCE(EXCLUDED.utm_source, leads_precheckout.utm_source),
        utm_medium   = COALESCE(EXCLUDED.utm_medium, leads_precheckout.utm_medium),
        utm_campaign = COALESCE(EXCLUDED.utm_campaign, leads_precheckout.utm_campaign),
        utm_content  = COALESCE(EXCLUDED.utm_content, leads_precheckout.utm_content),
        utm_term     = COALESCE(EXCLUDED.utm_term, leads_precheckout.utm_term),

        updated_at = NOW()
      `,
      [
        String(name).trim(),
        emailNorm,
        phoneNorm,
        page_url || null,
        referrer || null,
        utm_source || null,
        utm_medium || null,
        utm_campaign || null,
        utm_content || null,
        utm_term || null,
      ]
    );

    // ✅ envia pro Brevo (não pode quebrar o fluxo se falhar)
    try {
      await axios.post(
        "https://api.canvaspiritual.com/api/brevo-leads/precheckout",
        {
          name: String(name).trim(),
          email: emailNorm,
          phone: phoneNorm,
          page_url: page_url || null,
          referrer: referrer || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          utm_content: utm_content || null,
          utm_term: utm_term || null,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 6000,
        }
      );
    } catch (e) {
      console.error("[brevo precheckout] falhou:", e.response?.data || e.message);
      // segue normal: já salvou no banco
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[precheckout] error:", e);
    return res.status(500).json({ ok: false });
  }
});


// 🧪 DEV | Asaas Sandbox (smoke test)
app.use("/dev", asaasTestRoutes);
// topo do arquivo:
// 🧪 DEV | Debug de split/ledger
app.use("/debug", debugRoutes); // ← ADD

app.use(cookieParser());
app.use(fruitDetailsRoutes); // ✅ habilita GET /api/fruit-details?lang=en|es|pt


// ⬇️ Captura ?aff= ou ?ref= e salva cookie + sessão (90 dias)
app.use((req, res, next) => {
  const emProducao = process.env.RAILWAY_ENVIRONMENT !== undefined; // já existe acima no seu código
  const aff = (req.query.aff || req.query.ref || '').trim();

  if (aff) {
    res.cookie('aff_ref', aff, {
      maxAge: 90 * 24 * 60 * 60 * 1000,
      httpOnly: false,     // front pode ler se precisar
      sameSite: 'lax',
      secure: emProducao
    });
    req.session.aff_ref = aff;
  } else if (!req.session.aff_ref && req.cookies?.aff_ref) {
    req.session.aff_ref = req.cookies.aff_ref;
  }
  next();
});
// === [ADD] Atribuição de sessão para links do VENDEDOR (rede) ==================
// Se entrar com ?aff=CODE de affiliate_links, gravamos attribution(session -> link)
// Observação: ?ref=<affiliate_id> (afiliado direto 30%) continua como está (cookie/sessão),
// não criamos attribution para ?ref, pois não é link do vendedor.
app.use(async (req, res, next) => {
  try {
    const code = (req.query.aff || "").trim();      // só consideramos ?aff aqui
    if (!code) return next();

    // procura o link do vendedor
    const { rows } = await pool.query(
      "SELECT id FROM affiliate_links WHERE code = $1 AND active = TRUE LIMIT 1",
      [code]
    );
    if (rows.length === 0) return next(); // não é link de vendedor, segue o fluxo normal (?ref pode estar presente)

    const linkId = rows[0].id;
    const sessionId = req.sessionID;

    // upsert attribution (1 registro por sessão)
    await pool.query(
      `INSERT INTO attribution (session_id, affiliate_link_id)
       VALUES ($1, $2)
       ON CONFLICT (session_id)
       DO UPDATE SET affiliate_link_id = EXCLUDED.affiliate_link_id`,
      [sessionId, linkId]
    );

    // (opcional) incrementa cliques do link; coloque debounce via redis depois, se quiser
    await pool.query(
      `UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = $1`,
      [linkId]
    );

    return next();
  } catch (e) {
    console.error("[attrib vendor link] erro:", e);
    return next(); // não quebra a navegação se algo falhar
  }
});
// [ADD] Captura ?vend=<vendor_id> para vendas diretas do vendedor (30%)
app.use(async (req, res, next) => {
  try {
    const vend = (req.query.vend || "").trim();
    if (!vend) return next();

    // valida se existe um afiliado com esse id e role vendor (se tiver coluna role)
    const { rows } = await pool.query(
      `SELECT id FROM affiliates WHERE id = $1 AND role IN ('vendor','supervisor') LIMIT 1`,
      [vend]
    );
    if (!rows.length) return next();

    req.session.vendor_ref = vend; // guarda na sessão (vamos enviar ao PSP como metadata também)
    next();
  } catch (e) {
    console.error("[vend capture] error:", e);
    next();
  }
});

// ⤵️ atalhos de link amigáveis (se alguém usar /a/MEUAFILIADO, etc)
app.get(['/a/:aff', '/r/:aff', '/quiz/:aff', '/quiz.html/:aff'], (req, res) => {
  return res.redirect(`/quiz.html?aff=${encodeURIComponent(req.params.aff)}`);
});


// ---------------------------
// 📁 Arquivos Estáticos (CSS, JS, imagens, HTML)
// ---------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/relatorios', express.static(path.join(__dirname, 'relatorios')));
app.use('/relatorios', express.static('temp/prontos'));


// ---------------------------
// 🗂️ Garantir pastas necessárias
// ---------------------------
const pastasNecessarias = [
  path.join(__dirname, 'temp', 'pendentes'),
  path.join(__dirname, 'temp', 'processados'),
  path.join(__dirname, 'temp', 'respondidos'),
];

pastasNecessarias.forEach((pasta) => {
  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta, { recursive: true });
    console.log(`📁 Pasta criada automaticamente: ${pasta}`);
  }
});


// ---------------------------
// 🔄 Webhook & Diagnóstico
// ---------------------------
app.use('/webhook', webhookRoutes);
app.use('/webhook/ses', webhookSesRoutes);
// 🔔 Webhook do Asaas (sandbox/prod)
// No painel do Asaas, aponte para: https://SEU_DOMINIO/webhooks/asaas
app.use("/webhooks/asaas", asaasWebhookRoutes);

app.post("/verificar-recaptcha", async (req, res) => {
  const token = req.body.token;
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  try {
    const resposta = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
      params: { secret, response: token },
    });

    const sucesso = resposta.data.success;
    res.json({ sucesso });
  } catch (error) {
    console.error("Erro ao verificar reCAPTCHA:", error);
    res.status(500).json({ sucesso: false });
  }
});


// ---------------------------
// 🧾 Páginas HTML diretas
// ---------------------------
app.get('/aguarde/:session_id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aguarde.html'));
});


// ---------------------------
// 🔧 Rotas funcionais internas
// ---------------------------
app.use('/info', infoRoute);
app.use('/confirmar-email', confirmarEmailRoute);
app.use('/status', statusRoute);
app.use('/gerar', rotaGerar);
app.use('/api/teste', testeSimulacaoRouter);
app.use('/api/brevo', brevoRoutes);
app.use("/api/brevo-leads", brevoLeadsRoutes);

app.use('/ping/sincronizar', pingSincronizar);
const segundaViaRelatoriosRouter = require("./src/routes/segundaViaRelatorios");
app.use("/api/segunda-via-relatorios", segundaViaRelatoriosRouter);
// ★ HARD OVERRIDE: status da subconta (DB-first) — destrava o dashboard
// ★ OVERRIDE ÚNICO de status: DB-first + auto-enable do link
app.get("/affiliates/me/asaas/status", async (req, res) => {
  try {
    const aff = req.session?.aff;
    if (!aff?.id) return res.status(401).json({ error: "Não autenticado" });

    const { rows } = await pool.query(
      `SELECT
         asaas_wallet_id,
         asaas_account_id,
         link_enabled,
         payout_method,
         pix_key_value,
         bank_number, bank_agency, bank_account, bank_account_digit
       FROM affiliates
       WHERE id = $1
       LIMIT 1`,
      [aff.id]
    );

    const r = rows[0] || {};

    // Geral: aprovado se subconta existe (wallet + account)
    const hasSub = !!r.asaas_wallet_id && !!r.asaas_account_id;
    const general = hasSub ? "APPROVED" : "MISSING";

    // Bancário: aprovado se PIX com chave OU conta bancária completa
    const pixOK  = r.payout_method === "pix" &&
                   !!String(r.pix_key_value || "").trim();
    const bankOK = r.payout_method === "bank" &&
                   !!r.bank_number && !!r.bank_agency &&
                   !!r.bank_account && !!r.bank_account_digit;

    const bank = (pixOK || bankOK) ? "APPROVED" : "PENDING";

    let linkEnabled = !!r.link_enabled;

    // 🔒 Auto-enable somente quando os dois estiverem aprovados
    if (!linkEnabled && general === "APPROVED" && bank === "APPROVED") {
      await pool.query(
        `UPDATE affiliates
           SET link_enabled = TRUE,
               updated_at   = NOW()
         WHERE id = $1`,
        [aff.id]
      );
      linkEnabled = true;
      console.log("[STATUS] link_enabled -> TRUE (auto)");
    }

    return res.json({
      ok: true,
      status: { general, bank },
      link_enabled: linkEnabled,
      wallet_id: r.asaas_wallet_id || null,
    });
  } catch (e) {
    console.error("[/affiliates/me/asaas/status override] error:", e);
    return res.status(500).json({ ok: false, error: "Erro ao consultar status" });
  }
});


app.use('/affiliates/asaas', asaasSubaccountService);
app.use('/affiliates/me/asaas', asaasSubaccountService);
// 👇 Endpoints do Afiliado (cadastro, login, me)
app.use('/affiliates', affiliatesRoutes);

// 👇 Asaas: subconta/status + método de saque (D+7 controlado no dashboard)
app.use('/affiliates', affiliatesAsaasRoutes);
app.use('/affiliates', affiliatesPayoutRoutes);
// === [ADD] endpoint genérico de identidade ===
// Permite ao front descobrir o "role" pós-login e redirecionar para o dashboard certo.
app.get("/me", (req, res) => {
  const me = req.session?.aff;
  if (!me) return res.status(401).json({ error: "Não autenticado" });
  // me já inclui: { id, email, name, role } (role vem do /affiliates/login)
  res.json(me);
});
// === [OPTIONAL ADD] aliases para rotas de vendedor reaproveitando as de afiliado ===
// 1) Identidade básica (me)
app.get("/vendors/me", (req, res) => {
  if (!req.session?.aff) return res.status(401).json({ error: "Não autenticado" });
  // mantemos o mesmo shape que o afiliado usa
  res.json({ me: req.session.aff });
});

 app.get("/vendors/me/status", (req, res) => {
   // encaminha para o endpoint já existente de forma segura
   res.redirect(307, "/affiliates/me/asaas/status");
 });

// 3) Link pessoal do vendedor (se preferir responder “stub” agora)
app.get("/vendors/me/personal-link", (req, res) => {
  if (!req.session?.aff?.id) return res.status(401).json({ error: "Não autenticado" });
  // Se você ainda não tem link pessoal separado p/ vendedor, retorne null por enquanto.
  // (O vendor-dashboard.js trata ausência sem quebrar)
  res.json({ url: null });
});

app.use("/vendors", vendorsRoutes);


// ---------------------------
// 🔐 Área Administrativa
// ---------------------------
app.use("/admin", loginRoutes);
app.use("/admin", express.static(path.join(__dirname, "admin")));
app.use("/admin", painelAdmin);


// ---------------------------
// 📤 Envio e Salvamento
// ---------------------------
app.use("/api/enviar", enviarRouter);
app.use("/api/salvar-quiz", salvarQuizRouter);


// ---------------------------
// 💳 Pagamentos
// ---------------------------
app.use("/pagamento", pagamentoStart);
app.use('/pagamento', mercadopagoRoutes);
app.use("/pagamento", pagamentoPixRoutes);
app.use('/pagamento', pagamentoEmbed);
app.use("/pagamento", pagamentoStatus);
app.use("/pagamento", statusRedirect);
app.use("/pagamento", pagamentoStatusSessao);

app.use("/api/stripe", require("./src/routes/stripeCheckout"));
// ---------------------------
// 📄 Relatórios
// ---------------------------
app.use('/gerar-relatorio', relatorioRoutes);

// ---------------------------
// 🧪 Teste de Simulação de Sessão
// ---------------------------

// ---------------------------
// 🧪 Diagnóstico Simples
// ---------------------------
app.post('/diagnostico', (req, res) => {
  const { nome, emocao, nivel } = req.body;

  let mensagem;
  if (nivel >= 8) {
    mensagem = `🌟 ${nome}, sua ${emocao} está elevada. Você está vibrando com intensidade espiritual.`;
  } else if (nivel >= 5) {
    mensagem = `🔄 ${nome}, sua ${emocao} está em zona de transição. Ainda há campo fértil para crescer.`;
  } else {
    mensagem = `⚠️ ${nome}, sua ${emocao} está em estado crítico. É hora de olhar com coragem para dentro.`;
  }

  res.send(mensagem);
});


// ---------------------------
// 🧭 Diagnóstico Contextual
// ---------------------------
app.post('/mapa/contexto', (req, res) => {
  const { contexto, ...frutos } = req.body;
  const nomes = Object.keys(frutos);
  const valores = Object.values(frutos);

  const indiceMax = valores.indexOf(Math.max(...valores));
  const virtudeDominante = nomes[indiceMax];

  const indiceMin = valores.indexOf(Math.min(...valores));
  const desafio = nomes[indiceMin];

  let mensagemExtra = '';
  switch (contexto.toLowerCase()) {
    case 'profissional':
      mensagemExtra = `💼 No trabalho, sua maior força é ${virtudeDominante}. Mas sua fraqueza em ${desafio} pode gerar conflitos ou estagnação.`;
      break;
    case 'relacional':
      mensagemExtra = `❤️ Nos seus relacionamentos, ${virtudeDominante} é seu dom. Mas a ausência de ${desafio} pode gerar distanciamento.`;
      break;
    case 'espiritual':
      mensagemExtra = `🔮 No plano espiritual, ${virtudeDominante} te aproxima da luz. Mas ${desafio} pode te deixar vulnerável às quedas.`;
      break;
    default:
      mensagemExtra = `🌿 Contexto não reconhecido. Trabalhe suas virtudes com equilíbrio.`;
  }

  const resposta = `
    🌿 Diagnóstico Contextualizado:
    Virtude em destaque: ${virtudeDominante.toUpperCase()}
    Ponto de atenção: ${desafio.toUpperCase()}

    ${mensagemExtra}
  `;

  res.send(resposta);
});


// ---------------------------
// 🧿 Diagnóstico Geral (sem contexto)
// ---------------------------
app.post('/mapa', (req, res) => {
  const frutos = req.body;
  const nomes = Object.keys(frutos);
  const valores = Object.values(frutos);

  const indiceMax = valores.indexOf(Math.max(...valores));
  const virtudeDominante = nomes[indiceMax];

  const indiceMin = valores.indexOf(Math.min(...valores));
  const desafio = nomes[indiceMin];

  const resposta = `
    🌿 Seu espelho espiritual mostra:
    Virtude em destaque: ${virtudeDominante.toUpperCase()}
    Ponto de atenção: ${desafio.toUpperCase()}
    
    Caminho sugerido: Alimente sua virtude, mas olhe com coragem para sua sombra.
  `;

  res.send(resposta);
});


// ---------------------------
// 🏠 Página Inicial e Extras
// ---------------------------
app.get('/', (req, res) => {
  if (emProducao) {
    res.redirect('/quiz.html');
  } else {
    res.send('✨ O Espírito está vivo em http://localhost:3000');
  }
});

app.get('/fruto', (req, res) => {
  res.send('🍇 Fruto espiritual: Bondade');
});

app.get('/espelho/:nome', (req, res) => {
  const nomeDaPessoa = req.params.nome;
  res.send(`🪞 ${nomeDaPessoa}, o espelho te mostra aquilo que você carrega dentro.`);
});


// ---------------------------
// 🛠️ Iniciar o servidor
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
