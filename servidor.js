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
const statusRedirect = require("./src/routes/statusRedirect");
const infoRoute = require('./src/routes/info');
const testeSimulacaoRouter = require('./src/routes/testeSimulacao');
const confirmarEmailRoute = require('./src/routes/confirmarEmail');
const statusRoute = require('./src/routes/status');
const rotaGerar = require('./src/routes/gerar');
const webhookRoutes = require("./src/routes/webhook");
const webhookSesRoutes = require("./src/routes/webhookSes");
const brevoRoutes = require("./src/routes/brevo"); // ✅ novo
const pingSincronizar = require("./src/routes/ping/sincronizar");




const emProducao = process.env.RAILWAY_ENVIRONMENT !== undefined;
const app = express();


// ---------------------------
// 🔐 Sessão + JSON
// ---------------------------
app.use(session({
  secret: process.env.SEGREDO_SESSAO || "canva_supersecreto",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3 * 60 * 60 * 1000 }
}));
app.use(express.json());


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
app.use('/ping/sincronizar', pingSincronizar);

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
app.use('/pagamento', mercadopagoRoutes);
app.use("/pagamento", pagamentoPixRoutes);
app.use('/pagamento', pagamentoEmbed);
app.use("/pagamento", pagamentoStatus);
app.use("/pagamento", statusRedirect);


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
app.listen(3000, () => {
  console.log('🚀 Servidor rodando em http://localhost:3000');
});

