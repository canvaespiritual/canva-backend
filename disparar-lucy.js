require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");

async function main() {
  const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue("relatorios", { connection });

  const session_id = "sessao-1770498008592"; // Lucy
  await queue.add("gerar_relatorio", { session_id }, { removeOnComplete: true, attempts: 3 });

  console.log("✅ Job enfileirado para:", session_id);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
