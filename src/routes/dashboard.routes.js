const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

// GET /api/dashboard/summary
router.get('/summary', (req, res) => {
  try {
    const totalSalesCount = dbGet('SELECT COUNT(*) as count FROM sales WHERE tenant_id = ?', [req.tenantId])?.count || 0;
    const salesSum = dbGet('SELECT SUM(total) as sum FROM sales WHERE tenant_id = ?', [req.tenantId])?.sum || 0;
    const incomesSum = dbGet('SELECT SUM(amount) as sum FROM incomes WHERE tenant_id = ?', [req.tenantId])?.sum || 0;
    const expensesSum = dbGet('SELECT SUM(amount) as sum FROM expenses WHERE tenant_id = ?', [req.tenantId])?.sum || 0;
    const totalProductsCount = dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [req.tenantId])?.count || 0;
    const stockBajoCount = dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = ? AND stock <= min_stock', [req.tenantId])?.count || 0;

    const ingresos = Number(salesSum) + Number(incomesSum);
    const gastos = Number(expensesSum);
    const gananciaNeta = ingresos - gastos;

    res.json({
      totalVentas: totalSalesCount,
      ingresos,
      gastos,
      gananciaNeta,
      totalProductos: totalProductsCount,
      stockBajo: stockBajoCount
    });
  } catch (error) {
    console.error('Error dashboard summary:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/dashboard/sales-chart (last 30 days)
router.get('/sales-chart', (req, res) => {
  try {
    const chartData = dbAll(`
      SELECT date(created_at) as fecha, SUM(total) as total
      FROM sales
      WHERE tenant_id = ? AND created_at >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `, [req.tenantId]);
    res.json(chartData || []);
  } catch (error) {
    console.error('Error sales chart:', error);
    res.json([]);
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', (req, res) => {
  try {
    const topProducts = dbAll(`
      SELECT p.name as nombre, SUM(si.quantity) as cantidad
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE p.tenant_id = ?
      GROUP BY p.id
      ORDER BY cantidad DESC
      LIMIT 10
    `, [req.tenantId]);
    res.json(topProducts || []);
  } catch (error) {
    console.error('Error top products:', error);
    res.json([]);
  }
});

// GET /api/dashboard/recent-sales
router.get('/recent-sales', (req, res) => {
  try {
    const recentSales = dbAll(`
      SELECT s.id, s.total, s.created_at as fecha, COALESCE(c.name, 'Consumidor Final') as cliente
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.tenant_id = ?
      ORDER BY s.created_at DESC
      LIMIT 10
    `, [req.tenantId]);
    res.json(recentSales || []);
  } catch (error) {
    console.error('Error recent sales:', error);
    res.json([]);
  }
});

module.exports = router;
