const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Conexão com o Redis (use variável de ambiente se possível)
const connection = new IORedis(process.env.REDIS_URL);

const filaRelatorios = new Queue('relatorios', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true, // limpa jobs concluídos
    attempts: 3,             // tenta de novo se falhar
    backoff: {
      type: 'exponential',
      delay: 5000            // espera 5s antes do retry
    }
  }
});

module.exports = filaRelatorios;
