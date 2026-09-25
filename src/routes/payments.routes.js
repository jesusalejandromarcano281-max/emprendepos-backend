const express = require('express');
const router = express.Router();
const { dbGet, dbAll, dbRun } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');
const { roleCheck } = require('../middleware/roleCheck');

// GET /api/payments/methods
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

// GET /api/payments
router.get('/', auth, tenantCheck, async (req, res) => {
  try {
    const payments = await dbAll(
      'SELECT * FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.tenantId]
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// POST /api/payments
router.post('/', auth, tenantCheck, async (req, res) => {
  const { amount, currency, method, reference, proof_image, plan, notes } = req.body;

  if (!amount || !method || !reference || !plan || !proof_image) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const { lastId } = await dbRun(
      `INSERT INTO payments (tenant_id, amount, currency, method, reference, proof_image, plan, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
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

// GET /api/payments/all
router.get('/all', auth, roleCheck('admin'), async (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  try {
    const status = req.query.status;
    let query = `
      SELECT p.*, t.name as tenant_name 
      FROM payments p 
      JOIN tenants t ON p.tenant_id = t.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE p.status = $1';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const payments = await dbAll(query, params);
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

// GET /api/payments/pending — alias for frontend SuperAdmin page
router.get('/pending', auth, roleCheck('admin'), async (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  try {
    const payments = await dbAll(`
      SELECT p.*, t.name as tenant_name 
      FROM payments p 
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `, []);
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pagos pendientes' });
  }
});

// PUT /api/payments/:id/approve
router.put('/:id/approve', auth, roleCheck('admin'), async (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  try {
    const payment = await dbGet('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'El pago ya fue procesado' });
    }

    await dbRun(
      'UPDATE payments SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['approved', req.user.id, payment.id]
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await dbRun(
      'UPDATE tenants SET plan = $1, plan_status = $2, plan_expires_at = $3 WHERE id = $4',
      [payment.plan, 'active', expiresAt.toISOString(), payment.tenant_id]
    );

    res.json({ message: 'Pago aprobado y plan activado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar el pago' });
  }
});

// PUT /api/payments/:id/reject
router.put('/:id/reject', auth, roleCheck('admin'), async (req, res) => {
  if (req.user.is_superadmin !== 1) {
    return res.status(403).json({ error: 'Acceso denegado. Solo SuperAdmin.' });
  }

  const { notes } = req.body;

  try {
    await dbRun(
      'UPDATE payments SET status = $1, notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP WHERE id = $4',
      ['rejected', notes || 'Comprobante inválido', req.user.id, req.params.id]
    );

    res.json({ message: 'Pago rechazado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar el pago' });
  }
});

module.exports = router;
