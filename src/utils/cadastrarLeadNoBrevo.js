const axios = require("axios");

async function cadastrarLeadNoBrevo({ email, nome, atributos = {} }) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email,
        attributes: {
          NOME: nome || "",
          ...atributos
        },
        listIds: [3] // ID da sua lista "Leads quiz canva"
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Lead enviado para o Brevo: ${email}`, atributos);
    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error(`❌ Erro ao enviar lead para o Brevo (${email}):`, msg);
    return false;
  }
}

module.exports = cadastrarLeadNoBrevo;
