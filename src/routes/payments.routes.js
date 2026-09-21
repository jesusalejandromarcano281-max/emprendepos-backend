const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../config/database');
const auth = require('../middleware/auth');
const tenantCheck = require('../middleware/tenant');
const roleCheck = require('../middleware/roleCheck');

// GET /api/payments/methods - Devuelve los métodos de pago disponibles (Público/Auth no requiere tenant)
router.get('/methods', auth, (req, res) => {
  res.json({
    pago_movil: {
      cedula: 'V-28039554',
      telefono: '04123232392',
      banco: 'Mercantil'
    },
    binance: {
      id: '193628341'
    }
  });
});

// GET /api/payments - Lista de pagos del tenant actual
router.get('/', auth, tenantCheck, (req, res) => {
  try {
    const payments = dbAll(
      'SELECT * FROM payments WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// POST /api/payments - Crear un nuevo pago (subir comprobante)
router.post('/', auth, tenantCheck, (req, res) => {
  const { amount, currency, method, reference, proof_image, plan, notes } = req.body;

  if (!amount || !method || !reference || !plan || !proof_image) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const { lastId } = dbRun(
      \`INSERT INTO payments (tenant_id, amount, currency, method, reference, proof_image, plan, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
      [req.tenantId, amount, currency || 'USD', method, reference, proof_image, plan, notes || '']
    );

    res.status(201).json({ message: 'Pago registrado exitosamente. En espera de aprobación.', payment_id: lastId });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

// ==========================================
// RUTAS SUPERADMIN
// ==========================================

// GET /api/payments/all - Listar todos los pagos (SuperAdmin)
router.get('/all', auth, roleCheck('admin'), (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  try {
    const status = req.query.status;
    let query = \`
      SELECT p.*, t.name as tenant_name 
      FROM payments p 
      JOIN tenants t ON p.tenant_id = t.id
    \`;
    const params = [];

    if (status) {
      query += ' WHERE p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const payments = dbAll(query, params);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// PUT /api/payments/:id/approve - Aprobar pago (SuperAdmin)
router.put('/:id/approve', auth, roleCheck('admin'), (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  try {
    const payment = dbGet('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'El pago ya fue procesado' });
    }

    // 1. Marcar pago como aprobado
    dbRun(
      'UPDATE payments SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', req.user.id, payment.id]
    );

    // 2. Actualizar plan del tenant (30 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expiresAtStr = expiresAt.toISOString();

    dbRun(
      'UPDATE tenants SET plan = ?, plan_status = ?, plan_expires_at = ? WHERE id = ?',
      [payment.plan, 'active', expiresAtStr, payment.tenant_id]
    );

    res.json({ message: 'Pago aprobado y plan activado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar el pago' });
  }
});

// PUT /api/payments/:id/reject - Rechazar pago (SuperAdmin)
router.put('/:id/reject', auth, roleCheck('admin'), (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  const { notes } = req.body;

  try {
    dbRun(
      'UPDATE payments SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['rejected', notes || 'Comprobante inválido', req.user.id, req.params.id]
    );

    res.json({ message: 'Pago rechazado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar el pago' });
  }
});

module.exports = router;
