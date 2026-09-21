const express = require('express');
const router = express.Router();
const { dbAll, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

// Get all settings for tenant
router.get('/', (req, res) => {
  const settingsArray = dbAll('SELECT key, value FROM settings WHERE tenant_id = ?', [req.tenantId]);
  const settings = {};
  settingsArray.forEach(s => {
    settings[s.key] = s.value;
  });
  res.json(settings);
});

// Update settings for tenant
router.post('/', (req, res) => {
  const settings = req.body;
  Object.keys(settings).forEach(key => {
    const value = settings[key] !== null && settings[key] !== undefined ? settings[key].toString() : '';
    dbRun('INSERT OR REPLACE INTO settings (tenant_id, key, value) VALUES (?, ?, ?)', [req.tenantId, key, value]);
  });
  saveDatabase();
  res.json({ message: 'Configuración actualizada' });
});

module.exports = router;
