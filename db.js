const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_name TEXT        NOT NULL,
        s3_key        TEXT        NOT NULL UNIQUE,
        s3_bucket     TEXT        NOT NULL,
        mime_type     TEXT,
        file_size     BIGINT      NOT NULL DEFAULT 0,
        checksum      TEXT,
        folder        TEXT        DEFAULT '/',
        tags          TEXT[]      DEFAULT '{}',
        visibility    TEXT        DEFAULT 'private'
                        CHECK (visibility IN ('public', 'private')),
        download_count INTEGER    DEFAULT 0,
        uploaded_by   TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);
    `);

    console.log("✅ Database initialised — files table is ready");
  } catch (error) {
    console.error("❌ Database initialisation failed:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function checkDatabaseHealth() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return { status: "healthy", timestamp: new Date().toISOString() };
  } catch (error) {
    return { status: "unhealthy", error: error.message };
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase, checkDatabaseHealth };
