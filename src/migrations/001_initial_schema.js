const bcrypt = require('bcryptjs');
const { dbRun, saveDatabase, dbGet } = require('../config/database');

async function runMigrations() {
  // tenants table
  dbRun(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      rif TEXT,
      address TEXT,
      phone TEXT,
      plan TEXT DEFAULT 'basico',
      status TEXT DEFAULT 'activo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // users
  dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_superadmin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // products
  dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // clients
  dbRun(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      document TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // sales
  dbRun(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      client_id INTEGER,
      user_id INTEGER,
      total REAL NOT NULL,
      descuento REAL DEFAULT 0,
      notas TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // sale_items
  dbRun(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // expenses
  dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      category TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // incomes
  dbRun(`
    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      category TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // settings
  dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      tenant_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (tenant_id, key),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // Seed default tenant
  const tenantExists = dbGet('SELECT id FROM tenants WHERE slug = ?', ['demo']);
  let defaultTenantId = tenantExists?.id;
  if (!tenantExists) {
    const { lastId } = dbRun(
      'INSERT INTO tenants (name, slug, rif, address, plan, status) VALUES (?, ?, ?, ?, ?, ?)',
      ['Demo Negocio C.A.', 'demo', 'J-12345678-9', 'Av. Principal Local 1', 'pro', 'activo']
    );
    defaultTenantId = lastId;
  }

  // Seed Admin User (superadmin & admin of default tenant)
  const adminExists = dbGet('SELECT id FROM users WHERE email = ?', ['admin@admin.com']);
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    dbRun(
      'INSERT INTO users (tenant_id, name, email, password, role, is_superadmin) VALUES (?, ?, ?, ?, ?, ?)',
      [defaultTenantId, 'Admin Master', 'admin@admin.com', hash, 'admin', 1]
    );
  }

  // Seed sample products for default tenant
  const productExists = dbGet('SELECT id FROM products WHERE tenant_id = ? LIMIT 1', [defaultTenantId]);
  if (!productExists) {
    dbRun('INSERT INTO products (tenant_id, name, price, cost, stock, min_stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [defaultTenantId, 'Camisa Talla S', 15.00, 8.00, 25, 5, 'Ropa']);
    dbRun('INSERT INTO products (tenant_id, name, price, cost, stock, min_stock, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [defaultTenantId, 'Zapatos Deportivos', 45.00, 25.00, 10, 2, 'Calzado']);
  }

  // Seed sample client for default tenant
  const clientExists = dbGet('SELECT id FROM clients WHERE tenant_id = ? LIMIT 1', [defaultTenantId]);
  if (!clientExists) {
    dbRun('INSERT INTO clients (tenant_id, name, email, phone) VALUES (?, ?, ?, ?)', [defaultTenantId, 'Cliente Demo', 'cliente@demo.com', '0414-1234567']);
  }

  // Seed settings for default tenant
  const rateExists = dbGet('SELECT key FROM settings WHERE tenant_id = ? AND key = ?', [defaultTenantId, 'exchange_rate']);
  if (!rateExists) {
    dbRun('INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)', [defaultTenantId, 'exchange_rate', '40.00']);
    dbRun('INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)', [defaultTenantId, 'business_name', 'Demo Negocio C.A.']);
    dbRun('INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)', [defaultTenantId, 'business_rif', 'J-12345678-9']);
  }

  saveDatabase();
}

module.exports = { runMigrations };
