// ============================================================
// routes/disenos.js — Rutas de Archivos de Arte y Aprobaciones
// ============================================================
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const upload = require('../middleware/upload');

// GET /api/disenos/orden/:orden_id - Listar versiones de arte de una orden
router.get('/orden/:orden_id', async (req, res) => {
  const ordenId = parseInt(req.params.orden_id, 10);

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  try {
    // Validar existencia de la orden
    const ordenRes = await pool.query('SELECT id, producto FROM ordenes WHERE id = $1', [ordenId]);
    if (ordenRes.rowCount === 0) {
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    const archivosRes = await pool.query(`
      SELECT
        a.id,
        a.orden_id,
        a.numero_version,
        a.ruta_archivo,
        a.estado_aprobacion,
        a.comentario,
        a.created_at,
        creador.nombre_completo AS creador_nombre,
        decision.nombre_completo AS decidido_por_nombre
      FROM archivos_arte a
      INNER JOIN usuarios creador ON a.creador_id = creador.id
      LEFT JOIN usuarios decision ON a.decision_por = decision.id
      WHERE a.orden_id = $1
      ORDER BY a.numero_version ASC
    `, [ordenId]);

    res.json({
      orden_id: ordenId,
      producto: ordenRes.rows[0].producto,
      total_versiones: archivosRes.rowCount,
      data: archivosRes.rows,
    });
  } catch (error) {
    console.error(`GET /api/disenos/orden/${ordenId} error:`, error.message);
    res.status(500).json({ error: 'Error al consultar versiones de arte.', detalle: error.message });
  }
});

// POST /api/disenos/orden/:orden_id - Registrar nueva versión de arte
router.post('/orden/:orden_id', async (req, res) => {
  const ordenId = parseInt(req.params.orden_id, 10);
  const { ruta_archivo, creador_id, comentario } = req.body;

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  if (!creador_id) {
    return res.status(400).json({ error: 'El campo creador_id es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar orden
    const ordenRes = await client.query('SELECT id FROM ordenes WHERE id = $1', [ordenId]);
    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    // 2. Validar creador
    const creadorRes = await client.query('SELECT id FROM usuarios WHERE id = $1', [creador_id]);
    if (creadorRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El creador especificado no existe.' });
    }

    // 3. Determinar el siguiente número de versión
    const verRes = await client.query(
      'SELECT COALESCE(MAX(numero_version), 0) + 1 AS siguiente_version FROM archivos_arte WHERE orden_id = $1',
      [ordenId]
    );
    const siguienteVersion = verRes.rows[0].siguiente_version;

    // 4. Insertar versión
    const insertRes = await client.query(`
      INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, comentario, estado_aprobacion)
      VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING *
    `, [
      ordenId,
      siguienteVersion,
      ruta_archivo || null,
      creador_id,
      comentario || null,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Versión ${siguienteVersion} registrada exitosamente.`,
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`POST /api/disenos/orden/${ordenId} error:`, error.message);
    res.status(500).json({ error: 'Error al registrar versión de arte.', detalle: error.message });
  } finally {
    client.release();
  }
});

// PATCH /api/disenos/:id/aprobacion - Aprobar o rechazar un diseño
router.patch('/:id/aprobacion', async (req, res) => {
  const { id } = req.params;
  const { estado_aprobacion, decision_por, comentario } = req.body;

  const estadosPermitidos = ['borrador', 'pendiente', 'aprobado', 'rechazado'];
  if (!estadosPermitidos.includes(estado_aprobacion)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${estadosPermitidos.join(', ')}`,
    });
  }

  if (!decision_por) {
    return res.status(400).json({ error: 'El campo decision_por (ID del usuario) es obligatorio.' });
  }

  try {
    const updateRes = await pool.query(`
      UPDATE archivos_arte
      SET estado_aprobacion = $1, decision_por = $2, comentario = COALESCE($3, comentario)
      WHERE id = $4
      RETURNING *
    `, [estado_aprobacion, decision_por, comentario || null, id]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: `Archivo de arte ${id} no encontrado.` });
    }

    res.json({
      message: `Diseño actualizado a estado "${estado_aprobacion}".`,
      data: updateRes.rows[0],
    });
  } catch (error) {
    console.error(`PATCH /api/disenos/${id}/aprobacion error:`, error.message);
    res.status(500).json({ error: 'Error al actualizar aprobación de diseño.', detalle: error.message });
  }
});

// POST /api/disenos/upload/orden/:orden_id - Subir archivo físico y registrar versión de arte
router.post('/upload/orden/:orden_id', upload.single('archivo'), async (req, res) => {
  const ordenId = parseInt(req.params.orden_id, 10);
  const { creador_id, comentario } = req.body;

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Debes adjuntar un archivo en el campo "archivo".' });
  }

  if (!creador_id) {
    return res.status(400).json({ error: 'El campo creador_id es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar orden
    const ordenRes = await client.query('SELECT id FROM ordenes WHERE id = $1', [ordenId]);
    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    // 2. Validar creador
    const creadorRes = await client.query('SELECT id FROM usuarios WHERE id = $1', [creador_id]);
    if (creadorRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El usuario creador no existe.' });
    }

    // 3. Obtener el siguiente número de versión
    const verRes = await client.query(
      'SELECT COALESCE(MAX(numero_version), 0) + 1 AS siguiente_version FROM archivos_arte WHERE orden_id = $1',
      [ordenId]
    );
    const siguienteVersion = verRes.rows[0].siguiente_version;

    // 4. Guardar registro con la ruta relativa del archivo
    const rutaRelativa = `uploads/${req.file.filename}`;
    const insertRes = await client.query(`
      INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, comentario, estado_aprobacion)
      VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING *
    `, [
      ordenId,
      siguienteVersion,
      rutaRelativa,
      creador_id,
      comentario || null,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Archivo subido y versión ${siguienteVersion} registrada exitosamente.`,
      archivo: {
        nombre_original: req.file.originalname,
        tamano_bytes: req.file.size,
        mime_type: req.file.mimetype,
        url_descarga: `/uploads/${req.file.filename}`,
      },
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`POST /api/disenos/upload/orden/${ordenId} error:`, error.message);
    res.status(500).json({ error: 'Error al subir y registrar el arte.', detalle: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;

