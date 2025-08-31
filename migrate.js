// migrate.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

(async () => {
  const file = path.join(__dirname, 'migrations', 'affiliates.sql'); // <-- usa seu nome
  const sql = fs.readFileSync(file, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql); // aplica só a migração dos afiliados
    await client.query('COMMIT');
    console.log('✅ Migração de afiliados aplicada com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', err);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
})();
