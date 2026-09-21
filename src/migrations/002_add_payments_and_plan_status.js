const { dbRun, saveDatabase } = require('../config/database');

async function runMigration002() {
  // Add plan_expires_at to tenants if not exists
  try {
    dbRun(`ALTER TABLE tenants ADD COLUMN plan_expires_at DATETIME`);
  } catch (err) {
    // Column might already exist
    if (!err.message.includes('duplicate column name')) {
      console.log('Info: plan_expires_at might already exist or error:', err.message);
    }
  }

  try {
    dbRun(`ALTER TABLE tenants ADD COLUMN plan_status TEXT DEFAULT 'trial'`);
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.log('Info: plan_status might already exist or error:', err.message);
    }
  }

  // Create payments table
  dbRun(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      method TEXT NOT NULL,
      reference TEXT,
      proof_image TEXT,
      status TEXT DEFAULT 'pending',
      plan TEXT NOT NULL,
      notes TEXT,
      reviewed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    )
  `);

  saveDatabase();
}

module.exports = { runMigration002 };
