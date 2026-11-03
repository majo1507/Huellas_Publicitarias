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

function formatearCasoPostventa(pv) {
  const ordenCodigo = pv.orden_codigo || `OP-2026-${String(pv.orden_id).padStart(4, '0')}`;
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
    tipo: pv.tipo,
    prioridad: pv.prioridad || 'Media',
    fecha: pv.fecha_texto || formatearFechaHoy(new Date(pv.created_at)),
    descripcion: pv.descripcion || '',
    responsable: pv.responsable_nombre !== null && pv.responsable_nombre !== undefined ? pv.responsable_nombre : '',
    estado: pv.estado || 'Abierto',
    solucion: pv.solucion || '',
    fechaSolucion: pv.fecha_solucion || null,
    resueltoPor: pv.resuelto_por || null,
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
    nivel_conformidad,
    calificacion,
    descripcion,
    prioridad,
    responsable,
  } = req.body;

  if (!targetOrden || !tipo) {
    return res.status(400).json({
      error: 'Campos obligatorios: orden_id/ordenId y tipo (Ajuste, Garantía, Reclamo, Comentario, Reimpresión).',
    });
  }

  const tiposPermitidos = ['Ajuste', 'Garantía', 'Reclamo', 'Comentario', 'Reimpresión'];
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({
      error: `Tipo de postventa no válido. Opciones: ${tiposPermitidos.join(', ')}`,
    });
  }

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
    if (req.file) {
      const rutaRelativa = `uploads/${req.file.filename}`;
      archivoInfo = {
        nombre_original: req.file.originalname,
        archivo: rutaRelativa,
        url: `/${rutaRelativa}`,
      };
      descripcionFinal = descripcionFinal
        ? `${descripcionFinal} [Adjunto: ${rutaRelativa}]`
        : `[Adjunto: ${rutaRelativa}]`;
    }

    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM postventa');
    const nuevoNum = countRes.rows[0].total + 1;
    const codigo = req.body.id || req.body.codigo || `CAS-${String(nuevoNum).padStart(3, '0')}`;
    const fechaHoy = formatearFechaHoy();

    const insertRes = await client.query(
      `INSERT INTO postventa (
        codigo, orden_id, ejecutiva_id, tipo, nivel_conformidad, descripcion,
        fecha_texto, responsable_nombre, estado, prioridad, solucion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Abierto', $9, '')
      RETURNING *`,
      [
        codigo,
        orden.id,
        ejec.id,
        tipo,
        califInt,
        descripcionFinal || null,
        fechaHoy,
        responsable || '',
        prioridad || 'Media',
      ]
    );

    const autorNombre = req.usuario?.nombre_completo || ejec.nombre_completo;
    const autorId = (req.usuario?.id && req.usuario.rol !== 'cliente') ? req.usuario.id : ejec.id;

    await client.query(
      `INSERT INTO registro_sesion (
        orden_id, usuario_responsable_id, accion_texto,
        fecha_texto, hora_texto, responsable_nombre, estado_evento, interno, motivo
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente', false, $7)`,
      [
        orden.id,
        autorId,
        `Caso de postventa ${codigo} registrado (${tipo}): ${descripcionFinal}`,
        fechaHoy,
        formatearHoraAhora(),
        autorNombre,
        `Clasificación: ${tipo}`,
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

// Actualizar caso de postventa (asignar responsable, resolver caso, calificar atención)
const actualizarPostventa = async (req, res) => {
  const { estado, responsable, solucion, fechaSolucion, resueltoPor, calificacion, nivel_conformidad } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const actual = await resolverCaso(client, req.params.id);
    if (!actual) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Caso de postventa ${req.params.id} no encontrado.` });
    }

    const nuevoEstado = estado || (solucion ? 'Resuelto' : actual.estado);
    const nuevoResp = responsable !== undefined ? responsable : actual.responsable_nombre;
    const nuevaSol = solucion !== undefined ? solucion : actual.solucion;
    const nuevaFechaSol = fechaSolucion || (nuevoEstado === 'Resuelto' && !actual.fecha_solucion ? formatearFechaHoy() : actual.fecha_solucion);
    const nuevoResueltoPor = resueltoPor || (nuevoEstado === 'Resuelto' ? (req.usuario?.nombre_completo || 'Sofía Herrera') : actual.resuelto_por);

    const rawCalif = calificacion !== undefined ? calificacion : nivel_conformidad;
    const nuevaCalif = rawCalif !== undefined && rawCalif !== null ? parseInt(rawCalif, 10) : actual.nivel_conformidad;

    await client.query(
      `UPDATE postventa
       SET estado = $1,
           responsable_nombre = $2,
           solucion = $3,
           fecha_solucion = $4,
           resuelto_por = $5,
           nivel_conformidad = $6
       WHERE id = $7`,
      [nuevoEstado, nuevoResp, nuevaSol, nuevaFechaSol, nuevoResueltoPor, nuevaCalif, actual.id]
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
