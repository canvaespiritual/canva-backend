// db.js
const { Pool, types } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Força o Postgres a devolver DATE como string "YYYY-MM-DD"
 * (evita o bug do "-1 dia" ao cair em Date/UTC no Node)
 */
types.setTypeParser(1082, (val) => val); // OID 1082 = DATE

// Opcional: se quiser que TIMESTAMP também venha como string (cuidado se seu código espera Date)
// types.setTypeParser(1114, (val) => val); // TIMESTAMP sem TZ
// types.setTypeParser(1184, (val) => val); // TIMESTAMP com TZ

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
