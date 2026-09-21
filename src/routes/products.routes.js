const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');
const { checkPlanActive, checkProductLimit } = require('../middleware/planRestrictions');

router.use(auth);
router.use(tenantCheck);
router.use(checkPlanActive);

const mapProduct = (p) => ({
  id: p.id,
  nombre: p.name,
  descripcion: p.description,
  precio: p.price,
  costo: p.cost,
  stock: p.stock,
  stock_minimo: p.min_stock,
  categoria: p.category,
  imagen: p.image || null
});

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM products WHERE tenant_id = $1';
    let params = [req.tenantId];
    if (req.query.search) {
      sql += ' AND (name LIKE $2 OR category LIKE $3)';
      const search = `%${req.query.search}%`;
      params.push(search, search);
    }
    const products = await dbAll(sql, params);
    res.json(products.map(mapProduct));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/low-stock', async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products WHERE tenant_id = $1 AND stock <= min_stock', [req.tenantId]);
    res.json(products.map(mapProduct));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await dbGet('SELECT * FROM products WHERE tenant_id = $1 AND id = $2', [req.tenantId, req.params.id]);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(mapProduct(product));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST
router.post('/', checkProductLimit, async (req, res) => {
  try {
    const { nombre, descripcion, precio, costo, stock, stock_minimo, categoria, imagen } = req.body;
    if (!nombre || precio === undefined) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const { lastId } = await dbRun(
      'INSERT INTO products (tenant_id, name, description, price, cost, stock, min_stock, category, image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [req.tenantId, nombre, descripcion, precio, costo || 0, stock || 0, stock_minimo || 5, categoria || 'General', imagen || null]
    );
    if (typeof saveDatabase === 'function') saveDatabase();
    const product = await dbGet('SELECT * FROM products WHERE id = $1', [lastId]);
    res.status(201).json(mapProduct(product));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const { nombre, descripcion, precio, costo, stock, stock_minimo, categoria, imagen } = req.body;
    const { changes } = await dbRun(
      'UPDATE products SET name = $1, description = $2, price = $3, cost = $4, stock = $5, min_stock = $6, category = $7, image = $8, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $9 AND id = $10',
      [nombre, descripcion, precio, costo || 0, stock, stock_minimo, categoria, imagen || null, req.tenantId, req.params.id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    if (typeof saveDatabase === 'function') saveDatabase();
    const product = await dbGet('SELECT * FROM products WHERE id = $1', [req.params.id]);
    res.json(mapProduct(product));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { changes } = await dbRun('DELETE FROM products WHERE tenant_id = $1 AND id = $2', [req.tenantId, req.params.id]);
    if (changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    if (typeof saveDatabase === 'function') saveDatabase();
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
