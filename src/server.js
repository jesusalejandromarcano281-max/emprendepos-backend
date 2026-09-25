require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const { runMigrations } = require('./migrations/001_initial_schema');
const { runMigration003 } = require('./migrations/003_suppliers_schema');

const app = express();

// CORS configuration for production
const allowedOrigins = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:5173'] : '*';
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

const authRoutes = require('./routes/auth.routes');
const productsRoutes = require('./routes/products.routes');
const clientsRoutes = require('./routes/clients.routes');
const salesRoutes = require('./routes/sales.routes');
const expensesRoutes = require('./routes/expenses.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const saasRoutes = require('./routes/saas.routes');
const paymentsRoutes = require('./routes/payments.routes');
const suppliersRoutes = require('./routes/suppliers.routes');

async function startServer() {
  await initDatabase();
  await runMigrations();
  await runMigration003();

  // Health check endpoint for cloud monitors (Render / Railway)
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/saas', saasRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/suppliers', suppliersRoutes);
  app.use('/api/settings', require('./routes/settings.routes'));

  const { auth: authMiddleware } = require('./middleware/auth');
  const { tenantCheck: tenantMiddleware } = require('./middleware/tenant');
  const { getPlanInfo } = require('./middleware/planRestrictions');
  app.get('/api/plan-info', authMiddleware, tenantMiddleware, getPlanInfo);
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}

startServer().catch(console.error);
