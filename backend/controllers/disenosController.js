// ============================================================
// controllers/disenosController.js — Controlador de Archivos de Arte
// ORVEX — Huellas Publicidad S.A.S.
// Flujo: Diseño -> Comercial / Recepción -> Cliente -> Coordinación / Taller
// ============================================================
const { pool } = require('../db');
const {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  formatearFechaBogota,
  formatearHoraBogota,
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
        a.fecha_envio,
        a.fecha_envio_texto,
        a.hora_envio_texto,
        a.fecha_envio_comercial_texto,
        a.hora_envio_comercial_texto,
        a.enviado_a_comercial_nombre,
        a.gestion_comercial_estado,
        a.contacto_cliente_nombre,
        a.contacto_cliente_canal,
        a.contacto_cliente_fecha_texto,
        a.contacto_cliente_hora_texto,
        a.contacto_cliente_evidencia,
        a.contacto_cliente_observaciones,
        a.contacto_cliente_registrado_por_nombre,
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

    const versionesEnriquecidas = archivosRes.rows.map((row) => {
      const fechaEnvioIso = row.fecha_envio ? new Date(row.fecha_envio).toISOString() : null;
      const fechaEnvioTexto = row.fecha_envio_texto || (row.fecha_envio ? formatearFechaBogota(new Date(row.fecha_envio)) : null);
      const horaEnvioTexto = row.hora_envio_texto || (row.fecha_envio ? formatearHoraBogota(new Date(row.fecha_envio)) : null);
      return {
        ...row,
        numero: row.numero_version,
        estado: row.estado_ui,
        fecha: row.fecha_texto || formatearFechaBogota(new Date(row.created_at)),
        disenador: row.disenador_nombre || row.creador_nombre || 'María López',
        fechaEnvio: fechaEnvioIso,
        fechaEnvioTexto,
        horaEnvioTexto,
        fechaHoraEnvio: fechaEnvioTexto && horaEnvioTexto ? `${fechaEnvioTexto} ${horaEnvioTexto}` : null,
      };
    });

    res.json({
      orden_id: orden.codigo || orden.id,
      producto: orden.producto,
      total_versiones: archivosRes.rowCount,
      data: versionesEnriquecidas,
    });
  } catch (error) {
    console.error('disenosController.listarVersionesPorOrden error:', error.message);
    res.status(500).json({ error: 'Error al consultar versiones de arte.' });
  }
};

// Registrar nueva versión de arte con transacción y auditoría (ETAPA 1)
const crearVersion = async (req, res) => {
  const { ruta_archivo, archivoNombre, creador_id, comentario } = req.body;

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
    const ahora = new Date();
    const fechaHoy = formatearFechaBogota(ahora);
    const estDb = 'borrador';
    const estUi = 'En proceso';

    const insertRes = await client.query(
      `INSERT INTO archivos_arte (
        orden_id, numero_version, ruta_archivo, archivo_nombre, creador_id,
        comentario, estado_aprobacion, estado_ui, fecha_texto, disenador_nombre,
        gestion_comercial_estado, soporte_validado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en_diseno', false)
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

    // Al crear una versión nueva, la orden vuelve a estado "En diseño", impidiendo avances automáticos
    await client.query(
      `UPDATE ordenes
       SET diseno_estado = 'En diseño', estado_nombre = 'Diseño', etapa = 1
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
        formatearHoraBogota(ahora),
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

// Enviar la última versión de diseño a Comercial / Recepción (ETAPA 1 -> ETAPA 2)
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
      'SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1 FOR UPDATE',
      [orden.id]
    );
    if (ultRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La orden no tiene ninguna versión de diseño para enviar.' });
    }

    const ultima = ultRes.rows[0];
    if (
      ultima.estado_aprobacion === 'aprobado' ||
      (ultima.estado_aprobacion === 'pendiente' && orden.diseno_estado === 'Pendiente de gestión comercial')
    ) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La versión v${ultima.numero_version} ya fue enviada a Comercial o ya se encuentra aprobada.`,
      });
    }

    const ahora = new Date();
    const fechaEnvioTexto = formatearFechaBogota(ahora);
    const horaEnvioTexto = formatearHoraBogota(ahora);

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'disenador'));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    const esRevisionTecnica = orden.diseno_estado === 'Revisión técnica de archivo' || ultima.estado_ui === 'Revisión técnica de archivo';

    await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = 'pendiente',
           estado_ui = 'Pendiente de gestión comercial',
           gestion_comercial_estado = 'pendiente',
           comentario = COALESCE($1, comentario),
           fecha_envio = COALESCE(fecha_envio, CURRENT_TIMESTAMP),
           fecha_envio_texto = COALESCE(fecha_envio_texto, $2),
           hora_envio_texto = COALESCE(hora_envio_texto, $3),
           fecha_envio_comercial = COALESCE(fecha_envio_comercial, CURRENT_TIMESTAMP),
           fecha_envio_comercial_texto = COALESCE(fecha_envio_comercial_texto, $2),
           hora_envio_comercial_texto = COALESCE(hora_envio_comercial_texto, $3),
           enviado_a_comercial_por = $4,
           enviado_a_comercial_nombre = $5
       WHERE id = $6`,
      [observaciones || null, fechaEnvioTexto, horaEnvioTexto, respUser.id, respNombre, ultima.id]
    );

    await client.query(
      `UPDATE ordenes
       SET diseno_estado = 'Pendiente de gestión comercial', estado_nombre = 'Aprobación', etapa = 2
       WHERE id = $1`,
      [orden.id]
    );

    const textoAccion = esRevisionTecnica
      ? `Archivo de arte suministrado por el cliente verificado y aprobado técnicamente en pre-prensa. Enviado a Comercial para VoBo formal del cliente.`
      : `Diseño v${ultima.numero_version} enviado a Comercial para gestión con el cliente`;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
      [
        orden.id,
        respUser.id,
        textoAccion,
        fechaEnvioTexto,
        horaEnvioTexto,
        respNombre,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: esRevisionTecnica
        ? 'Archivo aprobado técnicamente en pre-prensa. Enviado a Comercial para visto bueno formal del cliente.'
        : `Diseño v${ultima.numero_version} enviado a Comercial. Pendiente de gestión con el cliente.`,
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.enviarDiseno error:', error.message);
    res.status(500).json({ error: 'Error al enviar diseño a Comercial.' });
  } finally {
    client.release();
  }
};

// Gestión Comercial con el cliente: Aprobación, Modificaciones o Espera de respuesta (ETAPA 2 y ETAPA 3)
const gestionarPropuestaComercial = async (req, res) => {
  const targetId = req.params.orden_id || req.params.id;
  const {
    accion,
    canal,
    nombreAutoriza,
    contacto,
    evidencia,
    soporte,
    observaciones,
    comentario,
    numero_version,
    versionNumero,
    fechaAprobacion,
    fecha_aprobacion,
  } = req.body;

  const rol = req.usuario?.rol_normalizado;
  if (rol === 'disenador') {
    return res.status(403).json({ error: 'El diseñador no puede aprobar ni registrar gestiones sobre sus propios diseños.' });
  }
  if (rol === 'cliente') {
    return res.status(403).json({ error: 'El perfil de cliente no tiene acceso directo para aprobar diseños en la plataforma.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, targetId, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${targetId} no encontrada.` });
    }

    const versionSolicitada = Number(numero_version || versionNumero || 0);
    let ultRes;
    if (versionSolicitada > 0) {
      ultRes = await client.query(
        'SELECT * FROM archivos_arte WHERE orden_id = $1 AND numero_version = $2 LIMIT 1 FOR UPDATE',
        [orden.id, versionSolicitada]
      );
    }
    if (!ultRes || ultRes.rowCount === 0) {
      ultRes = await client.query(
        'SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1 FOR UPDATE',
        [orden.id]
      );
    }
    if (ultRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La orden no tiene ninguna propuesta de diseño registrada.' });
    }

    const ultima = ultRes.rows[0];
    const ahora = new Date();
    const fechaHoy = formatearFechaBogota(ahora);
    const horaAhora = formatearHoraBogota(ahora);
    const fechaInput = String(fechaAprobacion || fecha_aprobacion || '').trim();
    const mFechaIso = fechaInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const fechaRegistroTexto = mFechaIso
      ? `${mFechaIso[3]}/${mFechaIso[2]}/${mFechaIso[1]}`
      : (fechaInput || fechaHoy);

    // RF-06/RF-07: Comercial solo gestiona con el cliente una versión enviada por Diseño
    // (no una versión aún en borrador 'En proceso' sin enviar).
    const versionEnviada = Boolean(
      ultima.fecha_envio_comercial ||
      ultima.fecha_envio ||
      ultima.estado_aprobacion === 'pendiente' ||
      ['Pendiente de gestión comercial', 'Esperando respuesta del cliente', 'Enviado', 'Enviado al cliente'].includes(ultima.estado_ui)
    );
    if (['aprobar', 'cambios', 'esperando'].includes(accion) && !versionEnviada) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La versión v${ultima.numero_version} aún no ha sido enviada a Comercial por el diseñador. Solo se puede gestionar con el cliente la versión enviada.`,
        version: ultima.numero_version,
      });
    }

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'ejecutiva'));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    const canalFinal = String(canal || 'WhatsApp').trim();
    const personaFinal = String(nombreAutoriza || contacto || '').trim();
    const textoEvidencia = String(evidencia || soporte || '').trim();
    const evidenciaFinal = req.file
      ? (textoEvidencia && !textoEvidencia.includes(req.file.originalname)
          ? `${textoEvidencia} (${req.file.filename})`
          : req.file.filename)
      : textoEvidencia;
    const obsFinal = String(observaciones || comentario || '').trim();

    if (accion === 'aprobar') {
      if (!personaFinal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debes indicar el nombre de la persona que autorizó el diseño.' });
      }
      if (!evidenciaFinal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debes adjuntar o indicar la evidencia verificable de la aprobación del cliente.' });
      }

      await client.query(
        `UPDATE archivos_arte
         SET estado_aprobacion = 'aprobado',
             estado_ui = 'Aprobado por el cliente',
             gestion_comercial_estado = 'aprobado',
             contacto_cliente_nombre = $1,
             contacto_cliente_canal = $2,
             contacto_cliente_fecha = CURRENT_TIMESTAMP,
             contacto_cliente_fecha_texto = $3,
             contacto_cliente_hora_texto = $4,
             contacto_cliente_evidencia = $5,
             contacto_cliente_observaciones = $6,
             contacto_cliente_registrado_por = $7,
             contacto_cliente_registrado_por_nombre = $8,
             tipo_aprobacion = 'externa',
             soporte_evidencia = $5,
             soporte_validado = true,
             soporte_fecha = CURRENT_TIMESTAMP,
             soporte_por = $7
         WHERE id = $9`,
        [personaFinal, canalFinal, fechaRegistroTexto, horaAhora, evidenciaFinal, obsFinal || null, respUser.id, respNombre, ultima.id]
      );

      await client.query(
        `UPDATE ordenes
         SET diseno_estado = 'Aprobado por el cliente',
             estado_nombre = CASE WHEN estado_nombre = 'Diseño' THEN 'Aprobación' ELSE estado_nombre END,
             etapa = CASE WHEN etapa < 2 THEN 2 ELSE etapa END
         WHERE id = $1`,
        [orden.id]
      );

      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
        ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
        [
          orden.id,
          respUser.id,
          `Diseño v${ultima.numero_version} aprobado por el cliente (${personaFinal}) vía ${canalFinal}. Evidencia: ${evidenciaFinal}`,
          fechaRegistroTexto,
          horaAhora,
          respNombre,
        ]
      );

      await client.query('COMMIT');
      const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
      return res.json({
        message: `Diseño v${ultima.numero_version} aprobado por el cliente (${personaFinal}). Listo para verificación de Coordinación.`,
        orden: ordenCompleta,
      });

    } else if (accion === 'cambios') {
      if (!obsFinal || obsFinal.length < 5) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Debes registrar las observaciones y modificaciones solicitadas por el cliente (mínimo 5 caracteres).' });
      }

      await client.query(
        `UPDATE archivos_arte
         SET estado_aprobacion = 'rechazado',
             estado_ui = 'Cambios solicitados',
             gestion_comercial_estado = 'cambios_solicitados',
             contacto_cliente_nombre = $1,
             contacto_cliente_canal = $2,
             contacto_cliente_fecha = CURRENT_TIMESTAMP,
             contacto_cliente_fecha_texto = $3,
             contacto_cliente_hora_texto = $4,
             contacto_cliente_observaciones = $5,
             comentario = $5,
             contacto_cliente_registrado_por = $6,
             contacto_cliente_registrado_por_nombre = $7,
             soporte_validado = false
         WHERE id = $8`,
        [personaFinal || null, canalFinal, fechaHoy, horaAhora, obsFinal, respUser.id, respNombre, ultima.id]
      );

      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Cambios solicitados', estado_nombre = 'Diseño', etapa = 1 WHERE id = $1",
        [orden.id]
      );

      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
        ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false)`,
        [
          orden.id,
          respUser.id,
          `Cliente solicitó modificaciones para diseño v${ultima.numero_version} vía ${canalFinal}: "${obsFinal}". Trabajo devuelto a Diseño.`,
          fechaHoy,
          horaAhora,
          respNombre,
        ]
      );

      await client.query('COMMIT');
      const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
      return res.json({
        message: 'Modificaciones registradas. Trabajo devuelto a Diseño para generar nueva versión.',
        orden: ordenCompleta,
      });

    } else if (accion === 'esperando') {
      await client.query(
        `UPDATE archivos_arte
         SET estado_ui = 'Esperando respuesta del cliente',
             gestion_comercial_estado = 'esperando_cliente',
             contacto_cliente_nombre = $1,
             contacto_cliente_canal = $2,
             contacto_cliente_fecha = CURRENT_TIMESTAMP,
             contacto_cliente_fecha_texto = $3,
             contacto_cliente_hora_texto = $4,
             contacto_cliente_observaciones = $5,
             contacto_cliente_registrado_por = $6,
             contacto_cliente_registrado_por_nombre = $7
         WHERE id = $8`,
        [personaFinal || null, canalFinal, fechaHoy, horaAhora, obsFinal || null, respUser.id, respNombre, ultima.id]
      );

      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Esperando respuesta del cliente' WHERE id = $1",
        [orden.id]
      );

      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
        ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false)`,
        [
          orden.id,
          respUser.id,
          `Comunicación iniciada con el cliente vía ${canalFinal}${personaFinal ? ' (' + personaFinal + ')' : ''}. Esperando respuesta del cliente.`,
          fechaHoy,
          horaAhora,
          respNombre,
        ]
      );

      await client.query('COMMIT');
      const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
      return res.json({
        message: 'Estado registrado: Esperando respuesta del cliente.',
        orden: ordenCompleta,
      });

    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Acción no válida. Opciones permitidas: aprobar, cambios, esperando.' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.gestionarPropuestaComercial error:', error.message);
    res.status(500).json({ error: 'Error al registrar la gestión comercial del diseño.' });
  } finally {
    client.release();
  }
};

// Aprobar o rechazar diseño (Ruta estándar con validación de roles y evidencias)
const aprobarORechazarDiseno = async (req, res) => {
  const targetId = req.params.id || req.params.orden_id;
  const rol = req.usuario?.rol_normalizado;

  if (rol === 'disenador') {
    return res.status(403).json({ error: 'El diseñador no puede aprobar sus propios diseños.' });
  }
  if (rol === 'cliente') {
    return res.status(403).json({ error: 'El perfil de cliente no tiene acceso directo para aprobar diseños en la plataforma.' });
  }

  const {
    estado_aprobacion,
    estado,
    decision_por,
    decisor,
    comentario,
    tipo_aprobacion,
    soporte_evidencia,
    soporte_tipo,
    contacto,
    canal,
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

    // Solo se decide sobre una versión que el diseñador ya envió (misma regla que la gestión comercial).
    if (['aprobado', 'rechazado'].includes(estadoDb) && !(arteRow.fecha_envio_comercial || arteRow.fecha_envio)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La versión v${arteRow.numero_version} aún no ha sido enviada a Comercial por el diseñador. Solo se puede decidir sobre la versión enviada.`,
        version: arteRow.numero_version,
      });
    }

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
      const ordenActual = await resolverOrden(client, arteRow.orden_id, true);
      const valSoporte = await validarArchivoEvidencia(req, 'archivo', 'soporte_evidencia', ordenActual, client, 'aprobacion_diseno');

      if (valSoporte.valido) {
        soporteValidado = true;
        soporteEvid = valSoporte.filename;
        soporteHash = valSoporte.hashSha256 || null;
        soporteTip = soporteTip || 'documental';
        estadoUi = 'Aprobado por el cliente';
        disenoEstadoOrden = 'Aprobado por el cliente';
        mensajeRespuesta = `Diseño v${arteRow.numero_version} aprobado por el cliente con soporte físico verificado (${soporteEvid}).`;
        textoEvento = `Diseño v${arteRow.numero_version} aprobado por el cliente (${nombreDecidor}). Soporte: ${soporteEvid}`;
      } else if (valSoporte.codigoHttp === 409) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: valSoporte.error });
      } else if (soporte_evidencia && String(soporte_evidencia).trim().length > 0) {
        soporteValidado = true;
        soporteEvid = String(soporte_evidencia).trim();
        soporteTip = soporteTip || 'digital';
        estadoUi = 'Aprobado por el cliente';
        disenoEstadoOrden = 'Aprobado por el cliente';
        mensajeRespuesta = `Diseño v${arteRow.numero_version} aprobado formalmente. Evidencia: ${soporteEvid}.`;
        textoEvento = `Diseño v${arteRow.numero_version} aprobado con soporte: ${soporteEvid}`;
      } else {
        // Bloqueo: No se permiten aprobaciones ficticias sin soporte verificable
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Debes adjuntar o indicar la evidencia o soporte verificable de la aprobación del cliente para registrar la aprobación.',
        });
      }
    } else if (estadoDb === 'rechazado') {
      estadoUi = 'Cambios solicitados';
      disenoEstadoOrden = 'Cambios solicitados';
      soporteValidado = false;
      mensajeRespuesta = `Diseño v${arteRow.numero_version} devuelto por modificaciones.`;
      textoEvento = `Cliente solicitó modificaciones para diseño v${arteRow.numero_version}: ${comentario || 'Se solicitaron ajustes'}`;
    } else {
      estadoUi = estadoDb === 'pendiente' ? 'Pendiente de gestión comercial' : 'En proceso';
      disenoEstadoOrden = estadoDb === 'pendiente' ? 'Pendiente de gestión comercial' : 'En diseño';
      mensajeRespuesta = `Diseño v${arteRow.numero_version} actualizado a estado "${estadoDb}".`;
      textoEvento = `Diseño v${arteRow.numero_version} cambiado a "${estadoDb}"`;
    }

    const updateRes = await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = $1::estado_aprobacion_arte,
           estado_ui = $2,
           decision_por = $3::uuid,
           comentario = COALESCE($4, comentario),
           tipo_aprobacion = $5,
           soporte_evidencia = $6,
           soporte_tipo = $7,
           soporte_validado = $8::boolean,
           soporte_fecha = CASE WHEN $8::boolean = true THEN CURRENT_TIMESTAMP ELSE NULL END,
           soporte_por = CASE WHEN $8::boolean = true THEN $3::uuid ELSE NULL END,
           soporte_hash = CASE WHEN $8::boolean = true THEN $10::varchar ELSE NULL END,
           gestion_comercial_estado = CASE WHEN $1::text = 'aprobado' THEN 'aprobado' WHEN $1::text = 'rechazado' THEN 'cambios_solicitados' ELSE 'pendiente' END,
           contacto_cliente_nombre = COALESCE($11, contacto_cliente_nombre),
           contacto_cliente_canal = COALESCE($12, contacto_cliente_canal),
           contacto_cliente_evidencia = CASE WHEN $8::boolean = true THEN COALESCE($6, contacto_cliente_evidencia) ELSE contacto_cliente_evidencia END
       WHERE id = $9
       RETURNING *`,
      [
        estadoFinalDb,
        estadoUi,
        usuarioDecidor.id,
        comentario || null,
        tipo_aprobacion || 'externa',
        soporteEvid,
        soporteTip,
        soporteValidado,
        arteRow.id,
        soporteHash,
        contacto || null,
        canal || 'WhatsApp',
      ]
    );

    const arte = updateRes.rows[0];

    // Verificar si es la versión vigente más alta
    const maxVerRes = await client.query(
      'SELECT MAX(numero_version) AS max_version FROM archivos_arte WHERE orden_id = $1',
      [arte.orden_id]
    );
    const versionVigente = maxVerRes.rows[0]?.max_version || 1;
    const esVersionVigente = arte.numero_version >= versionVigente;

    if (esVersionVigente) {
      if (disenoEstadoOrden === 'Aprobado por el cliente') {
        await client.query("UPDATE ordenes SET diseno_estado = 'Aprobado por el cliente' WHERE id = $1", [arte.orden_id]);
      } else if (disenoEstadoOrden === 'Cambios solicitados') {
        await client.query(
          "UPDATE ordenes SET diseno_estado = 'Cambios solicitados', estado_nombre = 'Diseño', etapa = 1 WHERE id = $1",
          [arte.orden_id]
        );
      } else {
        await client.query("UPDATE ordenes SET diseno_estado = $1 WHERE id = $2", [disenoEstadoOrden, arte.orden_id]);
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

// Liberar formalmente para impresión tras verificación (ETAPA 3 -> ETAPA 4)
const liberarParaImpresion = async (req, res) => {
  const targetId = req.params.orden_id || req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, targetId, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${targetId} no encontrada.` });
    }

    const ultRes = await client.query(
      'SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1 FOR UPDATE',
      [orden.id]
    );
    if (ultRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La orden no tiene ninguna versión de diseño.' });
    }

    const ultima = ultRes.rows[0];
    const estaAprobado = ultima.estado_aprobacion === 'aprobado' && (ultima.soporte_validado === true || Boolean(ultima.contacto_cliente_evidencia));

    if (!estaAprobado) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `No se puede liberar para impresión: la versión vigente (v${ultima.numero_version}) aún no cuenta con aprobación formal del cliente con evidencia verificada.`,
      });
    }

    if (orden.diseno_estado === 'Listo para impresión') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La orden ${orden.codigo || orden.id} ya fue verificada y liberada para impresión previamente.`,
      });
    }

    const ahora = new Date();
    const fechaHoy = formatearFechaBogota(ahora);
    const horaAhora = formatearHoraBogota(ahora);
    const coordUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const coordNombre = req.usuario?.nombre_completo || coordUser.nombre_completo;

    await client.query(
      "UPDATE ordenes SET diseno_estado = 'Listo para impresión' WHERE id = $1",
      [orden.id]
    );

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
      [
        orden.id,
        coordUser.id,
        `Diseño v${ultima.numero_version} verificado y liberado para impresión por Coordinación (${coordNombre})`,
        fechaHoy,
        horaAhora,
        coordNombre,
      ]
    );

    await client.query('COMMIT');
    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: `Orden ${ordenCompleta.id} liberada formalmente para impresión. Lista para pasar a producción.`,
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.liberarParaImpresion error:', error.message);
    res.status(500).json({ error: 'Error al liberar orden para impresión.' });
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
        const p = [orden.id];
        if (numero_version) {
          q += ' AND numero_version = $2';
          p.push(Number(numero_version));
        } else {
          q += ' ORDER BY numero_version DESC LIMIT 1';
        }
        q += ' FOR UPDATE';
        const aRes = await client.query(q, p);
        if (aRes.rowCount > 0) arteRow = aRes.rows[0];
      }
    }

    if (!arteRow || !orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Archivo de arte u orden ${targetId} no encontrado.` });
    }

    const valSoporte = await validarArchivoEvidencia(req, 'archivo', 'soporte_evidencia', orden, client, 'aprobacion_diseno');
    if (!valSoporte.valido) {
      await client.query('ROLLBACK');
      return res.status(valSoporte.codigoHttp || 400).json({ error: valSoporte.error });
    }

    const usuarioSoporte = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const nombreSoporte = req.usuario?.nombre_completo || usuarioSoporte.nombre_completo;

    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();

    const upRes = await client.query(
      `UPDATE archivos_arte
       SET estado_aprobacion = 'aprobado',
           estado_ui = 'Aprobado por el cliente',
           gestion_comercial_estado = 'aprobado',
           tipo_aprobacion = 'externa',
           soporte_evidencia = $1,
           soporte_tipo = $2,
           soporte_validado = true,
           soporte_fecha = CURRENT_TIMESTAMP,
           soporte_por = $3,
           soporte_hash = $4,
           comentario = COALESCE($5, comentario)
       WHERE id = $6
       RETURNING *`,
      [
        valSoporte.filename,
        soporte_tipo || 'documental',
        usuarioSoporte.id,
        valSoporte.hashSha256,
        comentario || null,
        arteRow.id,
      ]
    );

    const maxVerRes = await client.query(
      'SELECT MAX(numero_version) AS max_version FROM archivos_arte WHERE orden_id = $1',
      [orden.id]
    );
    const esVersionVigente = arteRow.numero_version >= (maxVerRes.rows[0]?.max_version || 1);

    if (esVersionVigente) {
      await client.query(
        "UPDATE ordenes SET diseno_estado = 'Aprobado por el cliente' WHERE id = $1",
        [orden.id]
      );
    }

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
      [
        orden.id,
        usuarioSoporte.id,
        `Soporte documental de aprobación v${arteRow.numero_version} adjuntado y verificado (${valSoporte.filename}) por ${nombreSoporte}`,
        fechaHoy,
        horaAhora,
        nombreSoporte,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.json({
      message: `Soporte de aprobación de la versión v${arteRow.numero_version} adjuntado y verificado exitosamente.`,
      data: upRes.rows[0],
      orden: ordenCompleta,
      soporte_validado: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('disenosController.adjuntarSoporteAprobacion error:', error.message);
    res.status(500).json({ error: 'Error al adjuntar soporte documental.' });
  } finally {
    client.release();
  }
};

// Carga física de archivo para una versión
const subirArchivoVersion = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Debes seleccionar un archivo para cargar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.orden_id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.orden_id} no encontrada.` });
    }

    const creador = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'disenador'));

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
        comentario, estado_aprobacion, estado_ui, fecha_texto, disenador_nombre,
        gestion_comercial_estado, soporte_validado
      ) VALUES ($1, $2, $3, $4, $5, $6, 'borrador', 'En proceso', $7, $8, 'en_diseno', false)
      RETURNING *`,
      [
        orden.id,
        siguienteVersion,
        rutaRelativa,
        req.file.originalname,
        creador.id,
        req.body.comentario || null,
        fechaHoy,
        orden.disenador_nombre_asignado || creador.nombre_completo || 'María López',
      ]
    );

    await client.query(
      `UPDATE ordenes
       SET diseno_estado = 'En diseño', estado_nombre = 'Diseño', etapa = 1
       WHERE id = $1`,
      [orden.id]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.status(201).json({
      message: `Arte v${siguienteVersion} cargado exitosamente.`,
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
  gestionarPropuestaComercial,
  aprobarORechazarDiseno,
  liberarParaImpresion,
  adjuntarSoporteAprobacion,
  subirArchivoVersion,
};
