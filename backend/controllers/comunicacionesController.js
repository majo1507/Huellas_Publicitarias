const { pool } = require('../db');
const {
  esUuid,
  resolverUsuario,
  obtenerUsuarioPorDefecto,
  formatearFechaHoy,
  formatearHoraAhora,
} = require('../utils/resolvers');
const { cargarOrdenesEnriquecidas } = require('./ordenesController');
const gmailService = require('../services/gmailService');
const whatsappService = require('../services/whatsappService');
const whatsappController = require('./whatsappController');

// ============================================================
// CANAL DE EVENTOS EN TIEMPO REAL (SSE - Server-Sent Events)
// ============================================================
const sseClients = new Set();

const streamComunicaciones = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write('data: {"tipo":"conectado"}\n\n');
  if (typeof res.flush === 'function') res.flush();

  sseClients.add(res);

  const pinger = setInterval(() => {
    try {
      res.write(': ping\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (_) {
      clearInterval(pinger);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(pinger);
    sseClients.delete(res);
  });
};

function notificarNovedadComunicaciones(evento = { tipo: 'actualizacion' }) {
  const payload = `data: ${JSON.stringify({ ...evento, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
      if (typeof client.flush === 'function') client.flush();
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Vincular emisor SSE al controlador de WhatsApp para eventos en vivo
whatsappController.setNotificadorComunicaciones(notificarNovedadComunicaciones);

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

  let estadoEnvio = undefined;
  let gmailMessageId = undefined;
  let whatsappMessageId = undefined;
  let errorEnvio = undefined;
  let reintentable = undefined;
  let leido = m.de === 'usuario'; // Mensajes salientes siempre leídos

  if (m.resumen) {
    try {
      const meta = JSON.parse(m.resumen);
      estadoEnvio = meta.estadoEnvio;
      gmailMessageId = meta.gmailMessageId;
      whatsappMessageId = meta.whatsappMessageId;
      errorEnvio = meta.error;
      reintentable = meta.reintentable;
      if (meta.leido !== undefined) {
        leido = Boolean(meta.leido);
      } else if (m.de === 'cliente') {
        leido = false;
      }
    } catch (_) {
      // Ignorar si resumen no era JSON
    }
  } else if (m.de === 'cliente') {
    leido = false;
  }

  return {
    id: m.id,
    de,
    remitente: m.remitente || (de === 'usuario' ? 'Equipo Huellas' : 'Cliente'),
    fecha,
    hora,
    texto,
    leido,
    marca_tiempo: m.marca_tiempo ? new Date(m.marca_tiempo).toISOString() : null,
    ...(llamadaMinutos ? { llamadaMinutos } : {}),
    ...(adjuntos ? { adjuntos } : {}),
    ...(estadoEnvio ? { estadoEnvio } : {}),
    ...(gmailMessageId ? { gmailMessageId } : {}),
    ...(whatsappMessageId ? { whatsappMessageId } : {}),
    ...(errorEnvio ? { errorEnvio } : {}),
    ...(reintentable != null ? { reintentable } : {}),
  };
}

function mapHiloRow(row, mensajes = []) {
  const msgsUI = mensajes.map(mapMensajeToUI);
  // Ordenar mensajes cronológicamente
  msgsUI.sort((a, b) => {
    const tA = a.marca_tiempo ? new Date(a.marca_tiempo).getTime() : 0;
    const tB = b.marca_tiempo ? new Date(b.marca_tiempo).getTime() : 0;
    return tA - tB;
  });

  const ultimoMsg = msgsUI[msgsUI.length - 1];
  const ultimaActividad = ultimoMsg?.marca_tiempo || (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString());
  const ultimaActividadTs = new Date(ultimaActividad).getTime();

  // Conteo de mensajes no leídos del cliente en este hilo
  const noLeidos = msgsUI.filter((m) => m.de === 'cliente' && !m.leido).length;
  const tieneNoLeidos = noLeidos > 0;

  // Cálculo de la ventana de atención de 24h de WhatsApp
  const ultMsgCliente = [...msgsUI].reverse().find((m) => m.de === 'cliente');
  const tiempoDesdeUltimoMsgClienteMs = ultMsgCliente?.marca_tiempo
    ? Date.now() - new Date(ultMsgCliente.marca_tiempo).getTime()
    : null;
  const ventana24hExpirada = tiempoDesdeUltimoMsgClienteMs !== null
    ? tiempoDesdeUltimoMsgClienteMs > 24 * 60 * 60 * 1000
    : true;

  return {
    id: row.codigo || String(row.id),
    dbId: row.id,
    codigo: row.codigo || String(row.id),
    canal: mapCanalToUI(row.canal),
    clienteId: row.cliente_codigo || (row.cliente_id ? String(row.cliente_id) : ''),
    cliente: row.cliente_empresa || 'Cliente',
    telefono: row.cliente_telefono || '',
    contacto: row.cliente_contacto || '',
    solicitudId: row.solicitud_codigo || '',
    ordenId: row.orden_codigo || (row.orden_id ? String(row.orden_id) : ''),
    orden_id: row.orden_id,
    responsable: row.responsable_nombre || 'Ana Martínez',
    estado: row.estado || 'Pendiente de respuesta',
    asunto: row.asunto || '',
    mensajes: msgsUI,
    ultimaActividad,
    ultimaActividadTs,
    noLeidos,
    tieneNoLeidos,
    ventana24hExpirada,
    ultimoMensajeClienteTs: ultMsgCliente?.marca_tiempo || null,
  };
}

async function fetchHiloCompleto(identificador, db = pool) {
  const str = String(identificador).trim();
  const byUuid = esUuid(str);
  const { rows } = await db.query(
    `SELECT c.*,
            cl.codigo AS cliente_codigo,
            cl.empresa AS cliente_empresa,
            cl.telefono AS cliente_telefono,
            cl.contacto_principal AS cliente_contacto,
            o.codigo AS orden_codigo,
            COALESCE(
              o.solicitud_codigo,
              (SELECT s.codigo FROM solicitudes s WHERE s.orden_id = c.orden_id ORDER BY s.id DESC LIMIT 1),
              (SELECT s.codigo FROM solicitudes s WHERE s.cliente_id = c.cliente_id ORDER BY s.id DESC LIMIT 1)
            ) AS solicitud_codigo
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

let ultimaSincronizacion = 0;
let sincronizandoEnCurso = false;

async function ejecutarSincronizacionAutomatica() {
  if (sincronizandoEnCurso) return { ok: false, razon: 'Sincronización en curso' };
  const ahora = Date.now();
  if (ahora - ultimaSincronizacion < 4000) {
    return { ok: true, mensaje: 'Sincronización reciente omitida' };
  }

  sincronizandoEnCurso = true;
  ultimaSincronizacion = ahora;

  try {
    const estado = gmailService.obtenerEstadoConexion();
    if (!estado.conectado) {
      return { ok: false, razon: 'Gmail no conectado' };
    }
    const resultado = await gmailService.sincronizarCorreosEntrantes({ db: pool });
    if (resultado.nuevos > 0) {
      console.log(`[GmailSync] Sincronizados ${resultado.nuevos} correos nuevos en Comunicaciones.`);
      notificarNovedadComunicaciones({ tipo: 'nuevos_correos', nuevos: resultado.nuevos });
    }
    return resultado;
  } catch (err) {
    console.error('[GmailSync] Error en sincronización:', err.message);
    return { ok: false, error: err.message };
  } finally {
    sincronizandoEnCurso = false;
  }
}

// Iniciar intervalo en segundo plano (cada 5 segundos)
setInterval(() => {
  ejecutarSincronizacionAutomatica().catch(() => {});
}, 5000);

const listarComunicaciones = async (_req, res) => {
  try {
    // Sincronizar correos entrantes de Gmail automáticamente antes de listar
    await ejecutarSincronizacionAutomatica().catch(() => {});

    const { rows: canales } = await pool.query(
      `SELECT c.*,
              cl.codigo AS cliente_codigo,
              cl.empresa AS cliente_empresa,
              cl.telefono AS cliente_telefono,
              cl.contacto_principal AS cliente_contacto,
              o.codigo AS orden_codigo,
              COALESCE(
                o.solicitud_codigo,
                (SELECT s.codigo FROM solicitudes s WHERE s.orden_id = c.orden_id ORDER BY s.id DESC LIMIT 1),
                (SELECT s.codigo FROM solicitudes s WHERE s.cliente_id = c.cliente_id ORDER BY s.id DESC LIMIT 1)
              ) AS solicitud_codigo
       FROM canales_contacto c
       LEFT JOIN clientes cl ON c.cliente_id = cl.id
       LEFT JOIN ordenes o ON c.orden_id = o.id`
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

    // REGLA FUNDAMENTAL: Ordenar conversaciones por actividad más reciente (descendente)
    data.sort((a, b) => (b.ultimaActividadTs || 0) - (a.ultimaActividadTs || 0));

    res.json({ total: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const enviarMensaje = async (req, res) => {
  const { id } = req.params;
  const { texto, remitente, de, fecha, hora, esAcuerdo } = req.body;

  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  const str = String(id).trim();
  const byUuid = esUuid(str);
  const { rows: cRows } = await pool.query(
    `SELECT * FROM canales_contacto WHERE ${byUuid ? 'id = $1' : 'codigo = $1'} LIMIT 1`,
    [str]
  );

  if (!cRows.length) {
    return res.status(404).json({ error: 'Conversación no encontrada.' });
  }

  const canalRow = cRows[0];
  const canalUI = mapCanalToUI(canalRow.canal);
  const deMsg = de === 'cliente' ? 'cliente' : 'usuario';
  const autorNombre = remitente || req.usuario?.nombre_completo || canalRow.responsable_nombre || 'Ana Martínez';
  const fechaMsg = fecha || formatearFechaHoy();
  const horaMsg = hora || formatearHoraAhora();
  const textoLimpio = String(texto).trim();
  const esAcuerdoComercial = Boolean(esAcuerdo) || /^\[acuerdo\]/i.test(textoLimpio);

  // CASO 1: Canal WhatsApp saliente (ORVEX -> Meta WhatsApp Cloud API)
  if (canalUI === 'wa' && deMsg !== 'cliente') {
    // 1. Obtener número de teléfono del cliente
    const { rows: clienteRows } = await pool.query(
      `SELECT cl.* FROM canales_contacto c LEFT JOIN clientes cl ON c.cliente_id = cl.id WHERE c.id = $1`,
      [canalRow.id]
    );
    const clienteRow = clienteRows[0] || {};
    let telefonoDestino = clienteRow.telefono || '';

    // Si el cliente no tiene teléfono en su ficha, buscar en el último mensaje entrante de ese hilo
    if (!telefonoDestino) {
      const { rows: ultimosMsgs } = await pool.query(
        `SELECT resumen, remitente FROM mensajes_entrantes WHERE canal_id = $1 AND de = 'cliente' ORDER BY marca_tiempo DESC LIMIT 1`,
        [canalRow.id]
      );
      if (ultimosMsgs[0]?.resumen) {
        try {
          const parsed = JSON.parse(ultimosMsgs[0].resumen);
          telefonoDestino = parsed.from || '';
        } catch (_) {}
      }
      if (!telefonoDestino && ultimosMsgs[0]?.remitente && /^\+?[0-9\s-]+$/.test(ultimosMsgs[0].remitente)) {
        telefonoDestino = ultimosMsgs[0].remitente;
      }
    }

    let metaResultado = null;
    let estadoEnvio = 'enviado';
    let errorEnvio = null;

    if (whatsappService.estaConfigurado()) {
      if (!telefonoDestino) {
        return res.status(400).json({
          error: 'No se encontró un número de teléfono registrado en el cliente ni en el historial para enviar el WhatsApp.',
        });
      }

      try {
        metaResultado = await whatsappService.enviarMensajeTexto({
          to: telefonoDestino,
          texto: textoLimpio,
        });
      } catch (err) {
        console.warn('[WhatsAppSend] Fallo en envío a Meta:', err.message);
        // Si Meta rechaza el mensaje, no marcar como enviado y devolver error descriptivo
        return res.status(err.status || 502).json({
          error: `Error al enviar WhatsApp a través de Meta: ${err.message}`,
          motivo: err.message,
          codigoMeta: err.codigoMeta,
        });
      }
    } else {
      // Modo local cuando aún no se han configurado credenciales de Meta
      estadoEnvio = 'enviado_local';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const resumenMeta = JSON.stringify({
        whatsappMessageId: metaResultado?.messageId || `wa-local-${Date.now()}`,
        to: telefonoDestino,
        estadoEnvio,
        error: errorEnvio,
        canal: 'wa',
      });

      await client.query(
        `INSERT INTO mensajes_entrantes
           (canal_id, remitente, texto, de, fecha_texto, hora_texto, resumen)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [canalRow.id, autorNombre, textoLimpio, deMsg, fechaMsg, horaMsg, resumenMeta]
      );

      await client.query('UPDATE canales_contacto SET estado = $1 WHERE id = $2', [
        'Respondida',
        canalRow.id,
      ]);

      if (canalRow.orden_id) {
        let actor = null;
        if (req.usuario?.id && req.usuario.rol !== 'cliente') {
          actor = await resolverUsuario(client, req.usuario.id);
        }
        if (!actor) actor = await obtenerUsuarioPorDefecto(client, 'ejecutiva');

        const accionBitacora = esAcuerdoComercial
          ? `Acuerdo con cliente registrado vía WhatsApp: "${textoLimpio.replace(/^\[acuerdo\]\s*/i, '')}"`
          : `Respuesta enviada al cliente por WhatsApp`;

        if (actor) {
          await client.query(
            `INSERT INTO registro_sesion (
               orden_id, usuario_responsable_id, accion_texto,
               fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
             ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
            [canalRow.orden_id, actor.id, accionBitacora, fechaMsg, horaMsg, autorNombre]
          );
        }
      }

      await client.query('COMMIT');
      notificarNovedadComunicaciones({
        tipo: 'nuevo_mensaje',
        canalId: canalRow.id,
        canal: 'wa',
        de: 'usuario',
        messageId: metaResultado?.messageId,
      });

      const hilo = await fetchHiloCompleto(canalRow.id);
      const [ordenCompleta] = canalRow.orden_id
        ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [canalRow.orden_id])
        : [null];

      return res.status(201).json({
        mensaje: esAcuerdoComercial ? 'Acuerdo registrado y enviado por WhatsApp.' : 'Mensaje enviado por WhatsApp.',
        data: hilo,
        orden: ordenCompleta,
      });
    } catch (errTx) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: errTx.message });
    } finally {
      client.release();
    }
  }

  // CASO 2: Canales no-email (Llamadas, notas internas, o mensaje entrante de cliente) -> Operación local
  if (canalUI !== 'mail' || deMsg === 'cliente') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO mensajes_entrantes
           (canal_id, remitente, texto, de, fecha_texto, hora_texto)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [canalRow.id, autorNombre, textoLimpio, deMsg, fechaMsg, horaMsg]
      );

      await client.query('UPDATE canales_contacto SET estado = $1 WHERE id = $2', [
        deMsg === 'cliente' ? 'Pendiente de respuesta' : 'Respondida',
        canalRow.id,
      ]);

      if (canalRow.orden_id && deMsg !== 'cliente') {
        let actor = null;
        if (req.usuario?.id && req.usuario.rol !== 'cliente') {
          actor = await resolverUsuario(client, req.usuario.id);
        }
        if (!actor) actor = await obtenerUsuarioPorDefecto(client, 'ejecutiva');

        const etiquetaCanal = canalUI === 'wa' ? 'WhatsApp' : 'Telefonía';
        const accionBitacora = esAcuerdoComercial
          ? `Acuerdo con cliente registrado vía ${etiquetaCanal}: "${textoLimpio.replace(/^\[acuerdo\]\s*/i, '')}"`
          : `Respuesta enviada al cliente por ${etiquetaCanal}`;

        if (actor) {
          await client.query(
            `INSERT INTO registro_sesion (
               orden_id, usuario_responsable_id, accion_texto,
               fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
             ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
            [canalRow.orden_id, actor.id, accionBitacora, fechaMsg, horaMsg, autorNombre]
          );
        }
      }

      await client.query('COMMIT');
      notificarNovedadComunicaciones({ tipo: 'nuevo_mensaje', canalId: canalRow.id, canal: canalUI, de: deMsg });
      const hilo = await fetchHiloCompleto(canalRow.id);
      const [ordenCompleta] = canalRow.orden_id
        ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [canalRow.orden_id])
        : [null];

      return res.status(201).json({
        mensaje: esAcuerdoComercial ? 'Acuerdo registrado en la conversación y trazabilidad.' : 'Mensaje enviado.',
        data: hilo,
        orden: ordenCompleta,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  // CASO 2: Canal Correo Electrónico (mail) con envío real vía Gmail API
  // A. Comprobar que Gmail esté conectado
  const estadoGmail = gmailService.obtenerEstadoConexion();
  if (!estadoGmail.conectado) {
    return res.status(400).json({
      error: 'La cuenta de Gmail (huellaspublicidad23@gmail.com) no está conectada. Un usuario con rol Gerente debe vincularla desde el Centro de Comunicaciones para habilitar el envío real de correos.',
      requiereConexionGmail: true,
    });
  }

  // B. Obtener correo destino del cliente
  const { rows: cliRows } = await pool.query(
    'SELECT id, empresa, correo, contacto_principal FROM clientes WHERE id = $1',
    [canalRow.cliente_id]
  );
  const clienteDestino = cliRows[0];
  const correoDestino = clienteDestino?.correo ? String(clienteDestino.correo).trim() : null;

  if (!correoDestino || !correoDestino.includes('@')) {
    return res.status(400).json({
      error: `El cliente "${clienteDestino?.empresa || 'Cliente'}" no tiene un correo electrónico válido registrado en su ficha.`,
    });
  }

  // FASE 1: Pre-registro local ultracorto (Estado 'enviando', se libera la conexión DB inmediatamente)
  let nuevoMensajeId = null;
  const clientPre = await pool.connect();
  try {
    await clientPre.query('BEGIN');
    const metaEnviando = JSON.stringify({
      estadoEnvio: 'enviando',
      destinatario: correoDestino,
      fechaInicio: new Date().toISOString(),
      intentos: 1,
    });
    const { rows: msgRows } = await clientPre.query(
      `INSERT INTO mensajes_entrantes
         (canal_id, remitente, texto, de, fecha_texto, hora_texto, resumen)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [canalRow.id, autorNombre, textoLimpio, deMsg, fechaMsg, horaMsg, metaEnviando]
    );
    nuevoMensajeId = msgRows[0].id;
    await clientPre.query('COMMIT');
  } catch (errPre) {
    await clientPre.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al iniciar el registro del mensaje: ' + errPre.message });
  } finally {
    clientPre.release();
  }

  // FASE 2: Despacho a Gmail API (Llamada HTTP externa SIN transacción DB abierta)
  // Recuperar metadatos de hilo previo (threadId, In-Reply-To, References) si existen
  let threadIdPrevio = null;
  let inReplyToPrevio = null;
  let referencesPrevio = null;

  try {
    const { rows: msgsPrevios } = await pool.query(
      `SELECT resumen FROM mensajes_entrantes
       WHERE canal_id = $1 AND resumen IS NOT NULL
       ORDER BY marca_tiempo DESC, id DESC LIMIT 5`,
      [canalRow.id]
    );
    for (const r of msgsPrevios) {
      try {
        const m = JSON.parse(r.resumen);
        if (!threadIdPrevio && m.threadId) threadIdPrevio = m.threadId;
        if (!inReplyToPrevio && m.rfcMessageId) inReplyToPrevio = m.rfcMessageId;
        if (!referencesPrevio && (m.references || m.rfcMessageId)) {
          referencesPrevio = m.references || m.rfcMessageId;
        }
      } catch (_) {}
    }
  } catch (_) {}

  let asuntoCorreo = canalRow.asunto || `Comunicación de Huellas Publicidad — ${canalRow.codigo || canalRow.id}`;
  if (!/^re:\s*/i.test(asuntoCorreo)) {
    asuntoCorreo = `Re: ${asuntoCorreo}`;
  }

  let resGmail = null;
  let errorGmail = null;
  try {
    resGmail = await gmailService.enviarCorreoGmail({
      destinatario: correoDestino,
      asunto: asuntoCorreo,
      texto: textoLimpio,
      mensajeIdLocal: nuevoMensajeId,
      threadId: threadIdPrevio,
      inReplyTo: inReplyToPrevio,
      references: referencesPrevio,
    });
  } catch (errCall) {
    errorGmail = errCall;
  }

  // FASE 3A: Si Gmail aceptó el envío (Éxito confirmado)
  if (resGmail && resGmail.ok) {
    const clientPost = await pool.connect();
    try {
      await clientPost.query('BEGIN');
      const metaEnviado = JSON.stringify({
        estadoEnvio: 'enviado',
        gmailMessageId: resGmail.id,
        threadId: resGmail.threadId || threadIdPrevio,
        rfcMessageId: resGmail.rfcMessageId,
        destinatario: correoDestino,
        fechaEnvio: new Date().toISOString(),
      });
      await clientPost.query(
        'UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2',
        [metaEnviado, nuevoMensajeId]
      );
      await clientPost.query('UPDATE canales_contacto SET estado = $1 WHERE id = $2', ['Respondida', canalRow.id]);

      // Registrar trazabilidad real en la orden de producción vinculada
      if (canalRow.orden_id) {
        let actor = null;
        if (req.usuario?.id && req.usuario.rol !== 'cliente') {
          actor = await resolverUsuario(clientPost, req.usuario.id);
        }
        if (!actor) actor = await obtenerUsuarioPorDefecto(clientPost, 'ejecutiva');

        const accionBitacora = esAcuerdoComercial
          ? `Acuerdo con cliente registrado vía Correo (${correoDestino}): "${textoLimpio.replace(/^\[acuerdo\]\s*/i, '')}"`
          : `Respuesta enviada al cliente por Correo (${correoDestino}) [Gmail ID: ${resGmail.id}]`;

        if (actor) {
          await clientPost.query(
            `INSERT INTO registro_sesion (
               orden_id, usuario_responsable_id, accion_texto,
               fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
             ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
            [canalRow.orden_id, actor.id, accionBitacora, fechaMsg, horaMsg, autorNombre]
          );
        }
      }
      await clientPost.query('COMMIT');
      notificarNovedadComunicaciones({ tipo: 'mensaje_enviado', canalId: canalRow.id, canal: 'mail' });
    } catch (dbErr) {
      await clientPost.query('ROLLBACK');
      console.error('[Comunicaciones] Advertencia: Correo enviado por Gmail pero falló actualización local:', dbErr.message);
    } finally {
      clientPost.release();
    }

    const hilo = await fetchHiloCompleto(canalRow.id);
    const [ordenCompleta] = canalRow.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [canalRow.orden_id])
      : [null];

    return res.status(201).json({
      mensaje: esAcuerdoComercial
        ? 'Acuerdo formal enviado por correo y registrado en trazabilidad.'
        : `Correo enviado exitosamente vía Gmail a ${correoDestino}.`,
      gmailMessageId: resGmail.id,
      data: hilo,
      orden: ordenCompleta,
    });
  }

  // FASE 3B: Si Gmail rechazó el envío (Fallo confirmado)
  const clientFallo = await pool.connect();
  try {
    const metaFallido = JSON.stringify({
      estadoEnvio: 'fallido',
      destinatario: correoDestino,
      error: errorGmail ? errorGmail.message : 'Error desconocido de red con Google',
      reintentable: true,
      fechaFallo: new Date().toISOString(),
    });
    await clientFallo.query(
      'UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2',
      [metaFallido, nuevoMensajeId]
    );
    // NOTA: NO se modifica canales_contacto a 'Respondida' ni se inserta en registro_sesion
  } catch (errDbFallo) {
    console.error('[Comunicaciones] Error al marcar fallo en base de datos:', errDbFallo.message);
  } finally {
    clientFallo.release();
  }

  const hiloFallo = await fetchHiloCompleto(canalRow.id);
  return res.status(502).json({
    error: `No se pudo entregar el correo a través de Gmail: ${errorGmail ? errorGmail.message : 'Error de comunicación'}`,
    mensajeId: nuevoMensajeId,
    reintentable: true,
    data: hiloFallo,
  });
};

const reintentarEnvioMensaje = async (req, res) => {
  const { id, mensajeId } = req.params;
  const str = String(id).trim();
  const byUuid = esUuid(str);

  const { rows: cRows } = await pool.query(
    `SELECT * FROM canales_contacto WHERE ${byUuid ? 'id = $1' : 'codigo = $1'} LIMIT 1`,
    [str]
  );
  if (!cRows.length) return res.status(404).json({ error: 'Conversación no encontrada.' });
  const canalRow = cRows[0];

  const { rows: mRows } = await pool.query(
    'SELECT * FROM mensajes_entrantes WHERE id = $1 AND canal_id = $2 LIMIT 1',
    [mensajeId, canalRow.id]
  );
  if (!mRows.length) return res.status(404).json({ error: 'Mensaje no encontrado.' });
  const msgRow = mRows[0];

  let meta = {};
  try {
    meta = JSON.parse(msgRow.resumen || '{}');
  } catch (_) {}

  // Si ya fue enviado previamente, evitar duplicado absoluto
  if (meta.estadoEnvio === 'enviado' && meta.gmailMessageId) {
    const hilo = await fetchHiloCompleto(canalRow.id);
    return res.status(200).json({
      mensaje: 'El correo ya había sido enviado previamente por Gmail.',
      gmailMessageId: meta.gmailMessageId,
      data: hilo,
    });
  }

  // Obtener correo destino del cliente
  const { rows: cliRows } = await pool.query(
    'SELECT correo, empresa FROM clientes WHERE id = $1',
    [canalRow.cliente_id]
  );
  const correoDestino = cliRows[0]?.correo ? String(cliRows[0].correo).trim() : null;
  if (!correoDestino || !correoDestino.includes('@')) {
    return res.status(400).json({ error: 'El cliente no tiene un correo válido registrado.' });
  }

  // Intentar reenvío por Gmail API
  try {
    const resGmail = await gmailService.enviarCorreoGmail({
      destinatario: correoDestino,
      asunto: canalRow.asunto || `Comunicación de Huellas Publicidad — ${canalRow.codigo || canalRow.id}`,
      texto: msgRow.texto,
      mensajeIdLocal: msgRow.id,
    });

    const metaEnviado = JSON.stringify({
      estadoEnvio: 'enviado',
      gmailMessageId: resGmail.id,
      rfcMessageId: resGmail.rfcMessageId,
      destinatario: correoDestino,
      fechaEnvio: new Date().toISOString(),
      reintentado: true,
    });

    await pool.query('UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2', [metaEnviado, msgRow.id]);
    await pool.query('UPDATE canales_contacto SET estado = $1 WHERE id = $2', ['Respondida', canalRow.id]);

    if (canalRow.orden_id) {
      let actor = null;
      if (req.usuario?.id && req.usuario.rol !== 'cliente') {
        actor = await resolverUsuario(pool, req.usuario.id);
      }
      if (!actor) actor = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');
      if (actor) {
        await pool.query(
          `INSERT INTO registro_sesion (
             orden_id, usuario_responsable_id, accion_texto,
             fecha_texto, hora_texto, responsable_nombre, estado_evento, interno
           ) VALUES ($1, $2, $3, $4, $5, $6, 'Completado', false)`,
          [
            canalRow.orden_id,
            actor.id,
            `Respuesta enviada al cliente por Correo (${correoDestino}) [Reintento exitoso · Gmail ID: ${resGmail.id}]`,
            formatearFechaHoy(),
            formatearHoraAhora(),
            req.usuario?.nombre_completo || 'Equipo Comercial',
          ]
        );
      }
    }

    const hilo = await fetchHiloCompleto(canalRow.id);
    const [ordenCompleta] = canalRow.orden_id
      ? await cargarOrdenesEnriquecidas(pool, 'AND o.id = $1', [canalRow.orden_id])
      : [null];

    return res.json({
      mensaje: `Reintento exitoso: correo entregado por Gmail a ${correoDestino}.`,
      gmailMessageId: resGmail.id,
      data: hilo,
      orden: ordenCompleta,
    });
  } catch (errReintento) {
    const metaFallido = JSON.stringify({
      estadoEnvio: 'fallido',
      destinatario: correoDestino,
      error: errReintento.message,
      reintentable: true,
      fechaFallo: new Date().toISOString(),
      intentos: (meta.intentos || 1) + 1,
    });
    await pool.query('UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2', [metaFallido, msgRow.id]);
    const hilo = await fetchHiloCompleto(canalRow.id);
    return res.status(502).json({
      error: `El reintento falló: ${errReintento.message}`,
      data: hilo,
    });
  }
};

/**
 * Permite redactar y enviar un nuevo correo electrónico a cualquier destinatario externo,
 * sin requerir que exista previamente un cliente, orden o conversación.
 */
const nuevoCorreo = async (req, res) => {
  const { destinatario, asunto, texto, esAcuerdo } = req.body;

  if (!destinatario || !destinatario.includes('@') || !destinatario.includes('.')) {
    return res.status(400).json({ error: 'Debes proporcionar una dirección de correo válida para el destinatario.' });
  }
  if (!asunto || !String(asunto).trim()) {
    return res.status(400).json({ error: 'El asunto del correo no puede estar vacío.' });
  }
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El contenido del correo no puede estar vacío.' });
  }

  const estadoGmail = gmailService.obtenerEstadoConexion();
  if (!estadoGmail.conectado) {
    return res.status(400).json({
      error: 'La cuenta corporativa de Gmail (huellaspublicidad23@gmail.com) no está conectada. No es posible enviar correos.',
      requiereConexionGmail: true,
    });
  }

  const emailDestino = destinatario.trim().toLowerCase();
  const asuntoLimpio = String(asunto).trim();
  const textoLimpio = String(texto).trim();
  const autorNombre = req.usuario?.nombre_completo || 'Ana Martínez';
  const fechaHoy = formatearFechaHoy();
  const horaAhora = formatearHoraAhora();
  const esAcuerdoComercial = Boolean(esAcuerdo) || /^\[acuerdo\]/i.test(textoLimpio);

  // 1. Buscar o registrar cliente para mantener integridad referencial sin migraciones
  let clienteId = null;
  const { rows: cliRows } = await pool.query(
    'SELECT id, empresa FROM clientes WHERE LOWER(TRIM(correo)) = $1 LIMIT 1',
    [emailDestino]
  );

  if (cliRows.length > 0) {
    clienteId = cliRows[0].id;
  } else {
    const { rows: ejecRows } = await pool.query(
      "SELECT id FROM usuarios WHERE rol = 'ejecutiva' LIMIT 1"
    );
    const ejecutivaId = ejecRows[0]?.id || req.usuario?.id;
    const nombreContacto = emailDestino.split('@')[0];
    const empresaNombre = `${nombreContacto} (${emailDestino})`;
    const nitRandom = `EXT-${Date.now().toString().slice(-6)}`;
    const codCli = `CLI-EXT-${Date.now().toString().slice(-4)}`;

    const { rows: nuevoCli } = await pool.query(
      `INSERT INTO clientes (empresa, nit, contacto_principal, correo, ejecutiva_id, estado, codigo)
       VALUES ($1, $2, $3, $4, $5, 'Nuevo', $6)
       RETURNING id`,
      [empresaNombre, nitRandom, nombreContacto, emailDestino, ejecutivaId, codCli]
    );
    clienteId = nuevoCli[0].id;
  }

  // 2. Crear hilo en canales_contacto
  const codCanal = `COM-MAIL-${Date.now().toString().slice(-5)}`;
  const { rows: canalRows } = await pool.query(
    `INSERT INTO canales_contacto (canal, cliente_id, asunto, estado, responsable_nombre, usuario_responsable_id, codigo)
     VALUES ('mail', $1, $2, 'Respondida', $3, $4, $5)
     RETURNING *`,
    [clienteId, asuntoLimpio, autorNombre, req.usuario?.id || null, codCanal]
  );
  const canalRow = canalRows[0];

  // 3. Pre-insertar mensaje con estado 'enviando'
  let nuevoMensajeId = null;
  const clientPre = await pool.connect();
  try {
    await clientPre.query('BEGIN');
    const metaEnviando = JSON.stringify({
      estadoEnvio: 'enviando',
      destinatario: emailDestino,
      fechaInicio: new Date().toISOString(),
      intentos: 1,
    });
    const { rows: msgRows } = await clientPre.query(
      `INSERT INTO mensajes_entrantes
         (canal_id, remitente, texto, de, fecha_texto, hora_texto, resumen)
       VALUES ($1, $2, $3, 'usuario', $4, $5, $6)
       RETURNING id`,
      [canalRow.id, autorNombre, textoLimpio, fechaHoy, horaAhora, metaEnviando]
    );
    nuevoMensajeId = msgRows[0].id;
    await clientPre.query('COMMIT');
  } catch (err) {
    await clientPre.query('ROLLBACK');
    return res.status(500).json({ error: 'Error al pre-registrar el correo: ' + err.message });
  } finally {
    clientPre.release();
  }

  // 4. Despacho a Gmail API sin transacción abierta
  let resGmail = null;
  let errorGmail = null;
  try {
    resGmail = await gmailService.enviarCorreoGmail({
      destinatario: emailDestino,
      asunto: asuntoLimpio,
      texto: textoLimpio,
      mensajeIdLocal: nuevoMensajeId,
    });
  } catch (errCall) {
    errorGmail = errCall;
  }

  // 5. Actualizar estado según resultado de Gmail
  if (resGmail && resGmail.ok) {
    const metaEnviado = JSON.stringify({
      estadoEnvio: 'enviado',
      gmailMessageId: resGmail.id,
      threadId: resGmail.threadId,
      rfcMessageId: resGmail.rfcMessageId,
      destinatario: emailDestino,
      fechaEnvio: new Date().toISOString(),
    });
    await pool.query(
      'UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2',
      [metaEnviado, nuevoMensajeId]
    );

    notificarNovedadComunicaciones({ tipo: 'nuevo_correo', canalId: canalRow.id, canal: 'mail' });

    const hilo = await fetchHiloCompleto(canalRow.id);
    return res.status(201).json({
      mensaje: esAcuerdoComercial
        ? `Acuerdo comercial enviado exitosamente a ${emailDestino}.`
        : `Correo enviado exitosamente a ${emailDestino}.`,
      gmailMessageId: resGmail.id,
      data: hilo,
    });
  } else {
    const metaFallido = JSON.stringify({
      estadoEnvio: 'fallido',
      destinatario: emailDestino,
      error: errorGmail?.message || 'Error desconocido de Gmail API',
      reintentable: true,
      fechaFallo: new Date().toISOString(),
    });
    await pool.query(
      'UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2',
      [metaFallido, nuevoMensajeId]
    );
    await pool.query(
      "UPDATE canales_contacto SET estado = 'Pendiente de respuesta' WHERE id = $1",
      [canalRow.id]
    );

    const hilo = await fetchHiloCompleto(canalRow.id);
    return res.status(207).json({
      mensaje: `El correo se guardó en ORVEX pero Gmail rechazó el envío: ${errorGmail?.message}`,
      error: errorGmail?.message,
      data: hilo,
    });
  }
};

/**
 * Permite iniciar y enviar un nuevo mensaje de WhatsApp a cualquier destinatario externo,
 * creando o vinculando automáticamente la conversación en el Centro de Comunicaciones.
 */
const nuevoWhatsApp = async (req, res) => {
  const { destinatario, texto, esAcuerdo, asunto } = req.body;

  if (!destinatario || !String(destinatario).trim()) {
    return res.status(400).json({ error: 'Debes proporcionar un número de teléfono de WhatsApp válido.' });
  }
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El mensaje de WhatsApp no puede estar vacío.' });
  }

  const telNormalizado = whatsappService.normalizarTelefono(destinatario);
  if (!telNormalizado || telNormalizado.length < 8) {
    return res.status(400).json({ error: `El número indicado (${destinatario}) no es válido para WhatsApp.` });
  }

  const textoLimpio = String(texto).trim();
  const asuntoLimpio = String(asunto || '').trim() || `Atención comercial WhatsApp (+${telNormalizado})`;
  const autorNombre = req.usuario?.nombre_completo || 'Ana Martínez';
  const fechaHoy = formatearFechaHoy();
  const horaAhora = formatearHoraAhora();
  const esAcuerdoComercial = Boolean(esAcuerdo) || /^\[acuerdo\]/i.test(textoLimpio);

  // 1. Buscar o registrar cliente para mantener consistencia
  const ultimosDigitos = telNormalizado.slice(-8);
  let clienteId = null;

  const { rows: cliRows } = await pool.query(
    `SELECT id, empresa, contacto_principal FROM clientes
     WHERE REGEXP_REPLACE(telefono, '[^0-9]', '', 'g') LIKE $1
     LIMIT 1`,
    [`%${ultimosDigitos}`]
  );

  if (cliRows.length > 0) {
    clienteId = cliRows[0].id;
  } else {
    const defaultEjecutiva = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');
    const nuevoCodigo = `CLI-WA-${Date.now().toString().slice(-6)}`;
    const nitRandom = `WA-${Date.now().toString().slice(-6)}`;
    const nombreContacto = `Contacto WhatsApp (+${telNormalizado})`;

    const { rows: nuevoCli } = await pool.query(
      `INSERT INTO clientes (empresa, nit, contacto_principal, telefono, ejecutiva_id, estado, codigo)
       VALUES ($1, $2, $3, $4, $5, 'Activo', $6)
       RETURNING id`,
      [nombreContacto, nitRandom, nombreContacto, `+${telNormalizado}`, defaultEjecutiva?.id || null, nuevoCodigo]
    );
    clienteId = nuevoCli[0].id;
  }

  // 2. Buscar si ya existe una conversación de WhatsApp con este cliente o crear una nueva
  const { rows: hilosExistentes } = await pool.query(
    `SELECT * FROM canales_contacto WHERE canal = 'wa' AND cliente_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [clienteId]
  );

  let canalRow = hilosExistentes[0] || null;

  if (!canalRow) {
    const { rows: maxCom } = await pool.query(
      `SELECT codigo FROM canales_contacto WHERE codigo LIKE 'COM-%'`
    );
    let maxNum = 15;
    for (const r of maxCom) {
      const match = r.codigo?.match(/COM-(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxNum) maxNum = val;
      }
    }
    const nuevoCodigoCom = `COM-${String(maxNum + 1).padStart(3, '0')}`;
    const defaultEjecutiva = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');

    const { rows: nuevoCanal } = await pool.query(
      `INSERT INTO canales_contacto (
         canal, cliente_id, asunto, estado, responsable_nombre, usuario_responsable_id, codigo
       ) VALUES ('wa', $1, $2, 'Respondida', $3, $4, $5)
       RETURNING *`,
      [clienteId, asuntoLimpio, defaultEjecutiva?.nombre_completo || autorNombre, defaultEjecutiva?.id || null, nuevoCodigoCom]
    );
    canalRow = nuevoCanal[0];
  } else {
    await pool.query("UPDATE canales_contacto SET estado = 'Respondida' WHERE id = $1", [canalRow.id]);
  }

  // 3. Envío real a través de Meta WhatsApp Cloud API si está configurado
  let metaResultado = null;
  let estadoEnvio = 'enviado';
  let errorEnvio = null;

  if (whatsappService.estaConfigurado()) {
    try {
      metaResultado = await whatsappService.enviarMensajeTexto({
        to: telNormalizado,
        texto: textoLimpio,
      });
    } catch (err) {
      console.warn('[WhatsAppNuevo] Fallo en envío a Meta:', err.message);
      return res.status(err.status || 502).json({
        error: `Error al enviar WhatsApp a través de Meta: ${err.message}`,
        motivo: err.message,
        codigoMeta: err.codigoMeta,
      });
    }
  } else {
    estadoEnvio = 'enviado_local';
  }

  // 4. Guardar mensaje en base de datos
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resumenMeta = JSON.stringify({
      whatsappMessageId: metaResultado?.messageId || `wa-local-${Date.now()}`,
      to: telNormalizado,
      estadoEnvio,
      error: errorEnvio,
      canal: 'wa',
    });

    await client.query(
      `INSERT INTO mensajes_entrantes
         (canal_id, remitente, texto, de, fecha_texto, hora_texto, resumen)
       VALUES ($1, $2, $3, 'usuario', $4, $5, $6)`,
      [canalRow.id, autorNombre, textoLimpio, fechaHoy, horaAhora, resumenMeta]
    );

    await client.query('COMMIT');
    notificarNovedadComunicaciones({ tipo: 'nuevo_mensaje', canalId: canalRow.id, canal: 'wa', de: 'usuario' });

    const hilo = await fetchHiloCompleto(canalRow.id);
    return res.status(201).json({
      mensaje: esAcuerdoComercial ? 'Acuerdo enviado por WhatsApp.' : 'Mensaje de WhatsApp enviado.',
      data: hilo,
    });
  } catch (errTx) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: errTx.message });
  } finally {
    client.release();
  }
};

/**
 * Permite invocar la sincronización manual inmediata de la bandeja de entrada.
 */
const sincronizarGmailManual = async (_req, res) => {
  try {
    ultimaSincronizacion = 0;
    const resultado = await ejecutarSincronizacionAutomatica();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Actualiza el estado de lectura de una conversación cuando el usuario la abre.
 * Marca todos los mensajes del cliente como leídos de manera persistente en `resumen` JSON.
 */
const marcarLeido = async (req, res) => {
  const { id } = req.params;
  const str = String(id).trim();
  const byUuid = esUuid(str);

  try {
    const { rows: cRows } = await pool.query(
      `SELECT id FROM canales_contacto WHERE ${byUuid ? 'id = $1' : 'codigo = $1'} LIMIT 1`,
      [str]
    );
    if (!cRows.length) {
      return res.status(404).json({ error: 'Conversación no encontrada.' });
    }

    const canalId = cRows[0].id;

    // Actualizar mensajes no leídos del cliente en este canal
    const { rows: msgs } = await pool.query(
      `SELECT id, resumen FROM mensajes_entrantes
       WHERE canal_id = $1 AND de = 'cliente'`,
      [canalId]
    );

    let actualizados = 0;
    for (const m of msgs) {
      let meta = {};
      try {
        if (m.resumen) meta = JSON.parse(m.resumen);
      } catch (_) {}

      if (meta.leido !== true) {
        meta.leido = true;
        meta.fechaLeido = new Date().toISOString();
        await pool.query(
          `UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2`,
          [JSON.stringify(meta), m.id]
        );
        actualizados++;
      }
    }

    const hilo = await fetchHiloCompleto(canalId);
    if (actualizados > 0) {
      notificarNovedadComunicaciones({ tipo: 'leido', canalId });
    }

    return res.json({ ok: true, actualizados, data: hilo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Consulta ultraligera de revisión: comprueba sincrónicamente novedades de Gmail (cada 4s)
 * y devuelve versión basada en total de mensajes, timestamps y canales.
 * Evita recargas forzadas y consultas completas innecesarias cuando no hay actividad nueva.
 */
const revisionComunicaciones = async (_req, res) => {
  try {
    // Sincronizar automáticamente en segundo plano si han pasado al menos 4 segundos
    await ejecutarSincronizacionAutomatica().catch(() => {});

    const { rows: countRows } = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM mensajes_entrantes) AS total_msgs,
         (SELECT COALESCE(MAX(marca_tiempo), '1970-01-01'::timestamptz) FROM mensajes_entrantes) AS ultimo_ts_msg,
         (SELECT COUNT(*) FROM canales_contacto) AS total_canales,
         (SELECT COALESCE(MAX(created_at), '1970-01-01'::timestamptz) FROM canales_contacto) AS ultimo_ts_canal,
         (SELECT COUNT(*) FROM mensajes_entrantes WHERE resumen LIKE '%"leido":true%') AS total_leidos`
    );
    const totalMsgs = parseInt(countRows[0]?.total_msgs || '0', 10);
    const ultimoTsMsg = countRows[0]?.ultimo_ts_msg ? new Date(countRows[0].ultimo_ts_msg).getTime() : 0;
    const totalCanales = parseInt(countRows[0]?.total_canales || '0', 10);
    const ultimoTsCanal = countRows[0]?.ultimo_ts_canal ? new Date(countRows[0].ultimo_ts_canal).getTime() : 0;
    const totalLeidos = parseInt(countRows[0]?.total_leidos || '0', 10);

    const version = `${totalMsgs}_${ultimoTsMsg}_${totalCanales}_${ultimoTsCanal}_${totalLeidos}`;

    res.json({
      total: totalMsgs,
      ultimoTs: ultimoTsMsg,
      version,
      sseClients: sseClients.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listarComunicaciones,
  enviarMensaje,
  reintentarEnvioMensaje,
  nuevoCorreo,
  nuevoWhatsApp,
  sincronizarGmailManual,
  marcarLeido,
  revisionComunicaciones,
  streamComunicaciones,
  notificarNovedadComunicaciones,
};
