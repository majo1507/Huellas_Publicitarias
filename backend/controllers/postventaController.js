// ============================================================
// controllers/postventaController.js — Controlador de Postventa y Calidad
// ============================================================
const { pool } = require('../db');
const {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  resolverOrden,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  esDisenoAprobado,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');

function inferirCategoria(pv) {
  if (pv.categoria) return pv.categoria;
  if (pv.tipo === 'Garantía') return 'Garantía';
  if (pv.tipo === 'Satisfacción' || (pv.tipo === 'Comentario' && pv.nivel_conformidad && !pv.solucion)) {
    return 'Satisfacción';
  }
  return 'PQRSF';
}

function formatearCasoPostventa(pv) {
  const ordenCodigo = pv.orden_codigo || (pv.orden_id ? `OP-2026-${String(pv.orden_id).padStart(4, '0')}` : '—');
  const categoria = inferirCategoria(pv);
  const subtipo = pv.subtipo || (categoria === 'Garantía' ? 'Garantía' : categoria === 'Satisfacción' ? 'Satisfacción' : pv.tipo);
  const fechaBase = pv.fecha_texto || formatearFechaHoy(new Date(pv.created_at));
  const historialInicial = [
    {
      fecha: fechaBase,
      hora: '09:00',
      autor: pv.cliente_empresa || pv.ejecutiva_nombre || 'Sistema ORVEX',
      estado: 'Abierto',
      accion: `Registro inicial (${categoria} — ${subtipo})`,
      detalle: pv.motivo || pv.descripcion || '',
    },
  ];
  return {
    id: pv.radicado || pv.codigo || pv.id,
    uuid: pv.id,
    codigo: pv.codigo,
    radicado: pv.radicado,
    canal: pv.canal || 'Directo',
    ordenId: ordenCodigo,
    orden_id: pv.orden_id,
    producto: pv.producto || '—',
    cliente: pv.cliente_empresa || pv.email_contacto || pv.telefono_contacto || 'Cliente',
    cliente_empresa: pv.cliente_empresa,
    ejecutiva_nombre: pv.ejecutiva_nombre,
    categoria,
    subtipo,
    tipo: pv.tipo,
    motivo: pv.motivo || (categoria === 'Garantía' ? 'Incumplimiento de las especificaciones acordadas' : subtipo),
    prioridad: pv.prioridad || 'Media',
    fecha: fechaBase,
    descripcion: pv.descripcion || '',
    radicado: pv.radicado || pv.codigo,
    canal: pv.canal || 'Portal Web',
    email_contacto: pv.email_contacto || '',
    telefono_contacto: pv.telefono_contacto || '',
    archivado: Boolean(pv.archivado),
    responsable: pv.responsable_nombre !== null && pv.responsable_nombre !== undefined ? pv.responsable_nombre : '',
    estado: pv.estado || 'Abierto',
    dictamenGarantia: pv.dictamen_garantia || (categoria === 'Garantía' ? 'Pendiente de evaluación' : ''),
    justificacionDictamen: pv.justificacion_dictamen || '',
    accionCorrectiva: pv.accion_correctiva || '',
    seguimiento: pv.seguimiento || '',
    respuestaCliente: pv.respuesta_cliente || pv.solucion || '',
    solucion: pv.solucion || '',
    fechaSolucion: pv.fecha_solucion || null,
    resueltoPor: pv.resuelto_por || null,
    evidencias: Array.isArray(pv.evidencias) ? pv.evidencias : [],
    historial: Array.isArray(pv.historial) && pv.historial.length > 0 ? pv.historial : historialInicial,
    aspectosEvaluados: Array.isArray(pv.aspectos_evaluados) ? pv.aspectos_evaluados : [],
    calificacion: pv.nivel_conformidad !== null && pv.nivel_conformidad !== undefined ? Number(pv.nivel_conformidad) : null,
    nivel_conformidad: pv.nivel_conformidad !== null && pv.nivel_conformidad !== undefined ? Number(pv.nivel_conformidad) : null,
    solicitudReimpresion: Boolean(pv.solicitud_reimpresion),
    reimpresionAutorizada: Boolean(pv.reimpresion_autorizada),
    reimpresionOrdenId: pv.reimpresion_orden_id || null,
    created_at: pv.created_at,
  };
}

async function resolverCaso(dbOrClient, idOrCodigo) {
  if (!idOrCodigo) return null;
  const str = String(idOrCodigo).trim();
  if (esUuid(str)) {
    const res = await dbOrClient.query('SELECT * FROM postventa WHERE id = $1', [str]);
    if (res.rowCount > 0) return res.rows[0];
  }
  const res = await dbOrClient.query(
    'SELECT * FROM postventa WHERE codigo = $1 OR radicado = $1',
    [str]
  );
  return res.rowCount > 0 ? res.rows[0] : null;
}

// Listar registros de postventa
const listarPostventa = async (req, res) => {
  const { orden_id, tipo } = req.query;

  try {
    let queryText = `
      SELECT
        pv.*,
        o.codigo AS orden_codigo,
        o.producto,
        c.empresa AS cliente_empresa,
        u.nombre_completo AS ejecutiva_nombre
      FROM postventa pv
      LEFT JOIN ordenes o ON pv.orden_id = o.id
      LEFT JOIN clientes c ON o.cliente_id = c.id
      LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (orden_id) {
      const ord = await resolverOrden(pool, orden_id);
      if (ord) {
        params.push(ord.id);
        queryText += ` AND pv.orden_id = $${params.length}`;
      }
    }
    if (tipo) {
      params.push(tipo);
      queryText += ` AND pv.tipo = $${params.length}`;
    }

    const incluirArchivados = req.query.incluir_archivados === 'true' || req.query.archivados === 'true';
    if (!incluirArchivados) {
      queryText += ' AND COALESCE(pv.archivado, false) = false';
    }

    queryText += ' ORDER BY pv.created_at DESC, COALESCE(pv.codigo, pv.id::text) ASC';

    const result = await pool.query(queryText, params);
    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearCasoPostventa),
    });
  } catch (error) {
    console.error('postventaController.listarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al consultar postventa.' });
  }
};

// Crear evaluación, reclamo, garantía o acta de postventa
const crearPostventa = async (req, res) => {
  const targetOrden = req.body.orden_id || req.body.ordenId;
  const {
    ejecutiva_id,
    tipo,
    categoria,
    subtipo,
    motivo,
    nivel_conformidad,
    calificacion,
    descripcion,
    prioridad,
    responsable,
    dictamenGarantia,
    justificacionDictamen,
    accionCorrectiva,
    evidencias,
    aspectosEvaluados,
  } = req.body;

  const tipoSolicitado = tipo || subtipo || (categoria === 'Garantía' ? 'Garantía' : categoria === 'Satisfacción' ? 'Satisfacción' : null);

  if (!targetOrden || !tipoSolicitado) {
    return res.status(400).json({
      error: 'Campos obligatorios: orden_id/ordenId y tipo/categoria.',
    });
  }

  const tiposPermitidos = [
    'Ajuste',
    'Garantía',
    'Reclamo',
    'Comentario',
    'Reimpresión',
    'Petición',
    'Queja',
    'Sugerencia',
    'Felicitación',
    'Satisfacción',
  ];
  if (!tiposPermitidos.includes(tipoSolicitado)) {
    return res.status(400).json({
      error: `Tipo de postventa no válido. Opciones: ${tiposPermitidos.join(', ')}`,
    });
  }

  const categoriaFinal =
    categoria ||
    (tipoSolicitado === 'Garantía'
      ? 'Garantía'
      : tipoSolicitado === 'Satisfacción'
      ? 'Satisfacción'
      : 'PQRSF');
  const subtipoFinal = subtipo || tipoSolicitado;

  const valorCalif = nivel_conformidad !== undefined ? nivel_conformidad : calificacion;
  let califInt = null;
  if (valorCalif !== undefined && valorCalif !== null && valorCalif !== '') {
    califInt = parseInt(valorCalif, 10);
    if (isNaN(califInt) || califInt < 1 || califInt > 5) {
      return res.status(400).json({ error: 'El nivel de conformidad debe ser un número entero entre 1 y 5.' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, targetOrden);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${targetOrden} no encontrada.` });
    }

    let ejec = null;
    if (ejecutiva_id) {
      ejec = await resolverUsuario(client, ejecutiva_id);
    }
    if (!ejec) {
      ejec = await resolverUsuario(client, orden.ejecutiva_id);
    }
    if (!ejec) {
      ejec = await obtenerUsuarioPorDefecto(client, 'ejecutiva');
    }

    let descripcionFinal = descripcion ? descripcion.trim() : '';
    let archivoInfo = null;
    const evidenciasList = Array.isArray(evidencias) ? [...evidencias] : [];
    if (req.file) {
      const rutaRelativa = `uploads/${req.file.filename}`;
      archivoInfo = {
        nombre_original: req.file.originalname,
        archivo: rutaRelativa,
        url: `/${rutaRelativa}`,
      };
      evidenciasList.push({
        id: `EV-${Date.now()}`,
        nombre: req.file.originalname,
        tipo: req.file.mimetype || 'application/octet-stream',
        url: `/${rutaRelativa}`,
        fecha: formatearFechaHoy(),
      });
      descripcionFinal = descripcionFinal
        ? `${descripcionFinal} [Adjunto: ${rutaRelativa}]`
        : `[Adjunto: ${rutaRelativa}]`;
    }

    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM postventa');
    const nuevoNum = countRes.rows[0].total + 1;
    const prefijo = categoriaFinal === 'Garantía' ? 'GAR' : categoriaFinal === 'Satisfacción' ? 'SAT' : 'CAS';
    const codigo = req.body.id || req.body.codigo || `${prefijo}-${String(nuevoNum).padStart(3, '0')}`;
    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();
    const autorNombre = req.usuario?.nombre_completo || ejec.nombre_completo;
    const estadoInicial = categoriaFinal === 'Satisfacción' ? 'Cerrado' : (req.body.estado || 'Abierto');

    const historialInicial = Array.isArray(req.body.historial) && req.body.historial.length > 0
      ? req.body.historial
      : [
          {
            fecha: fechaHoy,
            hora: horaAhora,
            autor: autorNombre,
            estado: estadoInicial,
            accion:
              categoriaFinal === 'Satisfacción'
                ? `Calificación de satisfacción registrada (${califInt || 5}/5)`
                : categoriaFinal === 'Garantía'
                ? `Solicitud de garantía radicada — Motivo: ${motivo || 'Revisión técnica'}`
                : `PQRSF radicada (${subtipoFinal})`,
            detalle: descripcionFinal || motivo || '',
          },
        ];

    const aspectosList = Array.isArray(aspectosEvaluados) ? aspectosEvaluados : [];

    const insertRes = await client.query(
      `INSERT INTO postventa (
        codigo, orden_id, ejecutiva_id, tipo, categoria, subtipo, motivo,
        nivel_conformidad, descripcion, fecha_texto, responsable_nombre,
        estado, prioridad, solucion, dictamen_garantia, justificacion_dictamen,
        accion_correctiva, evidencias, historial, aspectos_evaluados
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, '', $14, $15,
        $16, $17::jsonb, $18::jsonb, $19::jsonb
      )
      RETURNING *`,
      [
        codigo,
        orden.id,
        ejec.id,
        tipoSolicitado,
        categoriaFinal,
        subtipoFinal,
        motivo || subtipoFinal,
        califInt,
        descripcionFinal || null,
        fechaHoy,
        responsable || (categoriaFinal === 'Satisfacción' ? 'Sofía Herrera' : ''),
        estadoInicial,
        prioridad || 'Media',
        dictamenGarantia || (categoriaFinal === 'Garantía' ? 'Pendiente de evaluación' : ''),
        justificacionDictamen || '',
        accionCorrectiva || '',
        JSON.stringify(evidenciasList),
        JSON.stringify(historialInicial),
        JSON.stringify(aspectosList),
      ]
    );

    const autorId = (req.usuario?.id && req.usuario.rol !== 'cliente') ? req.usuario.id : ejec.id;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno, motivo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)`,
      [
        orden.id,
        autorId,
        `Postventa ${codigo} (${categoriaFinal} - ${subtipoFinal}): ${descripcionFinal || motivo || 'Registrado'}`,
        fechaHoy,
        horaAhora,
        autorNombre,
        estadoInicial === 'Cerrado' ? 'Completado' : 'Pendiente',
        `Clasificación: ${categoriaFinal} / ${subtipoFinal}`,
      ]
    );

    await client.query('COMMIT');

    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [insertRes.rows[0].id]
    );
    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.status(201).json({
      message: 'Registro de postventa creado exitosamente.',
      data: formatearCasoPostventa(fullRes.rows[0]),
      orden: ordenCompleta,
      adjunto: archivoInfo,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('postventaController.crearPostventa error:', error.message);
    res.status(500).json({ error: 'Error al registrar postventa.' });
  } finally {
    client.release();
  }
};

// Actualizar caso de postventa (asignar responsable, evaluar garantía, seguimiento, resolver o cerrar caso, calificar)
const actualizarPostventa = async (req, res) => {
  const {
    estado,
    responsable,
    prioridad,
    solucion,
    respuestaCliente,
    seguimiento,
    dictamenGarantia,
    justificacionDictamen,
    accionCorrectiva,
    evidencias,
    historial,
    notaHistorial,
    fechaSolucion,
    resueltoPor,
    calificacion,
    nivel_conformidad,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const actual = await resolverCaso(client, req.params.id);
    if (!actual) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    const nuevoEstado = estado || (solucion && actual.estado === 'Abierto' ? 'Resuelto' : actual.estado);
    const nuevoResp = responsable !== undefined ? responsable : actual.responsable_nombre;
    const nuevaPrio = prioridad !== undefined ? prioridad : (actual.prioridad || 'Media');
    const nuevaSol = solucion !== undefined ? solucion : actual.solucion;
    const nuevaRespCli = respuestaCliente !== undefined ? respuestaCliente : (actual.respuesta_cliente || nuevaSol || '');
    const nuevoSeg = seguimiento !== undefined ? seguimiento : (actual.seguimiento || '');
    const nuevoDictamen = dictamenGarantia !== undefined ? dictamenGarantia : (actual.dictamen_garantia || '');
    const nuevaJustificacion = justificacionDictamen !== undefined ? justificacionDictamen : (actual.justificacion_dictamen || '');
    const nuevaAccion = accionCorrectiva !== undefined ? accionCorrectiva : (actual.accion_correctiva || '');
    const nuevasEvidencias = Array.isArray(evidencias)
      ? evidencias
      : (Array.isArray(actual.evidencias) ? actual.evidencias : []);

    const esCierreOResolucion = nuevoEstado === 'Resuelto' || nuevoEstado === 'Cerrado';
    const nuevaFechaSol =
      fechaSolucion ||
      (esCierreOResolucion && !actual.fecha_solucion ? formatearFechaHoy() : actual.fecha_solucion);
    const nuevoResueltoPor =
      resueltoPor ||
      (esCierreOResolucion ? (req.usuario?.nombre_completo || 'Sofía Herrera') : actual.resuelto_por);

    const rawCalif = calificacion !== undefined ? calificacion : nivel_conformidad;
    const nuevaCalif = rawCalif !== undefined && rawCalif !== null ? parseInt(rawCalif, 10) : actual.nivel_conformidad;

    let historialActualizado = Array.isArray(historial)
      ? historial
      : (Array.isArray(actual.historial) ? [...actual.historial] : []);

    if (!Array.isArray(historial)) {
      const autorEvento = req.usuario?.nombre_completo || nuevoResueltoPor || 'Equipo Postventa';
      const detallesCambio = [];
      if (estado && estado !== actual.estado) detallesCambio.push(`Estado: ${actual.estado} → ${nuevoEstado}`);
      if (responsable !== undefined && responsable !== actual.responsable_nombre) detallesCambio.push(`Responsable: ${nuevoResp || 'Sin asignar'}`);
      if (dictamenGarantia && dictamenGarantia !== actual.dictamen_garantia) detallesCambio.push(`Dictamen garantía: ${nuevoDictamen}`);
      if (accionCorrectiva && accionCorrectiva !== actual.accion_correctiva) detallesCambio.push(`Acción: ${nuevaAccion}`);
      if (solucion && solucion !== actual.solucion) detallesCambio.push(`Solución: ${nuevaSol}`);
      if (notaHistorial) detallesCambio.push(notaHistorial);

      if (detallesCambio.length > 0) {
        historialActualizado.push({
          fecha: formatearFechaHoy(),
          hora: formatearHoraAhora(),
          autor: autorEvento,
          estado: nuevoEstado,
          accion: detallesCambio[0],
          detalle: detallesCambio.join(' | '),
        });
      }
    }

    await client.query(
      `UPDATE postventa
       SET estado = $1,
           responsable_nombre = $2,
           solucion = $3,
           fecha_solucion = $4,
           resuelto_por = $5,
           nivel_conformidad = $6,
           prioridad = $7,
           respuesta_cliente = $8,
           seguimiento = $9,
           dictamen_garantia = $10,
           justificacion_dictamen = $11,
           accion_correctiva = $12,
           evidencias = $13::jsonb,
           historial = $14::jsonb
       WHERE id = $15`,
      [
        nuevoEstado,
        nuevoResp,
        nuevaSol,
        nuevaFechaSol,
        nuevoResueltoPor,
        nuevaCalif,
        nuevaPrio,
        nuevaRespCli,
        nuevoSeg,
        nuevoDictamen,
        nuevaJustificacion,
        nuevaAccion,
        JSON.stringify(nuevasEvidencias),
        JSON.stringify(historialActualizado),
        actual.id,
      ]
    );

    if (estado && estado !== actual.estado) {
      const autorUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
        ? (await resolverUsuario(client, req.usuario.id))
        : (await resolverUsuario(client, actual.ejecutiva_id));
      const autorNombre = req.usuario?.nombre_completo || autorUser.nombre_completo;
      const codigoCaso = actual.codigo || actual.id;

      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
          estado_anterior, nuevo_estado, motivo
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10)`,
        [
          actual.orden_id,
          autorUser.id,
          `Caso postventa ${codigoCaso}: ${nuevoEstado}${nuevaSol ? ` - Solución: ${nuevaSol}` : ''}`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          autorNombre,
          nuevoEstado === 'Resuelto' ? 'Completado' : 'Pendiente',
          actual.estado,
          nuevoEstado,
          nuevaSol || null,
        ]
      );
    }

    await client.query('COMMIT');

    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [actual.id]
    );
    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [actual.orden_id]);

    res.json({
      message: 'Caso de postventa actualizado exitosamente.',
      data: formatearCasoPostventa(fullRes.rows[0]),
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('postventaController.actualizarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al actualizar caso de postventa.' });
  } finally {
    client.release();
  }
};

// 4. Solicitar reimpresión por garantía (exclusivo Postventa y Coordinación)
const solicitarReimpresion = async (req, res) => {
  const { motivo } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const caso = await resolverCaso(client, req.params.id);
    if (!caso) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    // Bloqueo pesimista del caso para prevenir condiciones de carrera y dobles autorizaciones
    await client.query('SELECT id FROM postventa WHERE id = $1 FOR UPDATE', [caso.id]);

    if (caso.tipo !== 'Garantía') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Solo los casos de tipo "Garantía" pueden solicitar reimpresión de producto.',
      });
    }

    if (caso.reimpresion_autorizada || caso.reimpresion_orden_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Este caso ya cuenta con una reimpresión autorizada previamente.',
      });
    }

    const accionCorr = motivo ? `Solicitud de reimpresión: ${motivo}` : 'Solicitud de reimpresión por garantía';
    await client.query(
      `UPDATE postventa
       SET solicitud_reimpresion = true,
           accion_correctiva = $1,
           dictamen_garantia = 'Evaluación de garantía: Solicitud de reimpresión enviada a Coordinación'
       WHERE id = $2`,
      [accionCorr, caso.id]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, caso.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false)`,
      [
        caso.orden_id,
        respUser.id,
        `Solicitud de reimpresión radicada por Postventa para el caso ${caso.codigo || caso.id}. Pendiente de autorización técnica por Coordinación.`,
        formatearFechaHoy(),
        formatearHoraAhora(),
        respNombre,
      ]
    );

    await client.query('COMMIT');

    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [caso.id]
    );

    res.json({
      message: `Solicitud de reimpresión para el caso ${caso.codigo || caso.id} registrada exitosamente. Pendiente de evaluación y autorización por Coordinación.`,
      data: formatearCasoPostventa(fullRes.rows[0]),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('postventaController.solicitarReimpresion error:', error.message);
    res.status(500).json({ error: 'Error al solicitar reimpresión.' });
  } finally {
    client.release();
  }
};

// 5. Autorizar reimpresión técnica y generar nueva OP a costo cero (exclusivo Coordinación)
const autorizarReimpresion = async (req, res) => {
  const { motivo } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const caso = await resolverCaso(client, req.params.id);
    if (!caso) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    // Bloqueo pesimista del caso para prevenir condiciones de carrera y dobles autorizaciones
    await client.query('SELECT id FROM postventa WHERE id = $1 FOR UPDATE', [caso.id]);

    if (caso.tipo !== 'Garantía') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Solo los casos de tipo "Garantía" pueden generar órdenes de reimpresión.',
      });
    }

    // Prevención estricta de duplicidad mediante el índice único idx_orden_postventa_unica
    const ordExistenteRes = await client.query(
      'SELECT id, codigo FROM ordenes WHERE postventa_caso_origen_id = $1',
      [caso.id]
    );
    if (ordExistenteRes.rowCount > 0 || caso.reimpresion_orden_id) {
      await client.query('ROLLBACK');
      const codOrdExistente = ordExistenteRes.rows[0]?.codigo || `OP-#${caso.reimpresion_orden_id}`;
      return res.status(409).json({
        error: `Ya existe una orden de reimpresión autorizada y generada para este caso (${codOrdExistente}). No se permiten órdenes duplicadas.`,
      });
    }

    // Cargar la orden original
    const origRes = await client.query('SELECT * FROM ordenes WHERE id = $1', [caso.orden_id]);
    if (origRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden original #${caso.orden_id} no encontrada.` });
    }
    const original = origRes.rows[0];

    // Verificar si la orden original contaba con aprobación documental formal de diseño (RF-07)
    const arteAprobadoRes = await client.query(
      `SELECT a.*, COALESCE(u.nombre_completo, a.disenador_nombre) AS aprobador_nombre
       FROM archivos_arte a
       LEFT JOIN usuarios u ON a.decision_por = u.id
       WHERE a.orden_id = $1 AND (a.estado_aprobacion = 'aprobado' OR a.estado_ui = 'Aprobada' OR a.estado_ui = 'Aprobada (Externa)' OR a.estado_ui = 'Aprobado por el cliente')
       ORDER BY a.numero_version DESC
       LIMIT 1`,
      [original.id]
    );

    const tieneAprobacionValida =
      esDisenoAprobado(original.diseno_estado) && arteAprobadoRes.rowCount > 0;
    const arteAprobado = arteAprobadoRes.rows[0] || null;

    const etapaInicial = tieneAprobacionValida ? 4 : 1;
    const estadoNombreInicial = tieneAprobacionValida ? 'Impresión' : 'Diseño';
    const disenoEstadoInicial = tieneAprobacionValida ? 'Aprobado por el cliente' : 'Pendiente';
    const avanceInicial = tieneAprobacionValida ? 50.00 : 15.00;

    const entregaCalc = new Date();
    entregaCalc.setDate(entregaCalc.getDate() + 3);
    const fechaSol = formatearFechaHoy();
    const fechaEnt = formatearFechaHoy(entregaCalc);

    const entregaBase = (original.entrega_json && typeof original.entrega_json === 'object')
      ? { ...original.entrega_json, fechaReal: null, conformidad: null, evidencia: null }
      : {};

    const origCodigo = original.codigo || `OP-2026-${String(original.id).padStart(4, '0')}`;

    // Creación de la nueva OP a COSTO CERO para el cliente por garantía
    const insOrd = await client.query(
      `INSERT INTO ordenes (
        cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
        etapa, prioridad, porcentaje_avance, bloqueado,
        solicitud_codigo, cantidad, material, dimensiones, colores, acabados,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        responsable_nombre, disenador_nombre_asignado, presupuesto, costo_interno,
        metodo_entrega, requerimientos, observaciones, entrega_json,
        es_reimpresion, orden_original_codigo, postventa_caso_origen_id
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,'Alta',$7,false,
        $8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,
        $18,$19,0.00,$20,
        $21,$22,$23,$24,
        true,$25,$26
      ) RETURNING *`,
      [
        original.cliente_id,
        original.producto,
        original.ejecutiva_id,
        original.disenador_id,
        original.produccion_id,
        etapaInicial,
        avanceInicial,
        original.solicitud_codigo,
        original.cantidad,
        original.material,
        original.dimensiones,
        original.colores,
        original.acabados,
        fechaSol,
        fechaEnt,
        estadoNombreInicial,
        disenoEstadoInicial,
        original.responsable_nombre || 'María López',
        original.disenador_nombre_asignado || 'María López',
        original.costo_interno || 0,
        original.metodo_entrega,
        original.requerimientos,
        `Reimpresión autorizada por garantía del caso ${caso.codigo || caso.id}. ${motivo || ''}`.trim(),
        JSON.stringify(entregaBase),
        origCodigo,
        caso.id,
      ]
    );

    const nuevaRow = insOrd.rows[0];
    const nuevoCodigo = `OP-2026-${String(nuevaRow.id).padStart(4, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [nuevoCodigo, nuevaRow.id]);

    // Reutilizar arte aprobado conservando trazabilidad formal si cumplía RF-07
    if (tieneAprobacionValida && arteAprobado) {
      await client.query(
        `INSERT INTO archivos_arte (
          orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion,
          decision_por, comentario, fecha_texto, disenador_nombre, estado_ui,
          archivo_nombre, tipo_aprobacion, soporte_evidencia, soporte_tipo, soporte_validado
        ) VALUES ($1, 1, $2, $3, 'aprobado', $4, $5, $6, $7, 'Aprobada', $8, $9, $10, $11, true)`,
        [
          nuevaRow.id,
          arteAprobado.ruta_archivo || `uploads/Arte_Final_${nuevoCodigo}_v1.pdf`,
          arteAprobado.creador_id || original.disenador_id || original.ejecutiva_id,
          req.usuario.id,
          `Arte aprobado reutilizado de orden original ${origCodigo} (v${arteAprobado.numero_version}). Reimpresión autorizada por garantía.`,
          fechaSol,
          arteAprobado.disenador_nombre || 'María López',
          arteAprobado.archivo_nombre || `Arte_Final_${nuevoCodigo}_v1.pdf`,
          arteAprobado.tipo_aprobacion || 'digital',
          arteAprobado.soporte_evidencia || 'Aprobación original verificada',
          arteAprobado.soporte_tipo || 'garantia_reutilizacion',
        ]
      );
    }

    const respUser = await resolverUsuario(client, req.usuario.id);
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    // Actualizar caso de postventa con la vinculación formal de la orden generada en estado intermedio 'En reposición'
    await client.query(
      `UPDATE postventa
       SET solicitud_reimpresion = true,
           reimpresion_autorizada = true,
           reimpresion_autorizada_por = $1,
           reimpresion_fecha = CURRENT_TIMESTAMP,
           reimpresion_orden_id = $2,
           estado = 'En reposición',
           dictamen_garantia = 'Garantía aceptada — Reimpresión en proceso de producción (' || $3 || ')',
           accion_correctiva = 'Reimpresión autorizada a costo cero',
           solucion = $4
       WHERE id = $5`,
      [
        req.usuario.id,
        nuevaRow.id,
        nuevoCodigo,
        `Garantía aceptada. Se autorizó y generó la nueva orden de reimpresión ${nuevoCodigo} a costo cero. Caso en reposición hasta entrega formal.`,
        caso.id,
      ]
    );

    // Auditoría inmutable en ambas órdenes
    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES
        ($1, $2, $3, $4, $5, $6, 'Completado', false),
        ($7, $2, $8, $4, $5, $6, 'Completado', false)`,
      [
        original.id,
        req.usuario.id,
        `Reimpresión autorizada por garantía: se generó la nueva OP ${nuevoCodigo} para el caso ${caso.codigo || caso.id} (estado: En reposición).`,
        fechaSol,
        formatearHoraAhora(),
        respNombre,
        nuevaRow.id,
        `Orden de reimpresión ${nuevoCodigo} creada a costo cero ($0 COP) por garantía autorizada a partir de ${origCodigo}.`,
      ]
    );

    await client.query('COMMIT');

    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [caso.id]
    );

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [nuevaRow.id], req.usuario?.rol);

    res.status(201).json({
      message: `Reimpresión autorizada exitosamente. Se generó la orden ${nuevoCodigo} a costo cero vinculada al caso ${caso.codigo || caso.id} (en reposición).`,
      data: formatearCasoPostventa(fullRes.rows[0]),
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('postventaController.autorizarReimpresion error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Ya existe una orden de reimpresión autorizada y generada para este caso de garantía (restricción de unicidad). No se permiten órdenes duplicadas.',
      });
    }
    res.status(500).json({ error: 'Error al autorizar reimpresión.' });
  } finally {
    client.release();
  }
};

// Archivar caso de postventa
const archivarPostventa = async (req, res) => {
  try {
    const caso = await resolverCaso(pool, req.params.id);
    if (!caso) {
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    await pool.query('UPDATE postventa SET archivado = true WHERE id = $1', [caso.id]);
    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [caso.id]
    );

    res.json({
      message: 'Caso de postventa archivado exitosamente.',
      data: formatearCasoPostventa(fullRes.rows[0]),
    });
  } catch (error) {
    console.error('postventaController.archivarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al archivar el caso de postventa.' });
  }
};

// Restaurar caso de postventa
const restaurarPostventa = async (req, res) => {
  try {
    const caso = await resolverCaso(pool, req.params.id);
    if (!caso) {
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    await pool.query('UPDATE postventa SET archivado = false WHERE id = $1', [caso.id]);
    const fullRes = await pool.query(
      `SELECT pv.*, o.codigo AS orden_codigo, o.producto, c.empresa AS cliente_empresa, u.nombre_completo AS ejecutiva_nombre
       FROM postventa pv
       LEFT JOIN ordenes o ON pv.orden_id = o.id
       LEFT JOIN clientes c ON o.cliente_id = c.id
       LEFT JOIN usuarios u ON pv.ejecutiva_id = u.id
       WHERE pv.id = $1`,
      [caso.id]
    );

    res.json({
      message: 'Caso de postventa restaurado exitosamente.',
      data: formatearCasoPostventa(fullRes.rows[0]),
    });
  } catch (error) {
    console.error('postventaController.restaurarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al restaurar el caso de postventa.' });
  }
};

// Eliminar caso seguro (solo si fue registrado por error y sin reimpresión autorizada)
const eliminarPostventa = async (req, res) => {
  try {
    const caso = await resolverCaso(pool, req.params.id);
    if (!caso) {
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    if (caso.reimpresion_autorizada || caso.reimpresion_orden_id) {
      return res.status(400).json({
        error: `No es posible eliminar el caso de garantía ${caso.codigo} porque ya tiene una reimpresión autorizada y generada en planta. Debe archivarse para mantener la trazabilidad.`,
      });
    }

    await pool.query('DELETE FROM postventa WHERE id = $1', [caso.id]);
    res.json({
      message: `Registro de postventa "${caso.codigo || caso.id}" eliminado permanentemente.`,
      id: caso.codigo || caso.id,
    });
  } catch (error) {
    console.error('postventaController.eliminarPostventa error:', error.message);
    res.status(500).json({ error: 'Error al eliminar el caso de postventa.' });
  }
};

module.exports = {
  listarPostventa,
  crearPostventa,
  actualizarPostventa,
  archivarPostventa,
  restaurarPostventa,
  eliminarPostventa,
  solicitarReimpresion,
  autorizarReimpresion,
};
