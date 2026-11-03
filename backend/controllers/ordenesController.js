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

function construirOrdenCompleta(o, versionesRows = [], historialRows = []) {
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
    costoInterno: costoInternoNum,
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
    created_at: o.created_at,
    updated_at: o.updated_at,
  };
}

async function cargarOrdenesEnriquecidas(dbOrClient, filtroWhere = '', params = []) {
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
    construirOrdenCompleta(o, artesByOrden[o.id] || [], histByOrden[o.id] || [])
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

    const ordenes = await cargarOrdenesEnriquecidas(pool, where, params);
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

    const [ordenCompleta] = await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [base.id]);
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
  } = req.body;

  const targetCliente = cliente_id || clienteId;
  if (!targetCliente || !producto) {
    return res.status(400).json({
      error: 'Campos obligatorios: cliente_id/clienteId y producto.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
        solicitudId || null,
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
    // CANDADO DE APROBACIÓN DE DISEÑO (HU-13):
    // Las etapas >= 4 corresponden a Impresión, Acabados, Despacho, Entrega
    // ========================================================
    if (nuevaEtapa >= 4 && orden.etapa < 4) {
      const ultimaArteRes = await client.query(
        `SELECT id, numero_version, estado_aprobacion, estado_ui
         FROM archivos_arte
         WHERE orden_id = $1
         ORDER BY numero_version DESC
         LIMIT 1`,
        [orden.id]
      );

      const arteAprobado =
        ultimaArteRes.rowCount > 0 &&
        (ultimaArteRes.rows[0].estado_aprobacion === 'aprobado' ||
          ultimaArteRes.rows[0].estado_ui === 'Aprobada');

      if (!arteAprobado) {
        const motivoBloqueo = 'El pedido no puede pasar a impresión porque el diseño vigente aún no ha sido aprobado.';
        // Registrar intento bloqueado en la bitácora inmutable y confirmar ese evento
        await client.query(
          `INSERT INTO registro_sesion (
            orden_id, usuario_responsable_id, accion_texto,
            fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
            estado_anterior, nuevo_estado, motivo
          ) VALUES ($1,$2,$3,$4,$5,$6,'Pendiente',false,$7,$8,$9)`,
          [
            orden.id,
            responsableId,
            `Avance bloqueado: se intentó pasar a ${nuevoEstadoUi} sin diseño aprobado`,
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
          error: 'CANDADO DE CALIDAD: No se puede avanzar a la etapa de impresión/producción sin un diseño en estado "aprobado".',
          motivo: motivoBloqueo,
          bloqueada: true,
        });
      }
    }

    // ========================================================
    // DESCUENTO DE STOCK EN INVENTARIO (Si se especificó material)
    // ========================================================
    let descuentoRealizado = null;
    if (material_id && cantidad_insumo) {
      const cantDescontar = parseFloat(cantidad_insumo);
      if (isNaN(cantDescontar) || cantDescontar <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'La cantidad de insumo a descontar debe ser un número positivo.' });
      }

      const materialRes = await client.query(
        'SELECT id, nombre_material, stock_actual, stock_minimo FROM inventario WHERE id = $1 FOR UPDATE',
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

      await client.query('UPDATE inventario SET stock_actual = stock_actual - $1 WHERE id = $2', [cantDescontar, material_id]);

      await client.query(
        `INSERT INTO movimientos_inventario (material_id, orden_id, usuario_responsable_id, cantidad, tipo)
         VALUES ($1, $2, $3, $4, 'salida')`,
        [material_id, orden.id, responsableId, cantDescontar]
      );

      descuentoRealizado = {
        material: material.nombre_material,
        cantidad_descontada: cantDescontar,
        stock_restante: stockActual - cantDescontar,
      };
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orden = await resolverOrden(client, req.params.id, true);
    if (!orden) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${req.params.id} no encontrada.` });
    }

    const entregaActual = (orden.entrega_json && typeof orden.entrega_json === 'object') ? orden.entrega_json : {};
    const nuevaEntrega = {
      ...entregaActual,
      contacto: String(datosEntrega.contacto).trim(),
      documento: datosEntrega.documento ? String(datosEntrega.documento).trim() : '',
      cargo: datosEntrega.cargo || 'Recepción cliente',
      telefono: datosEntrega.telefono || '',
      fechaReal: datosEntrega.fechaReal || formatearFechaHoy(),
      conformidad: datosEntrega.conformidad || 'Conforme',
      observaciones: datosEntrega.observaciones || '',
      evidencia: datosEntrega.evidencia || entregaActual.evidencia || null,
    };

    const estadoAnterior = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa] || 'Despacho';
    await client.query(
      `UPDATE ordenes
       SET etapa = 8, porcentaje_avance = 100.00, estado_nombre = 'Entrega', entrega_json = $1
       WHERE id = $2`,
      [JSON.stringify(nuevaEntrega), orden.id]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, orden.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;

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
      "SELECT COUNT(*)::int AS total FROM postventa WHERE orden_id = $1 AND estado != 'Resuelto'",
      [orden.id]
    );
    if (casosAbiertos.rows[0].total > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede cerrar la orden: tiene ${casosAbiertos.rows[0].total} caso(s) de postventa sin resolver.`,
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const original = await resolverOrden(client, req.params.id);
    if (!original) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden original ${req.params.id} no encontrada.` });
    }

    const entregaCalc = new Date();
    entregaCalc.setDate(entregaCalc.getDate() + 4);
    const fechaSol = formatearFechaHoy();
    const fechaEnt = formatearFechaHoy(entregaCalc);

    const entregaBase = (original.entrega_json && typeof original.entrega_json === 'object')
      ? { ...original.entrega_json, fechaReal: null, conformidad: null, evidencia: null }
      : {};

    const ins = await client.query(
      `INSERT INTO ordenes (
        cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
        etapa, prioridad, porcentaje_avance, bloqueado,
        solicitud_codigo, cantidad, material, dimensiones, colores, acabados,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        responsable_nombre, disenador_nombre_asignado, presupuesto, costo_interno,
        metodo_entrega, requerimientos, observaciones, entrega_json,
        es_reimpresion, orden_original_codigo
      ) VALUES (
        $1,$2,$3,$4,$5,
        4,$6,50.00,false,
        $7,$8,$9,$10,$11,$12,
        $13,$14,'Impresión','Aprobado',
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        true,$23
      ) RETURNING *`,
      [
        original.cliente_id,
        original.producto,
        original.ejecutiva_id,
        original.disenador_id,
        original.produccion_id,
        original.prioridad,
        original.solicitud_codigo,
        original.cantidad,
        original.material,
        original.dimensiones,
        original.colores,
        original.acabados,
        fechaSol,
        fechaEnt,
        original.responsable_nombre || 'Juan Pérez',
        original.disenador_nombre_asignado || 'María López',
        original.presupuesto,
        original.costo_interno,
        original.metodo_entrega,
        original.requerimientos,
        original.observaciones,
        JSON.stringify(entregaBase),
        original.codigo || `OP-2026-${String(original.id).padStart(4, '0')}`,
      ]
    );

    const nuevaRow = ins.rows[0];
    const nuevoCodigo = `ORD-2024-${String(nuevaRow.id).padStart(3, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [nuevoCodigo, nuevaRow.id]);

    // Copiar versión aprobada de arte para cumplir candado de impresión
    await client.query(
      `INSERT INTO archivos_arte (
        orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion,
        decision_por, comentario, fecha_texto, disenador_nombre, estado_ui, archivo_nombre
      ) VALUES ($1, 1, $2, $3, 'aprobado', $4, 'Arte aprobado heredado de orden original', $5, 'María López', 'Aprobada', $6)`,
      [
        nuevaRow.id,
        `uploads/Arte_Final_${nuevoCodigo}_v1.pdf`,
        original.disenador_id || original.ejecutiva_id,
        original.ejecutiva_id,
        fechaSol,
        `Arte_Final_${nuevoCodigo}_v1.pdf`,
      ]
    );

    const respUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await resolverUsuario(client, original.ejecutiva_id));
    const respNombre = req.usuario?.nombre_completo || respUser.nombre_completo;
    const origCodigo = original.codigo || `OP-2026-${String(original.id).padStart(4, '0')}`;

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

module.exports = {
  listarOrdenes,
  obtenerOrdenPorId,
  obtenerHistorialOrden,
  crearOrden,
  actualizarEtapa,
  registrarEntrega,
  cerrarOrden,
  reabrirOrden,
  clonarOrden,
  cargarOrdenesEnriquecidas,
};
