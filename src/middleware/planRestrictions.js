const { dbGet, dbAll } = require('../config/database');

const PLAN_LIMITS = {
  basico: {
    users: 1,
    products: 50,
    features: ['gastos'] // sin pdf, sin multi-moneda
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

const planRestrictions = (resource) => {
  return (req, res, next) => {
    try {
      const tenant = dbGet('SELECT plan, plan_status, plan_expires_at FROM tenants WHERE id = ?', [req.tenantId]);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Comercio no encontrado' });
      }

      // 1. Validar que el plan no esté expirado (si no es 'activo' o 'trial')
      if (tenant.plan_status === 'expired') {
         return res.status(403).json({ error: 'Suscripción expirada. Por favor realice un pago para continuar.', code: 'PLAN_EXPIRED' });
      }

      // Revisar si ya expiró por fecha
      if (tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date()) {
         // Auto-expirar
         const { dbRun } = require('../config/database');
         dbRun('UPDATE tenants SET plan_status = ? WHERE id = ?', ['expired', req.tenantId]);
         return res.status(403).json({ error: 'Suscripción expirada. Por favor realice un pago para continuar.', code: 'PLAN_EXPIRED' });
      }

      const planInfo = PLAN_LIMITS[tenant.plan || 'basico'];

      // 2. Validar límites de creación
      if (resource === 'products' && req.method === 'POST') {
        const count = dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [req.tenantId]).count;
        if (count >= planInfo.products) {
          return res.status(403).json({ 
            error: \`Límite alcanzado. El plan \${tenant.plan} solo permite \${planInfo.products} productos.\`,
            code: 'LIMIT_REACHED'
          });
        }
      }

      if (resource === 'users' && req.method === 'POST') {
        const count = dbGet('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [req.tenantId]).count;
        if (count >= planInfo.users) {
          return res.status(403).json({ 
            error: \`Límite alcanzado. El plan \${tenant.plan} solo permite \${planInfo.users} usuarios.\`,
            code: 'LIMIT_REACHED'
          });
        }
      }

      // Inyectar plan en request por si alguna ruta necesita validar features (ej. PDF)
      req.tenantPlan = tenant.plan;
      req.planFeatures = planInfo.features;

      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al verificar restricciones del plan' });
    }
  };
};

module.exports = planRestrictions;
