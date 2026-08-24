require("dotenv").config();

const { Queue, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");
const pool = require("./src/db"); // ajuste o caminho, se necessário

async function main() {
  const session_id = "sessao-1787438057370";

  const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  const queueEventsConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
  });

  const queue = new Queue("relatorios", { connection });

  const queueEvents = new QueueEvents("relatorios", {
    connection: queueEventsConnection
  });

  await queueEvents.waitUntilReady();

  let tipoOriginal;

  try {
    // 1. Busca e guarda o tipo original
    const { rows } = await pool.query(
      `
        SELECT tipo_relatorio
        FROM diagnosticos
        WHERE session_id = $1
      `,
      [session_id]
    );

    if (!rows.length) {
      throw new Error(`Sessão não encontrada: ${session_id}`);
    }

    tipoOriginal = rows[0].tipo_relatorio || "essencial";

    console.log("📌 Tipo original:", tipoOriginal);

    // 2. Altera temporariamente para completo
    await pool.query(
      `
        UPDATE diagnosticos
        SET tipo_relatorio = 'completo'
        WHERE session_id = $1
      `,
      [session_id]
    );

    console.log("🎯 Tipo alterado temporariamente para completo.");

    // 3. Enfileira
    const job = await queue.add(
      "gerar_relatorio",
      { session_id },
      {
        removeOnComplete: true,
        attempts: 3
      }
    );

    console.log("🌀 Job enfileirado:", job.id);

    // 4. Espera o worker finalizar
    await job.waitUntilFinished(queueEvents, 180000);

    console.log("✅ Relatório completo processado.");
  } finally {
    // 5. Restaura o tipo original mesmo se ocorrer erro no script
    if (tipoOriginal) {
      await pool.query(
        `
          UPDATE diagnosticos
          SET tipo_relatorio = $1
          WHERE session_id = $2
        `,
        [tipoOriginal, session_id]
      );

      console.log("🔄 Tipo original restaurado:", tipoOriginal);
    }

    await queue.close();
    await queueEvents.close();
    await connection.quit();
    await queueEventsConnection.quit();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Erro:", error);
  process.exit(1);
});