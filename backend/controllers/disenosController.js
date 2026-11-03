// ============================================================
// controllers/disenosController.js — Controlador de Archivos de Arte
// ============================================================
const { pool } = require('../db');
const {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  resolverOrden,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');

// Listar versiones de arte de una orden
const listarVersionesPorOrden = async (req, res) => {
  try {
    const orden = await resolverOrden(pool, req.params.orden_id);
    if (!orden) {
      return res.status(404).json({ error: `Orden ${req.params.orden_id} no encontrada.` });
    }

    const archivosRes = await pool.query(
      `SELECT
        a.id,
        a.orden_id,
        a.numero_version,
        a.ruta_archivo,
        a.archivo_nombre,
        a.estado_aprobacion,
        a.estado_ui,
        a.comentario,
        a.fecha_texto,
        a.disenador_nombre,
        a.created_at,
        creador.nombre_completo AS creador_nombre,
        decision.nombre_completo AS decidido_por_nombre
      FROM archivos_arte a
      LEFT JOIN usuarios creador ON a.creador_id = creador.id
      LEFT JOIN usuarios decision ON a.decision_por = decision.id
      WHERE a.orden_id = $1
      ORDER BY a.numero_version ASC`,
      [orden.id]
    );

    res.json({
      orden_id: orden.codigo || orden.id,
      producto: orden.producto,
      total_versiones: archivosRes.rowCount,
      data: archivosRes.rows,
    });
  } catch (error) {
    console.error('disenosController.listarVersionesPorOrden error:', error.message);
    res.status(500).json({ error: 'Error al consultar versiones de arte.' });
  }
};

// Registrar nueva versión de arte con transacción y auditoría
const crearVersion = async (req, res) => {
  const { ruta_archivo, archivoNombre, creador_id, comentario, estado_aprobacion } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.orden_id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.orden_id} no encontrada.` });
    }

    let creador = null;
    if (req.usuario?.id && req.usuario.rol !== 'cliente') {
      creador = await resolverUsuario(client, req.usuario.id);
    }
    if (!creador && creador_id) {
      creador = await resolverUsuario(client, creador_id);
    }
    if (!creador) {
      creador = await obtenerUsuarioPorDefecto(client, 'disenador');
    }

    const verRes = await client.query(
      'SELECT COALESCE(MAX(numero_version), 0) + 1 AS siguiente_version FROM archivos_arte WHERE orden_id = $1',
      [orden.id]
    );
    const siguienteVersion = verRes.rows[0].siguiente_version;
    const codigoOrden = orden.codigo || `OP-2026-${String(orden.id).padStart(4, '0')}`;
    const nombreArch = archivoNombre || (ruta_archivo ? ruta_archivo.split('/').pop() : `Arte_Final_${codigoOrden}_v${siguienteVersion}.pdf`);
    const rutaFinal = ruta_archivo || `uploads/${nombreArch}`;
    const fechaHoy = formatearFechaHoy();
    const estDb = estado_aprobacion || 'borrador';
    const estUi = estDb === 'aprobado' ? 'Aprobada' : estDb === 'pendiente' ? 'Enviada' : 'En proceso';

    const insertRes = await client.query(
      `INSERT INTO archivos_arte (
        orden_id, numero_version, ruta_archivo, archivo_nombre, creador_id,
        comentario, estado_aprobacion, estado_ui, fecha_texto, disenador_nombre
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        orden.id,
        siguienteVersion,
        rutaFinal,
        nombreArch,
        creador.id,
        comentario || null,
        estDb,
        estUi,
        fechaHoy,
        orden.disenador_nombre_asignado || creador.nombre_completo || 'María López',
      ]
    );

    await client.query(
      `UPDATE ordenes
       SET diseno_estado = 'En proceso', estado_nombre = 'Diseño', etapa = 1
       WHERE id = $1`,
      [orden.id]
    );

    const autorNombre = req.usuario?.nombre_completo || creador.nombre_completo;
    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
      [
        orden.id,
        creador.id,
        `Diseño creado (versión ${siguienteVersion})`,
        fechaHoy,
        formatearHoraAhora(),
        autorNombre,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.status(201).json({
      message: `Versión ${siguienteVersion} registrada exitosamente.`,
      data: { ...insertRes.rows[0], numero: siguienteVersion },
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.crearVersion error:', error.message);
    res.status(500).json({ error: 'Error al registrar versión de arte.' });
  } finally {
    client.release();
  }
};

// Enviar la última versión de diseño para aprobación del cliente
const enviarDiseno = async (req, res) => {
  const { observaciones } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.orden_id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.orden_id} no encontrada.` });
    }

    const ultRes = await client.query(
      'SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1',
      [orden.id]
    );
    if (ultRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La orden no tiene ninguna versión de diseño para enviar.' });
    }

    const ultima = ultRes.rows[0];
    await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = 'pendiente', estado_ui = 'Enviada',
           comentario = COALESCE($1, comentario)
       WHERE id = $2`,
      [observaciones || null, ultima.id]
    );

    await client.query(
      `UPDATE ordenes
       SET diseno_estado = 'Enviado', estado_nombre = 'Aprobación', etapa = 2
       WHERE id = $1`,
      [orden.id]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'disenador'));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,'Diseño enviado para aprobación',$3,$4,$5,'Completado',false)`,
      [orden.id, respUser.id, formatearFechaHoy(), formatearHoraAhora(), respNombre]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: 'Diseño enviado para aprobación del cliente.',
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.enviarDiseno error:', error.message);
    res.status(500).json({ error: 'Error al enviar diseño para aprobación.' });
  } finally {
    client.release();
  }
};

// Aprobar o rechazar un diseño (por ID de archivo_arte o por ID/código de orden)
const aprobarORechazarDiseno = async (req, res) => {
  const targetId = req.params.id || req.params.orden_id;
  const { estado_aprobacion, estado, decision_por, decisor, comentario } = req.body;
  const inputEstado = estado_aprobacion || estado;
  const inputDecisor = decision_por || decisor;

  const mapaEntrada = {
    aprobado: 'aprobado',
    aprobada: 'aprobado',
    rechazado: 'rechazado',
    rechazada: 'rechazado',
    pendiente: 'pendiente',
    enviada: 'pendiente',
    borrador: 'borrador',
  };
  const estadoDb = mapaEntrada[String(inputEstado || '').toLowerCase()];
  if (!estadoDb) {
    return res.status(400).json({
      error: 'Estado inválido. Debe ser uno de: borrador, pendiente, aprobado, rechazado.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let usuarioDecidor = null;
    if (req.usuario?.id && req.usuario.rol !== 'cliente') {
      usuarioDecidor = await resolverUsuario(client, req.usuario.id);
    }
    if (!usuarioDecidor && inputDecisor) {
      usuarioDecidor = await resolverUsuario(client, inputDecisor);
    }
    if (!usuarioDecidor) {
      usuarioDecidor = await obtenerUsuarioPorDefecto(client, 'coord');
    }
    const nombreDecidor = req.usuario?.nombre_completo || usuarioDecidor.nombre_completo;

    let arteRow = null;
    if (esUuid(targetId)) {
      const aRes = await client.query('SELECT * FROM archivos_arte WHERE id = $1 FOR UPDATE', [targetId]);
      if (aRes.rowCount > 0) arteRow = aRes.rows[0];
    }

    if (!arteRow) {
      const orden = await resolverOrden(client, targetId, true);
      if (orden) {
        const aRes = await client.query(
          'SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1 FOR UPDATE',
          [orden.id]
        );
        if (aRes.rowCount > 0) arteRow = aRes.rows[0];
      }
    }

    if (!arteRow) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Archivo de arte u orden ${targetId} no encontrado.` });
    }

    const estadoUi =
      estadoDb === 'aprobado'
        ? 'Aprobada'
        : estadoDb === 'rechazado'
          ? 'Rechazada'
          : estadoDb === 'pendiente'
            ? 'Enviada'
            : 'En proceso';

    const updateRes = await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = $1, estado_ui = $2, decision_por = $3, comentario = COALESCE($4, comentario)
       WHERE id = $5
       RETURNING *`,
      [estadoDb, estadoUi, usuarioDecidor.id, comentario || null, arteRow.id]
    );

    const arte = updateRes.rows[0];

    if (estadoDb === 'aprobado') {
      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Aprobado' WHERE id = $1",
        [arte.orden_id]
      );
    } else if (estadoDb === 'rechazado') {
      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Requiere cambios', estado_nombre = 'Diseño', etapa = 1 WHERE id = $1",
        [arte.orden_id]
      );
    }

    const textoEvento =
      estadoDb === 'aprobado'
        ? 'Diseño aprobado'
        : estadoDb === 'rechazado'
          ? `Diseño rechazado: ${comentario || 'Se solicitaron ajustes'}`
          : `Diseño v${arte.numero_version} cambiado a "${estadoDb}"`;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
      [
        arte.orden_id,
        usuarioDecidor.id,
        textoEvento,
        formatearFechaHoy(),
        formatearHoraAhora(),
        nombreDecidor,
        estadoDb === 'rechazado' ? 'Pendiente' : 'Completado',
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [arte.orden_id]);

    res.json({
      message: `Diseño actualizado a estado "${estadoDb}".`,
      data: arte,
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.aprobarORechazarDiseno error:', error.message);
    res.status(500).json({ error: 'Error al actualizar aprobación de diseño.' });
  } finally {
    client.release();
  }
};

// Subir archivo físico y registrar versión de arte con transacción
const subirArchivoVersion = async (req, res) => {
  const { creador_id, comentario } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Debes adjuntar un archivo en el campo "archivo".' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.orden_id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.orden_id} no encontrada.` });
    }

    let creador = null;
    if (req.usuario?.id && req.usuario.rol !== 'cliente') {
      creador = await resolverUsuario(client, req.usuario.id);
    }
    if (!creador && creador_id) {
      creador = await resolverUsuario(client, creador_id);
    }
    if (!creador) {
      creador = await obtenerUsuarioPorDefecto(client, 'disenador');
    }

    const verRes = await client.query(
      'SELECT COALESCE(MAX(numero_version), 0) + 1 AS siguiente_version FROM archivos_arte WHERE orden_id = $1',
      [orden.id]
    );
    const siguienteVersion = verRes.rows[0].siguiente_version;
    const rutaRelativa = `uploads/${req.file.filename}`;
    const fechaHoy = formatearFechaHoy();

    const insertRes = await client.query(
      `INSERT INTO archivos_arte (
        orden_id, numero_version, ruta_archivo, archivo_nombre, creador_id,
        comentario, estado_aprobacion, estado_ui, fecha_texto, disenador_nombre
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', 'En proceso', $7, $8)
      RETURNING *`,
      [
        orden.id,
        siguienteVersion,
        rutaRelativa,
        req.file.originalname,
        creador.id,
        comentario || null,
        fechaHoy,
        orden.disenador_nombre_asignado || creador.nombre_completo,
      ]
    );

    await client.query(
      "UPDATE ordenes SET diseno_estado = 'En proceso', estado_nombre = 'Diseño', etapa = 1 WHERE id = $1",
      [orden.id]
    );

    const autorNombre = req.usuario?.nombre_completo || creador.nombre_completo;
    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
      [
        orden.id,
        creador.id,
        `Archivo físico subido para arte v${siguienteVersion} (${req.file.originalname}) por ${autorNombre}.`,
        fechaHoy,
        formatearHoraAhora(),
        autorNombre,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.status(201).json({
      message: `Archivo subido y versión ${siguienteVersion} registrada exitosamente.`,
      archivo: {
        nombre_original: req.file.originalname,
        tamano_bytes: req.file.size,
        mime_type: req.file.mimetype,
        url_descarga: `/uploads/${req.file.filename}`,
      },
      data: insertRes.rows[0],
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.subirArchivoVersion error:', error.message);
    res.status(500).json({ error: 'Error al subir y registrar el arte.' });
  } finally {
    client.release();
  }
};

module.exports = {
  listarVersionesPorOrden,
  crearVersion,
  enviarDiseno,
  aprobarORechazarDiseno,
  subirArchivoVersion,
};
