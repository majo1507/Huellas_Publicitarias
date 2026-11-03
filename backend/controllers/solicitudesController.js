// ============================================================
// controllers/solicitudesController.js — Controlador de Solicitudes Comerciales
// ============================================================
const { pool } = require('../db');
const {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  resolverCliente,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');

const ESTADO_DB_TO_UI = {
  pendiente: 'Pendiente',
  cotizada: 'En validación',
  en_validacion: 'En validación',
  aprobada: 'Aprobada',
  convertida: 'Aprobada',
  devuelta: 'Devuelta para corrección',
  rechazada: 'Rechazada',
};

function formatearSolicitud(s) {
  const ordenCodigo = s.orden_codigo || (s.orden_id ? `OP-2026-${String(s.orden_id).padStart(4, '0')}` : null);
  return {
    id: s.codigo || s.id,
    uuid: s.id,
    codigo: s.codigo,
    clienteId: s.cliente_codigo || s.cliente_id,
    cliente_id: s.cliente_id,
    cliente: s.cliente_empresa,
    producto: s.producto || s.descripcion || 'Producto publicitario',
    cantidad: Number(s.cantidad || 1),
    dimensiones: s.dimensiones || 'Estándar',
    material: s.material || 'Lona',
    fechaSolicitud: s.fecha_solicitud || formatearFechaHoy(new Date(s.created_at)),
    fechaEntrega: s.fecha_entrega || formatearFechaHoy(new Date(s.created_at)),
    presupuesto: Number(s.presupuesto || 0),
    requerimientos: s.requerimientos || '',
    observaciones: s.observaciones || '',
    estado: ESTADO_DB_TO_UI[s.estado] || 'Pendiente',
    estado_db: s.estado,
    ordenId: ordenCodigo,
    orden_id: s.orden_id || null,
    motivoRechazo: s.motivo_rechazo || '',
    created_at: s.created_at,
  };
}

async function resolverSolicitud(dbOrClient, idOrCodigo, forUpdate = false) {
  if (!idOrCodigo) return null;
  const str = String(idOrCodigo).trim();
  const lock = forUpdate ? ' FOR UPDATE' : '';
  if (esUuid(str)) {
    const res = await dbOrClient.query(`SELECT * FROM solicitudes WHERE id = $1${lock}`, [str]);
    if (res.rowCount > 0) return res.rows[0];
  }
  const res = await dbOrClient.query(`SELECT * FROM solicitudes WHERE codigo = $1${lock}`, [str]);
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function consultarSolicitudCompleta(dbOrClient, uuid) {
  const res = await dbOrClient.query(
    `SELECT
      s.*,
      c.codigo AS cliente_codigo,
      c.empresa AS cliente_empresa,
      c.direccion AS cliente_direccion,
      c.ciudad AS cliente_ciudad,
      c.contacto_principal AS cliente_contacto,
      o.codigo AS orden_codigo
     FROM solicitudes s
     INNER JOIN clientes c ON s.cliente_id = c.id
     LEFT JOIN ordenes o ON s.orden_id = o.id
     WHERE s.id = $1`,
    [uuid]
  );
  return res.rowCount > 0 ? formatearSolicitud(res.rows[0]) : null;
}

const listarSolicitudes = async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        c.codigo AS cliente_codigo,
        c.empresa AS cliente_empresa,
        o.codigo AS orden_codigo
      FROM solicitudes s
      INNER JOIN clientes c ON s.cliente_id = c.id
      LEFT JOIN ordenes o ON s.orden_id = o.id
      ORDER BY COALESCE(s.codigo, s.id::text) ASC
    `);

    res.json({
      total: result.rowCount,
      data: result.rows.map(formatearSolicitud),
    });
  } catch (error) {
    console.error('solicitudesController.listarSolicitudes error:', error.message);
    res.status(500).json({ error: 'Error al listar solicitudes.' });
  }
};

const crearSolicitud = async (req, res) => {
  const {
    clienteId,
    cliente_id,
    cliente,
    producto,
    cantidad,
    dimensiones,
    material,
    fechaEntrega,
    presupuesto,
    requerimientos,
    observaciones,
  } = req.body;

  const targetCliente = clienteId || cliente_id || cliente;
  if (!targetCliente || !producto) {
    return res.status(400).json({ error: 'Campos obligatorios: clienteId y producto.' });
  }

  try {
    const cli = await resolverCliente(pool, targetCliente);
    if (!cli) {
      return res.status(404).json({ error: `Cliente ${targetCliente} no encontrado.` });
    }

    let ejec = null;
    if (req.usuario?.id && req.usuario.rol !== 'cliente') {
      ejec = await resolverUsuario(pool, req.usuario.id);
    }
    if (!ejec) {
      ejec = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');
    }

    const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM solicitudes');
    const numero = String(countRes.rows[0].total + 1).padStart(4, '0');
    let codigo = req.body.id || req.body.codigo || `SOL-2026-${numero}`;

    const checkCod = await pool.query('SELECT 1 FROM solicitudes WHERE codigo = $1', [codigo]);
    if (checkCod.rowCount > 0) {
      codigo = `SOL-2026-${String(Date.now()).slice(-4)}`;
    }

    const cantNum = Number(cantidad || 1);
    const presNum = Number(presupuesto || 0);
    const fechaSol = formatearFechaHoy();

    const ins = await pool.query(
      `INSERT INTO solicitudes (
        codigo, cliente_id, ejecutiva_id, descripcion, estado,
        producto, cantidad, dimensiones, material,
        fecha_solicitud, fecha_entrega, presupuesto,
        requerimientos, observaciones, motivo_rechazo
      ) VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7,$8,$9,$10,$11,$12,$13,'')
      RETURNING id`,
      [
        codigo,
        cli.id,
        ejec.id,
        `${producto.trim()} (${cantNum} uds)`,
        producto.trim(),
        cantNum,
        dimensiones || '',
        material || '',
        fechaSol,
        fechaEntrega || fechaSol,
        presNum,
        requerimientos || '',
        observaciones || '',
      ]
    );

    const data = await consultarSolicitudCompleta(pool, ins.rows[0].id);
    res.status(201).json({
      message: `Solicitud ${data.id} registrada exitosamente.`,
      data,
    });
  } catch (error) {
    console.error('solicitudesController.crearSolicitud error:', error.message);
    res.status(500).json({ error: 'Error al registrar la solicitud.' });
  }
};

const enviarAValidacion = async (req, res) => {
  try {
    const sol = await resolverSolicitud(pool, req.params.id);
    if (!sol) {
      return res.status(404).json({ error: `Solicitud ${req.params.id} no encontrada.` });
    }

    await pool.query(
      "UPDATE solicitudes SET estado = 'en_validacion', motivo_rechazo = '' WHERE id = $1",
      [sol.id]
    );

    const data = await consultarSolicitudCompleta(pool, sol.id);
    res.json({
      message: `Solicitud ${data.id} enviada a validación.`,
      data,
    });
  } catch (error) {
    console.error('solicitudesController.enviarAValidacion error:', error.message);
    res.status(500).json({ error: 'Error al enviar solicitud a validación.' });
  }
};

const devolverSolicitud = async (req, res) => {
  const { motivo } = req.body;
  if (!motivo || String(motivo).trim().length < 3) {
    return res.status(400).json({ error: 'Debes indicar el motivo de devolución.' });
  }

  try {
    const sol = await resolverSolicitud(pool, req.params.id);
    if (!sol) {
      return res.status(404).json({ error: `Solicitud ${req.params.id} no encontrada.` });
    }

    await pool.query(
      "UPDATE solicitudes SET estado = 'devuelta', motivo_rechazo = $1 WHERE id = $2",
      [String(motivo).trim(), sol.id]
    );

    const data = await consultarSolicitudCompleta(pool, sol.id);
    res.json({
      message: `Solicitud ${data.id} devuelta para corrección.`,
      data,
    });
  } catch (error) {
    console.error('solicitudesController.devolverSolicitud error:', error.message);
    res.status(500).json({ error: 'Error al devolver la solicitud.' });
  }
};

const rechazarSolicitud = async (req, res) => {
  const { motivo } = req.body;
  if (!motivo || String(motivo).trim().length < 3) {
    return res.status(400).json({ error: 'Debes indicar el motivo del rechazo.' });
  }

  try {
    const sol = await resolverSolicitud(pool, req.params.id);
    if (!sol) {
      return res.status(404).json({ error: `Solicitud ${req.params.id} no encontrada.` });
    }

    await pool.query(
      "UPDATE solicitudes SET estado = 'rechazada', motivo_rechazo = $1 WHERE id = $2",
      [String(motivo).trim(), sol.id]
    );

    const data = await consultarSolicitudCompleta(pool, sol.id);
    res.json({
      message: `Solicitud ${data.id} rechazada formalmente.`,
      data,
    });
  } catch (error) {
    console.error('solicitudesController.rechazarSolicitud error:', error.message);
    res.status(500).json({ error: 'Error al rechazar la solicitud.' });
  }
};

// Validar solicitud y generar orden de producción en una transacción (HU-06)
const validarSolicitud = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sol = await resolverSolicitud(client, req.params.id, true);
    if (!sol) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Solicitud ${req.params.id} no encontrada.` });
    }

    if (sol.orden_id || sol.estado === 'aprobada' || sol.estado === 'convertida') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `La solicitud ${sol.codigo || sol.id} ya generó una orden previamente. No se permiten órdenes duplicadas.`,
      });
    }

    if (sol.estado !== 'en_validacion' && sol.estado !== 'cotizada') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'La solicitud debe encontrarse en estado "En validación" para ser aprobada.',
      });
    }

    const clienteRes = await client.query('SELECT * FROM clientes WHERE id = $1', [sol.cliente_id]);
    const cliente = clienteRes.rows[0];
    const disenador = await obtenerUsuarioPorDefecto(client, 'disenador');
    const coordUser = (req.usuario?.id && req.usuario.rol !== 'cliente')
      ? (await resolverUsuario(client, req.usuario.id))
      : (await obtenerUsuarioPorDefecto(client, 'coord'));
    const coordNombre = req.usuario?.nombre_completo || coordUser.nombre_completo;

    const entregaJson = {
      direccion: cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || 'Bogotá'}` : 'Sede comercial, Bogotá',
      metodo: 'Domicilio',
      contacto: cliente.contacto_principal || cliente.empresa,
    };

    const presNum = Number(sol.presupuesto || 0);
    const insOrd = await client.query(
      `INSERT INTO ordenes (
        cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
        etapa, prioridad, porcentaje_avance, bloqueado,
        solicitud_codigo, cantidad, material, dimensiones, colores, acabados,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        responsable_nombre, disenador_nombre_asignado, presupuesto, costo_interno,
        metodo_entrega, requerimientos, observaciones, entrega_json
      ) VALUES (
        $1,$2,$3,$4,NULL,
        1,'Media',12.50,false,
        $5,$6,$7,$8,'Por definir en pre-prensa','Corte y empaque estándar',
        $9,$10,'Diseño','Pendiente',
        'María López','María López',$11,$12,
        'Domicilio',$13,$14,$15
      ) RETURNING *`,
      [
        sol.cliente_id,
        sol.producto || sol.descripcion,
        sol.ejecutiva_id,
        disenador ? disenador.id : null,
        sol.codigo || sol.id,
        Number(sol.cantidad || 1),
        sol.material || 'Lona',
        sol.dimensiones || 'Estándar',
        sol.fecha_solicitud || formatearFechaHoy(),
        sol.fecha_entrega || formatearFechaHoy(),
        presNum,
        Math.round(presNum * 0.6),
        sol.requerimientos || 'Sin especificaciones adicionales',
        sol.observaciones || '',
        JSON.stringify(entregaJson),
      ]
    );

    const nuevaOrdenRow = insOrd.rows[0];
    const codigoOrden = `OP-2026-${String(nuevaOrdenRow.id).padStart(4, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [codigoOrden, nuevaOrdenRow.id]);

    // Actualizar solicitud con el vínculo a la orden creada
    await client.query(
      "UPDATE solicitudes SET estado = 'aprobada', orden_id = $1, motivo_rechazo = '' WHERE id = $2",
      [nuevaOrdenRow.id, sol.id]
    );

    // Registrar los 3 eventos iniciales en la bitácora inmutable registro_sesion
    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();
    const codSol = sol.codigo || sol.id;

    await client.query(
      `INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto, fecha_texto, hora_texto, responsable_nombre, estado_evento, interno)
       VALUES
         ($1, $2, $3, $4, $5, 'Ana Martínez', 'Completado', false),
         ($1, $6, $7, $4, $5, $8, 'Completado', false),
         ($1, $6, 'Actividad asignada: propuesta gráfica a María López', $4, $5, $8, 'Completado', true)`,
      [
        nuevaOrdenRow.id,
        sol.ejecutiva_id,
        `Solicitud ${codSol} registrada en comercial`,
        fechaHoy,
        horaAhora,
        coordUser.id,
        `Orden generada desde solicitud ${codSol}`,
        coordNombre,
      ]
    );

    await client.query('COMMIT');

    const [solicitudActualizada, [ordenCompleta]] = await Promise.all([
      consultarSolicitudCompleta(pool, sol.id),
      cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [nuevaOrdenRow.id]),
    ]);

    res.status(201).json({
      message: `Solicitud validada. Se generó la orden ${ordenCompleta.id} y se asignó a diseño.`,
      data: solicitudActualizada,
      orden: ordenCompleta,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('solicitudesController.validarSolicitud error:', error.message);
    res.status(500).json({ error: 'Error al validar la solicitud y generar la orden.' });
  } finally {
    client.release();
  }
};

module.exports = {
  listarSolicitudes,
  crearSolicitud,
  enviarAValidacion,
  devolverSolicitud,
  rechazarSolicitud,
  validarSolicitud,
};
