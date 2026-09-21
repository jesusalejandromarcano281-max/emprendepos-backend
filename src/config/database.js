const { Pool } = require('pg');

let pool;

async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ No DATABASE_URL provided. Database connection might fail.");
  }
  
  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Conectado a PostgreSQL en Supabase:', res.rows[0]);
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err);
  }
}

async function dbRun(sql, params = []) {
  try {
    const res = await pool.query(sql, params);
    // If it's an INSERT with RETURNING, return the lastId
    if (res.rows && res.rows.length > 0 && res.rows[0].id) {
       return { lastId: res.rows[0].id };
    }
    return { lastId: null };
  } catch (err) {
    console.error('Database Error in dbRun:', err, sql, params);
    throw err;
  }
}

async function dbGet(sql, params = []) {
  try {
    const res = await pool.query(sql, params);
    return res.rows[0] || null;
  } catch (err) {
    console.error('Database Error in dbGet:', err, sql, params);
    throw err;
  }
}

async function dbAll(sql, params = []) {
  try {
    const res = await pool.query(sql, params);
    return res.rows;
  } catch (err) {
    console.error('Database Error in dbAll:', err, sql, params);
    throw err;
  }
}

function saveDatabase() {
  // Not needed for PostgreSQL
}

module.exports = { initDatabase, dbRun, dbGet, dbAll, saveDatabase };
