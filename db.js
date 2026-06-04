const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

const initDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS files (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(255) NOT NULL,
      url         TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(createTableQuery);
    console.log("✅ Database table ready");
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    throw err;
  }
};

module.exports = { pool, initDatabase };
