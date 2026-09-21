const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');

// Public Self-Onboarding: Register a new merchant / business
router.post('/register-tenant', async (req, res) => {
  try {
    const { business_name, rif, address, phone, admin_name, admin_email, admin_password } = req.body;

    if (!business_name || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'Nombre del negocio, nombre de usuario, correo y contraseña son requeridos' });
    }

    // Check if email already registered
    const existingUser = await dbGet('SELECT id FROM users WHERE email = $1', [admin_email]);
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado en la plataforma' });
    }

    // Generate unique slug
    const slugBase = business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

    // 1. Create Tenant
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 7);

    const { lastId: tenantId } = await dbRun(
      'INSERT INTO tenants (name, slug, rif, address, phone, plan, status, plan_status, plan_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [business_name, slug, rif || '', address || '', phone || '', 'basico', 'activo', 'trial', trialExpires.toISOString()]
    );

    // 2. Create Admin User
    const password_hash = bcrypt.hashSync(admin_password, 10);
    const { lastId: userId } = await dbRun(
      'INSERT INTO users (tenant_id, name, email, password, role, is_superadmin) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [tenantId, admin_name, admin_email, password_hash, 'admin', 0]
    );

    // 3. Create Default Settings
    await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3) RETURNING id', [tenantId, 'exchange_rate', '40.00']);
    await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3) RETURNING id', [tenantId, 'business_name', business_name]);
    if (rif) await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3) RETURNING id', [tenantId, 'business_rif', rif]);
    if (address) await dbRun('INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3) RETURNING id', [tenantId, 'business_address', address]);

    if (typeof saveDatabase === 'function') saveDatabase();

    // 4. Generate JWT
    const token = jwt.sign(
      { id: userId, email: admin_email, role: 'admin', tenant_id: tenantId, is_superadmin: 0 },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id: userId, name: admin_name, email: admin_email, role: 'admin', is_superadmin: 0 },
      tenant: { id: tenantId, name: business_name, slug, plan: 'basico', status: 'activo', plan_status: 'trial', plan_expires_at: trialExpires.toISOString() }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// SuperAdmin Routes (Protected)
router.get('/superadmin/tenants', auth, async (req, res) => {
  try {
    if (!req.user.is_superadmin) {
      return res.status(403).json({ error: 'Acceso reservado para el SuperAdministrador de la plataforma' });
    }

    const tenants = await dbAll(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as total_usuarios,
        (SELECT COUNT(*) FROM sales s WHERE s.tenant_id = t.id) as total_ventas,
        (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.tenant_id = t.id) as total_facturado
      FROM tenants t
      ORDER BY t.created_at DESC
    `);

    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/superadmin/tenants/:id/status', auth, async (req, res) => {
  try {
    if (!req.user.is_superadmin) {
      return res.status(403).json({ error: 'Acceso reservado para el SuperAdministrador de la plataforma' });
    }

    const { status, plan } = req.body;
    const tenantId = req.params.id;

    const current = await dbGet('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (!current) return res.status(404).json({ error: 'Comercio no encontrado' });

    const newStatus = status || current.status;
    const newPlan = plan || current.plan;

    await dbRun('UPDATE tenants SET status = $1, plan = $2 WHERE id = $3', [newStatus, newPlan, tenantId]);
    if (typeof saveDatabase === 'function') saveDatabase();

    const updated = await dbGet('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
