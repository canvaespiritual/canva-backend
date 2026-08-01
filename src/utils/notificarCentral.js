const axios = require("axios");

const CENTRAL_EVENTS_URL = String(
  process.env.CENTRAL_EVENTS_URL || "",
).trim();

const CENTRAL_EVENTS_SECRET = String(
  process.env.CENTRAL_EVENTS_SECRET || "",
).trim();

/**
 * Envia um evento de checkout para a Central Operacional.
 *
 * Esta integração é "best effort":
 * falhas de notificação nunca devem interromper o checkout
 * nem provocar erro no webhook da Kiwify.
 */
async function notificarCentral(event) {
  if (!CENTRAL_EVENTS_URL) {
    console.log(
      "[central-event] CENTRAL_EVENTS_URL ausente; evento ignorado.",
    );

    return {
      sent: false,
      reason: "missing_url",
    };
  }

  if (!CENTRAL_EVENTS_SECRET) {
    console.log(
      "[central-event] CENTRAL_EVENTS_SECRET ausente; evento ignorado.",
    );

    return {
      sent: false,
      reason: "missing_secret",
    };
  }

  try {
    const response = await axios.post(
      CENTRAL_EVENTS_URL,
      event,
      {
        headers: {
          "Content-Type": "application/json",
          "x-central-events-secret":
            CENTRAL_EVENTS_SECRET,
        },

        timeout: 2000,
      },
    );

    console.log("[central-event] enviado", {
      eventType: event.eventType,
      checkoutLeadId:
        event.checkoutLeadId || null,
      status: response.status,
    });

    return {
      sent: true,
      status: response.status,
    };
  } catch (error) {
    console.error(
      "[central-event] falhou:",
      error.response?.data ||
        error.message,
    );

    return {
      sent: false,
      reason: "request_failed",
    };
  }
}

module.exports = {
  notificarCentral,
};