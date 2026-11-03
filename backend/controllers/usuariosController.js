// ============================================================
// controllers/usuariosController.js — Controlador de Usuarios
// ============================================================
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { ROL_DB_TO_UI, normalizarRolDb, resolverUsuario } = require('../utils/resolvers');

function formatearUsuario(u) {
  const map = ROL_DB_TO_UI[u.rol] || { roleKey: u.rol, label: u.rol, cargoDefault: u.rol };
  return {
    id: u.codigo || u.id,
    uuid: u.id,
    codigo: u.codigo,
    nombre_completo: u.nombre_completo,
    nombre: u.nombre_completo,
    email: u.email,
    correo: u.email,
    rol_db: u.rol,
    rol: map.label,
    rolUi: map.roleKey,
    cargo: u.cargo || map.cargoDefault,
    esta_activo: u.esta_activo,
    estado: u.esta_activo ? 'Activo' : 'Inactivo',
    created_at: u.created_at,
  };
}

// Listar usuarios (con filtro opcional de rol o estado)
const listarUsuarios = async (req, res) => {
  const { rol, incluir_inactivos } = req.query;

  try {
    let queryText = `
      SELECT id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at
      FROM usuarios
      WHERE 1=1
    `;
    const params = [];

    if (rol) {
      const rolNorm = normalizarRolDb(rol) || rol;
      params.push(rolNorm);
      queryText += ` AND rol = $${params.length}`;
    }

    if (incluir_inactivos === 'false') {
      queryText += ' AND esta_activo = true';
    }

    queryText += ' ORDER BY COALESCE(codigo, nombre_completo) ASC';

    const result = await pool.query(queryText, params);
    const data = result.rows.map(formatearUsuario);

    res.json({
      total: result.rowCount,
      data,
    });
  } catch (error) {
    console.error('usuariosController.listarUsuarios error:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
};

// Obtener un usuario por ID o código
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const usuario = await resolverUsuario(pool, req.params.id);
    if (!usuario) {
      return res.status(404).json({ error: `Usuario ${req.params.id} no encontrado.` });
    }
    res.json({ data: formatearUsuario(usuario) });
  } catch (error) {
    console.error('usuariosController.obtenerUsuarioPorId error:', error.message);
    res.status(500).json({ error: 'Error al obtener el usuario.' });
  }
};

// Crear usuario (personal interno)
const crearUsuario = async (req, res) => {
  const nombre_completo = req.body.nombre_completo || req.body.nombre;
  const email = req.body.email || req.body.correo;
  const rolDb = normalizarRolDb(req.body.rol);
  const cargo = req.body.cargo || (rolDb ? ROL_DB_TO_UI[rolDb]?.cargoDefault : null);
  const password = req.body.password || req.body.clave || 'Huellas2026*';

  if (!nombre_completo || !email || !rolDb) {
    return res.status(400).json({
      error: 'Campos obligatorios: nombre/nombre_completo, correo/email, rol.',
    });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const seqRes = await pool.query('SELECT COUNT(*)::int AS total FROM usuarios');
    let nextNum = seqRes.rows[0].total + 1;
    let codigo = req.body.codigo || `U${nextNum}`;

    // Evitar colisión de código
    const checkCod = await pool.query('SELECT 1 FROM usuarios WHERE codigo = $1', [codigo]);
    if (checkCod.rowCount > 0) {
      codigo = `U${Date.now().toString().slice(-4)}`;
    }

    const result = await pool.query(
      `INSERT INTO usuarios (codigo, nombre_completo, email, password_hash, rol, cargo, esta_activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at`,
      [codigo, nombre_completo.trim(), email.trim().toLowerCase(), passwordHash, rolDb, cargo ? cargo.trim() : null]
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente.',
      data: formatearUsuario(result.rows[0]),
    });
  } catch (error) {
    console.error('usuariosController.crearUsuario error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico.' });
    }
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
};

// Actualizar datos de usuario (nombre, correo, cargo, rol)
const actualizarUsuario = async (req, res) => {
  try {
    const actual = await resolverUsuario(pool, req.params.id);
    if (!actual) {
      return res.status(404).json({ error: `Usuario ${req.params.id} no encontrado.` });
    }

    const nuevoNombre = (req.body.nombre_completo || req.body.nombre || actual.nombre_completo).trim();
    const nuevoEmail = (req.body.email || req.body.correo || actual.email).trim().toLowerCase();
    const nuevoRol = req.body.rol ? normalizarRolDb(req.body.rol) : actual.rol;
    const nuevoCargo = req.body.cargo !== undefined ? req.body.cargo.trim() : actual.cargo;

    if (!nuevoRol) {
      return res.status(400).json({ error: 'El rol proporcionado no es válido.' });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre_completo = $1, email = $2, rol = $3, cargo = $4
       WHERE id = $5
       RETURNING id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at`,
      [nuevoNombre, nuevoEmail, nuevoRol, nuevoCargo, actual.id]
    );

    res.json({
      message: 'Usuario actualizado exitosamente.',
      data: formatearUsuario(result.rows[0]),
    });
  } catch (error) {
    console.error('usuariosController.actualizarUsuario error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Este correo electrónico ya está registrado por otro usuario.' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
};

// Activar o desactivar usuario
const cambiarEstadoUsuario = async (req, res) => {
  try {
    const actual = await resolverUsuario(pool, req.params.id);
    if (!actual) {
      return res.status(404).json({ error: `Usuario ${req.params.id} no encontrado.` });
    }

    let nuevoActivo;
    if (typeof req.body.esta_activo === 'boolean') {
      nuevoActivo = req.body.esta_activo;
    } else if (typeof req.body.estado === 'string') {
      nuevoActivo = req.body.estado.toLowerCase() === 'activo';
    } else {
      nuevoActivo = !actual.esta_activo;
    }

    // Impedir que el usuario autenticado desactive su propia cuenta
    if (!nuevoActivo && req.usuario && (req.usuario.id === actual.id || req.usuario.email === actual.email)) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta activa en esta sesión.' });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET esta_activo = $1
       WHERE id = $2
       RETURNING id, codigo, nombre_completo, email, rol, cargo, esta_activo, created_at`,
      [nuevoActivo, actual.id]
    );

    res.json({
      message: `Usuario ${nuevoActivo ? 'activado' : 'desactivado'} exitosamente.`,
      data: formatearUsuario(result.rows[0]),
    });
  } catch (error) {
    console.error('usuariosController.cambiarEstadoUsuario error:', error.message);
    res.status(500).json({ error: 'Error al cambiar el estado del usuario.' });
  }
};

module.exports = {
  listarUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
};
