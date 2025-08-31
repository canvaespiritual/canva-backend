const express = require("express");
const router = express.Router();
const { applySplit } = require("../services/sliptService");

// POST /debug/split-test
router.post("/split-test", async (req, res) => {
  try {
    const {
      session_id = "sessao-TEST-001",
      amount_cents = 10000,          // R$100
      net_amount_cents,              // opcional
      gateway = "asaas",
      gateway_payment_id = `DBG-${Date.now()}`,
      status = "paid",
      bonus_vendor_pct = 0
    } = req.body || {};

    const out = await applySplit({
      session_id,
      amount_cents,
      net_amount_cents,
      gateway,
      gateway_payment_id,
      status,
      bonus_vendor_pct
    });

    res.json({ ok:true, ...out, gateway_payment_id });
  } catch (e) {
    console.error("[/debug/split-test] error:", e);
    res.status(500).json({ error: e.message || "erro" });
  }
});
router.get("/ping", (req, res) => res.json({ ok: true, from: "debug" }));

module.exports = router;
