const { dbGet, dbRun } = require('../config/database');

const PLAN_LIMITS = {
  basico: {
    users: 1,
    products: 50,
    features: ['gastos']
  },
  pro: {
    users: 3,
    products: 300,
    features: ['gastos', 'pdf', 'multi-moneda']
  },
  enterprise: {
    users: Infinity,
    products: Infinity,
    features: ['gastos', 'pdf', 'multi-moneda']
  }
};

// Middleware: Check that the tenant's plan is active (not expired)
async function checkPlanActive(req, res, next) {
  try {
    const tenant = await dbGet('SELECT plan, plan_status, plan_expires_at FROM tenants WHERE id = $1', [req.tenantId]);
    if (!tenant) return res.status(404).json({ error: 'Comercio no encontrado' });

    if (tenant.plan_status === 'expired') {
      return res.status(403).json({ error: 'Suscripción expirada. Por favor realice un pago para continuar.', code: 'PLAN_EXPIRED' });
    }

    if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) {
      await dbRun('UPDATE tenants SET plan_status = $1 WHERE id = $2', ['expired', req.tenantId]);
      return res.status(403).json({ error: 'Suscripción expirada. Por favor realice un pago para continuar.', code: 'PLAN_EXPIRED' });
    }

    req.tenantPlan = tenant.plan || 'basico';
    req.planFeatures = PLAN_LIMITS[req.tenantPlan].features;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar plan' });
  }
}

// Middleware: Check product creation limit
async function checkProductLimit(req, res, next) {
  try {
    const tenant = await dbGet('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
    const planInfo = PLAN_LIMITS[tenant ? tenant.plan : 'basico'];
    const row = await dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = $1', [req.tenantId]);
    const count = parseInt(row.count, 10);
    if (count >= planInfo.products) {
      return res.status(403).json({
        error: `Límite alcanzado. El plan ${tenant.plan} solo permite ${planInfo.products} productos.`,
        code: 'LIMIT_REACHED'
      });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar límites del plan' });
  }
}

// Middleware: Check user creation limit
async function checkUserLimit(req, res, next) {
  try {
    const tenant = await dbGet('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
    const planInfo = PLAN_LIMITS[tenant ? tenant.plan : 'basico'];
    const row = await dbGet('SELECT COUNT(*) as count FROM users WHERE tenant_id = $1', [req.tenantId]);
    const count = parseInt(row.count, 10);
    if (count >= planInfo.users) {
      return res.status(403).json({
        error: `Límite alcanzado. El plan ${tenant.plan} solo permite ${planInfo.users} usuarios.`,
        code: 'LIMIT_REACHED'
      });
    }
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar límites del plan' });
  }
}

function getPlanInfo(req, res) {
  res.json(PLAN_LIMITS);
}

module.exports = { checkPlanActive, checkProductLimit, checkUserLimit, getPlanInfo, PLAN_LIMITS };
