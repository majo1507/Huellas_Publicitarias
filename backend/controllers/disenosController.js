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
const { validarArchivoEvidencia } = require('../utils/validacionesArchivo');
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
        a.tipo_aprobacion,
        a.soporte_evidencia,
        a.soporte_tipo,
        a.soporte_validado,
        a.soporte_fecha,
        a.created_at,
        creador.nombre_completo AS creador_nombre,
        decision.nombre_completo AS decidido_por_nombre,
        soporte_u.nombre_completo AS soporte_por_nombre
      FROM archivos_arte a
      LEFT JOIN usuarios creador ON a.creador_id = creador.id
      LEFT JOIN usuarios decision ON a.decision_por = decision.id
      LEFT JOIN usuarios soporte_u ON a.soporte_por = soporte_u.id
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
  const {
    estado_aprobacion,
    estado,
    decision_por,
    decisor,
    comentario,
    tipo_aprobacion,
    soporte_evidencia,
    soporte_tipo,
  } = req.body;
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

    // Determinar si es aprobación externa o digital
    const esExterna = String(tipo_aprobacion || '').toLowerCase() === 'externa';
    const tipoAprob = esExterna ? 'externa' : 'digital';

    let estadoFinalDb = estadoDb;
    let estadoUi;
    let soporteValidado = false;
    let soporteEvid = null;
    let soporteTip = soporte_tipo ? String(soporte_tipo).trim() : null;
    let disenoEstadoOrden;
    let mensajeRespuesta;
    let textoEvento;

    let soporteHash = null;

    if (estadoDb === 'aprobado') {
      if (tipoAprob === 'externa') {
        const ordenActual = await resolverOrden(client, arteRow.orden_id, true);
        const valSoporte = await validarArchivoEvidencia(req, 'archivo', 'soporte_evidencia', ordenActual, client, 'aprobacion_diseno');
        if (valSoporte.valido) {
          // Aprobación externa con soporte formal verificado (archivo físico real y formato admitido)
          soporteValidado = true;
          soporteEvid = valSoporte.filename;
          soporteHash = valSoporte.hashSha256 || null;
          soporteTip = soporteTip || 'documental';
          estadoUi = 'Aprobada (Externa)';
          disenoEstadoOrden = 'Aprobado';
          mensajeRespuesta = `Diseño v${arteRow.numero_version} aprobado externamente con soporte físico verificado (${soporteEvid}).`;
          textoEvento = `Diseño v${arteRow.numero_version} aprobado externamente por ${nombreDecidor} (Soporte verificado: ${soporteEvid})`;
        } else if (valSoporte.codigoHttp === 409) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: valSoporte.error });
        } else {
          // Aprobación externa SIN soporte válido o pendiente: permanece como registro preliminar pendiente
          estadoFinalDb = 'pendiente';
          soporteValidado = false;
          estadoUi = 'Pendiente de soporte';
          disenoEstadoOrden = 'Pendiente de soporte';
          mensajeRespuesta = `Aprobación externa registrada preliminarmente como PENDIENTE DE SOPORTE. Debe adjuntar la evidencia documental física de la versión v${arteRow.numero_version} para habilitar el paso a producción.`;
          textoEvento = `Visto bueno externo v${arteRow.numero_version} registrado preliminarmente (soporte documental pendiente de verificación)`;
        }
      } else {
        // Aprobación digital directa en plataforma
        soporteValidado = true;
        soporteEvid = 'Aprobación digital en plataforma';
        soporteTip = soporteTip || 'portal_web';
        estadoUi = 'Aprobada';
        disenoEstadoOrden = 'Aprobado';
        mensajeRespuesta = `Diseño v${arteRow.numero_version} aprobado digitalmente.`;
        textoEvento = `Diseño aprobado digitalmente por ${nombreDecidor}`;
      }
    } else if (estadoDb === 'rechazado') {
      estadoUi = 'Rechazada';
      disenoEstadoOrden = 'Requiere cambios';
      soporteValidado = false;
      mensajeRespuesta = `Diseño v${arteRow.numero_version} rechazado con observaciones.`;
      textoEvento = `Diseño rechazado: ${comentario || 'Se solicitaron ajustes'}`;
    } else {
      estadoUi = estadoDb === 'pendiente' ? 'Enviada' : 'En proceso';
      disenoEstadoOrden = estadoDb === 'pendiente' ? 'Enviado' : 'En proceso';
      mensajeRespuesta = `Diseño v${arteRow.numero_version} actualizado a estado "${estadoDb}".`;
      textoEvento = `Diseño v${arteRow.numero_version} cambiado a "${estadoDb}"`;
    }

    const updateRes = await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = $1,
           estado_ui = $2,
           decision_por = $3::uuid,
           comentario = COALESCE($4, comentario),
           tipo_aprobacion = $5,
           soporte_evidencia = $6,
           soporte_tipo = $7,
           soporte_validado = $8,
           soporte_fecha = CASE WHEN $8 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
           soporte_por = CASE WHEN $8 = true THEN $3::uuid ELSE NULL END,
           soporte_hash = CASE WHEN $8 = true THEN $10 ELSE NULL END
       WHERE id = $9
       RETURNING *`,
      [
        estadoFinalDb,
        estadoUi,
        usuarioDecidor.id,
        comentario || null,
        tipoAprob,
        soporteEvid,
        soporteTip,
        soporteValidado,
        arteRow.id,
        soporteHash,
      ]
    );

    const arte = updateRes.rows[0];

    // Verificar si la versión evaluada es la versión vigente más alta de la orden
    const maxVerRes = await client.query(
      'SELECT MAX(numero_version) AS max_version FROM archivos_arte WHERE orden_id = $1',
      [arte.orden_id]
    );
    const versionVigente = maxVerRes.rows[0]?.max_version || 1;
    const esVersionVigente = arte.numero_version >= versionVigente;

    // Actualizar estado general del diseño en la orden ÚNICAMENTE si corresponde a la versión vigente
    if (esVersionVigente) {
      if (disenoEstadoOrden === 'Aprobado') {
        await client.query("UPDATE ordenes SET diseno_estado = 'Aprobado' WHERE id = $1", [arte.orden_id]);
      } else if (disenoEstadoOrden === 'Requiere cambios') {
        await client.query(
          "UPDATE ordenes SET diseno_estado = 'Requiere cambios', estado_nombre = 'Diseño', etapa = 1 WHERE id = $1",
          [arte.orden_id]
        );
      } else if (disenoEstadoOrden === 'Pendiente de soporte') {
        await client.query("UPDATE ordenes SET diseno_estado = 'Pendiente de soporte' WHERE id = $1", [arte.orden_id]);
      }
    }

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
        estadoDb === 'rechazado' || !soporteValidado && estadoDb === 'aprobado' ? 'Pendiente' : 'Completado',
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [arte.orden_id]);

    res.json({
      message: mensajeRespuesta,
      data: arte,
      orden: ordenCompleta,
      soporte_validado: soporteValidado,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.aprobarORechazarDiseno error:', error.message);
    res.status(500).json({ error: 'Error al actualizar aprobación de diseño.' });
  } finally {
    client.release();
  }
};

// Adjuntar y validar soporte documental para aprobación externa (RF-07)
const adjuntarSoporteAprobacion = async (req, res) => {
  const targetId = req.params.id || req.params.orden_id;
  const { soporte_tipo, comentario, numero_version } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let arteRow = null;
    let orden = null;

    if (esUuid(targetId)) {
      const aRes = await client.query('SELECT * FROM archivos_arte WHERE id = $1 FOR UPDATE', [targetId]);
      if (aRes.rowCount > 0) {
        arteRow = aRes.rows[0];
        orden = await resolverOrden(client, arteRow.orden_id, true);
      }
    }

    if (!arteRow) {
      orden = await resolverOrden(client, targetId, true);
      if (orden) {
        let q = 'SELECT * FROM archivos_arte WHERE orden_id = $1';
        const params = [orden.id];
        if (numero_version) {
          q += ' AND numero_version = $2';
          params.push(parseInt(numero_version, 10));
        } else {
          q += ' ORDER BY numero_version DESC LIMIT 1';
        }
        q += ' FOR UPDATE';
        const aRes = await client.query(q, params);
        if (aRes.rowCount > 0) arteRow = aRes.rows[0];
      }
    }

    if (!arteRow || !orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Versión de arte u orden ${targetId} no encontrada.` });
    }

    // Validación estricta: debe ser un archivo real en disco con formato admitido, serialización atómica y contexto de diseño
    const valSoporte = await validarArchivoEvidencia(req, 'archivo', 'soporte_evidencia', orden, client, 'aprobacion_diseno');
    if (!valSoporte.valido) {
      await client.query('ROLLBACK');
      return res.status(valSoporte.codigoHttp || 400).json({ error: valSoporte.error });
    }

    const usuarioVerificador = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const nombreVerificador = req.usuario?.nombre_completo || usuarioVerificador.nombre_completo;

    const evidStr = valSoporte.filename;
    const tipStr = soporte_tipo ? String(soporte_tipo).trim() : 'documental';

    const updateRes = await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = 'aprobado',
           estado_ui = 'Aprobada (Externa)',
           tipo_aprobacion = 'externa',
           soporte_evidencia = $1,
           soporte_tipo = $2,
           soporte_validado = true,
           soporte_fecha = CURRENT_TIMESTAMP,
           soporte_por = $3,
           comentario = COALESCE($4, comentario),
           soporte_hash = $5
       WHERE id = $6
       RETURNING *`,
      [evidStr, tipStr, usuarioVerificador.id, comentario || null, valSoporte.hashSha256 || null, arteRow.id]
    );

    const arteActualizado = updateRes.rows[0];

    // Verificar si la versión a la que se le valida soporte es la versión vigente más alta
    const maxVerRes = await client.query(
      'SELECT MAX(numero_version) AS max_version FROM archivos_arte WHERE orden_id = $1',
      [arteActualizado.orden_id]
    );
    const versionVigente = maxVerRes.rows[0]?.max_version || 1;
    const esVersionVigente = arteActualizado.numero_version >= versionVigente;

    if (esVersionVigente) {
      // Habilitar la orden para producción ÚNICAMENTE si el soporte corresponde a la versión vigente
      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Aprobado' WHERE id = $1",
        [arteActualizado.orden_id]
      );
    }

    const textoEvento = esVersionVigente
      ? `Soporte documental físico verificado para arte vigente v${arteActualizado.numero_version}: ${evidStr} (${tipStr}). Aprobación formal liberada para taller.`
      : `Soporte documental físico verificado para versión histórica v${arteActualizado.numero_version}: ${evidStr}. No modifica estado de orden por existir versión vigente más reciente (v${versionVigente}).`;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
      [
        arteActualizado.orden_id,
        usuarioVerificador.id,
        textoEvento,
        formatearFechaHoy(),
        formatearHoraAhora(),
        nombreVerificador,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [arteActualizado.orden_id]);

    res.json({
      message: `Soporte documental verificado para versión v${arteActualizado.numero_version}. Producción habilitada.`,
      data: arteActualizado,
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.adjuntarSoporteAprobacion error:', error.message);
    res.status(500).json({ error: 'Error al adjuntar soporte de aprobación.' });
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
  adjuntarSoporteAprobacion,
  subirArchivoVersion,
};
