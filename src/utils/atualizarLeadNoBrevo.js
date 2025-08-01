const axios = require("axios");
const cadastrarLeadNoBrevo = require("./cadastrarLeadNoBrevo");

async function atualizarLeadNoBrevo({ email, nome = "", atributos = {} }) {
  try {
    console.log("🔄 Iniciando atualização no Brevo...");
    console.log("📧 E-mail:", email);
    console.log("🧾 Nome:", nome);
    console.log("📦 Atributos recebidos:", atributos);

    const atributosConvertidos = Object.fromEntries(
      Object.entries(atributos).map(([chave, valor]) => {
        if (typeof valor === "boolean") return [chave, valor];
        if (valor === "true") return [chave, true];
        if (valor === "false") return [chave, false];
        return [chave, valor];
      })
    );

    console.log("✅ Atributos convertidos:", atributosConvertidos);

    await axios.put(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      { attributes: atributosConvertidos },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ Lead atualizado no Brevo: ${email}`, atributosConvertidos);
    return true;

  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    const msg = data?.message || error.message;

    console.error(`❌ Erro ao atualizar lead no Brevo (${email}):`);
    console.error("📛 Status HTTP:", status);
    console.error("📬 Mensagem:", msg);
    console.error("📝 Resposta completa da Brevo:", data);

    if (status === 404) {
      console.log("🔁 Contato não existe. Tentando criar novo lead...");
      return await cadastrarLeadNoBrevo({ email, nome });
    }

    return false;
  }
}

module.exports = atualizarLeadNoBrevo;
