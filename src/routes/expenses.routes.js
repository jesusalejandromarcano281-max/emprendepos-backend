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

const getExpensesHandler = (req, res) => {
  const expenses = dbAll('SELECT * FROM expenses WHERE tenant_id = ? ORDER BY date DESC', [req.tenantId]);
  res.json(expenses.map(mapFinanceItem));
};

router.get('/', getExpensesHandler);
router.get('/expenses', getExpensesHandler);

const createExpenseHandler = (req, res) => {
  const { descripcion, monto, categoria, fecha, description, amount, category, date } = req.body;
  const desc = descripcion || description;
  const amt = monto !== undefined ? monto : amount;
  const cat = categoria || category || 'General';
  const dt = fecha || date || new Date().toISOString().split('T')[0];

  if (!desc || amt === undefined) {
    return res.status(400).json({ error: 'Descripción y monto son requeridos' });
  }

  const { lastId } = dbRun(
    'INSERT INTO expenses (tenant_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)',
    [req.tenantId, desc, amt, cat, dt]
  );
  saveDatabase();
  const created = dbGet('SELECT * FROM expenses WHERE id = ?', [lastId]);
  res.status(201).json(mapFinanceItem(created));
};

router.post('/', createExpenseHandler);
router.post('/expenses', createExpenseHandler);

const deleteExpenseHandler = (req, res) => {
  const { id } = req.params;
  const { changes } = dbRun('DELETE FROM expenses WHERE tenant_id = ? AND id = ?', [req.tenantId, id]);
  if (changes === 0) return res.status(404).json({ error: 'Gasto no encontrado' });
  saveDatabase();
  res.json({ message: 'Gasto eliminado' });
};

router.delete('/:id', deleteExpenseHandler);
router.delete('/expenses/:id', deleteExpenseHandler);

// Incomes
router.get('/incomes', (req, res) => {
  const incomes = dbAll('SELECT * FROM incomes WHERE tenant_id = ? ORDER BY date DESC', [req.tenantId]);
  res.json(incomes.map(mapFinanceItem));
});

router.post('/incomes', (req, res) => {
  const { descripcion, monto, categoria, fecha, description, amount, category, date } = req.body;
  const desc = descripcion || description;
  const amt = monto !== undefined ? monto : amount;
  const cat = categoria || category || 'General';
  const dt = fecha || date || new Date().toISOString().split('T')[0];

  if (!desc || amt === undefined) {
    return res.status(400).json({ error: 'Descripción y monto son requeridos' });
  }

  const { lastId } = dbRun(
    'INSERT INTO incomes (tenant_id, description, amount, category, date) VALUES (?, ?, ?, ?, ?)',
    [req.tenantId, desc, amt, cat, dt]
  );
  saveDatabase();
  const created = dbGet('SELECT * FROM incomes WHERE id = ?', [lastId]);
  res.status(201).json(mapFinanceItem(created));
});

router.delete('/incomes/:id', (req, res) => {
  const { id } = req.params;
  const { changes } = dbRun('DELETE FROM incomes WHERE tenant_id = ? AND id = ?', [req.tenantId, id]);
  if (changes === 0) return res.status(404).json({ error: 'Ingreso no encontrado' });
  saveDatabase();
  res.json({ message: 'Ingreso eliminado' });
});

// Balance summary
router.get('/balance', (req, res) => {
  const totalSalesRes = dbGet("SELECT SUM(total) as sum FROM sales WHERE tenant_id = ? AND status = 'completed'", [req.tenantId]);
  const totalExpensesRes = dbGet("SELECT SUM(amount) as sum FROM expenses WHERE tenant_id = ?", [req.tenantId]);
  const totalIncomesRes = dbGet("SELECT SUM(amount) as sum FROM incomes WHERE tenant_id = ?", [req.tenantId]);

  const totalSales = Number(totalSalesRes?.sum || 0);
  const totalExpenses = Number(totalExpensesRes?.sum || 0);
  const totalIncomes = Number(totalIncomesRes?.sum || 0);
  const grandTotalIngresos = totalSales + totalIncomes;

  res.json({
    totalIngresos: grandTotalIngresos,
    totalGastos: totalExpenses,
    balance: grandTotalIngresos - totalExpenses
  });
});

module.exports = router;
