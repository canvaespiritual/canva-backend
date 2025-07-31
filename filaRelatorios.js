// filaRelatorios.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL);

const filaRelatorios = new Queue('relatorios', {
  connection
});

module.exports = filaRelatorios;
