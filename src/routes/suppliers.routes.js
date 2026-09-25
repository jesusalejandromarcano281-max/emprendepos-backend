const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth, tenantCheck);

// GET compare prices — MUST be before /:id to avoid Express treating "compare" as an id
router.get('/compare', async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products WHERE tenant_id = $1', [req.tenantId]);
    const prices = await dbAll(`
      SELECT sp.product_id, sp.price, s.id as supplier_id, s.name as supplier_name 
      FROM supplier_prices sp
      JOIN suppliers s ON s.id = sp.supplier_id
      WHERE sp.tenant_id = $1
    `, [req.tenantId]);

    const result = products.map(product => {
      const productPrices = prices.filter(p => p.product_id === product.id);
      return {
        id: product.id,
        product_name: product.name,
        internal_cost: product.cost || product.price || 0,
        quotes: productPrices.map(p => ({
          supplier_id: p.supplier_id,
          supplier_name: p.supplier_name,
          price: p.price
        }))
      };
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al comparar precios' });
  }
});

// GET all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await dbAll('SELECT * FROM suppliers WHERE tenant_id = $1 ORDER BY name', [req.tenantId]);
    res.json(suppliers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// GET specific supplier
router.get('/:id', async (req, res) => {
  try {
    const supplier = await dbGet('SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

// POST new supplier
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, sales_policies, nombre, telefono, politicas_venta } = req.body;
    const supplierName = name || nombre;
    const supplierPhone = phone || telefono;
    const supplierEmail = email || req.body.email;
    const supplierPolicies = sales_policies || politicas_venta;

    if (!supplierName) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const result = await dbRun(
      'INSERT INTO suppliers (tenant_id, name, phone, email, sales_policies) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.tenantId, supplierName, supplierPhone, supplierEmail, supplierPolicies]
    );
    res.status(201).json({ id: result.lastId, message: 'Proveedor creado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

// PUT update supplier
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, sales_policies, nombre, telefono, politicas_venta } = req.body;
    const supplierName = name || nombre;
    const supplierPhone = phone || telefono;
    const supplierEmail = email || req.body.email;
    const supplierPolicies = sales_policies || politicas_venta;

    const supplier = await dbGet('SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

    await dbRun(
      'UPDATE suppliers SET name = $1, phone = $2, email = $3, sales_policies = $4 WHERE id = $5 AND tenant_id = $6',
      [supplierName, supplierPhone, supplierEmail, supplierPolicies, req.params.id, req.tenantId]
    );
    res.json({ message: 'Proveedor actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

// DELETE supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await dbGet('SELECT * FROM suppliers WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });

    await dbRun('DELETE FROM supplier_prices WHERE supplier_id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    await dbRun('DELETE FROM suppliers WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
    res.json({ message: 'Proveedor eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
});

// GET prices for a supplier
router.get('/:id/prices', async (req, res) => {
  try {
    const prices = await dbAll(`
      SELECT sp.id, sp.product_id, p.name as product_name, sp.price, sp.updated_at
      FROM supplier_prices sp
      JOIN products p ON p.id = sp.product_id
      WHERE sp.supplier_id = $1 AND sp.tenant_id = $2
    `, [req.params.id, req.tenantId]);
    
    res.json(prices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener precios del proveedor' });
  }
});

// POST update/insert price for a supplier
router.post('/:id/prices', async (req, res) => {
  try {
    const { product_id, price, precio_cotizado } = req.body;
    const actualPrice = price || precio_cotizado;

    if (!product_id || actualPrice === undefined) {
      return res.status(400).json({ error: 'Faltan datos (product_id, price)' });
    }

    const existingPrice = await dbGet(
      'SELECT id FROM supplier_prices WHERE supplier_id = $1 AND product_id = $2 AND tenant_id = $3',
      [req.params.id, product_id, req.tenantId]
    );

    if (existingPrice) {
      await dbRun(
        'UPDATE supplier_prices SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [actualPrice, existingPrice.id]
      );
      return res.json({ message: 'Precio actualizado exitosamente' });
    } else {
      const result = await dbRun(
        'INSERT INTO supplier_prices (tenant_id, supplier_id, product_id, price) VALUES ($1, $2, $3, $4) RETURNING id',
        [req.tenantId, req.params.id, product_id, actualPrice]
      );
      return res.status(201).json({ id: result.lastId, message: 'Precio registrado exitosamente' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al guardar el precio' });
  }
});

module.exports = router;
