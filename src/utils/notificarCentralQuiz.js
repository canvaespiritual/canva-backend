const axios = require("axios");

const CENTRAL_QUIZ_EVENTS_URL = String(
  process.env.CENTRAL_QUIZ_EVENTS_URL || "",
).trim();

const CENTRAL_EVENTS_SECRET = String(
  process.env.CENTRAL_EVENTS_SECRET || "",
).trim();

async function notificarCentralQuiz(event) {
  if (!CENTRAL_QUIZ_EVENTS_URL) {
    console.log(
      "[central-quiz-event] CENTRAL_QUIZ_EVENTS_URL ausente; evento ignorado.",
    );

    return {
      sent: false,
      reason: "missing_url",
    };
  }

  if (!CENTRAL_EVENTS_SECRET) {
    console.log(
      "[central-quiz-event] CENTRAL_EVENTS_SECRET ausente; evento ignorado.",
    );

    return {
      sent: false,
      reason: "missing_secret",
    };
  }

  try {
    const response = await axios.post(
      CENTRAL_QUIZ_EVENTS_URL,
      event,
      {
        headers: {
          "Content-Type": "application/json",
          "x-central-events-secret": CENTRAL_EVENTS_SECRET,
        },
        timeout: 2000,
      },
    );

    console.log("[central-quiz-event] enviado", {
      eventType: event.eventType,
      sessionId: event.sessionId || null,
      status: response.status,
    });

    return {
      sent: true,
      status: response.status,
    };
  } catch (error) {
    console.error(
      "[central-quiz-event] falhou:",
      error.response?.data || error.message,
    );

    return {
      sent: false,
      reason: "request_failed",
    };
  }
}

module.exports = {
  notificarCentralQuiz,
};
