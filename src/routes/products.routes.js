const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

const mapProduct = (p) => ({
  id: p.id,
  nombre: p.name,
  descripcion: p.description,
  precio: p.price,
  costo: p.cost,
  stock: p.stock,
  stock_minimo: p.min_stock,
  categoria: p.category
});

router.get('/', (req, res) => {
  let sql = 'SELECT * FROM products WHERE tenant_id = ?';
  let params = [req.tenantId];
  if (req.query.search) {
    sql += ' AND (name LIKE ? OR category LIKE ?)';
    const search = `%${req.query.search}%`;
    params.push(search, search);
  }
  const products = dbAll(sql, params);
  res.json(products.map(mapProduct));
});

router.get('/low-stock', (req, res) => {
  const products = dbAll('SELECT * FROM products WHERE tenant_id = ? AND stock <= min_stock', [req.tenantId]);
  res.json(products.map(mapProduct));
});

router.get('/:id', (req, res) => {
  const product = dbGet('SELECT * FROM products WHERE tenant_id = ? AND id = ?', [req.tenantId, req.params.id]);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(mapProduct(product));
});

router.post('/', (req, res) => {
  const { nombre, descripcion, precio, costo, stock, stock_minimo, categoria } = req.body;
  if (!nombre || precio === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  const { lastId } = dbRun(
    'INSERT INTO products (tenant_id, name, description, price, cost, stock, min_stock, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [req.tenantId, nombre, descripcion, precio, costo || 0, stock || 0, stock_minimo || 5, categoria || 'General']
  );
  saveDatabase();
  const product = dbGet('SELECT * FROM products WHERE id = ?', [lastId]);
  res.status(201).json(mapProduct(product));
});

router.put('/:id', (req, res) => {
  const { nombre, descripcion, precio, costo, stock, stock_minimo, categoria } = req.body;
  const { changes } = dbRun(
    'UPDATE products SET name = ?, description = ?, price = ?, cost = ?, stock = ?, min_stock = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?',
    [nombre, descripcion, precio, costo || 0, stock, stock_minimo, categoria, req.tenantId, req.params.id]
  );
  if (changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  saveDatabase();
  const product = dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(mapProduct(product));
});

router.delete('/:id', (req, res) => {
  const { changes } = dbRun('DELETE FROM products WHERE tenant_id = ? AND id = ?', [req.tenantId, req.params.id]);
  if (changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  saveDatabase();
  res.json({ message: 'Producto eliminado exitosamente' });
});

module.exports = router;
