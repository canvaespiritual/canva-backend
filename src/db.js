const { Pool } = require('pg');

const pool = new Pool({
  user: 'canvaespiritual',
  host: 'localhost',
  database: 'canva',
  password: 'Crailgra272@',
  port: 5432,
});

module.exports = pool;
