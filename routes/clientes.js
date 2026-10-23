// ============================================================
// routes/clientes.js — Rutas de Clientes
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/clientes - Listar clientes con el nombre de la ejecutiva asignada
router.get('/', async (_req, res) => {
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
    console.error('GET /api/clientes error:', error.message);
    res.status(500).json({ error: 'Error al obtener clientes.', detalle: error.message });
  }
});

// GET /api/clientes/:id - Obtener un cliente específico
router.get('/:id', async (req, res) => {
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
    console.error(`GET /api/clientes/${id} error:`, error.message);
    res.status(500).json({ error: 'Error al obtener el cliente.', detalle: error.message });
  }
});

// POST /api/clientes - Registrar un nuevo cliente
router.post('/', async (req, res) => {
  const { empresa, nit, contacto_principal, telefono, correo, ejecutiva_id, estado } = req.body;

  if (!empresa || !nit || !contacto_principal || !ejecutiva_id) {
    return res.status(400).json({
      error: 'Campos obligatorios: empresa, nit, contacto_principal, ejecutiva_id.',
    });
  }

  try {
    // Validar que la ejecutiva existe y tiene el rol correcto
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
    console.error('POST /api/clientes error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con este NIT.' });
    }
    res.status(500).json({ error: 'Error al registrar cliente.', detalle: error.message });
  }
});

module.exports = router;
