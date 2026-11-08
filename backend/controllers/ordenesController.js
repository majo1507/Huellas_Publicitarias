// ============================================================
// controllers/ordenesController.js — Controlador de Órdenes
// ============================================================
const { pool } = require('../db');
const {
  formatearFechaHoy,
  formatearHoraAhora,
  ETAPA_NUM_TO_NOMBRE_UI,
  ESTADO_UI_TO_ETAPA_NUM,
  resolverOrden,
  resolverCliente,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
} = require('../utils/resolvers');
const { validarArchivoEvidencia } = require('../utils/validacionesArchivo');

const FLUJO_ETAPAS_UI = [
  'Solicitud',
  'Diseño',
  'Aprobación',
  'Impresión',
  'Acabados',
  'Despacho',
  'Entrega',
  'Postventa',
];

function formatearVersionArte(a) {
  const estadoMap = {
    borrador: 'En proceso',
    pendiente: 'Enviada',
    aprobado: 'Aprobada',
    rechazado: 'Rechazada',
  };
  return {
    id: a.id,
    numero: a.numero_version,
    fecha: a.fecha_texto || formatearFechaHoy(new Date(a.created_at)),
    disenador: a.disenador_nombre || a.creador_nombre || 'María López',
    estado: a.estado_ui || estadoMap[a.estado_aprobacion] || 'En proceso',
    estado_aprobacion: a.estado_aprobacion,
    comentario: a.comentario || '',
    archivoNombre: a.archivo_nombre || (a.ruta_archivo ? a.ruta_archivo.split('/').pop() : null),
    ruta_archivo: a.ruta_archivo,
  };
}

function formatearEventoHistorial(r) {
  const dt = r.created_at ? new Date(r.created_at) : new Date();
  return {
    id: r.id,
    fecha: r.fecha_texto || formatearFechaHoy(dt),
    hora: r.hora_texto || formatearHoraAhora(dt),
    actividad: r.accion_texto,
    accion_texto: r.accion_texto,
    responsable: r.responsable_nombre || 'Coordinación',
    estado: r.estado_evento || 'Completado',
    interno: Boolean(r.interno),
    estadoAnterior: r.estado_anterior || null,
    nuevoEstado: r.nuevo_estado || null,
    motivo: r.motivo || null,
    created_at: r.created_at,
  };
}

function construirOrdenCompleta(o, versionesRows = [], historialRows = [], rolUsuario = null) {
  const codigo = o.codigo || `OP-2026-${String(o.id).padStart(4, '0')}`;
  const estadoUi = o.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[o.etapa] || 'Diseño';
  const versiones = versionesRows.map(formatearVersionArte);
  const ultimaVer = versiones[versiones.length - 1];

  let disenoEstado = o.diseno_estado;
  if (!disenoEstado) {
    if (!ultimaVer) disenoEstado = 'Pendiente';
    else if (ultimaVer.estado === 'Aprobada') disenoEstado = 'Aprobado';
    else if (ultimaVer.estado === 'Enviada') disenoEstado = 'Enviado';
    else if (ultimaVer.estado === 'Rechazada') disenoEstado = 'Requiere cambios';
    else disenoEstado = 'En proceso';
  }

  const direccionDefault = o.cliente_direccion
    ? `${o.cliente_direccion}, ${o.cliente_ciudad || 'Bogotá'}`
    : 'Cra 15 # 80-20, Bogotá';

  const entregaBase = {
    direccion: direccionDefault,
    metodo: o.metodo_entrega || 'Domicilio',
    contacto: o.cliente_contacto || o.cliente_empresa || 'Cliente',
  };

  const entrega =
    o.entrega_json && typeof o.entrega_json === 'object' && Object.keys(o.entrega_json).length > 0
      ? { ...entregaBase, ...o.entrega_json }
      : entregaBase;

  const presupuestoNum = Number(o.presupuesto || 0);
  const costoInternoNum = Number(o.costo_interno || Math.round(presupuestoNum * 0.6));
  // T-08: Exclusión estricta de costos internos sensibles para operarios de taller, clientes y diseñadores
  const rolNorm = rolUsuario ? String(rolUsuario).toLowerCase() : '';
  const sinAccesoFinanciero = ['produccion', 'operario', 'cliente', 'disenador', 'diseñador'].includes(rolNorm);

  return {
    // Campos esperados por el frontend ORVEX
    id: codigo,
    dbId: o.id,
    codigo,
    solicitudId: o.solicitud_codigo || `SOL-2026-${String(o.id).padStart(4, '0')}`,
    clienteId: o.cliente_codigo || o.cliente_id,
    cliente_id: o.cliente_id,
    cliente: o.cliente_empresa,
    cliente_empresa: o.cliente_empresa,
    producto: o.producto,
    cantidad: Number(o.cantidad || 1),
    material: o.material || 'Lona',
    dimensiones: o.dimensiones || 'Estándar',
    colores: o.colores || 'Por definir en pre-prensa',
    acabados: o.acabados || 'Corte y empaque estándar',
    fechaSolicitud: o.fecha_solicitud || formatearFechaHoy(new Date(o.created_at)),
    fechaEntrega: o.fecha_entrega || formatearFechaHoy(new Date(o.created_at)),
    estado: estadoUi,
    etapa: o.etapa,
    prioridad: o.prioridad,
    porcentaje_avance: Number(o.porcentaje_avance || 0),
    disenoEstado,
    responsable: o.responsable_nombre || o.produccion_nombre || o.disenador_nombre || 'María López',
    disenador: o.disenador_nombre_asignado || o.disenador_nombre || 'María López',
    ejecutiva_nombre: o.ejecutiva_nombre,
    disenador_nombre: o.disenador_nombre,
    produccion_nombre: o.produccion_nombre,
    presupuesto: presupuestoNum,
    costoInterno: sinAccesoFinanciero ? undefined : costoInternoNum,
    metodoEntrega: o.metodo_entrega || 'Domicilio',
    requerimientos: o.requerimientos || '',
    observaciones: o.observaciones || '',
    blocked: Boolean(o.bloqueado),
    bloqueado: Boolean(o.bloqueado),
    blockReason: o.motivo_bloqueo || '',
    entrega,
    versiones,
    historial: historialRows.map(formatearEventoHistorial),
    cerradoPor: o.cerrado_por || null,
    fechaCierre: o.fecha_cierre || null,
    motivoCierre: o.motivo_cierre || null,
    reabiertoPor: o.reabierto_por || null,
    fechaReapertura: o.fecha_reapertura || null,
    esReimpresion: Boolean(o.es_reimpresion),
    ordenOriginalId: o.orden_original_codigo || null,
    archivosReferencia: Array.isArray(o.archivos_referencia) ? o.archivos_referencia : [],
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

async function cargarOrdenesEnriquecidas(dbOrClient, filtroWhere = '', params = [], rolUsuario = null) {
  const queryText = `
    SELECT
      o.*,
      c.codigo AS cliente_codigo,
      c.empresa AS cliente_empresa,
      c.nit AS cliente_nit,
      c.contacto_principal AS cliente_contacto,
      c.direccion AS cliente_direccion,
      c.ciudad AS cliente_ciudad,
      u_ejec.nombre_completo AS ejecutiva_nombre,
      u_dis.nombre_completo AS disenador_nombre,
      u_prod.nombre_completo AS produccion_nombre
    FROM ordenes o
    INNER JOIN clientes c ON o.cliente_id = c.id
    INNER JOIN usuarios u_ejec ON o.ejecutiva_id = u_ejec.id
    LEFT JOIN usuarios u_dis ON o.disenador_id = u_dis.id
    LEFT JOIN usuarios u_prod ON o.produccion_id = u_prod.id
    WHERE 1=1 ${filtroWhere}
    ORDER BY o.id ASC
  `;
  const result = await dbOrClient.query(queryText, params);
  if (result.rowCount === 0) return [];

  const ordenIds = result.rows.map((r) => r.id);

  const [artesRes, histRes] = await Promise.all([
    dbOrClient.query(
      `SELECT a.*, u.nombre_completo AS creador_nombre
       FROM archivos_arte a
       LEFT JOIN usuarios u ON a.creador_id = u.id
       WHERE a.orden_id = ANY($1::int[])
       ORDER BY a.numero_version ASC`,
      [ordenIds]
    ),
    dbOrClient.query(
      `SELECT r.*, COALESCE(r.responsable_nombre, u.nombre_completo) AS responsable_nombre, u.rol AS responsable_rol
       FROM registro_sesion r
       LEFT JOIN usuarios u ON r.usuario_responsable_id = u.id
       WHERE r.orden_id = ANY($1::int[])
       ORDER BY r.created_at ASC, r.id ASC`,
      [ordenIds]
    ),
  ]);

  const artesByOrden = {};
  for (const a of artesRes.rows) {
    if (!artesByOrden[a.orden_id]) artesByOrden[a.orden_id] = [];
    artesByOrden[a.orden_id].push(a);
  }

  const histByOrden = {};
  for (const h of histRes.rows) {
    if (!histByOrden[h.orden_id]) histByOrden[h.orden_id] = [];
    histByOrden[h.orden_id].push(h);
  }

  return result.rows.map((o) =>
    construirOrdenCompleta(o, artesByOrden[o.id] || [], histByOrden[o.id] || [], rolUsuario)
  );
}

// Listar órdenes con filtros
const listarOrdenes = async (req, res) => {
  const { cliente_id, etapa, prioridad } = req.query;

  try {
    let where = '';
    const params = [];

    if (cliente_id) {
      const cli = await resolverCliente(pool, cliente_id);
      if (cli) {
        params.push(cli.id);
        where += ` AND o.cliente_id = $${params.length}`;
      }
    }
    if (etapa !== undefined) {
      params.push(parseInt(etapa, 10));
      where += ` AND o.etapa = $${params.length}`;
    }
    if (prioridad) {
      params.push(prioridad);
      where += ` AND o.prioridad = $${params.length}`;
    }

    const ordenes = await cargarOrdenesEnriquecidas(pool, where, params, req.usuario?.rol);
    res.json({
      total: ordenes.length,
      data: ordenes,
    });
  } catch (error) {
    console.error('ordenesController.listarOrdenes error:', error.message);
    res.status(500).json({ error: 'Error al listar las órdenes.' });
  }
};

// Detalle de una orden por ID o código
const obtenerOrdenPorId = async (req, res) => {
  try {
    const base = await resolverOrden(pool, req.params.id);
    if (!base) {
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [base.id], req.usuario?.rol);
    res.json({
      data: ordenCompleta,
      historial_sesion: ordenCompleta.historial,
    });
  } catch (error) {
    console.error('ordenesController.obtenerOrdenPorId error:', error.message);
    res.status(500).json({ error: 'Error al obtener la orden.' });
  }
};

// Obtener historial cronológico de una orden (HU-19)
const obtenerHistorialOrden = async (req, res) => {
  try {
    const base = await resolverOrden(pool, req.params.id);
    if (!base) {
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const histRes = await pool.query(
      `SELECT r.*, COALESCE(r.responsable_nombre, u.nombre_completo) AS responsable_nombre, u.rol AS responsable_rol
       FROM registro_sesion r
       LEFT JOIN usuarios u ON r.usuario_responsable_id = u.id
       WHERE r.orden_id = $1
       ORDER BY r.created_at ASC, r.id ASC`,
      [base.id]
    );

    res.json({
      orden_id: base.codigo || base.id,
      total: histRes.rowCount,
      data: histRes.rows.map(formatearEventoHistorial),
    });
  } catch (error) {
    console.error('ordenesController.obtenerHistorialOrden error:', error.message);
    res.status(500).json({ error: 'Error al obtener el historial de la orden.' });
  }
};

/**
 * 1. TRANSACCIÓN: Creación de orden + Registro de Auditoría Inmutable
 */
const crearOrden = async (req, res) => {
  const {
    cliente_id,
    clienteId,
    producto,
    ejecutiva_id,
    disenador_id,
    produccion_id,
    prioridad,
    cantidad,
    material,
    dimensiones,
    colores,
    acabados,
    fechaSolicitud,
    fechaEntrega,
    presupuesto,
    metodoEntrega,
    requerimientos,
    observaciones,
    solicitudId,
    solicitud_id,
  } = req.body;

  const targetSolId = solicitudId || solicitud_id;
  if (!targetSolId) {
    return res.status(400).json({
      error: 'FLUJO NO PERMITIDO: Toda orden de producción debe originarse a partir de una solicitud comercial previamente validada (RF-01, RF-03). Indique el identificador o código de la solicitud.',
    });
  }

  const targetCliente = cliente_id || clienteId;
  if (!targetCliente || !producto) {
    return res.status(400).json({
      error: 'Campos obligatorios: cliente_id/clienteId y producto.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solRes = await client.query(
      `SELECT * FROM solicitudes 
       WHERE id::text = $1 OR codigo = $1 
       FOR UPDATE`,
      [String(targetSolId).trim()]
    );
    if (solRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Solicitud comercial ${targetSolId} no encontrada.` });
    }
    const sol = solRes.rows[0];
    if (sol.orden_id || sol.estado === 'convertida') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La solicitud ${sol.codigo || sol.id} ya generó una orden de producción previamente (${sol.orden_id ? 'OP vinculada: ' + sol.orden_id : 'estado: convertida'}). No se permiten órdenes duplicadas.`,
      });
    }

    if (sol.estado === 'en_validacion' || sol.estado === 'cotizada') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `FLUJO NO PERMITIDO: La solicitud ${sol.codigo || sol.id} se encuentra "En validación" (pendiente de revisión técnica por Coordinación). No puede generar una orden hasta que sea formalmente validada y aprobada.`,
      });
    }

    if (sol.estado === 'pendiente') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `FLUJO NO PERMITIDO: La solicitud ${sol.codigo || sol.id} está en estado "Pendiente" (borrador comercial). Debe enviarse a validación técnica y ser aprobada por Coordinación antes de generar la orden.`,
      });
    }

    if (sol.estado === 'devuelta') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `FLUJO NO PERMITIDO: La solicitud ${sol.codigo || sol.id} fue devuelta para corrección técnica. No puede generar una orden de producción hasta ser subsanada y aprobada.`,
      });
    }

    if (sol.estado === 'rechazada') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `FLUJO NO PERMITIDO: La solicitud ${sol.codigo || sol.id} fue rechazada por inviabilidad. No puede generar una orden de producción.`,
      });
    }

    if (sol.estado !== 'aprobada') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `FLUJO NO PERMITIDO: La solicitud ${sol.codigo || sol.id} (estado: "${sol.estado}") no ha superado la validación formal de Coordinación. Solo solicitudes en estado "aprobada" pueden convertirse a Orden de Producción.`,
      });
    }

    const cliente = await resolverCliente(client, targetCliente);
    if (!cliente) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Cliente ${targetCliente} no encontrado.` });
    }

    let ejecutiva = null;
    if (ejecutiva_id) {
      ejecutiva = await resolverUsuario(client, ejecutiva_id);
    } else if (req.usuario?.rol === 'ejecutiva') {
      ejecutiva = await resolverUsuario(client, req.usuario.id);
    }
    if (!ejecutiva) {
      ejecutiva = await obtenerUsuarioPorDefecto(client, 'ejecutiva');
    }

    let disenador = null;
    if (disenador_id) {
      disenador = await resolverUsuario(client, disenador_id);
    } else {
      disenador = await obtenerUsuarioPorDefecto(client, 'disenador');
    }

    const produccion = produccion_id ? await resolverUsuario(client, produccion_id) : null;

    const estadoInicial = req.body.estado || 'Diseño';
    const etapaInicial = req.body.etapa !== undefined ? parseInt(req.body.etapa, 10) : (ESTADO_UI_TO_ETAPA_NUM[estadoInicial] ?? 1);
    const pctInicial = parseFloat(((etapaInicial / 8) * 100).toFixed(2));
    const presNum = Number(presupuesto || 0);
    const entregaJson = {
      direccion: cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || 'Bogotá'}` : 'Sede comercial, Bogotá',
      metodo: metodoEntrega || 'Domicilio',
      contacto: cliente.contacto_principal || cliente.empresa,
    };

    const insertRes = await client.query(
      `INSERT INTO ordenes (
        cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
        etapa, prioridad, porcentaje_avance,
        solicitud_codigo, cantidad, material, dimensiones, colores, acabados,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        responsable_nombre, disenador_nombre_asignado, presupuesto, costo_interno,
        metodo_entrega, requerimientos, observaciones, entrega_json
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,$12,$13,$14,
        $15,$16,$17,'Pendiente',
        $18,$19,$20,$21,
        $22,$23,$24,$25
      ) RETURNING *`,
      [
        cliente.id,
        producto.trim(),
        ejecutiva.id,
        disenador ? disenador.id : null,
        produccion ? produccion.id : null,
        etapaInicial,
        prioridad || 'Media',
        pctInicial,
        sol.codigo || (sol.id ? `SOL-${String(sol.id).replace(/-/g, '').substring(0, 20)}` : null),
        Number(cantidad || 1),
        material || 'Lona',
        dimensiones || 'Estándar',
        colores || 'Por definir en pre-prensa',
        acabados || 'Corte y empaque estándar',
        fechaSolicitud || formatearFechaHoy(),
        fechaEntrega || formatearFechaHoy(),
        estadoInicial,
        disenador ? disenador.nombre_completo : 'María López',
        disenador ? disenador.nombre_completo : 'María López',
        presNum,
        Math.round(presNum * 0.6),
        metodoEntrega || 'Domicilio',
        requerimientos || '',
        observaciones || '',
        JSON.stringify(entregaJson),
      ]
    );

    const nuevaRow = insertRes.rows[0];
    const codigo = req.body.codigo || `OP-2026-${String(nuevaRow.id).padStart(4, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [codigo, nuevaRow.id]);

    await client.query(
      `UPDATE solicitudes 
       SET estado = 'convertida', orden_id = $1 
       WHERE id = $2`,
      [nuevaRow.id, sol.id]
    );

    const autorNombre = req.usuario?.nombre_completo || ejecutiva.nombre_completo;
    const autorId = (req.usuario?.id && req.usuario.rol !== 'cliente') ? req.usuario.id : ejecutiva.id;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
      [
        nuevaRow.id,
        autorId,
        `Orden ${codigo} generada para el cliente "${cliente.empresa}" (${producto.trim()}).`,
        formatearFechaHoy(),
        formatearHoraAhora(),
        autorNombre,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [nuevaRow.id]);

    res.status(201).json({
      message: 'Orden de producción creada y auditada exitosamente.',
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.crearOrden error:', error.message);
    res.status(500).json({ error: 'Error al crear la orden.' });
  } finally {
    client.release();
  }
};

/**
 * 2. CANDADO DE APROBACIÓN DE DISEÑO + 3. PASO A PRODUCCIÓN Y DESCUENTO DE STOCK
 * PATCH /api/ordenes/:id/etapa
 */
const actualizarEtapa = async (req, res) => {
  const {
    etapa,
    estado,
    usuario_id,
    material_id,
    cantidad_insumo,
    observaciones,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    if (orden.bloqueado) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La orden está bloqueada y no puede cambiar de etapa.' });
    }

    const estadoActualUi = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa] || 'Diseño';
    let nuevoEstadoUi = estado;
    let nuevaEtapa;

    if (nuevoEstadoUi) {
      nuevaEtapa = ESTADO_UI_TO_ETAPA_NUM[nuevoEstadoUi];
      if (nuevaEtapa === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Estado "${nuevoEstadoUi}" no es válido.` });
      }
    } else if (etapa !== undefined && etapa !== null && ESTADO_UI_TO_ETAPA_NUM[etapa] !== undefined) {
      nuevoEstadoUi = etapa;
      nuevaEtapa = ESTADO_UI_TO_ETAPA_NUM[etapa];
    } else if (etapa !== undefined && etapa !== null) {
      nuevaEtapa = parseInt(etapa, 10);
      if (isNaN(nuevaEtapa) || nuevaEtapa < 0 || nuevaEtapa > 8) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La etapa debe ser un número entero entre 0 y 8 o un nombre de etapa válido.' });
      }
      nuevoEstadoUi = ETAPA_NUM_TO_NOMBRE_UI[nuevaEtapa];
    } else {
      // Si no se especificó, avanza a la siguiente etapa del flujo de ORVEX
      const idxActual = FLUJO_ETAPAS_UI.indexOf(estadoActualUi);
      if (idxActual < 0 || idxActual >= FLUJO_ETAPAS_UI.length - 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La orden ya está en la última etapa.' });
      }
      nuevoEstadoUi = FLUJO_ETAPAS_UI[idxActual + 1];
      nuevaEtapa = ESTADO_UI_TO_ETAPA_NUM[nuevoEstadoUi];
    }

    // Identificar usuario responsable para auditoría
    let responsableUser = null;
    if (req.usuario?.id && req.usuario.rol !== 'cliente') {
      responsableUser = await resolverUsuario(client, req.usuario.id);
    }
    if (!responsableUser && usuario_id) {
      responsableUser = await resolverUsuario(client, usuario_id);
    }
    if (!responsableUser) {
      responsableUser = await resolverUsuario(client, orden.ejecutiva_id);
    }
    const responsableId = responsableUser.id;
    const responsableNombre = req.usuario?.nombre_completo || responsableUser.nombre_completo;

    // ========================================================
    // CANDADO DE APROBACIÓN DE DISEÑO (HU-13, RF-07, T-06):
    // Las etapas >= 4 corresponden a Impresión, Acabados, Despacho, Entrega
    // ========================================================
    if (nuevaEtapa >= 4 && orden.etapa < 4) {
      const ultimaArteRes = await client.query(
        `SELECT id, numero_version, estado_aprobacion, estado_ui, tipo_aprobacion, soporte_validado, soporte_evidencia
         FROM archivos_arte
         WHERE orden_id = $1
         ORDER BY numero_version DESC
         LIMIT 1`,
        [orden.id]
      );

      const arteExiste = ultimaArteRes.rowCount > 0;
      const arteRow = arteExiste ? ultimaArteRes.rows[0] : null;

      const esAprobadoGeneral = arteExiste && (
        arteRow.estado_aprobacion === 'aprobado' ||
        arteRow.estado_ui === 'Aprobada' ||
        arteRow.estado_ui === 'Aprobada (Externa)'
      );

      const pendienteSoporte = arteExiste && (
        arteRow.tipo_aprobacion === 'externa' &&
        (!arteRow.soporte_validado || !arteRow.soporte_evidencia || arteRow.estado_ui === 'Pendiente de soporte')
      );

      if (!arteExiste || !esAprobadoGeneral || pendienteSoporte) {
        let motivoBloqueo;
        let mensajeError;

        if (!arteExiste) {
          motivoBloqueo = 'El pedido no cuenta con ninguna propuesta gráfica registrada.';
          mensajeError = 'CANDADO DE CALIDAD: No se puede avanzar a la etapa de impresión sin un diseño registrado.';
        } else if (pendienteSoporte) {
          motivoBloqueo = `La versión vigente (v${arteRow.numero_version}) cuenta con visto bueno preliminar pero tiene soporte documental pendiente de verificación.`;
          mensajeError = 'CANDADO DE CALIDAD: La aprobación externa de diseño permanece como registro preliminar pendiente. Debe adjuntar y verificar la evidencia documental de la versión exacta antes de pasar a impresión.';
        } else {
          motivoBloqueo = `El pedido no puede pasar a impresión porque el diseño vigente (v${arteRow.numero_version}) aún no ha sido aprobado formalmente.`;
          mensajeError = 'CANDADO DE CALIDAD: No se puede avanzar a la etapa de impresión/producción sin un diseño en estado "aprobado".';
        }

        // Registrar intento bloqueado en la bitácora inmutable
        await client.query(
          `INSERT INTO registro_sesion (
            orden_id, usuario_responsable_id, accion_texto,
            fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
            estado_anterior, nuevo_estado, motivo
          ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false,$7,$8,$9)`,
          [
            orden.id,
            responsableId,
            `Avance bloqueado: se intentó pasar a ${nuevoEstadoUi} (${motivoBloqueo})`,
            formatearFechaHoy(),
            formatearHoraAhora(),
            responsableNombre,
            estadoActualUi,
            nuevoEstadoUi,
            motivoBloqueo,
          ]
        );
        await client.query('COMMIT');
        return res.status(400).json({
          error: mensajeError,
          motivo: motivoBloqueo,
          bloqueada: true,
        });
      }
    }

    // ========================================================
    // CONSUMO DE INVENTARIO E IDEMPOTENCIA (RF-05, RF-08)
    // ========================================================
    let descuentoRealizado = null;
    if (nuevaEtapa >= 4) {
      if (orden.consumo_inventario_descontado) {
        // Idempotencia: Ya fue descontado en una transición previa
        descuentoRealizado = {
          ya_descontado: true,
          mensaje: 'Consumo de insumos previamente descontado (idempotencia garantizada).',
        };
      } else {
        // Descuento real en primera entrada a taller/impresión
        if (material_id && cantidad_insumo) {
          const cantDescontar = parseFloat(cantidad_insumo);
          if (isNaN(cantDescontar) || cantDescontar <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La cantidad de insumo a descontar debe ser un número positivo.' });
          }

          const materialRes = await client.query(
            'SELECT id, nombre_material, stock_actual, stock_reservado, stock_minimo FROM inventario WHERE id = $1 FOR UPDATE',
            [material_id]
          );

          if (materialRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: `Material de inventario #${material_id} no encontrado.` });
          }

          const material = materialRes.rows[0];
          const stockActual = parseFloat(material.stock_actual);

          if (stockActual < cantDescontar) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Stock insuficiente para "${material.nombre_material}".`,
              disponible: stockActual,
              requerido: cantDescontar,
            });
          }

          // Verificar si existía una reserva activa para esta orden y material
          const resReserva = await client.query(
            "SELECT * FROM orden_material_reserva WHERE orden_id = $1 AND material_id = $2 AND estado = 'activa' FOR UPDATE",
            [orden.id, material_id]
          );

          let cantLiberarReserva = 0;
          if (resReserva.rowCount > 0) {
            const reserva = resReserva.rows[0];
            cantLiberarReserva = Math.min(parseFloat(reserva.cantidad_reservada), cantDescontar);
            await client.query(
              "UPDATE orden_material_reserva SET estado = 'consumida', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
              [reserva.id]
            );
          }

          await client.query(
            'UPDATE inventario SET stock_actual = stock_actual - $1, stock_reservado = GREATEST(0, stock_reservado - $2) WHERE id = $3',
            [cantDescontar, cantLiberarReserva, material_id]
          );

          await client.query(
            `INSERT INTO movimientos_inventario (material_id, orden_id, usuario_responsable_id, cantidad, tipo)
             VALUES ($1, $2, $3, $4, 'salida')`,
            [material_id, orden.id, responsableId, cantDescontar]
          );

          await client.query(
            'UPDATE ordenes SET consumo_inventario_descontado = true WHERE id = $1',
            [orden.id]
          );

          descuentoRealizado = {
            material: material.nombre_material,
            cantidad_descontada: cantDescontar,
            stock_restante: stockActual - cantDescontar,
            reserva_consumida: cantLiberarReserva,
          };
        } else {
          // Si no se pasaron parámetros pero hay reservas activas para la orden, consumirlas
          const resActivas = await client.query(
            "SELECT * FROM orden_material_reserva WHERE orden_id = $1 AND estado = 'activa' FOR UPDATE",
            [orden.id]
          );
          if (resActivas.rowCount > 0) {
            for (const r of resActivas.rows) {
              const cantCons = parseFloat(r.cantidad_reservada);
              await client.query(
                'UPDATE inventario SET stock_actual = GREATEST(0, stock_actual - $1), stock_reservado = GREATEST(0, stock_reservado - $1) WHERE id = $2',
                [cantCons, r.material_id]
              );
              await client.query(
                "UPDATE orden_material_reserva SET estado = 'consumida', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [r.id]
              );
              await client.query(
                `INSERT INTO movimientos_inventario (material_id, orden_id, usuario_responsable_id, cantidad, tipo)
                 VALUES ($1, $2, $3, $4, 'salida')`,
                [r.material_id, orden.id, responsableId, cantCons]
              );
            }
            await client.query('UPDATE ordenes SET consumo_inventario_descontado = true WHERE id = $1', [orden.id]);
            descuentoRealizado = {
              reservas_consumidas: resActivas.rowCount,
              mensaje: 'Reservas previas convertidas a consumo real de taller.',
            };
          }
        }
      }
    }

    const porcentaje = parseFloat(((nuevaEtapa / 8) * 100).toFixed(2));
    await client.query(
      `UPDATE ordenes
       SET etapa = $1, porcentaje_avance = $2, estado_nombre = $3
       WHERE id = $4`,
      [nuevaEtapa, porcentaje, nuevoEstadoUi, orden.id]
    );

    let textoAuditoria = `Etapa cambiada a ${nuevoEstadoUi}`;
    if (descuentoRealizado) {
      textoAuditoria += `. Se descontaron ${descuentoRealizado.cantidad_descontada} unidades de "${descuentoRealizado.material}".`;
    }
    if (observaciones) {
      textoAuditoria += ` (${observaciones})`;
    }

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
        estado_anterior, nuevo_estado, motivo
      ) VALUES ($1, $2, $3, $4, $5, $6, 'En proceso', false, $7, $8, $9)`,
      [
        orden.id,
        responsableId,
        textoAuditoria,
        formatearFechaHoy(),
        formatearHoraAhora(),
        responsableNombre,
        estadoActualUi,
        nuevoEstadoUi,
        observaciones || null,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);

    res.json({
      message: `Orden ${ordenCompleta.id} actualizada exitosamente a ${nuevoEstadoUi}.`,
      data: ordenCompleta,
      descuento_inventario: descuentoRealizado,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.actualizarEtapa error:', error.message);
    res.status(500).json({ error: 'Error al actualizar etapa de la orden.' });
  } finally {
    client.release();
  }
};

/**
 * 4. REGISTRO DE ENTREGA FORMAL Y EVIDENCIA (HU-17)
 * POST /api/ordenes/:id/entrega
 */
const registrarEntrega = async (req, res) => {
  const datosEntrega = req.body || {};

  if (!datosEntrega.contacto || !String(datosEntrega.contacto).trim()) {
    return res.status(400).json({ error: 'El nombre de quien recibe es obligatorio.' });
  }

  // T-04: Validación de datos obligatorios del receptor (documento de identidad)
  if (!datosEntrega.documento || !String(datosEntrega.documento).trim()) {
    return res.status(400).json({ error: 'El documento o número de identificación de quien recibe es obligatorio.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    // T-04: Validación física, formato, firma, serialización atómica y contexto de entrega formal
    const validacionEvid = await validarArchivoEvidencia(req, 'evidencia', 'archivo', orden, client, 'entrega_formal');
    if (!validacionEvid.valido) {
      await client.query('ROLLBACK');
      return res.status(validacionEvid.codigoHttp || 400).json({ error: validacionEvid.error });
    }
    const archivoEvidencia = validacionEvid.filename;

    const entregaActual = (orden.entrega_json && typeof orden.entrega_json === 'object') ? orden.entrega_json : {};
    const nuevaEntrega = {
      ...entregaActual,
      contacto: String(datosEntrega.contacto).trim(),
      documento: String(datosEntrega.documento).trim(),
      cargo: datosEntrega.cargo || 'Recepción cliente',
      telefono: datosEntrega.telefono || '',
      fechaReal: datosEntrega.fechaReal || formatearFechaHoy(),
      conformidad: datosEntrega.conformidad || 'Conforme',
      observaciones: datosEntrega.observaciones || '',
      evidencia: String(archivoEvidencia).trim(),
      evidencia_hash: validacionEvid.hashSha256 || null,
    };

    const estadoAnterior = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa] || 'Despacho';
    await client.query(
      `UPDATE ordenes
       SET etapa = 8, porcentaje_avance = 100.00, estado_nombre = 'Entrega',
           entrega_json = $1, entrega_hash = $2
       WHERE id = $3`,
      [JSON.stringify(nuevaEntrega), validacionEvid.hashSha256 || null, orden.id]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, orden.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    // Si esta orden corresponde a una reposición por garantía, resolver el caso en postventa únicamente tras entrega formal
    if (orden.postventa_caso_origen_id || orden.es_reimpresion) {
      await client.query(
        `UPDATE postventa
         SET estado = 'Resuelto',
             fecha_solucion = CURRENT_TIMESTAMP,
             resuelto_por = $1,
             solucion = COALESCE(solucion, '') || ' Reposición física entregada formalmente a conformidad (Evidencia: ' || $2 || ').'
         WHERE (id = $3 OR reimpresion_orden_id = $4) AND estado = 'En reposición'`,
        [respUser.id, archivoEvidencia, orden.postventa_caso_origen_id || null, orden.id]
      );
    }

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
        estado_anterior, nuevo_estado, motivo
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false,$7,'Entrega',$8)`,
      [
        orden.id,
        respUser.id,
        `Entrega formal registrada a ${nuevaEntrega.contacto}${nuevaEntrega.documento ? ` (Doc: ${nuevaEntrega.documento})` : ''}`,
        formatearFechaHoy(),
        formatearHoraAhora(),
        respNombre,
        estadoAnterior,
        `Conformidad: ${nuevaEntrega.conformidad}${nuevaEntrega.observaciones ? ` - ${nuevaEntrega.observaciones}` : ''}`,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: `Entrega de ${ordenCompleta.id} registrada exitosamente.`,
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.registrarEntrega error:', error.message);
    res.status(500).json({ error: 'Error al registrar la entrega.' });
  } finally {
    client.release();
  }
};

/**
 * 5. CIERRE FORMAL DE ORDEN (HU-20)
 * POST /api/ordenes/:id/cerrar
 */
const cerrarOrden = async (req, res) => {
  const motivo = req.body.motivo || 'Cierre formal de producción y entrega';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const estadoActual = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa];
    if (!['Entrega', 'Postventa'].includes(estadoActual)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Solo pueden cerrarse órdenes en etapa Entrega o Postventa (actual: ${estadoActual}).`,
      });
    }

    // Verificar que no existan tareas pendientes ni casos abiertos
    const tareasPend = await client.query(
      "SELECT COUNT(*)::int AS total FROM tareas WHERE orden_id = $1 AND estado != 'Finalizada'",
      [orden.id]
    );
    if (tareasPend.rows[0].total > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede cerrar la orden: tiene ${tareasPend.rows[0].total} tarea(s) de taller sin finalizar.`,
      });
    }

    const casosAbiertos = await client.query(
      "SELECT COUNT(*)::int AS total FROM postventa WHERE orden_id = $1 AND estado != 'Resuelto' AND estado != 'Cerrado'",
      [orden.id]
    );
    if (casosAbiertos.rows[0].total > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede cerrar la orden: tiene ${casosAbiertos.rows[0].total} caso(s) de postventa sin resolver o en reposición.`,
      });
    }

    // Verificar si existen órdenes de reposición por garantía asociadas que no hayan completado su entrega formal
    const reposicionesPend = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM ordenes o
       INNER JOIN postventa pv ON o.postventa_caso_origen_id = pv.id
       WHERE pv.orden_id = $1 AND (o.etapa < 8 OR o.estado_nombre != 'Entrega')`,
      [orden.id]
    );
    if (reposicionesPend.rows[0].total > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede cerrar la orden original: tiene ${reposicionesPend.rows[0].total} orden(es) de reposición por garantía en taller pendientes de entrega formal.`,
      });
    }

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, orden.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;
    const fechaHoy = formatearFechaHoy();

    await client.query(
      `UPDATE ordenes
       SET estado_nombre = 'Cerrada', cerrado_por = $1, fecha_cierre = $2, motivo_cierre = $3
       WHERE id = $4`,
      [respNombre, fechaHoy, motivo, orden.id]
    );

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
        estado_anterior, nuevo_estado, motivo
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false,$7,'Cerrada',$8)`,
      [
        orden.id,
        respUser.id,
        `Orden cerrada formalmente por ${respNombre}`,
        fechaHoy,
        formatearHoraAhora(),
        respNombre,
        estadoActual,
        motivo,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: `La orden ${ordenCompleta.id} ha sido cerrada formalmente.`,
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.cerrarOrden error:', error.message);
    res.status(500).json({ error: 'Error al cerrar la orden.' });
  } finally {
    client.release();
  }
};

/**
 * 6. REAPERTURA DE ORDEN A POSTVENTA (HU-20)
 * POST /api/ordenes/:id/reabrir
 */
const reabrirOrden = async (req, res) => {
  const motivo = req.body.motivo || 'Reapertura para gestión postventa';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const estadoActual = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa];
    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, orden.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;
    const fechaHoy = formatearFechaHoy();

    await client.query(
      `UPDATE ordenes
       SET estado_nombre = 'Postventa', reabierto_por = $1, fecha_reapertura = $2
       WHERE id = $3`,
      [respNombre, fechaHoy, orden.id]
    );

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
        estado_anterior, nuevo_estado, motivo
      ) VALUES ($1,$2,$3,$4,$5,$6,'En proceso',false,$7,'Postventa',$8)`,
      [
        orden.id,
        respUser.id,
        `Orden reabierta por ${respNombre} a etapa Postventa`,
        fechaHoy,
        formatearHoraAhora(),
        respNombre,
        estadoActual,
        motivo,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: `La orden ${ordenCompleta.id} ha sido reabierta a Postventa.`,
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.reabrirOrden error:', error.message);
    res.status(500).json({ error: 'Error al reabrir la orden.' });
  } finally {
    client.release();
  }
};

/**
 * 7. CLONACIÓN DE ORDEN PARA REIMPRESIÓN
 * POST /api/ordenes/:id/clonar
 */
const clonarOrden = async (req, res) => {
  const motivo = req.body.motivo || 'Reimpresión o reposición de producto';
  const casoOrigenId = req.body.postventa_caso_origen_id || req.body.caso_id || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const original = await resolverOrden(client, req.params.id);
    if (!original) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden original ${req.params.id} no encontrada.` });
    }

    if (casoOrigenId) {
      const yaExisteRes = await client.query(
        'SELECT id, codigo FROM ordenes WHERE postventa_caso_origen_id = $1',
        [casoOrigenId]
      );
      if (yaExisteRes.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Ya existe una orden de reimpresión autorizada y generada para este caso (${yaExisteRes.rows[0].codigo || yaExisteRes.rows[0].id}). No se permiten órdenes duplicadas.`,
        });
      }
    }

    const entregaCalc = new Date();
    entregaCalc.setDate(entregaCalc.getDate() + 4);
    const fechaSol = formatearFechaHoy();
    const fechaEnt = formatearFechaHoy(entregaCalc);

    const entregaBase = (original.entrega_json && typeof original.entrega_json === 'object')
      ? { ...original.entrega_json, fechaReal: null, conformidad: null, evidencia: null }
      : {};

    // 1. RF-07: Verificar si la orden original cuenta con aprobación formal documentada
    const arteAprobadoRes = await client.query(
      `SELECT a.*, COALESCE(u.nombre_completo, a.disenador_nombre) AS aprobador_nombre
       FROM archivos_arte a
       LEFT JOIN usuarios u ON a.decision_por = u.id
       WHERE a.orden_id = $1 AND (a.estado_aprobacion = 'aprobado' OR a.estado_ui = 'Aprobada' OR a.estado_ui = 'Aprobada (Externa)')
       ORDER BY a.numero_version DESC
       LIMIT 1`,
      [original.id]
    );

    const eventoAprobadoRes = await client.query(
      `SELECT * FROM registro_sesion
       WHERE orden_id = $1 AND (accion_texto ILIKE '%diseño aprobado%' OR accion_texto ILIKE '%diseno aprobado%')
       ORDER BY id DESC
       LIMIT 1`,
      [original.id]
    );

    const tieneAprobacionValida =
      original.diseno_estado === 'Aprobado' &&
      (arteAprobadoRes.rowCount > 0 || eventoAprobadoRes.rowCount > 0);

    const arteAprobado = arteAprobadoRes.rows[0] || null;
    const eventoAprob = eventoAprobadoRes.rows[0] || null;

    const aprobadorReal = arteAprobado?.aprobador_nombre || eventoAprob?.responsable_nombre || null;
    const fechaAprobacionReal = arteAprobado?.fecha_texto || eventoAprob?.fecha_texto || null;
    const versionAprobadaNum = arteAprobado?.numero_version || null;

    // Etapa inicial condicionada por RF-07
    const etapaInicial = tieneAprobacionValida ? 4 : (original.etapa === 2 || original.diseno_estado === 'Enviado') ? 2 : 1;
    const estadoNombreInicial = tieneAprobacionValida ? 'Impresión' : (etapaInicial === 2 ? 'Aprobación' : 'Diseño');
    const disenoEstadoInicial = tieneAprobacionValida ? 'Aprobado' : (original.diseno_estado === 'Enviado' ? 'Enviado' : 'Pendiente');
    const avanceInicial = tieneAprobacionValida ? 50.00 : (etapaInicial === 2 ? 30.00 : 15.00);

    const presupuestoFinal = casoOrigenId ? 0.00 : original.presupuesto;

    const ins = await client.query(
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
        $6,$7,$8,false,
        $9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        $23,$24,$25,$26,
        true,$27,$28
      ) RETURNING *`,
      [
        original.cliente_id,
        original.producto,
        original.ejecutiva_id,
        original.disenador_id,
        original.produccion_id,
        etapaInicial,
        original.prioridad,
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
        presupuestoFinal,
        original.costo_interno,
        original.metodo_entrega,
        original.requerimientos,
        original.observaciones,
        JSON.stringify(entregaBase),
        original.codigo || `OP-2026-${String(original.id).padStart(4, '0')}`,
        casoOrigenId,
      ]
    );

    const nuevaRow = ins.rows[0];
    const nuevoCodigo = `OP-2026-${String(nuevaRow.id).padStart(4, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [nuevoCodigo, nuevaRow.id]);
    const origCodigo = original.codigo || `OP-2026-${String(original.id).padStart(4, '0')}`;

    if (casoOrigenId) {
      await client.query(
        `UPDATE postventa
         SET solicitud_reimpresion = true,
             reimpresion_autorizada = true,
             reimpresion_orden_id = $1,
             reimpresion_autorizada_por = $2,
             reimpresion_fecha = CURRENT_TIMESTAMP,
             estado = 'Resuelto',
             dictamen_garantia = 'Garantía aceptada — Reimpresión generada',
             solucion = $3
         WHERE id = $4`,
        [nuevaRow.id, req.usuario.id, `Reimpresión generada formalmente: ${nuevoCodigo}`, casoOrigenId]
      );
    }

    if (tieneAprobacionValida) {
      // Reutilizar arte aprobado conservando trazabilidad formal de aprobación original (RF-07)
      const rutaFinal = arteAprobado?.ruta_archivo || `uploads/Arte_Final_${nuevoCodigo}_v1.pdf`;
      const archivoNombreFinal = arteAprobado?.archivo_nombre || `Arte_Final_${nuevoCodigo}_v1.pdf`;
      const comentarioAprob = `Reutilización autorizada de arte v${versionAprobadaNum || 1} aprobado en ${origCodigo}. Aprobador: ${aprobadorReal || 'Cliente'} (${fechaAprobacionReal || fechaSol}).`;

      await client.query(
        `INSERT INTO archivos_arte (
          orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion,
          decision_por, comentario, fecha_texto, disenador_nombre, estado_ui, archivo_nombre
        ) VALUES ($1, 1, $2, $3, 'aprobado', $4, $5, $6, $7, 'Aprobada', $8)`,
        [
          nuevaRow.id,
          rutaFinal,
          arteAprobado?.creador_id || original.disenador_id || original.ejecutiva_id,
          arteAprobado?.decision_por || original.ejecutiva_id,
          comentarioAprob,
          fechaAprobacionReal || fechaSol,
          arteAprobado?.disenador_nombre || original.disenador_nombre_asignado || 'María López',
          archivoNombreFinal,
        ]
      );
    } else {
      // Si la orden original NO tenía aprobación verificable, no inventar aprobación (RF-07)
      const cualquierArteRes = await client.query(
        `SELECT * FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version DESC LIMIT 1`,
        [original.id]
      );
      if (cualquierArteRes.rowCount > 0) {
        const artBase = cualquierArteRes.rows[0];
        const estDb = artBase.estado_aprobacion === 'pendiente' ? 'pendiente' : 'borrador';
        const estUi = estDb === 'pendiente' ? 'Enviada' : 'En proceso';
        await client.query(
          `INSERT INTO archivos_arte (
            orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion,
            decision_por, comentario, fecha_texto, disenador_nombre, estado_ui, archivo_nombre
          ) VALUES ($1, 1, $2, $3, $4, NULL, $5, $6, $7, $8, $9)`,
          [
            nuevaRow.id,
            artBase.ruta_archivo || `uploads/Arte_Final_${nuevoCodigo}_v1.pdf`,
            artBase.creador_id || original.disenador_id || original.ejecutiva_id,
            estDb,
            `Arte base de ${origCodigo} copiado como borrador/revisión. Requiere aprobación formal del cliente (RF-07).`,
            fechaSol,
            artBase.disenador_nombre || original.disenador_nombre_asignado || 'María López',
            estUi,
            artBase.archivo_nombre || `Arte_Final_${nuevoCodigo}_v1.pdf`,
          ]
        );
      }
    }

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, original.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    // Registrar evento de clonación
    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
      [
        nuevaRow.id,
        respUser.id,
        `Orden clonada a partir de ${origCodigo} para reimpresión. Motivo: ${motivo}`,
        fechaSol,
        formatearHoraAhora(),
        respNombre,
      ]
    );

    // Registrar trazabilidad estricta de aprobación según RF-07
    if (tieneAprobacionValida) {
      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
        ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',false)`,
        [
          nuevaRow.id,
          respUser.id,
          `Aprobación reutilizada de orden original ${origCodigo} (v${versionAprobadaNum || 1}). Aprobado formalmente por: ${aprobadorReal || 'Cliente'} (${fechaAprobacionReal || fechaSol}). Cumple RF-07 para impresión.`,
          fechaSol,
          formatearHoraAhora(),
          respNombre,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO registro_sesion (
          orden_id, usuario_responsable_id, accion_texto,
          fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
        ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false)`,
        [
          nuevaRow.id,
          respUser.id,
          `RF-07: Paso a impresión bloqueado en orden clonada. La orden de origen ${origCodigo} no contaba con aprobación formal documentada; requiere visto bueno del cliente.`,
          fechaSol,
          formatearHoraAhora(),
          respNombre,
        ]
      );
    }

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [nuevaRow.id]);
    res.status(201).json({
      message: `Orden clonada con éxito: ${ordenCompleta.id}.`,
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.clonarOrden error:', error.message);
    res.status(500).json({ error: 'Error al clonar la orden.' });
  } finally {
    client.release();
  }
};

/**
 * 8. COORDINACIÓN Y ASIGNACIÓN DE EQUIPO, PLAZOS Y PRESUPUESTO EN ORDEN
 * PATCH /api/ordenes/:id/asignacion
 */
const actualizarAsignacionOrden = async (req, res) => {
  const { disenador, responsable, presupuesto, costoInterno, fechaEntrega } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const nuevoDisenador = disenador || orden.disenador_nombre_asignado || 'María López';
    const nuevoResponsable = responsable || orden.responsable_nombre || 'Pedro Morales';
    const nuevoPresupuesto = presupuesto !== undefined ? Number(presupuesto) : Number(orden.presupuesto || 0);
    const nuevoCosto = costoInterno !== undefined ? Number(costoInterno) : Number(orden.costo_interno || 0);
    const nuevaFechaEntrega = fechaEntrega || orden.fecha_entrega;

    const usrDis = await resolverUsuario(client, nuevoDisenador);
    const usrProd = await resolverUsuario(client, nuevoResponsable);

    await client.query(
      `UPDATE ordenes
       SET disenador_nombre_asignado = $1,
           responsable_nombre = $2,
           disenador_id = COALESCE($3, disenador_id),
           produccion_id = COALESCE($4, produccion_id),
           presupuesto = $5,
           costo_interno = $6,
           fecha_entrega = $7
       WHERE id = $8`,
      [
        nuevoDisenador,
        nuevoResponsable,
        usrDis ? usrDis.id : null,
        usrProd ? usrProd.id : null,
        nuevoPresupuesto,
        nuevoCosto,
        nuevaFechaEntrega,
        orden.id,
      ]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, orden.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
      ) VALUES ($1,$2,$3,$4,$5,$6,'Completado',true)`,
      [
        orden.id,
        respUser.id,
        `Coordinación de orden actualizada: Diseño (${nuevoDisenador}), Responsable operativo (${nuevoResponsable})`,
        formatearFechaHoy(),
        formatearHoraAhora(),
        respNombre,
      ]
    );

    await client.query('COMMIT');

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [orden.id]);
    res.json({
      message: 'Asignación y costos de la orden actualizados exitosamente.',
      data: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ordenesController.actualizarAsignacionOrden error:', error.message);
    res.status(500).json({ error: 'Error al actualizar la asignación de la orden.' });
  } finally {
    client.release();
  }
};

module.exports = {
  listarOrdenes,
  obtenerOrdenPorId,
  obtenerHistorialOrden,
  crearOrden,
  actualizarEtapa,
  actualizarAsignacionOrden,
  registrarEntrega,
  cerrarOrden,
  reabrirOrden,
  clonarOrden,
  cargarOrdenesEnriquecidas,
};
