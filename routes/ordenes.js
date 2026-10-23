// ============================================================
// routes/ordenes.js — Rutas del Flujo Productivo de Órdenes
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/ordenes - Listar todas las órdenes con detalles relacionados
router.get('/', async (req, res) => {
  const { cliente_id, etapa, prioridad } = req.query;

  try {
    let queryText = `
      SELECT
        o.id,
        o.producto,
        o.etapa,
        o.prioridad,
        o.porcentaje_avance,
        o.bloqueado,
        o.created_at,
        o.updated_at,
        c.id AS cliente_id,
        c.empresa AS cliente_empresa,
        u_ejec.nombre_completo AS ejecutiva_nombre,
        u_dis.nombre_completo AS disenador_nombre,
        u_prod.nombre_completo AS produccion_nombre
      FROM ordenes o
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u_ejec ON o.ejecutiva_id = u_ejec.id
      LEFT JOIN usuarios u_dis ON o.disenador_id = u_dis.id
      LEFT JOIN usuarios u_prod ON o.produccion_id = u_prod.id
      WHERE 1=1
    `;
    const params = [];

    if (cliente_id) {
      params.push(cliente_id);
      queryText += ` AND o.cliente_id = $${params.length}`;
    }
    if (etapa !== undefined) {
      params.push(parseInt(etapa, 10));
      queryText += ` AND o.etapa = $${params.length}`;
    }
    if (prioridad) {
      params.push(prioridad);
      queryText += ` AND o.prioridad = $${params.length}`;
    }

    queryText += ' ORDER BY o.created_at DESC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('GET /api/ordenes error:', error.message);
    res.status(500).json({ error: 'Error al listar las órdenes.', detalle: error.message });
  }
});

// GET /api/ordenes/:id - Detalle de una orden
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        o.*,
        c.empresa AS cliente_empresa,
        c.nit AS cliente_nit,
        c.contacto_principal AS cliente_contacto,
        u_ejec.nombre_completo AS ejecutiva_nombre,
        u_dis.nombre_completo AS disenador_nombre,
        u_prod.nombre_completo AS produccion_nombre
      FROM ordenes o
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u_ejec ON o.ejecutiva_id = u_ejec.id
      LEFT JOIN usuarios u_dis ON o.disenador_id = u_dis.id
      LEFT JOIN usuarios u_prod ON o.produccion_id = u_prod.id
      WHERE o.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Orden ${id} no encontrada.` });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error(`GET /api/ordenes/${id} error:`, error.message);
    res.status(500).json({ error: 'Error al obtener la orden.', detalle: error.message });
  }
});

// POST /api/ordenes - Crear una orden de producción dentro de una transacción
router.post('/', async (req, res) => {
  const { cliente_id, producto, ejecutiva_id, disenador_id, produccion_id, prioridad } = req.body;

  if (!cliente_id || !producto || !ejecutiva_id) {
    return res.status(400).json({
      error: 'Campos obligatorios: cliente_id, producto y ejecutiva_id.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar cliente
    const clienteRes = await client.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (clienteRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Cliente con ID ${cliente_id} no encontrado.` });
    }

    // 2. Validar ejecutiva
    const ejecutivaRes = await client.query(
      "SELECT id FROM usuarios WHERE id = $1 AND rol = 'ejecutiva'",
      [ejecutiva_id]
    );
    if (ejecutivaRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La ejecutiva especificada no existe o no tiene el rol correspondiente.' });
    }

    // 3. Validar diseñador (si fue enviado)
    if (disenador_id) {
      const disRes = await client.query(
        "SELECT id FROM usuarios WHERE id = $1 AND rol = 'disenador'",
        [disenador_id]
      );
      if (disRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'El diseñador especificado no existe o no tiene el rol de diseñador.' });
      }
    }

    // 4. Insertar la orden
    const insertRes = await client.query(`
      INSERT INTO ordenes (cliente_id, producto, ejecutiva_id, disenador_id, produccion_id, etapa, prioridad, porcentaje_avance)
      VALUES ($1, $2, $3, $4, $5, 0, $6, 0.00)
      RETURNING *
    `, [
      cliente_id,
      producto.trim(),
      ejecutiva_id,
      disenador_id || null,
      produccion_id || null,
      prioridad || 'Media',
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Orden de producción creada exitosamente.',
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POST /api/ordenes error:', error.message);
    res.status(500).json({ error: 'Error al crear la orden.', detalle: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/ordenes/:id/etapa - Avanzar o retroceder etapa (0 - 8)
router.patch('/:id/etapa', async (req, res) => {
  const ordenId = parseInt(req.params.id, 10);
  const { etapa } = req.body;

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  if (etapa === undefined || etapa === null) {
    return res.status(400).json({ error: 'El campo etapa es obligatorio.' });
  }

  const nuevaEtapa = parseInt(etapa, 10);
  if (isNaN(nuevaEtapa) || nuevaEtapa < 0 || nuevaEtapa > 8) {
    return res.status(400).json({ error: 'La etapa debe ser un número entero entre 0 y 8.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar si la orden existe y si está bloqueada
    const ordenRes = await client.query(
      'SELECT id, bloqueado, etapa FROM ordenes WHERE id = $1',
      [ordenId]
    );

    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    if (ordenRes.rows[0].bloqueado) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La orden está bloqueada y no puede cambiar de etapa.' });
    }

    // Calcular porcentaje proporcional (8 etapas = 100%)
    const porcentaje = parseFloat(((nuevaEtapa / 8) * 100).toFixed(2));

    const updateRes = await client.query(`
      UPDATE ordenes
      SET etapa = $1, porcentaje_avance = $2
      WHERE id = $3
      RETURNING *
    `, [nuevaEtapa, porcentaje, ordenId]);

    await client.query('COMMIT');

    res.json({
      message: `Orden ${ordenId} actualizada a etapa ${nuevaEtapa} (${porcentaje}% completado).`,
      data: updateRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`PATCH /api/ordenes/${ordenId}/etapa error:`, error.message);
    res.status(500).json({ error: 'Error al actualizar etapa.', detalle: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
