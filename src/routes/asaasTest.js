// src/routes/asaasTest.js
const express = require("express");
const router = express.Router();
const {
  createCustomer,
  createPixCharge,           // smoke sem split
  createPixChargeWithSplit,  // com split + retenção
} = require("../services/asaas");

/**
 * GET /dev/asaas/test
 * Exemplos:
 *  - Sem split (smoke):              /dev/asaas/test
 *  - Com split por % (30%):          /dev/asaas/test?valor=100&affWallet=SEU_WALLET&percent=30
 *  - Com split por valor fixo (20):  /dev/asaas/test?valor=100&affWallet=SEU_WALLET&fixed=20
 *  - Definir retenção (dias):        ...&dias=7
 */
router.get("/asaas/test", async (req, res) => {
  try {
    const { valor = "5", affWallet, percent, fixed, dias } = req.query;

    // 1) cria um comprador de teste
    const customer = await createCustomer(
      "Cliente Teste Sandbox",
      "teste+asaas@example.com",
      "12345678909", // sandbox aceita fictício
      "11987654321"
    );

    // 2) decide se roda smoke (sem split) ou com split
    let charge;
    if (!affWallet) {
      // SMOKE: sem split
      charge = await createPixCharge(customer.id, Number(valor), "Teste PIX - Canva Espiritual");
    } else {
      // SPLIT: por percent OU valor fixo
      const splitConfig = {
        affiliateWalletId: affWallet,
        daysToRelease: dias ? Number(dias) : 7,
      };

      if (typeof fixed !== "undefined") {
        splitConfig.fixedValue = Number(fixed);
      } else if (typeof percent !== "undefined") {
        splitConfig.percent = Number(percent);
      } else {
        // se não informar percent/fixed, default 30%
        splitConfig.percent = 30;
      }

      charge = await createPixChargeWithSplit(
        customer.id,
        Number(valor),
        "Relatório Canva Espiritual",
        splitConfig
      );
    }

    // 3) resposta útil
    res.json({
      ok: true,
      customerId: customer.id,
      paymentId: charge.id,
      invoiceUrl: charge.invoiceUrl, // abra isso para ver o QR Pix
      raw: charge,
    });
  } catch (err) {
    console.error("Asaas test error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: err.message });
  }
});

module.exports = router;
