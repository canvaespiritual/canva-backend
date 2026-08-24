const express = require("express");
const axios = require("axios");
const pool = require("../db");

const router = express.Router();

const ASAAS_ENV =
  String(process.env.ASAAS_ENV || "sandbox")
    .trim()
    .toLowerCase();

const IS_PROD =
  ASAAS_ENV === "production";

const ASAAS_BASE =
  IS_PROD
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

const ASAAS_CHECKOUT_VIEW =
  IS_PROD
    ? "https://asaas.com/checkoutSession/show?id="
    : "https://sandbox.asaas.com/checkoutSession/show?id=";

const asaas = axios.create({
  baseURL: ASAAS_BASE,
  headers: {
    "Content-Type": "application/json",
    access_token:
      process.env.ASAAS_API_KEY || "",
  },
});

function normalizeTipo(tipo) {
  const t =
    String(tipo || "")
      .trim()
      .toLowerCase();

  if (
    t === "intermediario" ||
    t === "premium"
  ) {
    return "premium";
  }

  if (
    t === "completo" ||
    t === "interdimensional"
  ) {
    return "completo";
  }

  return "basico";
}

function mapTipoRelatorio(tipo) {
  const t =
    normalizeTipo(tipo);

  if (t === "premium") {
    return "premium";
  }

  if (t === "completo") {
    return "completo";
  }

  return "essencial";
}

function mapPreco(tipo) {
  switch (
    normalizeTipo(tipo)
  ) {
    case "basico":
      return 12;

    case "premium":
      return 21;

    case "completo":
      return 40;

    default:
      return 12;
  }
}

const VALOR_MINIMO = 12;
const VALOR_MAXIMO = 500;

function clampValor(
  valor,
  fallback
) {
  const n =
    Number(valor);

  if (
    !Number.isFinite(n)
  ) {
    return fallback;
  }

  return Math.min(
    Math.max(
      n,
      VALOR_MINIMO
    ),
    VALOR_MAXIMO
  );
}

function onlyDigits(v) {
  return String(v || "")
    .replace(/\D/g, "");
}

function normalizeHttpsBase(u) {
  let s =
    String(u || "")
      .trim();

  if (!s) {
    return "";
  }

  if (
    !/^https?:\/\//i.test(s)
  ) {
    s =
      "https://" + s;
  }

  s =
    s.replace(
      /^http:\/\//i,
      "https://"
    );

  return s.replace(
    /\/+$/,
    ""
  );
}

/*
 * Busca ou cria customer no Asaas.
 *
 * A sessão já contém:
 * nome
 * email
 * telefone
 *
 * O CPF vem do checkout.
 */
async function getOrCreateCustomer({
  nome,
  email,
  telefone,
  cpf
}) {

  const cpfCnpj =
    onlyDigits(cpf);

  const mobilePhone =
    onlyDigits(telefone);

  /*
   * Primeiro tentamos localizar
   * pelo CPF/CNPJ.
   */
  try {

    const existing =
      await asaas.get(
        "/customers",
        {
          params: {
            cpfCnpj,
            limit: 1
          }
        }
      );

    const customer =
      existing?.data?.data?.[0];

    if (
      customer?.id
    ) {
      return customer.id;
    }

  } catch (e) {

    console.warn(
      "[ASAAS DIRETO] falha ao procurar customer:",
      e?.response?.data ||
      e.message
    );
  }


  /*
   * Não existe → cria.
   */
  const created =
    await asaas.post(
      "/customers",
      {
        name:
          nome,

        email:
          email,

        cpfCnpj,

        mobilePhone,

        notificationDisabled:
          false
      }
    );

  const customerId =
    created?.data?.id;

  if (!customerId) {
    throw new Error(
      "Asaas criou customer sem ID."
    );
  }

  return customerId;
}


/* ======================================================
   PIX DIRETO
   GET /pagamento/asaas-direto/criar-pix/:tipo/:session_id
====================================================== */

router.get(
  "/criar-pix/:tipo/:session_id",
  async (req, res) => {

    try {

      const tipo =
        normalizeTipo(
          req.params.tipo
        );

      const session_id =
        String(
          req.params.session_id ||
          ""
        ).trim();

      const cpf =
        onlyDigits(
          req.query.cpf
        );

      const valorFinal =
        clampValor(
          req.query.valor,
          mapPreco(tipo)
        );


      if (!session_id) {
        return res.status(400).json({
          erro:
            "session_id obrigatório."
        });
      }


      if (!cpf) {
        return res.status(400).json({
          erro:
            "CPF obrigatório."
        });
      }


      if (
        !process.env.ASAAS_API_KEY
      ) {
        return res.status(500).json({
          erro:
            "ASAAS_API_KEY não configurada."
        });
      }


      /*
       * Carrega diagnóstico.
       */
      const { rows } =
        await pool.query(
          `
            SELECT
              session_id,
              nome,
              email,
              telefone,
              status_pagamento,
              asaas_payment_id
            FROM diagnosticos
            WHERE session_id = $1
            LIMIT 1
          `,
          [session_id]
        );


      if (!rows.length) {
        return res.status(404).json({
          erro:
            "Sessão não encontrada."
        });
      }


      const diag =
        rows[0];


      /*
       * Se já pagou, não cria cobrança nova.
       */
      if (
        String(
          diag.status_pagamento ||
          ""
        ).toLowerCase() === "pago"
      ) {
        return res.json({
          alreadyPaid: true,
          redirect:
            `/aguarde.html?session_id=${encodeURIComponent(
              session_id
            )}`
        });
      }


      const customerId =
        await getOrCreateCustomer({
          nome:
            diag.nome,

          email:
            diag.email,

          telefone:
            diag.telefone,

          cpf
        });


      /*
       * Cria cobrança PIX SEM split.
       */
      const pagamento =
        await asaas.post(
          "/payments",
          {
            customer:
              customerId,

            billingType:
              "PIX",

            value:
              valorFinal,

            dueDate:
              new Date()
                .toISOString()
                .slice(0, 10),

            description:
              `Checkup Emocional ${tipo} - ${session_id}`,

            externalReference:
              session_id
          }
        );


      const paymentId =
        pagamento?.data?.id;


      if (!paymentId) {
        throw new Error(
          "Pagamento criado sem ID."
        );
      }


      /*
       * Guarda vínculo no diagnóstico.
       */
      await pool.query(
        `
          UPDATE diagnosticos
          SET
            gateway = 'asaas',
            tipo_relatorio = $1,
            asaas_payment_id = $2,
            updated_at = NOW()
          WHERE session_id = $3
        `,
        [
          mapTipoRelatorio(tipo),
          paymentId,
          session_id
        ]
      );


      /*
       * Busca QR Code PIX.
       */
      const qr =
        await asaas.get(
          `/payments/${encodeURIComponent(
            paymentId
          )}/pixQrCode`
        );


      return res.json({
        gateway:
          "asaas",

        payment_id:
          paymentId,

        qr_code:
          qr?.data?.payload || "",

        qr_code_base64:
          qr?.data?.encodedImage || "",

        expiration_date:
          qr?.data?.expirationDate || null,

        valor:
          valorFinal
      });


    } catch (e) {

      console.error(
        "[ASAAS DIRETO PIX] erro:",
        e?.response?.data ||
        e.message
      );

      return res
        .status(500)
        .json({
          erro:
            "Não foi possível gerar o PIX.",

          detalhe:
            e?.response?.data ||
            e.message
        });
    }
  }
);


/* ======================================================
   CHECKOUT ASAAS DIRETO
   PIX + CARTÃO NA PÁGINA DO ASAAS

   POST /pagamento/asaas-direto/criar-checkout
====================================================== */

router.post(
  "/criar-checkout",
  async (req, res) => {

    try {

      const {
        tipo,
        session_id,
        valor
      } =
        req.body || {};


      const tipoNorm =
        normalizeTipo(tipo);


      const sessionId =
        String(
          session_id ||
          ""
        ).trim();


      if (
        !sessionId
      ) {
        return res
          .status(400)
          .json({
            error:
              "session_id obrigatório."
          });
      }


      if (
        !process.env.ASAAS_API_KEY
      ) {
        return res
          .status(500)
          .json({
            error:
              "ASAAS_API_KEY não configurada."
          });
      }


      const valorFinal =
        clampValor(
          valor,
          mapPreco(tipoNorm)
        );


      const { rows } =
        await pool.query(
          `
            SELECT
              session_id,
              nome,
              email,
              status_pagamento
            FROM diagnosticos
            WHERE session_id = $1
            LIMIT 1
          `,
          [sessionId]
        );


      if (!rows.length) {
        return res
          .status(404)
          .json({
            error:
              "Sessão não encontrada."
          });
      }


      const diag =
        rows[0];


      if (
        String(
          diag.status_pagamento ||
          ""
        ).toLowerCase() ===
        "pago"
      ) {
        return res.json({
          alreadyPaid:
            true,

          redirect:
            `/aguarde.html?session_id=${encodeURIComponent(
              sessionId
            )}`
        });
      }


      const callbackBase =
        normalizeHttpsBase(
          process.env.APP_URL ||
          process.env.CALLBACK_BASE_URL ||
          process.env.PUBLIC_BASE_URL ||
          "https://api.canvaspiritual.com"
        );


      const successUrl =
        `${callbackBase}/aguarde.html?session_id=${encodeURIComponent(
          sessionId
        )}`;


      const cancelUrl =
        `${callbackBase}/pagar-mini-asaas.html?tipo=completo&session_id=${encodeURIComponent(
          sessionId
        )}`;


      const expiredUrl =
        `${cancelUrl}&exp=1`;


      /*
       * Checkout ASAAS SEM SPLIT.
       *
       * Não existe:
       * splits
       * walletId
       * affiliate
       * vendor
       */
      const payloadCheckout = {

        billingTypes: [
          "PIX",
          "CREDIT_CARD"
        ],

        chargeTypes: [
          "DETACHED"
        ],

        minutesToExpire:
          90,

        callback: {
          successUrl,
          cancelUrl,
          expiredUrl
        },

        items: [
          {
            name:
              `Checkup Emocional ${tipoNorm}`,

            description:
              `Mapa da Alma - ${sessionId}`,

            value:
              valorFinal,

            quantity:
              1
          }
        ],

        externalReference:
          sessionId
      };


      const created =
        await asaas.post(
          "/checkouts",
          payloadCheckout
        );


      const checkoutId =
        created?.data?.id;


      if (
        !checkoutId
      ) {
        throw new Error(
          "Checkout criado sem ID."
        );
      }


      /*
       * Salva vínculo do checkout.
       */
      try {

        await pool.query(
          `
            UPDATE diagnosticos
            SET
              gateway = 'asaas',
              tipo_relatorio = $1,
              asaas_checkout_id = $2,
              updated_at = NOW()
            WHERE session_id = $3
          `,
          [
            mapTipoRelatorio(
              tipoNorm
            ),

            checkoutId,

            sessionId
          ]
        );

      } catch (e) {

        /*
         * Caso a coluna ainda não exista,
         * mantém o comportamento de segurança
         * semelhante ao pagamentoStart atual.
         */
        console.warn(
          "[ASAAS DIRETO] asaas_checkout_id indisponível:",
          e.message
        );


        await pool.query(
          `
            UPDATE diagnosticos
            SET
              gateway = 'asaas',
              tipo_relatorio = $1,
              updated_at = NOW()
            WHERE session_id = $2
          `,
          [
            mapTipoRelatorio(
              tipoNorm
            ),

            sessionId
          ]
        );
      }


      return res.json({
        gateway:
          "asaas",

        checkout_url:
          `${ASAAS_CHECKOUT_VIEW}${encodeURIComponent(
            checkoutId
          )}`
      });


    } catch (e) {

      console.error(
        "[ASAAS DIRETO CHECKOUT] erro:",
        e?.response?.data ||
        e.message
      );


      return res
        .status(500)
        .json({
          error:
            "Não foi possível abrir o checkout Asaas.",

          detalhe:
            e?.response?.data ||
            e.message
        });
    }
  }
);


module.exports =
  router;