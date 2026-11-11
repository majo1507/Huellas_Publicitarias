// ============================================================
// controllers/solicitudesController.js — Controlador de Solicitudes Comerciales
// ============================================================
const { pool } = require('../db');
const {
  esUuid,
  formatearFechaHoy,
  formatearHoraAhora,
  formatearFechaBogota,
  formatearHoraBogota,
  resolverCliente,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
} = require('../utils/resolvers');
const {
  validarDimensiones,
  MENSAJE_ERROR_DIMENSIONES,
} = require('../utils/validacionesDimensiones');
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
    prioridad: s.prioridad || 'Media',
    metodoEntrega: s.metodo_entrega || 'Domicilio',
    acabados: s.acabados || 'Corte y empaque estándar',
    fechaSolicitud: s.fecha_solicitud || formatearFechaHoy(new Date(s.created_at)),
    fechaEntrega: s.fecha_entrega || formatearFechaHoy(new Date(s.created_at)),
    presupuesto: Number(s.presupuesto || 0),
    cotizacionTotal: Number(s.cotizacion_total || s.presupuesto || 0),
    estadoPago: s.estado_pago || (Number(s.total_abonado) > 0 ? (Number(s.saldo_pendiente) === 0 ? 'Pagado' : 'Abono parcial') : 'Pendiente de pago'),
    totalAbonado: Number(s.total_abonado || 0),
    saldoPendiente: Number(s.saldo_pendiente != null ? s.saldo_pendiente : (s.cotizacion_total || s.presupuesto || 0)),
    tipoPago: s.tipo_pago || 'sin_pago',
    pagos: Array.isArray(s.pagos) ? s.pagos : [],
    requerimientos: s.requerimientos || '',
    observaciones: s.observaciones || '',
    estado: ESTADO_DB_TO_UI[s.estado] || 'Pendiente',
    estado_db: s.estado,
    ordenId: ordenCodigo,
    orden_id: s.orden_id || null,
    motivoRechazo: s.motivo_rechazo || '',
    archivosReferencia: Array.isArray(s.archivos_referencia) ? s.archivos_referencia : [],
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

  const dimVal = String(dimensiones || '').trim();
  if (!dimVal) {
    return res.status(400).json({ error: 'Las dimensiones son obligatorias.' });
  }
  if (!validarDimensiones(dimVal)) {
    return res.status(400).json({ error: MENSAJE_ERROR_DIMENSIONES });
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

    // Consecutivo basado en el mayor código existente (COUNT+1 colisionaba tras borrados o códigos manuales)
    const countRes = await pool.query(
      "SELECT COALESCE(MAX((substring(codigo FROM '^SOL-2026-([0-9]+)$'))::int), 0) + 1 AS siguiente FROM solicitudes"
    );
    const numero = String(countRes.rows[0].siguiente).padStart(4, '0');
    let codigo = req.body.id || req.body.codigo || `SOL-2026-${numero}`;

    const checkCod = await pool.query('SELECT 1 FROM solicitudes WHERE codigo = $1', [codigo]);
    if (checkCod.rowCount > 0) {
      codigo = `SOL-2026-${String(Date.now()).slice(-4)}`;
    }

    const cantNum = Number(cantidad || 1);
    const presNum = Number(req.body.cotizacionTotal != null ? req.body.cotizacionTotal : (presupuesto || 0));
    const cotizacionTotal = presNum;
    if (cotizacionTotal < 0 || isNaN(cotizacionTotal)) {
      return res.status(400).json({ error: 'El valor total de la cotización no puede ser negativo.' });
    }

    const tipoPagoInput = req.body.tipoPago || 'sin_pago';
    const rawPagos = Array.isArray(req.body.pagos) ? req.body.pagos : [];
    const pagosValidados = [];

    for (let idx = 0; idx < rawPagos.length; idx++) {
      const p = rawPagos[idx];
      const val = Number(p.valor);
      if (isNaN(val) || val <= 0) {
        return res.status(400).json({ error: `El abono #${idx + 1} debe tener un valor numérico mayor a $0.` });
      }
      pagosValidados.push({
        id: p.id || `PAG-${Date.now()}-${idx + 1}`,
        valor: val,
        metodo: p.metodo || p.metodoPago || p.metodo_pago || 'efectivo',
        referencia: (p.referencia || '').trim(),
        soporte: (p.soporte || '').trim(),
        fecha: p.fecha || formatearFechaBogota(),
        hora: p.hora || formatearHoraBogota(),
        registradoPor: req.usuario?.nombre_completo || ejec.nombre_completo || 'Ana Martínez',
        tipoDocumento: 'Recibo de caja interno (No constituye factura electrónica)',
      });
    }

    const totalAbonado = pagosValidados.reduce((acc, p) => acc + p.valor, 0);

    if (totalAbonado > cotizacionTotal) {
      return res.status(400).json({
        error: `El total abonado ($${totalAbonado.toLocaleString('es-CO')}) no puede superar el valor total de la cotización ($${cotizacionTotal.toLocaleString('es-CO')}).`,
      });
    }

    if (tipoPagoInput === 'completo' && cotizacionTotal > 0 && totalAbonado < cotizacionTotal) {
      return res.status(400).json({
        error: `Para pago completo, los abonos deben cubrir el 100% de la cotización ($${cotizacionTotal.toLocaleString('es-CO')}). Total abonado actual: $${totalAbonado.toLocaleString('es-CO')}.`,
      });
    }

    if (tipoPagoInput === 'parcial' && totalAbonado <= 0) {
      return res.status(400).json({
        error: 'En modalidad de abono parcial debes registrar al menos un abono mayor a $0.',
      });
    }

    if (tipoPagoInput === 'parcial' && cotizacionTotal > 0 && totalAbonado >= cotizacionTotal) {
      return res.status(400).json({
        error: 'Los abonos cubren el 100% de la cotización. Selecciona la modalidad "Pago completo".',
      });
    }

    const saldoPendiente = Math.max(0, cotizacionTotal - totalAbonado);
    const estadoPago = cotizacionTotal > 0 && saldoPendiente === 0 ? 'Pagado' : (totalAbonado > 0 ? 'Abono parcial' : 'Pendiente de pago');

    const fechaSol = formatearFechaHoy();
    const archRef = Array.isArray(req.body.archivosReferencia)
      ? req.body.archivosReferencia
      : (Array.isArray(req.body.archivos_referencia) ? req.body.archivos_referencia : []);
    const prioridad = req.body.prioridad || 'Media';
    const metodoEntrega = req.body.metodoEntrega || req.body.metodo_entrega || 'Domicilio';
    const acabados = Array.isArray(req.body.acabados)
      ? req.body.acabados.join(', ')
      : (req.body.acabados || 'Corte y empaque estándar');

    const ins = await pool.query(
      `INSERT INTO solicitudes (
        codigo, cliente_id, ejecutiva_id, descripcion, estado,
        producto, cantidad, dimensiones, material,
        prioridad, metodo_entrega, acabados,
        fecha_solicitud, fecha_entrega, presupuesto,
        requerimientos, observaciones, motivo_rechazo, archivos_referencia,
        cotizacion_total, estado_pago, total_abonado, saldo_pendiente, tipo_pago, pagos
      ) VALUES ($1,$2,$3,$4,'pendiente',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'',$17::jsonb,$18,$19,$20,$21,$22,$23::jsonb)
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
        prioridad,
        metodoEntrega,
        acabados,
        fechaSol,
        fechaEntrega || fechaSol,
        presNum,
        requerimientos || '',
        observaciones || '',
        JSON.stringify(archRef),
        cotizacionTotal,
        estadoPago,
        totalAbonado,
        saldoPendiente,
        tipoPagoInput,
        JSON.stringify(pagosValidados),
      ]
    );

    const solicitudId = ins.rows[0].id;

    for (const p of pagosValidados) {
      await pool.query(
        `INSERT INTO pagos_registro (
          codigo, solicitud_id, cliente_id, valor, metodo_pago, referencia, soporte_nota,
          fecha_pago, hora_pago, registrado_por, tipo_documento
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          p.id,
          solicitudId,
          cli.id,
          p.valor,
          p.metodo || 'efectivo',
          p.referencia || null,
          p.soporte || null,
          p.fecha || formatearFechaBogota(),
          p.hora || formatearHoraBogota(),
          ejec.id,
          'Recibo de caja interno (No constituye factura electrónica)',
        ]
      );
    }

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

    if (!['pendiente', 'devuelta'].includes(sol.estado)) {
      return res.status(409).json({
        error: `La solicitud ${sol.codigo || sol.id} ya se encuentra en estado '${sol.estado}' y no puede enviarse nuevamente a validación.`,
      });
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

    if (['aprobada', 'convertida', 'rechazada'].includes(sol.estado)) {
      return res.status(409).json({
        error: `La solicitud ${sol.codigo || sol.id} ya se encuentra en estado '${sol.estado}' y no puede devolverse.`,
      });
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

const corregirSolicitud = async (req, res) => {
  const { id } = req.params;
  const {
    producto,
    cantidad,
    dimensiones,
    material,
    acabados,
    metodoEntrega,
    metodo_entrega,
    fechaEntrega,
    fecha_entrega,
    presupuesto,
    requerimientos,
    observaciones,
  } = req.body;

  try {
    const sol = await resolverSolicitud(pool, id, true);
    if (!sol) {
      return res.status(404).json({ error: `Solicitud ${id} no encontrada.` });
    }

    if (sol.estado !== 'devuelta') {
      return res.status(400).json({
        error: `Solo pueden corregirse solicitudes en estado "Devuelta para corrección". Estado actual: "${ESTADO_DB_TO_UI[sol.estado] || sol.estado}".`,
      });
    }

    // Validaciones de negocio en backend
    if (!producto || !String(producto).trim()) {
      return res.status(400).json({ error: 'El producto es obligatorio.' });
    }
    const cantNum = Number(cantidad);
    if (!cantNum || cantNum <= 0 || !Number.isInteger(cantNum)) {
      return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor a 0.' });
    }
    const dimVal = String(dimensiones || '').trim();
    if (!dimVal) {
      return res.status(400).json({ error: 'Las dimensiones son obligatorias.' });
    }
    if (!validarDimensiones(dimVal)) {
      return res.status(400).json({ error: MENSAJE_ERROR_DIMENSIONES });
    }
    const matVal = String(material || '').trim();
    if (!matVal) {
      return res.status(400).json({ error: 'El material es obligatorio.' });
    }
    const fEntrega = String(fechaEntrega || fecha_entrega || '').trim();
    if (!fEntrega) {
      return res.status(400).json({ error: 'La fecha de entrega es obligatoria.' });
    }
    const presNum = Number(presupuesto);
    if (isNaN(presNum) || presNum < 0) {
      return res.status(400).json({ error: 'El presupuesto debe ser un número mayor o igual a 0.' });
    }

    const metodoFinal = String(metodoEntrega || metodo_entrega || sol.metodo_entrega || 'Domicilio').trim();
    const acabadosFinal = Array.isArray(acabados)
      ? acabados.join(', ')
      : String(acabados !== undefined ? acabados : (sol.acabados || 'Corte y empaque estándar')).trim();
    const reqFinal = requerimientos !== undefined ? String(requerimientos).trim() : (sol.requerimientos || '');
    const obsUsuario = observaciones !== undefined ? String(observaciones).trim() : String(sol.observaciones || '').trim();

    // Detectar campos modificados para el registro de trazabilidad
    const cambios = [];
    if (String(sol.producto || '').trim() !== String(producto).trim()) {
      cambios.push(`Producto: "${sol.producto || ''}" -> "${producto.trim()}"`);
    }
    if (Number(sol.cantidad) !== cantNum) {
      cambios.push(`Cantidad: ${sol.cantidad} -> ${cantNum}`);
    }
    if (String(sol.dimensiones || '').trim() !== dimVal) {
      cambios.push(`Dimensiones: "${sol.dimensiones || ''}" -> "${dimVal}"`);
    }
    if (String(sol.material || '').trim() !== matVal) {
      cambios.push(`Material: "${sol.material || ''}" -> "${matVal}"`);
    }
    if (String(sol.acabados || '').trim() !== acabadosFinal) {
      cambios.push(`Acabados: "${sol.acabados || ''}" -> "${acabadosFinal}"`);
    }
    if (String(sol.metodo_entrega || '').trim() !== metodoFinal) {
      cambios.push(`Método de entrega: "${sol.metodo_entrega || ''}" -> "${metodoFinal}"`);
    }
    if (String(sol.fecha_entrega || '').trim() !== fEntrega) {
      cambios.push(`Fecha de entrega: "${sol.fecha_entrega || ''}" -> "${fEntrega}"`);
    }
    if (Number(sol.presupuesto) !== presNum) {
      cambios.push(`Presupuesto: ${sol.presupuesto} -> ${presNum}`);
    }
    if (String(sol.requerimientos || '').trim() !== reqFinal) {
      cambios.push('Requerimientos técnicos ajustados');
    }

    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();
    const usuarioNombre = req.usuario?.nombre_completo || req.usuario?.nombre || req.usuario?.email || 'Ejecutiva comercial';
    const detalleCambios = cambios.length > 0 ? cambios.join('; ') : 'Especificaciones técnicas verificadas';
    const entradaTrazabilidad = `[${fechaHoy} ${horaAhora} - ${usuarioNombre}]: Solicitud corregida y reenviada a validación. Cambios: ${detalleCambios}.`;

    const observacionesFinales = obsUsuario
      ? `${obsUsuario}\n\n${entradaTrazabilidad}`
      : entradaTrazabilidad;

    const descripcion = `${producto.trim()} (${cantNum} uds)`;

    await pool.query(
      `UPDATE solicitudes
       SET
         producto = $1,
         cantidad = $2,
         dimensiones = $3,
         material = $4,
         acabados = $5,
         metodo_entrega = $6,
         fecha_entrega = $7,
         presupuesto = $8,
         requerimientos = $9,
         observaciones = $10,
         descripcion = $11,
         estado = 'en_validacion',
         motivo_rechazo = '',
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $12`,
      [
        producto.trim(),
        cantNum,
        dimVal,
        matVal,
        acabadosFinal,
        metodoFinal,
        fEntrega,
        presNum,
        reqFinal,
        observacionesFinales,
        descripcion,
        sol.id,
      ]
    );

    const data = await consultarSolicitudCompleta(pool, sol.id);
    res.json({
      message: `Solicitud ${data.id} corregida y reenviada a validación exitosamente.`,
      data,
    });
  } catch (error) {
    console.error('solicitudesController.corregirSolicitud error:', error.message);
    res.status(500).json({ error: 'Error al corregir y reenviar la solicitud.' });
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

    if (['aprobada', 'convertida', 'rechazada'].includes(sol.estado)) {
      return res.status(409).json({
        error: `La solicitud ${sol.codigo || sol.id} ya se encuentra en estado '${sol.estado}' y no puede rechazarse.`,
      });
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

    const metodoEntregaOrd = sol.metodo_entrega || 'Domicilio';
    const acabadosOrd = sol.acabados || 'Corte y empaque estándar';
    const prioridadOrd = ['Alta', 'Media', 'Baja'].includes(sol.prioridad) ? sol.prioridad : 'Media';

    const entregaJson = {
      direccion: cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || 'Bogotá'}` : 'Sede comercial, Bogotá',
      metodo: metodoEntregaOrd,
      contacto: cliente.contacto_principal || cliente.empresa,
    };

    const presNum = Number(sol.presupuesto || sol.cotizacion_total || 0);
    const cotizacionTotalOrd = Number(sol.cotizacion_total || presNum);
    const totalAbonadoOrd = Number(sol.total_abonado || 0);
    const saldoPendienteOrd = Number(sol.saldo_pendiente != null ? sol.saldo_pendiente : Math.max(0, cotizacionTotalOrd - totalAbonadoOrd));
    const estadoPagoOrd = sol.estado_pago || (totalAbonadoOrd > 0 ? (saldoPendienteOrd === 0 ? 'Pagado' : 'Abono parcial') : 'Pendiente de pago');
    const tipoPagoOrd = sol.tipo_pago || 'sin_pago';
    const pagosOrd = Array.isArray(sol.pagos) ? sol.pagos : [];

    const archRef = Array.isArray(sol.archivos_referencia) ? sol.archivos_referencia : [];
    const tieneArteCliente = archRef.some((a) => a && a.esArteCliente === true);
    const disenoEstadoOrd = tieneArteCliente ? 'Revisión técnica de archivo' : 'En diseño';

    const insOrd = await client.query(
      `INSERT INTO ordenes (
        cliente_id, producto, ejecutiva_id, disenador_id, produccion_id,
        etapa, prioridad, porcentaje_avance, bloqueado,
        solicitud_codigo, cantidad, material, dimensiones, colores, acabados,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        responsable_nombre, disenador_nombre_asignado, presupuesto, costo_interno,
        metodo_entrega, requerimientos, observaciones, entrega_json, archivos_referencia,
        cotizacion_total, estado_pago, total_abonado, saldo_pendiente, tipo_pago, pagos
      ) VALUES (
        $1,$2,$3,$4,NULL,
        1,$17::prioridad_orden,12.50,false,
        $5,$6,$7,$8,'Por definir en pre-prensa',$18,
        $9,$10,'Diseño',$26,
        'María López','María López',$11,$12,
        $19,$13,$14,$15,$16::jsonb,
        $20,$21,$22,$23,$24,$25::jsonb
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
        JSON.stringify(archRef),
        prioridadOrd,
        acabadosOrd,
        metodoEntregaOrd,
        cotizacionTotalOrd,
        estadoPagoOrd,
        totalAbonadoOrd,
        saldoPendienteOrd,
        tipoPagoOrd,
        JSON.stringify(pagosOrd),
        disenoEstadoOrd,
      ]
    );

    const nuevaOrdenRow = insOrd.rows[0];
    const codigoOrden = `OP-2026-${String(nuevaOrdenRow.id).padStart(4, '0')}`;
    await client.query('UPDATE ordenes SET codigo = $1 WHERE id = $2', [codigoOrden, nuevaOrdenRow.id]);

    // Si el cliente suministró el arte, registrar la versión 1 en archivos_arte para revisión técnica
    if (tieneArteCliente) {
      const arteCliente = archRef.find((a) => a && a.esArteCliente === true) || archRef[0];
      const nomArchCliente = arteCliente.nombre || 'Arte_Suministrado_Cliente.pdf';
      const rutaArchCliente = arteCliente.url || arteCliente.dataUrl || `uploads/${nomArchCliente}`;
      await client.query(
        `INSERT INTO archivos_arte (
          orden_id, numero_version, ruta_archivo, archivo_nombre, creador_id,
          comentario, estado_aprobacion, estado_ui, fecha_texto, disenador_nombre,
          gestion_comercial_estado, soporte_validado
        ) VALUES ($1, 1, $2, $3, $4, $5, 'pendiente', 'Revisión técnica de archivo', $6, $7, 'en_diseno', false)`,
        [
          nuevaOrdenRow.id,
          rutaArchCliente,
          nomArchCliente,
          disenador ? disenador.id : sol.ejecutiva_id,
          'Arte final suministrado por el cliente. Requiere revisión técnica de pre-prensa antes de autorizar impresión.',
          formatearFechaHoy(),
          disenador ? disenador.nombre_completo : 'María López',
        ]
      );
    }

    // Asociar recibos de caja a la orden generada
    await client.query('UPDATE pagos_registro SET orden_id = $1 WHERE solicitud_id = $2', [nuevaOrdenRow.id, sol.id]);

    // Vincular hilos de comunicación del cliente sin orden asignada para mantener continuidad Cliente -> Solicitud -> Orden
    await client.query(
      'UPDATE canales_contacto SET orden_id = $1 WHERE cliente_id = $2 AND orden_id IS NULL',
      [nuevaOrdenRow.id, sol.cliente_id]
    );

    // Actualizar solicitud con el vínculo a la orden creada
    await client.query(
      "UPDATE solicitudes SET estado = 'aprobada', orden_id = $1, motivo_rechazo = '' WHERE id = $2",
      [nuevaOrdenRow.id, sol.id]
    );

    // Registrar los 3 eventos iniciales en la bitácora inmutable registro_sesion
    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();
    const codSol = sol.codigo || sol.id;
    const actorSolId = req.usuario?.id || sol.ejecutiva_id;
    const actorSolNombre = req.usuario?.nombre_completo || 'Equipo Comercial';

    const textoEventoOrden = tieneArteCliente
      ? `Orden generada desde solicitud ${codSol} (Modalidad: Arte suministrado por el cliente · Requiere revisión técnica de pre-prensa)`
      : `Orden generada desde solicitud ${codSol} (Modalidad: Elaboración de diseño por Huellas)`;
    const textoEventoTarea = tieneArteCliente
      ? 'Actividad de pre-prensa asignada: revisión técnica de archivo a María López'
      : 'Actividad asignada: propuesta gráfica a María López';

    await client.query(
      `INSERT INTO registro_sesion (orden_id, usuario_responsable_id, accion_texto, fecha_texto, hora_texto, responsable_nombre, estado_evento, interno)
       VALUES
         ($1, $2, $3, $4, $5, 'Ana Martínez', 'Completado', false),
         ($1, $6, $7, $4, $5, $8, 'Completado', false),
         ($1, $6, $9, $4, $5, $8, 'Completado', true)`,
      [
        nuevaOrdenRow.id,
        sol.ejecutiva_id,
        `Solicitud ${codSol} registrada en comercial`,
        fechaHoy,
        horaAhora,
        actorSolId,
        textoEventoOrden,
        actorSolNombre,
        textoEventoTarea,
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
  corregirSolicitud,
  rechazarSolicitud,
  validarSolicitud,
};
