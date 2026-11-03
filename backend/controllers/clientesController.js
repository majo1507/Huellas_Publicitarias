// ============================================================
// controllers/clientesController.js — Controlador de Clientes
// ============================================================
const { pool } = require('../db');

// Listar clientes con su ejecutiva asignada
const listarClientes = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.empresa,
        c.nit,
        c.contacto_principal,
        c.telefono,
        c.correo,
        c.estado,
        c.created_at,
        c.ejecutiva_id,
        u.nombre_completo AS ejecutiva_nombre
      FROM clientes c
      INNER JOIN usuarios u ON c.ejecutiva_id = u.id
      ORDER BY c.empresa ASC
    `);

    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('clientesController.listarClientes error:', error.message);
    res.status(500).json({ error: 'Error al obtener clientes.', detalle: error.message });
  }
};

// Obtener un cliente específico por ID
const obtenerClientePorId = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.empresa,
        c.nit,
        c.contacto_principal,
        c.telefono,
        c.correo,
        c.estado,
        c.created_at,
        c.ejecutiva_id,
        u.nombre_completo AS ejecutiva_nombre
      FROM clientes c
      INNER JOIN usuarios u ON c.ejecutiva_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Cliente con ID ${id} no encontrado.` });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(`clientesController.obtenerClientePorId error:`, error.message);
    res.status(500).json({ error: 'Error al obtener el cliente.', detalle: error.message });
  }
};

// Crear cliente
const crearCliente = async (req, res) => {
  const { empresa, nit, contacto_principal, telefono, correo, ejecutiva_id, estado } = req.body;

  if (!empresa || !nit || !contacto_principal || !ejecutiva_id) {
    return res.status(400).json({
      error: 'Campos obligatorios: empresa, nit, contacto_principal, ejecutiva_id.',
    });
  }

  try {
    const ejecutivaCheck = await pool.query(
      "SELECT id, nombre_completo FROM usuarios WHERE id = $1 AND rol = 'ejecutiva'",
      [ejecutiva_id]
    );

    if (ejecutivaCheck.rowCount === 0) {
      return res.status(400).json({
        error: 'La ejecutiva asignada no existe o no tiene el rol de ejecutiva.',
      });
    }

    const estadoFinal = estado || 'Nuevo';
    const result = await pool.query(`
      INSERT INTO clientes (empresa, nit, contacto_principal, telefono, correo, ejecutiva_id, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      empresa.trim(),
      nit.trim(),
      contacto_principal.trim(),
      telefono ? telefono.trim() : null,
      correo ? correo.trim().toLowerCase() : null,
      ejecutiva_id,
      estadoFinal,
    ]);

    res.status(201).json({
      message: 'Cliente creado exitosamente.',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('clientesController.crearCliente error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con este NIT.' });
    }
    res.status(500).json({ error: 'Error al registrar cliente.', detalle: error.message });
  }
};

module.exports = {
  listarClientes,
  obtenerClientePorId,
  crearCliente,
};
