// ============================================================
// controllers/disenosController.js — Controlador de Archivos de Arte
// ============================================================
const { pool } = require('../db');

// Listar versiones de arte de una orden
const listarVersionesPorOrden = async (req, res) => {
  const ordenId = parseInt(req.params.orden_id, 10);

  if (isNaN(ordenId)) {
    return res.status(400).json({ error: 'El ID de la orden debe ser un número entero.' });
  }

  try {
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
    console.error(`disenosController.listarVersionesPorOrden error:`, error.message);
    res.status(500).json({ error: 'Error al consultar versiones de arte.', detalle: error.message });
  }
};

// Registrar nueva versión de arte (datos manuales) con transacción y auditoría
const crearVersion = async (req, res) => {
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
    const ordenRes = await client.query('SELECT id, producto FROM ordenes WHERE id = $1 FOR UPDATE', [ordenId]);
    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    // 2. Validar creador
    const creadorRes = await client.query('SELECT id, nombre_completo FROM usuarios WHERE id = $1', [creador_id]);
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

    // 5. Registrar auditoría inmutable en registro_sesion
    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [
      ordenId,
      creador_id,
      `Nueva versión de arte v${siguienteVersion} cargada por ${creadorRes.rows[0].nombre_completo}.`,
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      message: `Versión ${siguienteVersion} registrada exitosamente.`,
      data: insertRes.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`disenosController.crearVersion error:`, error.message);
    res.status(500).json({ error: 'Error al registrar versión de arte.', detalle: error.message });
  } finally {
    client.release();
  }
};

// Aprobar o rechazar un diseño con transacción y registro de auditoría
const aprobarORechazarDiseno = async (req, res) => {
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar usuario decidor
    const usuarioRes = await client.query('SELECT id, nombre_completo FROM usuarios WHERE id = $1', [decision_por]);
    if (usuarioRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El usuario evaluador no existe.' });
    }

    // 2. Actualizar arte
    const updateRes = await client.query(`
      UPDATE archivos_arte
      SET estado_aprobacion = $1, decision_por = $2, comentario = COALESCE($3, comentario)
      WHERE id = $4
      RETURNING *
    `, [estado_aprobacion, decision_por, comentario || null, id]);

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Archivo de arte ${id} no encontrado.` });
    }

    const arte = updateRes.rows[0];

    // 3. Registrar auditoría inmutable
    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [
      arte.orden_id,
      decision_por,
      `Diseño v${arte.numero_version} cambiado a estado "${estado_aprobacion}" por ${usuarioRes.rows[0].nombre_completo}.${comentario ? ` Comentario: ${comentario}` : ''}`,
    ]);

    await client.query('COMMIT');

    res.json({
      message: `Diseño actualizado a estado "${estado_aprobacion}".`,
      data: arte,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`disenosController.aprobarORechazarDiseno error:`, error.message);
    res.status(500).json({ error: 'Error al actualizar aprobación de diseño.', detalle: error.message });
  } finally {
    client.release();
  }
};

// Subir archivo físico y registrar versión de arte con transacción
const subirArchivoVersion = async (req, res) => {
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
    const ordenRes = await client.query('SELECT id, producto FROM ordenes WHERE id = $1 FOR UPDATE', [ordenId]);
    if (ordenRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${ordenId} no encontrada.` });
    }

    // 2. Validar creador
    const creadorRes = await client.query('SELECT id, nombre_completo FROM usuarios WHERE id = $1', [creador_id]);
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

    // 5. Registrar auditoría inmutable
    await client.query(`
      INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto)
      VALUES ($1, $2, $3)
    `, [
      ordenId,
      creador_id,
      `Archivo físico subido para arte v${siguienteVersion} (${req.file.originalname}) por ${creadorRes.rows[0].nombre_completo}.`,
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
    console.error(`disenosController.subirArchivoVersion error:`, error.message);
    res.status(500).json({ error: 'Error al subir y registrar el arte.', detalle: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listarVersionesPorOrden,
  crearVersion,
  aprobarORechazarDiseno,
  subirArchivoVersion,
};
