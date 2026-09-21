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

router.get('/', (req, res) => {
  let sql = 'SELECT * FROM clients WHERE tenant_id = ?';
  let params = [req.tenantId];
  if (req.query.search) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    const search = `%${req.query.search}%`;
    params.push(search, search);
  }
  const clients = dbAll(sql, params);
  res.json(clients.map(mapClient));
});

router.get('/:id', (req, res) => {
  const client = dbGet('SELECT * FROM clients WHERE tenant_id = ? AND id = ?', [req.tenantId, req.params.id]);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

  const sales = dbAll('SELECT * FROM sales WHERE tenant_id = ? AND client_id = ?', [req.tenantId, req.params.id]);
  const mapped = mapClient(client);
  mapped.purchaseHistory = sales;
  res.json(mapped);
});

router.post('/', (req, res) => {
  const { nombre, email, telefono, documento, direccion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  const { lastId } = dbRun(
    'INSERT INTO clients (tenant_id, name, email, phone, document, address) VALUES (?, ?, ?, ?, ?, ?)',
    [req.tenantId, nombre, email, telefono, documento, direccion]
  );
  saveDatabase();
  const client = dbGet('SELECT * FROM clients WHERE id = ?', [lastId]);
  res.status(201).json(mapClient(client));
});

router.put('/:id', (req, res) => {
  const { nombre, email, telefono, documento, direccion } = req.body;
  const { changes } = dbRun(
    'UPDATE clients SET name = ?, email = ?, phone = ?, document = ?, address = ? WHERE tenant_id = ? AND id = ?',
    [nombre, email, telefono, documento, direccion, req.tenantId, req.params.id]
  );
  if (changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  saveDatabase();
  const client = dbGet('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  res.json(mapClient(client));
});

router.delete('/:id', (req, res) => {
  const { changes } = dbRun('DELETE FROM clients WHERE tenant_id = ? AND id = ?', [req.tenantId, req.params.id]);
  if (changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
  saveDatabase();
  res.json({ message: 'Cliente eliminado exitosamente' });
});

module.exports = router;
