// ============================================================
// controllers/usuariosController.js — Controlador de Usuarios
// ============================================================
const { pool } = require('../db');

// Listar usuarios activos (con filtro opcional de rol)
const listarUsuarios = async (req, res) => {
  const { rol } = req.query;

  try {
    let queryText = `
      SELECT id, nombre_completo, email, rol, esta_activo, created_at
      FROM usuarios
    `;
    const params = [];

    if (rol) {
      queryText += ' WHERE rol = $1 AND esta_activo = true';
      params.push(rol);
    } else {
      queryText += ' WHERE esta_activo = true';
    }

    queryText += ' ORDER BY nombre_completo ASC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('usuariosController.listarUsuarios error:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios.', detalle: error.message });
  }
};

// Obtener un usuario por ID
const obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, nombre_completo, email, rol, esta_activo, created_at FROM usuarios WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Usuario ${id} no encontrado.` });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(`usuariosController.obtenerUsuarioPorId error:`, error.message);
    res.status(500).json({ error: 'Error al obtener el usuario.', detalle: error.message });
  }
};

// Crear usuario (personal)
const crearUsuario = async (req, res) => {
  const { nombre_completo, email, rol } = req.body;

  if (!nombre_completo || !email || !rol) {
    return res.status(400).json({
      error: 'Campos obligatorios: nombre_completo, email, rol (ejecutiva, disenador, coord, produccion, gerente).',
    });
  }

  const rolesPermitidos = ['ejecutiva', 'disenador', 'coord', 'produccion', 'gerente'];
  if (!rolesPermitidos.includes(rol)) {
    return res.status(400).json({
      error: `Rol inválido. Debe ser uno de: ${rolesPermitidos.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO usuarios (nombre_completo, email, rol)
       VALUES ($1, $2, $3)
       RETURNING id, nombre_completo, email, rol, esta_activo, created_at`,
      [nombre_completo.trim(), email.trim().toLowerCase(), rol]
    );

    res.status(201).json({
      message: 'Usuario creado exitosamente.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('usuariosController.crearUsuario error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un usuario con este correo electrónico.' });
    }
    res.status(500).json({ error: 'Error al crear usuario.', detalle: error.message });
  }
};

module.exports = {
  listarUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
};
