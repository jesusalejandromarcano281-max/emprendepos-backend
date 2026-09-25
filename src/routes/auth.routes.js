const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet } = require('../config/database');
const { auth } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const user = await dbGet('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Check if tenant is active
    if (user.tenant_id && !user.is_superadmin) {
      const tenant = await dbGet('SELECT status FROM tenants WHERE id = $1', [user.tenant_id]);
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
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, tenant_id, name, email, role, is_superadmin FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const user = await dbGet('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!bcrypt.compareSync(current_password, user.password)) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    const { dbRun } = require('../config/database');
    await dbRun('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;

