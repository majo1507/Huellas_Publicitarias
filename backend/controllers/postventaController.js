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
  const ordenCodigo = pv.orden_codigo || `OP-2026-${String(pv.orden_id).padStart(4, '0')}`;
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
    id: pv.codigo || pv.id,
    uuid: pv.id,
    codigo: pv.codigo,
    ordenId: ordenCodigo,
    orden_id: pv.orden_id,
    producto: pv.producto,
    cliente: pv.cliente_empresa,
    cliente_empresa: pv.cliente_empresa,
    ejecutiva_nombre: pv.ejecutiva_nombre,
    categoria,
    subtipo,
    tipo: pv.tipo,
    motivo: pv.motivo || (categoria === 'Garantía' ? 'Incumplimiento de las especificaciones acordadas' : subtipo),
    prioridad: pv.prioridad || 'Media',
    fecha: fechaBase,
    descripcion: pv.descripcion || '',
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
  const res = await dbOrClient.query('SELECT * FROM postventa WHERE codigo = $1', [str]);
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
      INNER JOIN ordenes o ON pv.orden_id = o.id
      INNER JOIN clientes c ON o.cliente_id = c.id
      INNER JOIN usuarios u ON pv.ejecutiva_id = u.id
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
       INNER JOIN ordenes o ON pv.orden_id = o.id
       INNER JOIN clientes c ON o.cliente_id = c.id
       INNER JOIN usuarios u ON pv.ejecutiva_id = u.id
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
       INNER JOIN ordenes o ON pv.orden_id = o.id
       INNER JOIN clientes c ON o.cliente_id = c.id
       INNER JOIN usuarios u ON pv.ejecutiva_id = u.id
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

module.exports = {
  listarPostventa,
  crearPostventa,
  actualizarPostventa,
};
