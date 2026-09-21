const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const totalSalesCountRes = await dbGet('SELECT COUNT(*) as count FROM sales WHERE tenant_id = $1', [req.tenantId]);
    const totalSalesCount = parseInt(totalSalesCountRes.count || 0, 10);
    
    const salesSumRes = await dbGet('SELECT COALESCE(SUM(total), 0) as sum FROM sales WHERE tenant_id = $1', [req.tenantId]);
    const salesSum = Number(salesSumRes.sum || 0);
    
    const incomesSumRes = await dbGet('SELECT COALESCE(SUM(amount), 0) as sum FROM incomes WHERE tenant_id = $1', [req.tenantId]);
    const incomesSum = Number(incomesSumRes.sum || 0);
    
    const expensesSumRes = await dbGet('SELECT COALESCE(SUM(amount), 0) as sum FROM expenses WHERE tenant_id = $1', [req.tenantId]);
    const expensesSum = Number(expensesSumRes.sum || 0);
    
    const totalProductsCountRes = await dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = $1', [req.tenantId]);
    const totalProductsCount = parseInt(totalProductsCountRes.count || 0, 10);
    
    const stockBajoCountRes = await dbGet('SELECT COUNT(*) as count FROM products WHERE tenant_id = $1 AND stock <= min_stock', [req.tenantId]);
    const stockBajoCount = parseInt(stockBajoCountRes.count || 0, 10);

    const ingresos = salesSum + incomesSum;
    const gastos = expensesSum;
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
router.get('/sales-chart', async (req, res) => {
  try {
    const chartData = await dbAll(`
      SELECT date(created_at) as fecha, SUM(total) as total
      FROM sales
      WHERE tenant_id = $1 AND created_at >= current_date - interval '30 days'
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
router.get('/top-products', async (req, res) => {
  try {
    const topProducts = await dbAll(`
      SELECT p.name as nombre, SUM(si.quantity) as cantidad
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE p.tenant_id = $1
      GROUP BY p.id, p.name
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
router.get('/recent-sales', async (req, res) => {
  try {
    const recentSales = await dbAll(`
      SELECT s.id, s.total, s.created_at as fecha, COALESCE(c.name, 'Consumidor Final') as cliente
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.tenant_id = $1
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
