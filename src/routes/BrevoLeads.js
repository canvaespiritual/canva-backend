const express = require("express");
const axios = require("axios");

const router = express.Router();

const BREVO_API_KEY = process.env.BREVO_API_KEY;

// LISTAS //
const LIST_PRECHECKOUT = 8;
const LIST_CLIENTES = 9;

// ========== ADD LEAD PRECHECKOUT ==========
router.post("/precheckout", async (req, res) => {
  try {
    const { name, email, phone, page_url, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body || {};

    if (!email) return res.status(400).json({ ok: false, error: "missing_email" });

    await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email,
        attributes: {
          FIRSTNAME: name || "",
          WHATSAPP: phone || "",
          FUNIL_STAGE: "PRECHECKOUT",

          // (opcional) se você criar esses atributos no Brevo:
          PAGE_URL: page_url || "",
          REFERRER: referrer || "",
          UTM_SOURCE: utm_source || "",
          UTM_MEDIUM: utm_medium || "",
          UTM_CAMPAIGN: utm_campaign || "",
          UTM_CONTENT: utm_content || "",
          UTM_TERM: utm_term || "",
        },
        listIds: [LIST_PRECHECKOUT],
        updateEnabled: true,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 8000,
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("BREVO PRECHECKOUT ERROR:", err.response?.data || err.message);
    return res.status(500).json({ ok: false });
  }
});

// ========== MOVE PARA CLIENTES (PÓS PAGAMENTO) ==========
router.post("/cliente", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "missing_email" });

    await axios.put(
      `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
      {
        listIds: [LIST_CLIENTES],
        unlinkListIds: [LIST_PRECHECKOUT],
        attributes: { FUNIL_STAGE: "CLIENTE" },
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        timeout: 8000,
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("BREVO CLIENT ERROR:", err.response?.data || err.message);
    return res.status(500).json({ ok: false });
  }
});

module.exports = router;
