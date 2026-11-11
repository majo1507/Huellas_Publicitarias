// ============================================================
// controllers/authController.js — Controlador de Autenticación
// ============================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { getJwtSecret } = require('../middleware/auth');
const { ROL_DB_TO_UI, normalizarRolDb } = require('../utils/resolvers');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function serializarUsuarioAuth(u) {
  const map = ROL_DB_TO_UI[u.rol] || { roleKey: u.rol, label: u.rol, cargoDefault: u.rol };
  return {
    id: u.codigo || u.id,
    uuid: u.id,
    codigo: u.codigo || null,
    nombre_completo: u.nombre_completo,
    nombre: u.nombre_completo,
    email: u.email,
    correo: u.email,
    rol: map.roleKey,
    rolUi: map.roleKey,
    rolBd: u.rol,
    rolLabel: map.label,
    cargo: u.cargo || map.cargoDefault,
    esta_activo: u.esta_activo,
    estado: u.esta_activo ? 'Activo' : 'Inactivo',
  };
}

// Iniciar sesión
const login = async (req, res) => {
  const rawIdent = req.body.email || req.body.identificador || req.body.usuario || '';
  const rawPass = req.body.password || req.body.clave || '';

  if (!rawIdent.trim() || !rawPass) {
    return res.status(400).json({ error: 'Debes proporcionar correo/usuario y contraseña.' });
  }

  const identificador = rawIdent.trim().toLowerCase();

  try {
    // El acceso de cliente como usuario interno de ORVEX ha sido retirado
    if (
      (identificador === 'carlos.mendoza@alpina.com' || identificador === 'carlos mendoza' || identificador === 'laura@empresaabc.test') ||
      rawPass === 'cliente123'
    ) {
      return res.status(401).json({
        error: 'El perfil de Cliente como usuario interno ha sido retirado de ORVEX. La atención y seguimiento a clientes es gestionada exclusivamente por Comercial / Recepción.',
      });
    }

    const result = await pool.query(
      `SELECT id, codigo, nombre_completo, email, password_hash, rol, cargo, esta_activo
       FROM usuarios
       WHERE LOWER(email) = $1 OR LOWER(nombre_completo) = $1
       LIMIT 1`,
      [identificador]
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

    const passwordValida = await bcrypt.compare(rawPass, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas. Contraseña incorrecta.' });
    }

    const serializado = serializarUsuarioAuth(usuario);
    const tokenPayload = {
      id: usuario.id,
      codigo: usuario.codigo,
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      rol: usuario.rol,
      rolUi: serializado.rolUi,
    };

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      expira_en: JWT_EXPIRES_IN,
      usuario: serializado,
    });
  } catch (error) {
    console.error('authController.login error:', error.message);
    res.status(500).json({ error: 'Error al procesar el inicio de sesión.' });
  }
};

// Registrar nuevo usuario (restringido a Gerencia por ruta)
const register = async (req, res) => {
  const nombre_completo = req.body.nombre_completo || req.body.nombre;
  const email = req.body.email || req.body.correo;
  const password = req.body.password || req.body.clave || 'Huellas2026*';
  const rolDb = normalizarRolDb(req.body.rol);
  const cargo = req.body.cargo || null;

  if (!nombre_completo || !email || !rolDb) {
    return res.status(400).json({
      error: 'Campos requeridos: nombre_completo, email, rol (ejecutiva, disenador, coord, produccion, postventa, gerente).',
    });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios');
    const codigo = `U${countRes.rows[0].total + 1}`;

    const insertRes = await pool.query(
      `INSERT INTO usuarios (codigo, nombre_completo, email, password_hash, rol, cargo, esta_activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at`,
      [codigo, nombre_completo.trim(), email.trim().toLowerCase(), passwordHash, rolDb, cargo]
    );

    const nuevoUsuario = serializarUsuarioAuth(insertRes.rows[0]);

    res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      usuario: nuevoUsuario,
    });
  } catch (error) {
    console.error('authController.register error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo electrónico.' });
    }
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
};

// Perfil del usuario autenticado
const obtenerPerfil = async (req, res) => {
  try {
    if (req.usuario.rol === 'cliente') {
      return res.json({
        autenticado: true,
        perfil: {
          id: 'C1',
          nombre_completo: req.usuario.nombre_completo,
          nombre: req.usuario.nombre_completo,
          email: req.usuario.email,
          correo: req.usuario.email,
          rol: 'cliente',
          rolUi: 'cliente',
          cargo: 'Empresa ABC',
          esta_activo: true,
          estado: 'Activo',
        },
      });
    }

    const result = await pool.query(
      'SELECT id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({
      autenticado: true,
      perfil: serializarUsuarioAuth(result.rows[0]),
    });
  } catch (error) {
    console.error('authController.obtenerPerfil error:', error.message);
    res.status(500).json({ error: 'Error al consultar perfil.' });
  }
};

const logout = async (_req, res) => {
  res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
};

module.exports = {
  login,
  register,
  obtenerPerfil,
  logout,
  serializarUsuarioAuth,
};
