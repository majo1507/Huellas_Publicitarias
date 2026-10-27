// ============================================================
// controllers/authController.js — Controlador de Autenticación
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'huellas_default_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Iniciar sesión
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Debes proporcionar email y contraseña.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, email, password_hash, rol, esta_activo FROM usuarios WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas. Usuario no encontrado.' });
    }

    const usuario = result.rows[0];

    if (!usuario.esta_activo) {
      return res.status(403).json({ error: 'Este usuario se encuentra inactivo. Contacta a gerencia.' });
    }

    if (!usuario.password_hash) {
      return res.status(401).json({ error: 'El usuario no tiene una contraseña configurada.' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas. Contraseña incorrecta.' });
    }

    const tokenPayload = {
      id: usuario.id,
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      rol: usuario.rol,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      expira_en: JWT_EXPIRES_IN,
      usuario: {
        id: usuario.id,
        nombre_completo: usuario.nombre_completo,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('authController.login error:', error.message);
    res.status(500).json({ error: 'Error al procesar el inicio de sesión.', detalle: error.message });
  }
};

// Registrar nuevo usuario
const register = async (req, res) => {
  const { nombre_completo, email, password, rol } = req.body;

  if (!nombre_completo || !email || !password || !rol) {
    return res.status(400).json({
      error: 'Campos requeridos: nombre_completo, email, password, rol.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  const rolesPermitidos = ['ejecutiva', 'disenador', 'coord', 'produccion', 'gerente'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({
      error: `Rol no válido. Permitidos: ${rolesPermitidos.join(', ')}`,
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const insertRes = await pool.query(`
      INSERT INTO usuarios (nombre_completo, email, password_hash, rol, esta_activo)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, nombre_completo, email, rol, esta_activo, created_at
    `, [
      nombre_completo.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      rol,
    ]);

    const nuevoUsuario = insertRes.rows[0];

    const token = jwt.sign({
      id: nuevoUsuario.id,
      nombre_completo: nuevoUsuario.nombre_completo,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      token,
      usuario: nuevoUsuario,
    });
  } catch (error) {
    console.error('authController.register error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario.', detalle: error.message });
  }
};

// Perfil del usuario autenticado
const obtenerPerfil = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, email, rol, esta_activo, created_at FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({
      autenticado: true,
      perfil: result.rows[0],
    });
  } catch (error) {
    console.error('authController.obtenerPerfil error:', error.message);
    res.status(500).json({ error: 'Error al consultar perfil.', detalle: error.message });
  }
};

module.exports = {
  login,
  register,
  obtenerPerfil,
};
