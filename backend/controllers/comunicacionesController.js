const { pool } = require('../db');
const {
  esUuid,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  formatearFechaHoy,
  formatearHoraAhora,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');

function mapCanalToUI(canal) {
  const c = String(canal || 'wa').toLowerCase().trim();
  if (c === 'whatsapp' || c === 'wa') return 'wa';
  if (c === 'email' || c === 'correo' || c === 'mail') return 'mail';
  if (c === 'telefono' || c === 'llamada' || c === 'call') return 'call';
  return 'wa';
}

function mapMensajeToUI(m) {
  const texto = m.texto || '';
  const de = m.de === 'cliente' ? 'cliente' : 'usuario';
  const fecha = m.fecha_texto || formatearFechaHoy(m.marca_tiempo ? new Date(m.marca_tiempo) : new Date());
  const hora = m.hora_texto || formatearHoraAhora(m.marca_tiempo ? new Date(m.marca_tiempo) : new Date());
  const llamadaMinutos = m.duracion || undefined;
  const adjuntos = Array.isArray(m.adjuntos) && m.adjuntos.length > 0 ? m.adjuntos : undefined;

  return {
    id: m.id,
    de,
    remitente: m.remitente || (de === 'usuario' ? 'Equipo Huellas' : 'Cliente'),
    fecha,
    hora,
    texto,
    ...(llamadaMinutos ? { llamadaMinutos } : {}),
    ...(adjuntos ? { adjuntos } : {}),
  };
}

function mapHiloRow(row, mensajes = []) {
  return {
    id: row.codigo || String(row.id),
    dbId: row.id,
    codigo: row.codigo || String(row.id),
    canal: mapCanalToUI(row.canal),
    clienteId: row.cliente_codigo || (row.cliente_id ? String(row.cliente_id) : ''),
    cliente: row.cliente_empresa || 'Cliente',
    ordenId: row.orden_codigo || (row.orden_id ? String(row.orden_id) : ''),
    orden_id: row.orden_id,
    responsable: row.responsable_nombre || 'Ana Martínez',
    estado: row.estado || 'Pendiente de respuesta',
    asunto: row.asunto || '',
    mensajes: mensajes.map(mapMensajeToUI),
  };
}

async function fetchHiloCompleto(identificador, db = pool) {
  const str = String(identificador).trim();
  const byUuid = esUuid(str);
  const { rows } = await db.query(
    `SELECT c.*,
            cl.codigo AS cliente_codigo,
            cl.empresa AS cliente_empresa,
            o.codigo AS orden_codigo
     FROM canales_contacto c
     LEFT JOIN clientes cl ON c.cliente_id = cl.id
     LEFT JOIN ordenes o ON c.orden_id = o.id
     WHERE ${byUuid ? 'c.id = $1' : 'c.codigo = $1'}
     LIMIT 1`,
    [str]
  );
  if (!rows.length) return null;

  const { rows: msgs } = await db.query(
    `SELECT * FROM mensajes_entrantes
     WHERE canal_id = $1
     ORDER BY marca_tiempo ASC, id ASC`,
    [rows[0].id]
  );

  return mapHiloRow(rows[0], msgs);
}

const listarComunicaciones = async (_req, res) => {
  try {
    const { rows: canales } = await pool.query(
      `SELECT c.*,
              cl.codigo AS cliente_codigo,
              cl.empresa AS cliente_empresa,
              o.codigo AS orden_codigo
       FROM canales_contacto c
       LEFT JOIN clientes cl ON c.cliente_id = cl.id
       LEFT JOIN ordenes o ON c.orden_id = o.id
       ORDER BY COALESCE(c.codigo, c.id::text) ASC`
    );

    const { rows: mensajes } = await pool.query(
      `SELECT * FROM mensajes_entrantes ORDER BY marca_tiempo ASC, id ASC`
    );

    const msgsPorCanal = new Map();
    for (const m of mensajes) {
      if (!msgsPorCanal.has(m.canal_id)) msgsPorCanal.set(m.canal_id, []);
      msgsPorCanal.get(m.canal_id).push(m);
    }

    const data = canales.map((c) => mapHiloRow(c, msgsPorCanal.get(c.id) || []));
    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const enviarMensaje = async (req, res) => {
  const { id } = req.params;
  const { texto, remitente, de, fecha, hora } = req.body;

  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const str = String(id).trim();
    const byUuid = esUuid(str);
    const { rows: cRows } = await client.query(
      `SELECT * FROM canales_contacto WHERE ${byUuid ? 'id = $1' : 'codigo = $1'} LIMIT 1`,
      [str]
    );

    if (!cRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Conversación no encontrada.' });
    }

    const canalRow = cRows[0];
    const deMsg = de === 'cliente' ? 'cliente' : 'usuario';
    const autorNombre = remitente || req.usuario?.nombre_completo || canalRow.responsable_nombre || 'Ana Martínez';
    const fechaMsg = fecha || formatearFechaHoy();
    const horaMsg = hora || formatearHoraAhora();
    const textoLimpio = String(texto).trim();

    await client.query(
      `INSERT INTO mensajes_entrantes
         (canal_id, remitente, texto, de, fecha_texto, hora_texto)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [canalRow.id, autorNombre, textoLimpio, deMsg, fechaMsg, horaMsg]
    );

    await client.query(
      `UPDATE canales_contacto
       SET estado = 'Respondida'
       WHERE id = $1`,
      [canalRow.id]
    );

    if (canalRow.orden_id) {
      let actor = null;
      if (req.usuario?.id && req.usuario.rol !== 'cliente') {
        actor = await resolverUsuario(client, req.usuario.id);
      }
      if (!actor) actor = await obtenerUsuarioPorDefecto(client, 'ejecutiva');

      const canalUI = mapCanalToUI(canalRow.canal);
      const etiquetaCanal = canalUI === 'wa' ? 'WhatsApp' : canalUI === 'mail' ? 'Correo' : 'Telefonía';

      if (actor) {
        await client.query(
          `INSERT INTO registro_sesion (
             orden_id, usuario_responsable_id, accion_texto,
             fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
           ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
          [
            canalRow.orden_id,
            actor.id,
            `Respuesta enviada al cliente por ${etiquetaCanal}`,
            fechaMsg,
            horaMsg,
            autorNombre,
          ]
        );
      }
    }

    await client.query('COMMIT');
    const hilo = await fetchHiloCompleto(canalRow.id);
    const [ordenCompleta] = canalRow.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [canalRow.orden_id])
      : [null];

    res.status(201).json({
      mensaje: 'Mensaje enviado.',
      data: hilo,
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
  listarComunicaciones,
  enviarMensaje,
};
