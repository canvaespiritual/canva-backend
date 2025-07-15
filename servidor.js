require('dotenv').config();
const express = require('express');
const emProducao = process.env.RAILWAY_ENVIRONMENT !== undefined;

const path = require('path');
const fs = require('fs');
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

const nodemailer = require('nodemailer');
const salvarQuizRouter = require("./src/routes/salvarQuiz");

const enviarRouter = require("./routes/enviar");
const relatorioRoutes = require('./src/routes/relatorio');
//const stripeRoutes = require('./src/routes/stripe');
const mercadopagoRoutes = require('./src/routes/mercadopago');

const pagamentoPixRoutes = require("./src/routes/pagamentoPix");

const pagamentoEmbed = require('./src/routes/pagamentoEmbed');
const pagamentoStatus = require("./src/routes/pagamentoStatus");




const finalizarPagamentoRoute = require('./src/routes/finalizarPagamento');

const app = express();
app.use(express.json()); // <-- Agora vem logo após o app ser criado
app.use(express.static(path.join(__dirname, 'public')));
app.get('/aguarde/:session_id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'aguarde.html'));
});

const infoRoute = require('./src/routes/info');
app.use('/info', infoRoute);

const confirmarEmailRoute = require('./src/routes/confirmarEmail');
app.use('/confirmar-email', confirmarEmailRoute);

const statusRoute = require('./src/routes/status');
app.use('/status', statusRoute);


const rotaGerar = require('./src/routes/gerar');
app.use('/gerar', rotaGerar);

app.use('/relatorios', express.static('temp/prontos'));

app.use(express.json());
app.use('/relatorios', express.static('relatorios'));

// Expor os arquivos PDF publicamente
app.use('/relatorios', express.static(path.join(__dirname, 'relatorios')));

// Rotas customizadas
app.use("/api/enviar", enviarRouter);
app.use('/gerar-relatorio', relatorioRoutes);
//app.use('/pagamento/stripe', stripeRoutes); 
app.use('/pagamento', mercadopagoRoutes);

app.use("/api/salvar-quiz", salvarQuizRouter);
app.use('/pagamento/finalizar-pagamento', finalizarPagamentoRoute);
app.use("/pagamento", pagamentoPixRoutes);

app.use('/pagamento', pagamentoEmbed);
app.use("/pagamento", pagamentoStatus);



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


const axios = require('axios');

app.post("/verificar-recaptcha", async (req, res) => {
  const token = req.body.token;
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  try {
    const resposta = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
      params: {
        secret: secret,
        response: token,
      },
    });

    const sucesso = resposta.data.success;
    res.json({ sucesso });
  } catch (error) {
    console.error("Erro ao verificar reCAPTCHA:", error);
    res.status(500).json({ sucesso: false });
  }
});


// Inicia o servidor
app.listen(3000, () => {
  console.log('🚀 Servidor rodando em http://localhost:3000');
});
require('./worker');
