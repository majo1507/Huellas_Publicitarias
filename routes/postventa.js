// ============================================================
// routes/postventa.js — Rutas del Módulo de Postventa y Calidad
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/postventa - Listar registros de postventa
router.get('/', async (req, res) => {
  const { orden_id, tipo } = req.query;

  try {
    let queryText = `
      SELECT
        pv.id,
        pv.orden_id,
        pv.tipo,
        pv.nivel_conformidad,
        pv.descripcion,
        pv.created_at,
        o.producto,
        c.empresa AS cliente_empresa,
        u.nombre_completo AS ejecutiva_nombre
      FROM postventa pv
      INNER JOIN ordenes o ON pv.orden_id = o.id
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u ON pv.ejecutiva_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (orden_id) {
      params.push(parseInt(orden_id, 10));
      queryText += ` AND pv.orden_id = $${params.length}`;
    }
    if (tipo) {
      params.push(tipo);
      queryText += ` AND pv.tipo = $${params.length}`;
    }

    queryText += ' ORDER BY pv.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('GET /api/postventa error:', error.message);
    res.status(500).json({ error: 'Error al consultar postventa.', detalle: error.message });
  }
});

// POST /api/postventa - Registrar evaluación, reclamo o garantía de postventa
router.post('/', async (req, res) => {
  const { orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion } = req.body;

  if (!orden_id || !ejecutiva_id || !tipo) {
    return res.status(400).json({
      error: 'Campos obligatorios: orden_id, ejecutiva_id, tipo (Ajuste, Garantía, Reclamo, Comentario).',
    });
  }

  const tiposPermitidos = ['Ajuste', 'Garantía', 'Reclamo', 'Comentario'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo de postventa no válido. Opciones: ${tiposPermitidos.join(', ')}`,
    });
  }

  if (nivel_conformidad !== undefined && nivel_conformidad !== null) {
    const calif = parseInt(nivel_conformidad, 10);
    if (isNaN(calif) || calif < 1 || calif > 5) {
      return res.status(400).json({ error: 'El nivel de conformidad debe ser un número entero entre 1 y 5.' });
    }
  }

  try {
    // Validar existencia de orden
    const ordenRes = await pool.query('SELECT id FROM ordenes WHERE id = $1', [orden_id]);
    if (ordenRes.rowCount === 0) {
      return res.status(404).json({ error: `Orden ${orden_id} no encontrada.` });
    }

    // Validar ejecutiva
    const ejecRes = await pool.query("SELECT id FROM usuarios WHERE id = $1 AND rol = 'ejecutiva'", [ejecutiva_id]);
    if (ejecRes.rowCount === 0) {
      return res.status(400).json({ error: 'La ejecutiva especificada no existe o no tiene dicho rol.' });
    }

    const insertRes = await pool.query(`
      INSERT INTO postventa (orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      orden_id,
      ejecutiva_id,
      tipo,
      nivel_conformidad || null,
      descripcion ? descripcion.trim() : null,
    ]);

    res.status(201).json({
      message: 'Registro de postventa creado exitosamente.',
      data: insertRes.rows[0],
    });
  } catch (error) {
    console.error('POST /api/postventa error:', error.message);
    res.status(500).json({ error: 'Error al registrar postventa.', detalle: error.message });
  }
});

module.exports = router;
