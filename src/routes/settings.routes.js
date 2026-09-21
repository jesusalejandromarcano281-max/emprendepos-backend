const express = require('express');
const router = express.Router();
const { dbAll, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

// Get all settings for tenant
router.get('/', async (req, res) => {
  try {
    const settingsArray = await dbAll('SELECT key, value FROM settings WHERE tenant_id = $1', [req.tenantId]);
    const settings = {};
    settingsArray.forEach(s => {
      settings[s.key] = s.value;
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Update settings for tenant
router.post('/', async (req, res) => {
  try {
    const settings = req.body;
    for (const key of Object.keys(settings)) {
      const value = settings[key] !== null && settings[key] !== undefined ? settings[key].toString() : '';
      const result = await dbRun(
        'UPDATE settings SET value = $1 WHERE tenant_id = $2 AND key = $3',
        [value, req.tenantId, key]
      );
      if (result && result.changes === 0) {
        await dbRun(
          'INSERT INTO settings (tenant_id, key, value) VALUES ($1, $2, $3) RETURNING id',
          [req.tenantId, key, value]
        );
      }
    }
    if (typeof saveDatabase === 'function') saveDatabase();
    res.json({ message: 'Configuración actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
