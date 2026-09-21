const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

router.get('/', (req, res) => {
  let sql = `
    SELECT s.id, s.created_at as fecha, c.name as cliente_nombre, u.name as usuario_nombre, s.total
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.tenant_id = ?
  `;
  let params = [req.tenantId];

  if (req.query.desde && req.query.hasta) {
    sql += " AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)";
    params.push(req.query.desde, req.query.hasta);
  }

  sql += " ORDER BY s.created_at DESC";

  const sales = dbAll(sql, params);
  res.json(sales);
});

router.get('/:id', (req, res) => {
  const sale = dbGet(`
    SELECT s.id, s.created_at as fecha, c.name as cliente_nombre, u.name as usuario_nombre, s.total, s.notas, s.descuento
    FROM sales s
    LEFT JOIN clients c ON s.client_id = c.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.tenant_id = ? AND s.id = ?
  `, [req.tenantId, req.params.id]);

  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

  const items = dbAll(`
    SELECT si.quantity as cantidad, si.price as precio_unitario, si.subtotal, p.name as producto_nombre
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `, [req.params.id]);

  sale.items = items;
  res.json(sale);
});

router.post('/', (req, res) => {
  const { client_id, items, descuento, notas } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'La venta debe tener items' });

  let total = 0;
  // Validate stock for tenant's products
  for (let item of items) {
    const p = dbGet('SELECT * FROM products WHERE tenant_id = ? AND id = ?', [req.tenantId, item.product_id]);
    if (!p) return res.status(400).json({ error: `Producto no encontrado: ${item.product_id}` });
    if (p.stock < item.cantidad) {
      return res.status(400).json({ error: `Stock insuficiente para ${p.name}` });
    }
    item.precio_unitario = p.price;
    item.subtotal = p.price * item.cantidad;
    total += item.subtotal;
  }
  
  if (descuento) total = Math.max(0, total - Number(descuento));

  try {
    const saleRes = dbRun(
      'INSERT INTO sales (tenant_id, client_id, user_id, total, descuento, notas) VALUES (?, ?, ?, ?, ?, ?)',
      [req.tenantId, client_id || null, req.user.id, total, descuento || 0, notas || null]
    );
    const saleId = saleRes.lastId;

    for (let item of items) {
      dbRun(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [saleId, item.product_id, item.cantidad, item.precio_unitario, item.subtotal]
      );
      dbRun(
        'UPDATE products SET stock = stock - ? WHERE tenant_id = ? AND id = ?',
        [item.cantidad, req.tenantId, item.product_id]
      );
    }
    saveDatabase();
    res.status(201).json({ id: saleId, total, message: 'Venta creada exitosamente' });
  } catch (error) {
    console.error('ERROR EN VENTAS:', error);
    res.status(500).json({ error: 'Error al registrar la venta', details: error.message });
  }
});

module.exports = router;
