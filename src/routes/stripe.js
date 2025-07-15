// 📁 src/routes/stripe.js
require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const fs = require("fs");
const path = require("path");
const pdf = require("html-pdf");
const nodemailer = require("nodemailer");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const tempDir = path.join(__dirname, "../../temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// 🔹 Criar sessão de pagamento
router.post('/criar-sessao-pagamento', async (req, res) => {
  const dados = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        }
      ],
      success_url: 'http://localhost:3000/sucesso.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3000/falha.html',
    });

    const caminho = path.join(tempDir, `${session.id}.json`);
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão:', err);
    res.status(500).send('Erro ao criar sessão de pagamento.');
  }
});

// 🔹 Finalizar pagamento e gerar PDF
router.get('/finalizar-pagamento', async (req, res) => {
  const session_id = req.query.session_id;
  if (!session_id) return res.status(400).send('Sessão não encontrada.');

  const dadosPath = path.join(tempDir, `${session_id}.json`);
  if (!fs.existsSync(dadosPath)) {
    return res.status(404).send('Dados da sessão não encontrados.');
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') {
      return res.status(402).send('Pagamento não confirmado.');
    }

    const { nome, email, telefone, respostas } = JSON.parse(fs.readFileSync(dadosPath, 'utf8'));

    // Carrega e preenche template
    let template = fs.readFileSync(path.join(__dirname, "../../templates/relatorio.html"), "utf8");
    const preenchido = template
      .replace(/{{nome}}/g, nome)
      .replace(/{{data}}/g, new Date().toLocaleDateString("pt-BR"))
      .replace(/{{zona}}/g, "Transição")
      .replace(/{{media_vibracional}}/g, "6.4")
      .replace(/{{arquétipo_tecnico}}/g, "AM07")
      .replace(/{{arquétipo_simbolico}}/g, "Semente da Indiferença")
      .replace(/{{mensagem_zona}}/g, "Você está num ponto de virada vibracional...")
      .replace(/{{grafico_vibracional_url}}/g, "https://canvaespiritual.com/grafico1.png")
      .replace(/{{grafico_percentual_url}}/g, "https://canvaespiritual.com/grafico2.png")
      .replace(/{{chave_correspondencia}}/g, "R4Y3B5")
      .replace(/{{diagnostico_arquétipo}}/g, "Sua estrutura emocional...")
      .replace(/{{reflexao_simbolica}}/g, "Você representa o limiar...")
      .replace(/{{gatilho_tatil}}/g, "Toque suave de tecido natural")
      .replace(/{{gatilho_olfato}}/g, "Lavanda que remete ao centro")
      .replace(/{{gatilho_audicao}}/g, "Som de sinos e vento")
      .replace(/{{gatilho_visao}}/g, "Imagem de flor azul surgindo da terra")
      .replace(/{{gatilho_paladar}}/g, "Chá morno de camomila")
      .replace(/{{html_frutos}}/g, "<div><h3>Fruto Amor</h3><p>Nível: 6</p></div>")
      .replace(/{{cta_links.ebook}}/g, "https://canvaespiritual.com/ebook.pdf")
      .replace(/{{cta_links.aula}}/g, "https://canvaespiritual.com/aula")
      .replace(/{{cta_links.quiz_avançado}}/g, "https://canvaespiritual.com/quiz-novo");

    const nomeArquivo = `${nome.replace(/ /g, "_")}_relatorio.pdf`;
    const caminhoFinal = path.join(__dirname, "../../relatorios", nomeArquivo);

    pdf.create(preenchido).toFile(caminhoFinal, async (err) => {
      if (err) {
        console.error("❌ Erro ao gerar PDF:", err);
        return res.status(500).send("Erro ao gerar relatório.");
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_REMETENTE,
          pass: process.env.SENHA_EMAIL_APP
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_REMETENTE,
        to: email,
        subject: `✅ Seu Relatório Espiritual – Canva Espiritual`,
        text: `Olá ${nome},\n\nSegue em anexo o seu diagnóstico espiritual.\n\nCom luz,`,
        attachments: [
          { filename: nomeArquivo, path: caminhoFinal }
        ]
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("❌ Erro ao enviar e-mail:", error);
          return res.status(500).send("Erro ao enviar e-mail.");
        }

        console.log("✅ E-mail enviado:", info.response);
        res.redirect(`/sucesso.html?arquivo=${encodeURIComponent(nomeArquivo)}`);
      });
    });
  } catch (error) {
    console.error("Erro ao finalizar pagamento:", error);
    res.status(500).send("Erro ao processar pagamento.");
  }
});

module.exports = router;
