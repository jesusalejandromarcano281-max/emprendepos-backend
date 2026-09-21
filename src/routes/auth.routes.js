const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet } = require('../config/database');
const { auth } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

  const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Check if tenant is active
  if (user.tenant_id && !user.is_superadmin) {
    const tenant = dbGet('SELECT status FROM tenants WHERE id = ?', [user.tenant_id]);
    if (tenant && tenant.status === 'suspendido') {
      return res.status(403).json({ error: 'La suscripción de tu negocio está suspendida. Por favor contacta al administrador del sistema.' });
    }
  }

  const token = jwt.sign(
    { 
      id: user.id, 
      role: user.role, 
      tenant_id: user.tenant_id, 
      is_superadmin: user.is_superadmin || 0 
    }, 
    process.env.JWT_SECRET || 'secret', 
    { expiresIn: '30d' }
  );

  res.json({ 
    token, 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      tenant_id: user.tenant_id, 
      is_superadmin: user.is_superadmin || 0 
    } 
  });
});

router.get('/me', auth, (req, res) => {
  const user = dbGet('SELECT id, tenant_id, name, email, role, is_superadmin FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

module.exports = router;
