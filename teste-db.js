const pool = require('./db');

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erro na conexão com o PostgreSQL:', err);
  } else {
    console.log('✅ Conexão bem-sucedida! Hora atual do banco:', res.rows[0]);
  }
  pool.end();
});
