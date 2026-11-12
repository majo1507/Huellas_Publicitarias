// ============================================================
// controllers/portalController.js — Portal Público Huellas Publicidad
// ============================================================
const { pool } = require('../db');
const { esUuid, formatearFechaHoy, formatearHoraAhora, obtenerUsuarioPorDefecto } = require('../utils/resolvers');

const ETAPAS_PUBLICAS = {
  0: { etapa: 0, nombre: 'Recepción', descripcion: 'Solicitud recibida y en validación de especificaciones técnicas' },
  1: { etapa: 1, nombre: 'Diseño', descripcion: 'Elaboración y preparación de la propuesta gráfica' },
  2: { etapa: 2, nombre: 'Aprobación de diseño', descripcion: 'Propuesta enviada al cliente para visto bueno' },
  3: { etapa: 3, nombre: 'Preprensa', descripcion: 'Preparación técnica de archivos para salida a máquinas' },
  4: { etapa: 4, nombre: 'Impresión', descripcion: 'Impresión en sustrato publicitario en taller' },
  5: { etapa: 5, nombre: 'Acabados', descripcion: 'Corte, confección, laminado, ojales o confección de acabados' },
  6: { etapa: 6, nombre: 'Control de calidad', descripcion: 'Inspección de nitidez de color, dimensiones y terminados' },
  7: { etapa: 7, nombre: 'Despacho', descripcion: 'Embalado y en ruta de entrega o disponible para retiro' },
  8: { etapa: 8, nombre: 'Entregada', descripcion: 'Pedido entregado a conformidad' },
};

function calcularProgresoPublico(etapa) {
  const p = Math.min(Math.max(etapa, 0), 8);
  return Math.round((p / 8) * 100);
}

/**
 * Consulta pública de orden
 * Requiere: codigo_orden y un dato de verificación (telefono o email o nit)
 * Evita enumeración masiva forzando verificación dual.
 */
const consultarPedidoPublico = async (req, res) => {
  const { codigo_orden, verificacion } = req.body;

  if (!codigo_orden || !verificacion) {
    return res.status(400).json({
      error: 'Por seguridad, debes ingresar el número de orden y tu dato de contacto registrado (teléfono, correo o documento/NIT).',
    });
  }

  const cod = String(codigo_orden).trim().toUpperCase();
  const verif = String(verificacion).trim().toLowerCase().replace(/[^a-z0-9@.]/g, '');

  try {
    const query = `
      SELECT
        o.id,
        o.codigo,
        o.producto,
        o.cantidad,
        o.dimensiones,
        o.etapa,
        o.estado_nombre,
        o.fecha_solicitud,
        o.fecha_entrega,
        o.archivado,
        c.empresa AS cliente_nombre,
        c.telefono AS cliente_telefono,
        c.nit AS cliente_nit,
        c.contacto_principal
      FROM ordenes o
      INNER JOIN clientes c ON o.cliente_id = c.id
      WHERE (UPPER(o.codigo) = $1 OR o.id::text = $1)
        AND COALESCE(o.archivado, false) = false
      LIMIT 1;
    `;
    const result = await pool.query(query, [cod]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'No se encontró ninguna orden activa con el número suministrado o no coincide con los registros.',
      });
    }

    const row = result.rows[0];

    // Validación de seguridad (verificación contra teléfono, NIT o nombre)
    const telLimpio = String(row.cliente_telefono || '').replace(/\D/g, '');
    const nitLimpio = String(row.cliente_nit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const verifLimpiaDigitos = verif.replace(/\D/g, '');

    const coincideTel = verifLimpiaDigitos.length >= 7 && telLimpio.includes(verifLimpiaDigitos.slice(-7));
    const coincideNit = nitLimpio.length >= 4 && (nitLimpio.includes(verif) || verif.includes(nitLimpio));

    // También permitir verificación si coincide con un email de la empresa en clientes
    const queryEmail = await pool.query(
      `SELECT id FROM clientes WHERE id = (SELECT cliente_id FROM ordenes WHERE id = $1) AND LOWER(contacto_principal) LIKE $2`,
      [row.id, `%${verif}%`]
    );

    if (!coincideTel && !coincideNit && queryEmail.rowCount === 0) {
      return res.status(403).json({
        error: 'El dato de verificación (teléfono, NIT o contacto) no coincide con el cliente titular de la orden.',
      });
    }

    const etapaInfo = ETAPAS_PUBLICAS[row.etapa] || ETAPAS_PUBLICAS[0];

    // Respuesta sanitizada: SIN costos internos, presupuestos, notas privadas ni IDs internos
    res.json({
      success: true,
      orden: {
        codigo: row.codigo,
        cliente: row.cliente_nombre,
        producto: row.producto,
        cantidad: row.cantidad,
        dimensiones: row.dimensiones || null,
        fechaSolicitud: row.fecha_solicitud,
        fechaEntregaEstimada: row.fecha_entrega,
        etapaActual: etapaInfo.nombre,
        descripcionEtapa: etapaInfo.descripcion,
        numeroEtapa: row.etapa,
        porcentajeAvance: calcularProgresoPublico(row.etapa),
        estado: row.etapa >= 8 ? 'Entregado' : 'En producción',
      },
    });
  } catch (err) {
    console.error('portalController.consultarPedidoPublico error:', err.message);
    res.status(500).json({ error: 'Error al consultar el pedido en el portal.' });
  }
};

/**
 * Radicación pública de PQRSF y Garantías
 * No exige login administrativo. Crea el radicado en la tabla `postventa`.
 */
const radicarPqrsfPublico = async (req, res) => {
  const {
    nombre_contacto,
    email,
    telefono,
    tipo,
    codigo_orden,
    descripcion,
  } = req.body;

  if (!nombre_contacto || !email || !tipo || !descripcion) {
    return res.status(400).json({
      error: 'Por favor completa todos los campos obligatorios: nombre, correo, tipo de solicitud y descripción.',
    });
  }

  const tiposPermitidos = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación', 'Garantía'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo de solicitud no válido. Opciones: ${tiposPermitidos.join(', ')}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolver orden si fue ingresada
    let ordenRow = null;
    if (codigo_orden && String(codigo_orden).trim()) {
      const codLimpio = String(codigo_orden).trim().toUpperCase();
      const ordRes = await client.query(
        `SELECT id, codigo, cliente_id, ejecutiva_id FROM ordenes WHERE (UPPER(codigo) = $1 OR id::text = $1) LIMIT 1`,
        [codLimpio]
      );
      if (ordRes.rowCount > 0) {
        ordenRow = ordRes.rows[0];
      }
    }

    // 2. Asociar o resolver cliente
    let clienteId = ordenRow ? ordenRow.cliente_id : null;
    let ejecutivaId = ordenRow ? ordenRow.ejecutiva_id : null;

    if (!clienteId) {
      const emailLimpio = String(email).trim().toLowerCase();
      const telLimpio = String(telefono || '').replace(/\D/g, '').slice(-8);
      const clRes = await client.query(
        `SELECT id, ejecutiva_id FROM clientes 
         WHERE LOWER(contacto_principal) LIKE $1 
            OR (telefono IS NOT NULL AND REGEXP_REPLACE(telefono, '[^0-9]', '', 'g') LIKE $2)
         LIMIT 1`,
        [`%${emailLimpio}%`, `%${telLimpio}%`]
      );
      if (clRes.rowCount > 0) {
        clienteId = clRes.rows[0].id;
        ejecutivaId = clRes.rows[0].ejecutiva_id;
      }
    }

    // Si aún no hay ejecutiva, asignar la ejecutiva comercial por defecto
    if (!ejecutivaId) {
      const defaultEjec = await obtenerUsuarioPorDefecto(client, 'ejecutiva');
      ejecutivaId = defaultEjec ? defaultEjec.id : null;
    }

    // Si no hay orden asociada pero la tabla postventa exige orden_id, buscar una orden de referencia o asociar
    let finalOrdenId = ordenRow ? ordenRow.id : null;
    if (!finalOrdenId) {
      // Buscar la primera orden del cliente o una orden global de soporte
      const primerOrdRes = await client.query(`SELECT id FROM ordenes LIMIT 1`);
      if (primerOrdRes.rowCount > 0) {
        finalOrdenId = primerOrdRes.rows[0].id;
      }
    }

    // 3. Generar número de radicado único
    const anio = new Date().getFullYear();
    const countRes = await client.query(`SELECT COUNT(*)::int AS total FROM postventa WHERE EXTRACT(YEAR FROM created_at) = $1`, [anio]);
    const consecutivo = countRes.rows[0].total + 1;
    const prefijo = tipo === 'Garantía' ? 'GAR' : 'RAD';
    const radicado = `${prefijo}-${anio}-${String(consecutivo).padStart(4, '0')}`;

    const fechaHoy = formatearFechaHoy();
    const horaAhora = formatearHoraAhora();

    const evidenciasList = [];
    if (req.file) {
      const rutaRelativa = `uploads/${req.file.filename}`;
      evidenciasList.push({
        id: `EV-PUB-${Date.now()}`,
        nombre: req.file.originalname,
        tipo: req.file.mimetype || 'application/octet-stream',
        url: `/${rutaRelativa}`,
        fecha: fechaHoy,
      });
    }

    const historialInicial = [
      {
        fecha: fechaHoy,
        hora: horaAhora,
        autor: `Cliente: ${nombre_contacto} (Portal Web)`,
        estado: 'Recibido',
        accion: `Radicación pública de ${tipo} por portal web`,
        detalle: descripcion.trim(),
      },
    ];

    const categoria = tipo === 'Garantía' ? 'Garantía' : 'PQRSF';

    // Insertar en la tabla postventa
    const insertRes = await client.query(`
      INSERT INTO postventa (
        orden_id, ejecutiva_id, tipo, categoria, subtipo, motivo,
        descripcion, prioridad, estado, radicado, canal, email_contacto,
        telefono_contacto, evidencias, historial, archivado
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, 'Media', 'Abierto', $8, 'Portal Web', $9,
        $10, $11, $12, false
      ) RETURNING id, radicado, created_at;
    `, [
      finalOrdenId,
      ejecutivaId,
      tipo,
      categoria,
      tipo,
      `Radicación Portal Web: ${tipo}`,
      descripcion.trim(),
      radicado,
      email.trim().toLowerCase(),
      telefono ? telefono.trim() : null,
      JSON.stringify(evidenciasList),
      JSON.stringify(historialInicial)
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      mensaje: 'Tu solicitud ha sido radicada formalmente ante Huellas Publicidad.',
      radicado: insertRes.rows[0].radicado,
      fechaRadicacion: fechaHoy,
      horaRadicacion: horaAhora,
      tipo,
      instrucciones: 'Guarda tu número de radicado para realizar consultas en cualquier momento en este mismo portal o vía WhatsApp.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('portalController.radicarPqrsfPublico error:', err.message);
    res.status(500).json({ error: 'No se pudo radicar la solicitud en este momento. Intenta nuevamente.' });
  } finally {
    client.release();
  }
};

/**
 * Consulta de radicado PQRSF / Garantía
 * Requiere: radicado y correo de verificación
 */
const consultarRadicadoPublico = async (req, res) => {
  const { radicado, email } = req.body;

  if (!radicado || !email) {
    return res.status(400).json({
      error: 'Ingresa el número de radicado y el correo electrónico con el que realizaste el registro.',
    });
  }

  const radLimpio = String(radicado).trim().toUpperCase();
  const emailLimpio = String(email).trim().toLowerCase();

  try {
    const query = `
      SELECT
        pv.id,
        pv.radicado,
        pv.tipo,
        pv.categoria,
        pv.subtipo,
        pv.motivo,
        pv.estado,
        pv.respuesta_cliente,
        pv.solucion,
        pv.dictamen_garantia,
        pv.created_at,
        pv.fecha_solucion,
        pv.email_contacto,
        o.codigo AS orden_codigo
      FROM postventa pv
      LEFT JOIN ordenes o ON pv.orden_id = o.id
      WHERE (UPPER(pv.radicado) = $1 OR UPPER(pv.codigo) = $1 OR pv.id::text = $1)
        AND (LOWER(pv.email_contacto) = $2 OR pv.email_contacto IS NULL)
      LIMIT 1;
    `;
    const result = await pool.query(query, [radLimpio, emailLimpio]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'No se encontró ninguna solicitud con ese radicado y correo asociado.',
      });
    }

    const row = result.rows[0];

    res.json({
      success: true,
      caso: {
        radicado: row.radicado || radLimpio,
        tipo: row.tipo || row.categoria,
        motivo: row.motivo,
        estado: row.estado,
        ordenRelacionada: row.orden_codigo || 'N/A',
        fechaRadicacion: formatearFechaHoy(new Date(row.created_at)),
        dictamenGarantia: row.categoria === 'Garantía' ? (row.dictamen_garantia || 'En evaluación técnica') : null,
        respuestaComercial: row.respuesta_cliente || row.solucion || 'Tu solicitud se encuentra en atención activa por nuestro equipo de Postventa.',
        fechaSolucion: row.fecha_solucion ? formatearFechaHoy(new Date(row.fecha_solucion)) : null,
      },
    });
  } catch (err) {
    console.error('portalController.consultarRadicadoPublico error:', err.message);
    res.status(500).json({ error: 'Error al consultar el radicado.' });
  }
};

module.exports = {
  consultarPedidoPublico,
  radicarPqrsfPublico,
  consultarRadicadoPublico,
};
