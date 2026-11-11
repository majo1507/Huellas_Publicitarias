const { pool } = require('../db');
const { normalizarRol } = require('../middleware/auth');
const {
  esUuid,
  resolverOrden,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  formatearFechaHoy,
  formatearHoraAhora,
  ETAPA_NUM_TO_NOMBRE_UI,
  ESTADO_UI_TO_ETAPA_NUM,
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
    // El propietario (owner_id) es la fuente de verdad; el nombre en texto es respaldo heredado
    responsable: row.owner_nombre || row.responsable_nombre || 'Sin asignar',
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

    // Operarios de taller consultan únicamente sus actividades asignadas
    const rolSolicitante = req.usuario?.rol_normalizado || normalizarRol(req.usuario?.rol);
    if (rolSolicitante === 'produccion' && req.usuario?.id) {
      valores.push(req.usuario.id);
      const idxOwner = valores.length;
      if (req.usuario.nombre_completo) {
        valores.push(req.usuario.nombre_completo);
        const idxNombre = valores.length;
        filtros.push(`(t.owner_id = $${idxOwner} OR (t.owner_id IS NULL AND t.responsable_nombre = $${idxNombre}))`);
      } else {
        filtros.push(`t.owner_id = $${idxOwner}`);
      }
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

    const rolNorm = req.usuario?.rol_normalizado || (req.usuario?.rol ? normalizarRol(req.usuario.rol) : '');
    if (['produccion', 'disenador'].includes(rolNorm)) {
      if (tarea.owner_id && tarea.owner_id !== req.usuario.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Acceso denegado: Solo puedes modificar o reportar avance sobre las tareas asignadas a tu usuario.',
        });
      }
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

/**
 * Valida si un usuario operativo (producción o diseñador) tiene permisos
 * para operar o modificar la actividad, garantizando aislamiento entre operarios.
 */
function verificarPropiedadTarea(tarea, req) {
  const rolNorm = req.usuario?.rol_normalizado || (req.usuario?.rol ? normalizarRol(req.usuario.rol) : '');
  if (['produccion', 'disenador'].includes(rolNorm)) {
    const idUsuarioReq = req.usuario?.id;
    const nombreUsuarioReq = req.usuario?.nombre_completo;
    const esPropietario =
      (tarea.owner_id && tarea.owner_id === idUsuarioReq) ||
      (!tarea.owner_id && tarea.responsable_nombre && tarea.responsable_nombre === nombreUsuarioReq);

    if (!esPropietario) {
      return {
        permitido: false,
        error: 'Acceso denegado: Solo puedes modificar o reportar avance sobre las tareas asignadas a tu usuario.',
      };
    }
  }
  return { permitido: true };
}

/**
 * Verifica si todas las actividades de la etapa actual de la orden están finalizadas al 100%
 * sin incidencias activas, y realiza la transición automática de etapa.
 * Se ejecuta de manera transaccional e idempotente dentro del mismo cliente PG.
 */
async function verificarYAvanzarEtapaAutomatica(client, ordenId, actor, req) {
  if (!ordenId) return null;

  // 1. Obtener orden con bloqueo pesimista FOR UPDATE
  const ordRes = await client.query(
    'SELECT id, codigo, etapa, estado_nombre, diseno_estado, bloqueado, producto FROM ordenes WHERE id = $1 FOR UPDATE',
    [ordenId]
  );
  if (ordRes.rowCount === 0) return null;
  const orden = ordRes.rows[0];

  if (orden.bloqueado) {
    return null; // La orden tiene un bloqueo preventivo activo
  }

  const estadoActualUi = orden.estado_nombre || ETAPA_NUM_TO_NOMBRE_UI[orden.etapa] || 'Impresión';

  // Solo se avanza automáticamente en etapas operativas de taller:
  // Impresión (4) -> Acabados (5) -> Despacho (7)
  const SIGUIENTE_ETAPA_TALLER = {
    Impresión: { siguienteNum: 5, siguienteUi: 'Acabados' },
    Acabados: { siguienteNum: 7, siguienteUi: 'Despacho' },
  };

  const configTransicion = SIGUIENTE_ETAPA_TALLER[estadoActualUi];
  if (!configTransicion) {
    return null;
  }

  // 2. Consultar actividades de esta orden en la etapa actual
  const tareasRes = await client.query(
    `SELECT t.*, u.nombre_completo AS owner_nombre
     FROM tareas t
     LEFT JOIN usuarios u ON t.owner_id = u.id
     WHERE t.orden_id = $1 AND t.etapa = $2
     FOR UPDATE OF t`,
    [orden.id, estadoActualUi]
  );

  if (tareasRes.rowCount === 0) {
    return null; // Si no hay actividades en esta etapa, no se avanza
  }

  const tareasEtapa = tareasRes.rows;

  // 3. REGLA ESTRICTA: Todas las actividades obligatorias deben estar Finalizadas al 100%
  const todasFinalizadas = tareasEtapa.every(
    (t) => t.estado === 'Finalizada' && Number(t.porcentaje) === 100
  );
  if (!todasFinalizadas) {
    return null; // Aún hay actividades en proceso, pausadas o menores al 100%
  }

  // 4. REGLA ESTRICTA: Comprobar que no existan incidencias activas sin resolver
  const tieneIncidenciasActivas = tareasEtapa.some((t) => {
    const incs = Array.isArray(t.incidencias) ? t.incidencias : [];
    return incs.some((inc) => inc && !inc.resuelto && !inc.resuelta);
  });

  if (tieneIncidenciasActivas) {
    return {
      bloqueadoPorIncidencia: true,
      mensaje: `Transición automática detenida: existen incidencias técnicas activas reportadas en ${estadoActualUi}.`,
    };
  }

  // 5. Transición automática a la siguiente etapa
  const { siguienteNum, siguienteUi } = configTransicion;
  const nuevoPorcentaje = parseFloat(((siguienteNum / 8) * 100).toFixed(2));

  await client.query(
    `UPDATE ordenes
     SET etapa = $1, estado_nombre = $2, porcentaje_avance = $3
     WHERE id = $4`,
    [siguienteNum, siguienteUi, nuevoPorcentaje, orden.id]
  );

  // 6. Actividades para la siguiente etapa:
  // Verificar si ya existen tareas para la siguiente etapa
  const tareasSiguienteRes = await client.query(
    `SELECT t.*, o.codigo AS orden_codigo, u.nombre_completo AS owner_nombre
     FROM tareas t
     LEFT JOIN ordenes o ON t.orden_id = o.id
     LEFT JOIN usuarios u ON t.owner_id = u.id
     WHERE t.orden_id = $1 AND t.etapa = $2`,
    [orden.id, siguienteUi]
  );

  let nuevasTareasGeneradas = [];

  // Si no existen actividades creadas para la siguiente etapa, crearlas y asignarlas al responsable correspondiente
  if (tareasSiguienteRes.rowCount === 0) {
    let operarioSiguiente = null;
    let nombreOperario = 'Pedro Morales';
    if (siguienteUi === 'Acabados') {
      operarioSiguiente = await resolverUsuario(client, 'pedro@huellaspublicidad.com');
      nombreOperario = operarioSiguiente ? operarioSiguiente.nombre_completo : 'Pedro Morales';
    } else if (siguienteUi === 'Despacho') {
      operarioSiguiente = await resolverUsuario(client, 'carlos@huellaspublicidad.com');
      nombreOperario = operarioSiguiente ? operarioSiguiente.nombre_completo : 'Carlos Mendoza';
    }

    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM tareas');
    const codigoNuevaTarea = `T-${countRes.rows[0].total + 1}`;
    const tituloNuevaTarea = siguienteUi === 'Acabados'
      ? 'Corte, refilado y acabados finales'
      : 'Control de calidad final y preparación para despacho';

    const insNueva = await client.query(
      `INSERT INTO tareas (
        codigo, orden_id, owner_id, titulo, etapa, responsable_nombre, prioridad, fecha_limite, estado, porcentaje
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Media', $7, 'Pendiente', 0)
      RETURNING *`,
      [
        codigoNuevaTarea,
        orden.id,
        operarioSiguiente ? operarioSiguiente.id : null,
        tituloNuevaTarea,
        siguienteUi,
        nombreOperario,
        formatearFechaHoy(),
      ]
    );
    nuevasTareasGeneradas.push(mapTareaRow(insNueva.rows[0]));
  }

  // 7. Registro obligatorio e inmutable en registro_sesion
  const actorId = actor ? actor.id : (req?.usuario?.id || null);
  const actorNombre = req?.usuario?.nombre_completo || actor?.nombre_completo || 'Sistema ORVEX';

  await client.query(
    `INSERT INTO registro_sesion (
      orden_id, usuario_responsable_id, accion_texto,
      fecha_texto, hora_texto, responsable_nombre, estado_evento, interno,
      estado_anterior, nuevo_estado, motivo
    ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false, $7, $8, $9)`,
    [
      orden.id,
      actorId,
      `Avance automático: Todas las actividades obligatorias de ${estadoActualUi} fueron completadas al 100%. Orden avanzada a ${siguienteUi}.`,
      formatearFechaHoy(),
      formatearHoraAhora(),
      actorNombre,
      estadoActualUi,
      siguienteUi,
      `Finalización completa de etapa por cumplimiento de tareas técnicas sin incidencias activas.`,
    ]
  );

  return {
    avanzada: true,
    ejecutado: true,
    etapaAnterior: estadoActualUi,
    nuevaEtapa: siguienteUi,
    etapaSiguiente: siguienteUi,
    nuevasTareas: nuevasTareasGeneradas,
  };
}

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

    // Aislamiento de operarios: no permitir modificar tareas ajenas
    const testProp = verificarPropiedadTarea(tarea, req);
    if (!testProp.permitido) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: testProp.error });
    }

    // Control de dependencias técnicas
    const depsList = (Array.isArray(tarea.dependencias) ? tarea.dependencias : []).map(String).filter(Boolean);
    if ((accion === 'iniciar' || accion === 'finalizar') && depsList.length > 0) {
      const depsRes = await client.query(
        `SELECT codigo, titulo, estado, porcentaje
         FROM tareas
         WHERE (id::text = ANY($1::text[]) OR codigo = ANY($1::text[])) AND (estado != 'Finalizada' OR porcentaje < 100)`,
        [depsList]
      );
      if (depsRes.rowCount > 0) {
        const nombres = depsRes.rows.map((d) => `"${d.titulo || d.codigo}" (${d.estado})`).join(', ');
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No puedes ${accion} esta actividad porque depende de tareas no finalizadas: ${nombres}.`,
        });
      }
    }

    // Control de calidad: no permitir finalizar si existen incidencias activas sin resolver
    if (accion === 'finalizar') {
      const incs = Array.isArray(tarea.incidencias) ? tarea.incidencias : [];
      const activas = incs.filter((i) => i && !i.resuelto && !i.resuelta);
      if (activas.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No se puede finalizar la actividad porque tiene ${activas.length} incidencia(s) técnica(s) activa(s) sin resolver en taller.`,
        });
      }
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
          `Tarea "${tarea.titulo}" ${c.verbo} (${nuevoPct}%)`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          req.usuario?.nombre_completo || actor.nombre_completo,
          c.estado,
        ]
      );
    }

    // Si se finalizó la actividad, verificar avance automático de etapa
    let avanceAuto = null;
    if (accion === 'finalizar' && tarea.orden_id) {
      avanceAuto = await verificarYAvanzarEtapaAutomatica(client, tarea.orden_id, actor, req);
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
      avanceAutomatico: avanceAuto,
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

    // Aislamiento de operarios: no permitir modificar tareas ajenas
    const testProp = verificarPropiedadTarea(tarea, req);
    if (!testProp.permitido) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: testProp.error });
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

    // Control de dependencias técnicas
    const depsList = (Array.isArray(tarea.dependencias) ? tarea.dependencias : []).map(String).filter(Boolean);
    if (finalPct > 0 && depsList.length > 0) {
      const depsRes = await client.query(
        `SELECT codigo, titulo, estado, porcentaje
         FROM tareas
         WHERE (id::text = ANY($1::text[]) OR codigo = ANY($1::text[])) AND (estado != 'Finalizada' OR porcentaje < 100)`,
        [depsList]
      );
      if (depsRes.rowCount > 0) {
        const nombres = depsRes.rows.map((d) => `"${d.titulo || d.codigo}" (${d.estado})`).join(', ');
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No puedes reportar avance en esta actividad porque depende de tareas no finalizadas: ${nombres}.`,
        });
      }
    }

    // Control de calidad: no permitir finalizar si existen incidencias activas sin resolver
    if (finalEstado === 'Finalizada') {
      const incs = Array.isArray(tarea.incidencias) ? tarea.incidencias : [];
      const activas = incs.filter((i) => i && !i.resuelto && !i.resuelta);
      if (activas.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No se puede marcar la actividad como Finalizada porque tiene ${activas.length} incidencia(s) técnica(s) activa(s) sin resolver en taller.`,
        });
      }
    }

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

    // Si se finalizó la actividad (100%), verificar avance automático de etapa
    let avanceAuto = null;
    if (finalEstado === 'Finalizada' && finalPct === 100 && tarea.orden_id) {
      avanceAuto = await verificarYAvanzarEtapaAutomatica(client, tarea.orden_id, actor, req);
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
      avanceAutomatico: avanceAuto,
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
  const { texto, esIncidencia: rawEsInc, tipo } = req.body || {};
  const esIncidencia = Boolean(rawEsInc || tipo === 'incidencias' || tipo === 'incidencia');

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

    const testProp = verificarPropiedadTarea(tarea, req);
    if (!testProp.permitido) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: testProp.error });
    }

    const actor = await resolveActor(req, client);
    const autorNombre = req.usuario?.nombre_completo || actor?.nombre_completo || tarea.responsable_nombre || 'Operario';
    const item = {
      fecha: formatearFechaHoy(),
      hora: formatearHoraAhora(),
      texto: String(texto).trim(),
      autor: autorNombre,
      resuelto: esIncidencia ? false : undefined,
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
          `${esIncidencia ? 'Incidencia reportada' : 'Observación registrada'} en "${tarea.titulo}": ${String(texto).trim()}`,
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

const resolverIncidenciaTarea = async (req, res) => {
  const { id } = req.params;
  const { index, solucion } = req.body || {};

  if (!solucion || !String(solucion).trim()) {
    return res.status(400).json({ error: 'Debes registrar la solución o medida correctiva de la incidencia.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tarea = await fetchTareaByIdOrCodigo(id, client);
    if (!tarea) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Actividad no encontrada.' });
    }

    const testProp = verificarPropiedadTarea(tarea, req);
    if (!testProp.permitido) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: testProp.error });
    }

    const incs = Array.isArray(tarea.incidencias) ? [...tarea.incidencias] : [];
    if (incs.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La actividad no tiene incidencias registradas.' });
    }

    const idxTarget = index !== undefined && index >= 0 && index < incs.length
      ? Number(index)
      : incs.findIndex((i) => !i.resuelto && !i.resuelta);

    if (idxTarget === -1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Todas las incidencias de esta actividad ya se encuentran resueltas.' });
    }

    const actor = await resolveActor(req, client);
    const autorNombre = req.usuario?.nombre_completo || actor?.nombre_completo || 'Operario de taller';

    incs[idxTarget] = {
      ...incs[idxTarget],
      resuelto: true,
      resuelta: true,
      fechaResolucion: formatearFechaHoy(),
      horaResolucion: formatearHoraAhora(),
      solucion: String(solucion).trim(),
      resueltoPor: autorNombre,
    };

    await client.query(
      'UPDATE tareas SET incidencias = $1::jsonb WHERE id = $2',
      [JSON.stringify(incs), tarea.id]
    );

    if (tarea.orden_id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', true)`,
        [
          tarea.orden_id,
          actor.id,
          `Incidencia técnica resuelta en "${tarea.titulo}": ${String(solucion).trim()}`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          autorNombre,
        ]
      );
    }

    // Verificar si el despeje de la incidencia permite el avance automático de etapa
    let avanceAuto = null;
    if (tarea.orden_id) {
      avanceAuto = await verificarYAvanzarEtapaAutomatica(client, tarea.orden_id, actor, req);
    }

    await client.query('COMMIT');
    const actualizada = await fetchTareaByIdOrCodigo(tarea.id);
    const [ordenCompleta] = tarea.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [tarea.orden_id])
      : [null];

    res.json({
      mensaje: 'Incidencia resuelta exitosamente.',
      data: mapTareaRow(actualizada),
      orden: ordenCompleta,
      avanceAutomatico: avanceAuto,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const crearTarea = async (req, res) => {
  const { ordenId, orden_id, actividad, titulo, etapa, responsable, prioridad, fechaLimite, dependencias, deps } = req.body || {};
  const targetOrden = ordenId || orden_id;
  const targetTitulo = actividad || titulo;
  const depsArray = Array.isArray(dependencias) ? dependencias : (Array.isArray(deps) ? deps : []);

  if (!targetOrden || !targetTitulo) {
    return res.status(400).json({ error: 'Campos obligatorios: ordenId y actividad.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ord = await resolverOrden(client, targetOrden);
    if (!ord) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Orden ${targetOrden} no encontrada.` });
    }

    const usr = responsable ? await resolverUsuario(client, responsable) : null;
    const nombreResp = usr ? usr.nombre_completo : (responsable || 'Pedro Morales');
    const countRes = await client.query('SELECT COUNT(*)::int AS total FROM tareas');
    const codigo = `T-${countRes.rows[0].total + 1}`;
    const etapaFinal = etapa || 'Impresión';

    const ins = await client.query(
      `INSERT INTO tareas (
        codigo, orden_id, owner_id, titulo, etapa, responsable_nombre, prioridad, fecha_limite, estado, porcentaje, dependencias
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pendiente',0,$9::jsonb)
      RETURNING *`,
      [
        codigo,
        ord.id,
        usr ? usr.id : null,
        String(targetTitulo).trim(),
        etapaFinal,
        nombreResp,
        prioridad || 'Media',
        fechaLimite || formatearFechaHoy(),
        JSON.stringify(depsArray),
      ]
    );

    const actor = await resolveActor(req, client);
    if (ord.id && actor) {
      await client.query(
        `INSERT INTO registro_sesion (
           orden_id, usuario_responsable_id, accion_texto,
           fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
         ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', true)`,
        [
          ord.id,
          actor.id,
          `Nueva actividad programada en ${etapaFinal}: "${String(targetTitulo).trim()}" asignada a ${nombreResp}`,
          formatearFechaHoy(),
          formatearHoraAhora(),
          req.usuario?.nombre_completo || actor.nombre_completo,
        ]
      );
    }

    await client.query('COMMIT');
    const creada = await fetchTareaByIdOrCodigo(ins.rows[0].id);
    res.status(201).json({
      mensaje: 'Actividad creada exitosamente.',
      data: mapTareaRow(creada),
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
  crearTarea,
  asignarTarea,
  ejecutarAccionTarea,
  actualizarAvanceTarea,
  agregarNotaTarea,
  resolverIncidenciaTarea,
};
