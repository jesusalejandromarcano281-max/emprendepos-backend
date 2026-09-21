const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

const mapFinanceItem = (item) => ({
  id: item.id,
  descripcion: item.description,
  monto: item.amount,
  categoria: item.category,
  fecha: item.date
});

const getExpensesHandler = async (req, res) => {
  try {
    const expenses = await dbAll('SELECT * FROM expenses WHERE tenant_id = $1 ORDER BY date DESC', [req.tenantId]);
    res.json(expenses.map(mapFinanceItem));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

router.get('/', getExpensesHandler);
router.get('/expenses', getExpensesHandler);

const createExpenseHandler = async (req, res) => {
  try {
    const { descripcion, monto, categoria, fecha, description, amount, category, date } = req.body;
    const desc = descripcion || description;
    const amt = monto !== undefined ? monto : amount;
    const cat = categoria || category || 'General';
    const dt = fecha || date || new Date().toISOString().split('T')[0];

    if (!desc || amt === undefined) {
      return res.status(400).json({ error: 'Descripción y monto son requeridos' });
    }

    const { lastId } = await dbRun(
      'INSERT INTO expenses (tenant_id, description, amount, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.tenantId, desc, amt, cat, dt]
    );
    if (typeof saveDatabase === 'function') saveDatabase();
    const created = await dbGet('SELECT * FROM expenses WHERE id = $1', [lastId]);
    res.status(201).json(mapFinanceItem(created));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

router.post('/', createExpenseHandler);
router.post('/expenses', createExpenseHandler);

const deleteExpenseHandler = async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM expenses WHERE tenant_id = $1 AND id = $2', [req.tenantId, id]);
    if (typeof saveDatabase === 'function') saveDatabase();
    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

router.delete('/:id', deleteExpenseHandler);
router.delete('/expenses/:id', deleteExpenseHandler);

// Incomes
router.get('/incomes', async (req, res) => {
  try {
    const incomes = await dbAll('SELECT * FROM incomes WHERE tenant_id = $1 ORDER BY date DESC', [req.tenantId]);
    res.json(incomes.map(mapFinanceItem));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/incomes', async (req, res) => {
  try {
    const { descripcion, monto, categoria, fecha, description, amount, category, date } = req.body;
    const desc = descripcion || description;
    const amt = monto !== undefined ? monto : amount;
    const cat = categoria || category || 'General';
    const dt = fecha || date || new Date().toISOString().split('T')[0];

    if (!desc || amt === undefined) {
      return res.status(400).json({ error: 'Descripción y monto son requeridos' });
    }

    const { lastId } = await dbRun(
      'INSERT INTO incomes (tenant_id, description, amount, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.tenantId, desc, amt, cat, dt]
    );
    if (typeof saveDatabase === 'function') saveDatabase();
    const created = await dbGet('SELECT * FROM incomes WHERE id = $1', [lastId]);
    res.status(201).json(mapFinanceItem(created));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/incomes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbRun('DELETE FROM incomes WHERE tenant_id = $1 AND id = $2', [req.tenantId, id]);
    if (typeof saveDatabase === 'function') saveDatabase();
    res.json({ message: 'Ingreso eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Balance summary
router.get('/balance', async (req, res) => {
  try {
    const totalSalesRes = await dbGet("SELECT COALESCE(SUM(total), 0) as sum FROM sales WHERE tenant_id = $1 AND status = 'completed'", [req.tenantId]);
    const totalExpensesRes = await dbGet("SELECT COALESCE(SUM(amount), 0) as sum FROM expenses WHERE tenant_id = $1", [req.tenantId]);
    const totalIncomesRes = await dbGet("SELECT COALESCE(SUM(amount), 0) as sum FROM incomes WHERE tenant_id = $1", [req.tenantId]);

    const totalSales = Number(totalSalesRes.sum || 0);
    const totalExpenses = Number(totalExpensesRes.sum || 0);
    const totalIncomes = Number(totalIncomesRes.sum || 0);
    const grandTotalIngresos = totalSales + totalIncomes;

    res.json({
      totalIngresos: grandTotalIngresos,
      totalGastos: totalExpenses,
      balance: grandTotalIngresos - totalExpenses
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
