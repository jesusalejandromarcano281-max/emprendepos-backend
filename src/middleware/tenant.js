const { dbGet } = require('../config/database');

async function tenantCheck(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Superadmin can access everything or specify header X-Tenant-Id
  if (req.user.is_superadmin) {
    const overrideTenant = req.headers['x-tenant-id'];
    req.tenantId = overrideTenant ? Number(overrideTenant) : req.user.tenant_id;
    return next();
  }

  if (!req.user.tenant_id) {
    return res.status(403).json({ error: 'Usuario no asignado a ningún comercio' });
  }

  try {
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = $1', [req.user.tenant_id]);
    if (!tenant) {
      return res.status(404).json({ error: 'Comercio no encontrado' });
    }

    if (tenant.status === 'suspendido') {
      return res.status(403).json({ error: 'La suscripción de este comercio está suspendida. Por favor contacta al administrador.' });
    }

    req.tenantId = tenant.id;
    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('Tenant check error', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
}

module.exports = { tenantCheck };
