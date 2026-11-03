const { pool } = require('../db');
const {
  esUuid,
  resolverOrden,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  formatearFechaHoy,
  formatearHoraAhora,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');

function mapTareaRow(row) {
  return {
    id: row.codigo || String(row.id),
    dbId: row.id,
    codigo: row.codigo || String(row.id),
    ordenId: row.orden_codigo || (row.orden_id ? String(row.orden_id) : ''),
    orden_id: row.orden_id,
    actividad: row.titulo,
    titulo: row.titulo,
    etapa: row.etapa || 'Impresión',
    responsable: row.responsable_nombre || row.owner_nombre || 'Sin asignar',
    owner_id: row.owner_id,
    prioridad: row.prioridad || 'Media',
    fechaLimite: row.fecha_limite || '',
    estado: row.estado || 'Pendiente',
    pct: Number(row.porcentaje ?? 0),
    porcentaje: Number(row.porcentaje ?? 0),
    deps: Array.isArray(row.dependencias) ? row.dependencias : [],
    notas: Array.isArray(row.notas) ? row.notas : [],
    incidencias: Array.isArray(row.incidencias) ? row.incidencias : [],
  };
}

async function fetchTareaByIdOrCodigo(identificador, db = pool) {
  const str = String(identificador).trim();
  const byUuid = esUuid(str);
  const { rows } = await db.query(
    `SELECT t.*, o.codigo AS orden_codigo, u.nombre_completo AS owner_nombre
     FROM tareas t
     LEFT JOIN ordenes o ON t.orden_id = o.id
     LEFT JOIN usuarios u ON t.owner_id = u.id
     WHERE ${byUuid ? 't.id = $1' : 't.codigo = $1'}
     LIMIT 1`,
    [str]
  );
  return rows[0] || null;
}

async function resolveActor(req, client) {
  if (req.usuario?.id && req.usuario.rol !== 'cliente') {
    const usr = await resolverUsuario(client, req.usuario.id);
    if (usr) return usr;
  }
  return obtenerUsuarioPorDefecto(client, 'produccion');
}

const listarTareas = async (req, res) => {
  try {
    const { orden_id, estado } = req.query;
    const filtros = [];
    const valores = [];

    if (orden_id) {
      const ord = await resolverOrden(pool, orden_id);
      if (!ord) return res.json({ total: 0, data: [] });
      valores.push(ord.id);
      filtros.push(`t.orden_id = $${valores.length}`);
    }
    if (estado) {
      valores.push(estado);
      filtros.push(`t.estado = $${valores.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT t.*, o.codigo AS orden_codigo, u.nombre_completo AS owner_nombre
       FROM tareas t
       LEFT JOIN ordenes o ON t.orden_id = o.id
       LEFT JOIN usuarios u ON t.owner_id = u.id
       ${where}
       ORDER BY COALESCE(t.codigo, t.id::text) ASC`,
      valores
    );

    res.json({ total: rows.length, data: rows.map(mapTareaRow) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const asignarTarea = async (req, res) => {
  const { id } = req.params;
  const { responsable } = req.body;

  if (!responsable || !String(responsable).trim()) {
    return res.status(400).json({ error: 'Debes indicar el responsable a asignar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tarea = await fetchTareaByIdOrCodigo(id, client);
    if (!tarea) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const usr = await resolverUsuario(client, responsable);
    const nombreResp = usr ? usr.nombre_completo : String(responsable).trim();

    await client.query(
      `UPDATE tareas
       SET owner_id = $1,
           responsable_nombre = $2
       WHERE id = $3`,
      [usr ? usr.id : tarea.owner_id, nombreResp, tarea.id]
    );

    const actor = await resolveActor(req, client);
    if (tarea.orden_id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', true)`,
        [
          tarea.orden_id,
          actor.id,
          `Actividad "${tarea.titulo}": responsable asignado a ${nombreResp}`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          req.usuario?.nombre_completo || actor.nombre_completo,
        ]
      );
    }

    await client.query('COMMIT');
    const actualizada = await fetchTareaByIdOrCodigo(tarea.id);
    const [ordenCompleta] = tarea.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [tarea.orden_id])
      : [null];

    res.json({
      mensaje: `Actividad asignada a ${nombreResp}.`,
      data: mapTareaRow(actualizada),
      orden: ordenCompleta,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const ejecutarAccionTarea = async (req, res) => {
  const { id } = req.params;
  const { accion } = req.body;

  const map = {
    iniciar: { estado: 'En proceso', pct: (p) => Math.max(Number(p) || 0, 15), verbo: 'iniciada' },
    pausar: { estado: 'Pausada', pct: (p) => Number(p) || 0, verbo: 'pausada' },
    finalizar: { estado: 'Finalizada', pct: () => 100, verbo: 'finalizada' },
  };

  const c = map[accion];
  if (!c) {
    return res.status(400).json({ error: 'Acción inválida. Usa iniciar, pausar o finalizar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tarea = await fetchTareaByIdOrCodigo(id, client);
    if (!tarea) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const nuevoPct = c.pct(tarea.porcentaje);
    await client.query(
      `UPDATE tareas
       SET estado = $1,
           porcentaje = $2
       WHERE id = $3`,
      [c.estado, nuevoPct, tarea.id]
    );

    const actor = await resolveActor(req, client);
    if (tarea.orden_id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          tarea.orden_id,
          actor.id,
          `Tarea "${tarea.titulo}" ${c.verbo}`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          req.usuario?.nombre_completo || actor.nombre_completo,
          c.estado,
        ]
      );
    }

    await client.query('COMMIT');
    const actualizada = await fetchTareaByIdOrCodigo(tarea.id);
    const [ordenCompleta] = tarea.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [tarea.orden_id])
      : [null];

    res.json({
      mensaje: `Actividad "${tarea.titulo}" ${c.verbo}.`,
      data: mapTareaRow(actualizada),
      orden: ordenCompleta,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const actualizarAvanceTarea = async (req, res) => {
  const { id } = req.params;
  const { estado, pct, porcentaje } = req.body;
  const rawPct = pct !== undefined ? pct : porcentaje;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tarea = await fetchTareaByIdOrCodigo(id, client);
    if (!tarea) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const numPct = Math.max(0, Math.min(100, Number(rawPct ?? tarea.porcentaje ?? 0)));
    const targetEstado = estado || tarea.estado;

    if (targetEstado === 'Pendiente' && numPct > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Una actividad en estado Pendiente debe tener 0% de avance, o cambia su estado a En proceso.',
      });
    }
    if (targetEstado === 'Finalizada' && numPct < 100) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Para marcar la actividad como Finalizada el avance debe ser 100%.',
      });
    }

    const finalEstado = numPct === 100 ? 'Finalizada' : targetEstado;
    const finalPct = finalEstado === 'Pendiente' ? 0 : finalEstado === 'Finalizada' ? 100 : numPct;

    await client.query(
      `UPDATE tareas
       SET estado = $1,
           porcentaje = $2
       WHERE id = $3`,
      [finalEstado, finalPct, tarea.id]
    );

    const actor = await resolveActor(req, client);
    if (tarea.orden_id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          tarea.orden_id,
          actor.id,
          `Avance en actividad "${tarea.titulo}": ${finalEstado} (${finalPct}%)`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          req.usuario?.nombre_completo || actor.nombre_completo,
          finalEstado,
        ]
      );
    }

    await client.query('COMMIT');
    const actualizada = await fetchTareaByIdOrCodigo(tarea.id);
    const [ordenCompleta] = tarea.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [tarea.orden_id])
      : [null];

    res.json({
      mensaje: `Avance actualizado: ${finalEstado} (${finalPct}%).`,
      data: mapTareaRow(actualizada),
      orden: ordenCompleta,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const agregarNotaTarea = async (req, res) => {
  const { id } = req.params;
  const { texto, esIncidencia } = req.body;

  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'Escribe el detalle de la nota o incidencia.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tarea = await fetchTareaByIdOrCodigo(id, client);
    if (!tarea) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const actor = await resolveActor(req, client);
    const autorNombre = req.usuario?.nombre_completo || actor?.nombre_completo || tarea.responsable_nombre || 'Operario';
    const item = {
      fecha: formatearFechaHoy(),
      hora: formatearHoraAhora(),
      texto: String(texto).trim(),
      autor: autorNombre,
    };

    const notasActuales = Array.isArray(tarea.notas) ? tarea.notas : [];
    const incActuales = Array.isArray(tarea.incidencias) ? tarea.incidencias : [];

    const nuevasNotas = esIncidencia ? notasActuales : [...notasActuales, item];
    const nuevasInc = esIncidencia ? [...incActuales, item] : incActuales;

    await client.query(
      `UPDATE tareas
       SET notas = $1::jsonb,
           incidencias = $2::jsonb
       WHERE id = $3`,
      [JSON.stringify(nuevasNotas), JSON.stringify(nuevasInc), tarea.id]
    );

    if (tarea.orden_id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, 'Pendiente', true)`,
        [
          tarea.orden_id,
          actor.id,
          `${esIncidencia ? 'Incidencia' : 'Observación'} en "${tarea.titulo}": ${String(texto).trim()}`,
          item.fecha,
          item.hora,
          autorNombre,
        ]
      );
    }

    await client.query('COMMIT');
    const actualizada = await fetchTareaByIdOrCodigo(tarea.id);
    const [ordenCompleta] = tarea.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [tarea.orden_id])
      : [null];

    res.status(201).json({
      mensaje: esIncidencia ? 'Incidencia reportada.' : 'Nota técnica guardada.',
      data: mapTareaRow(actualizada),
      orden: ordenCompleta,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  listarTareas,
  asignarTarea,
  ejecutarAccionTarea,
  actualizarAvanceTarea,
  agregarNotaTarea,
};
