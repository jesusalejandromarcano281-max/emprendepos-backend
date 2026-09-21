const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, saveDatabase } = require('../config/database');
const { auth } = require('../middleware/auth');
const { tenantCheck } = require('../middleware/tenant');

router.use(auth);
router.use(tenantCheck);

const mapClient = (c) => ({
  id: c.id,
  nombre: c.name,
  email: c.email,
  telefono: c.phone,
  direccion: c.address,
  documento: c.document
});

router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM clients WHERE tenant_id = $1';
    let params = [req.tenantId];
    if (req.query.search) {
      sql += ' AND (name LIKE $2 OR email LIKE $3)';
      const search = `%${req.query.search}%`;
      params.push(search, search);
    }
    const clients = await dbAll(sql, params);
    res.json(clients.map(mapClient));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await dbGet('SELECT * FROM clients WHERE tenant_id = $1 AND id = $2', [req.tenantId, req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const sales = await dbAll('SELECT * FROM sales WHERE tenant_id = $1 AND client_id = $2', [req.tenantId, req.params.id]);
    const mapped = mapClient(client);
    mapped.purchaseHistory = sales;
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, email, telefono, documento, direccion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

    const { lastId } = await dbRun(
      'INSERT INTO clients (tenant_id, name, email, phone, document, address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [req.tenantId, nombre, email, telefono, documento, direccion]
    );
    if (typeof saveDatabase === 'function') saveDatabase();
    const client = await dbGet('SELECT * FROM clients WHERE id = $1', [lastId]);
    res.status(201).json(mapClient(client));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, email, telefono, documento, direccion } = req.body;
    const { changes } = await dbRun(
      'UPDATE clients SET name = $1, email = $2, phone = $3, document = $4, address = $5 WHERE tenant_id = $6 AND id = $7',
      [nombre, email, telefono, documento, direccion, req.tenantId, req.params.id]
    );
    if (changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (typeof saveDatabase === 'function') saveDatabase();
    const client = await dbGet('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    res.json(mapClient(client));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { changes } = await dbRun('DELETE FROM clients WHERE tenant_id = $1 AND id = $2', [req.tenantId, req.params.id]);
    if (changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (typeof saveDatabase === 'function') saveDatabase();
    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

