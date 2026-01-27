// utils/cadastrarLeadNoBrevo.js
const axios = require("axios");

/**
 * Cadastra ou atualiza um lead no Brevo com idioma e tags dinâmicas
 * @param {Object} params
 * @param {string} params.email - Email do contato
 * @param {string} params.nome - Nome do contato
 * @param {string} [params.idioma='pt'] - Idioma detectado (pt, en, es, etc.)
 * @param {Object} [params.atributos={}] - Atributos adicionais opcionais
 */
async function cadastrarLeadNoBrevo({ email, nome, idioma = "pt", atributos = {} }) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email,
        attributes: {
          NOME: nome || "",
          IDIOMA: idioma.toUpperCase(), // grava idioma no contato
          ...atributos
        },
        listIds: [3], // ID da sua lista "Leads quiz canva"
        updateEnabled: true, // atualiza se o contato já existir
        tags: [`quiz-${idioma}`] // cria tag dinâmica ex: quiz-en, quiz-pt
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Lead enviado para o Brevo: ${email} [${idioma.toUpperCase()}]`, atributos);
    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error(`❌ Erro ao enviar lead para o Brevo (${email}):`, msg);
    return false;
  }
}

module.exports = cadastrarLeadNoBrevo;
