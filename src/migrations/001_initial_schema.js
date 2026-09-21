const bcrypt = require('bcryptjs');
const { dbRun, dbGet } = require('../config/database');

async function runMigrations() {
  // tenants table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      rif TEXT,
      address TEXT,
      phone TEXT,
      plan TEXT DEFAULT 'basico',
      status TEXT DEFAULT 'activo',
      plan_status TEXT DEFAULT 'trial',
      plan_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // users
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_superadmin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // products
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      category TEXT,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // clients
  await dbRun(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      document TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // sales
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      client_id INTEGER,
      user_id INTEGER,
      total REAL NOT NULL,
      descuento REAL DEFAULT 0,
      notas TEXT,
      status TEXT DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // sale_items
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
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
  await dbRun(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      category TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // incomes
  await dbRun(`
    CREATE TABLE IF NOT EXISTS incomes (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      category TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // settings
  await dbRun(`
    CREATE TABLE IF NOT EXISTS settings (
      tenant_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (tenant_id, key),
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // payments
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(reviewed_by) REFERENCES users(id)
    )
  `);

  // Seed default tenant
  const tenantExists = await dbGet('SELECT id FROM tenants WHERE slug = $1', ['demo']);
  let defaultTenantId = tenantExists?.id;
  if (!tenantExists) {
    const res = await dbRun(
      'INSERT INTO tenants (name, slug, rif, address, plan, status, plan_status, plan_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      ['Demo Negocio C.A.', 'demo', 'J-12345678-9', 'Av. Principal Local 1', 'pro', 'activo', 'active', '2099-12-31']
    );
    defaultTenantId = res.lastId;
  }

  // Seed Admin User
  if (defaultTenantId) {
     const adminExists = await dbGet('SELECT id FROM users WHERE email = $1', ['admin@admin.com']);
     if (!adminExists) {
       const hash = bcrypt.hashSync('admin123', 10);
       await dbRun(
         'INSERT INTO users (tenant_id, name, email, password, role, is_superadmin) VALUES ($1, $2, $3, $4, $5, $6)',
         [defaultTenantId, 'Admin Master', 'admin@admin.com', hash, 'admin', 1]
       );
     }

     // Seed settings for default tenant
     const rateExists = await dbGet('SELECT key FROM settings WHERE tenant_id = $1 AND key = $2', [defaultTenantId, 'exchange_rate']);
     if (!rateExists) {
       await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3)', [defaultTenantId, 'exchange_rate', '40.00']);
       await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3)', [defaultTenantId, 'business_name', 'Demo Negocio C.A.']);
       await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3)', [defaultTenantId, 'business_rif', 'J-12345678-9']);
     }
  }
}

module.exports = { runMigrations };
