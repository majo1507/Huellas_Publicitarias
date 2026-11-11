// ============================================================
// controllers/whatsappController.js — Controlador Webhook y Estado Meta WhatsApp
// ============================================================
const { pool } = require('../db');
const whatsappService = require('../services/whatsappService');
const {
  formatearFechaHoy,
  formatearHoraAhora,
  obtenerUsuarioPorDefecto,
} = require('../utils/resolvers');

let notificarNovedadComunicacionesFn = null;

function setNotificadorComunicaciones(fn) {
  notificarNovedadComunicacionesFn = fn;
}

function notificar(evento) {
  if (typeof notificarNovedadComunicacionesFn === 'function') {
    try {
      notificarNovedadComunicacionesFn(evento);
    } catch (_) {}
  }
}

/**
 * Endpoint GET para la verificación de suscripción de Meta (Challenge Handshake)
 * GET /api/comunicaciones/whatsapp/webhook
 */
const verificarWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (whatsappService.validarVerifyToken(mode, token)) {
    console.log('✅ [WhatsAppWebhook] Verificación de webhook exitosa desde Meta Developers.');
    return res.status(200).send(challenge);
  }

  console.warn('❌ [WhatsAppWebhook] Rechazo en verificación: verify_token no coincide.', { mode });
  return res.status(403).json({ error: 'Verify token de webhook inválido o ausente.' });
};

/**
 * Endpoint POST para la recepción de mensajes y estados de entrega desde Meta
 * POST /api/comunicaciones/whatsapp/webhook
 */
const recibirWebhook = async (req, res) => {
  // Regla estricta de Meta: responder 200 OK inmediatamente para evitar reintentos y timeouts
  res.sendStatus(200);

  try {
    // Validar firma criptográfica HMAC si WHATSAPP_APP_SECRET está configurado
    const firmaHeader = req.headers['x-hub-signature-256'];
    const esFirmaValida = whatsappService.validarFirma(req.rawBody || JSON.stringify(req.body), firmaHeader);
    if (!esFirmaValida) {
      console.warn('⚠️ [WhatsAppWebhook] Firma HMAC inválida en petición entrante.');
      return;
    }

    const { mensajes, estados } = whatsappService.procesarPayloadWebhook(req.body);

    // 1. Procesar mensajes entrantes de clientes
    for (const msg of mensajes) {
      await procesarMensajeEntrante(msg).catch((err) => {
        console.error('[WhatsAppWebhook] Error al procesar mensaje entrante:', err.message);
      });
    }

    // 2. Procesar estados de entrega de mensajes salientes (sent, delivered, read, failed)
    for (const st of estados) {
      await procesarEstadoMensaje(st).catch((err) => {
        console.error('[WhatsAppWebhook] Error al procesar estado de mensaje:', err.message);
      });
    }
  } catch (err) {
    console.error('[WhatsAppWebhook] Error global en procesamiento de webhook:', err.message);
  }
};

/**
 * Procesa un mensaje entrante de un cliente, vinculándolo al cliente e hilo correspondiente
 */
async function procesarMensajeEntrante(msg) {
  // Prevención de duplicados por reintentos de Meta
  const { rows: duplicados } = await pool.query(
    `SELECT id FROM mensajes_entrantes WHERE resumen LIKE $1 LIMIT 1`,
    [`%"whatsappMessageId":"${msg.id}"%`]
  );

  if (duplicados.length > 0) {
    return;
  }

  const telNormalizado = whatsappService.normalizarTelefono(msg.from);
  const ultimosDigitos = telNormalizado.slice(-8); // Para búsqueda tolerante de números

  // 1. Buscar cliente por número de teléfono
  const { rows: clientesExistentes } = await pool.query(
    `SELECT * FROM clientes
     WHERE REGEXP_REPLACE(telefono, '[^0-9]', '', 'g') LIKE $1
     LIMIT 1`,
    [`%${ultimosDigitos}`]
  );

  let clienteRow = clientesExistentes[0] || null;

  // Si el cliente no existe, crear un prospecto comercial automáticamente respetando el modelo
  if (!clienteRow) {
    const defaultEjecutiva = await obtenerUsuarioPorDefecto(pool, 'ejecutiva');
    const nuevoCodigo = `CLI-WA-${Date.now().toString().slice(-6)}`;
    const nitRandom = `WA-${Date.now().toString().slice(-6)}`;
    const nombreContacto = msg.name || `Contacto WhatsApp (+${telNormalizado})`;

    const { rows: nuevoCliente } = await pool.query(
      `INSERT INTO clientes (
         empresa, nit, contacto_principal, telefono, ejecutiva_id, estado, codigo
       ) VALUES ($1, $2, $3, $4, $5, 'Activo', $6)
       RETURNING *`,
      [
        nombreContacto,
        nitRandom,
        nombreContacto,
        `+${telNormalizado}`,
        defaultEjecutiva?.id || null,
        nuevoCodigo,
      ]
    );
    clienteRow = nuevoCliente[0];
  }

  // 2. Buscar conversación de WhatsApp activa para este cliente
  const { rows: hilosExistentes } = await pool.query(
    `SELECT * FROM canales_contacto
     WHERE canal = 'wa' AND cliente_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [clienteRow.id]
  );

  let canalRow = hilosExistentes[0] || null;

  if (canalRow) {
    // Actualizar estado a 'Pendiente de respuesta' para alertar a la ejecutiva
    await pool.query(
      `UPDATE canales_contacto SET estado = 'Pendiente de respuesta' WHERE id = $1`,
      [canalRow.id]
    );
  } else {
    // Generar nuevo código de comunicación COM-XXX sin colisiones
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
       ) VALUES ('wa', $1, $2, 'Pendiente de respuesta', $3, $4, $5)
       RETURNING *`,
      [
        clienteRow.id,
        'Atención comercial WhatsApp',
        defaultEjecutiva?.nombre_completo || 'Ana Martínez',
        defaultEjecutiva?.id || null,
        nuevoCodigoCom,
      ]
    );
    canalRow = nuevoCanal[0];
  }

  // 3. Insertar mensaje en mensajes_entrantes
  const fechaTexto = formatearFechaHoy(new Date(msg.timestamp));
  const horaTexto = formatearHoraAhora(new Date(msg.timestamp));

  const metadataResumen = JSON.stringify({
    whatsappMessageId: msg.id,
    from: msg.from,
    name: msg.name,
    numeroEmpresarial: msg.numeroEmpresarial || '',
    phoneNumberId: msg.phoneNumberId || '',
    canal: 'wa',
    leido: false,
    tipo: msg.type,
    estadoEnvio: 'recibido',
  });

  await pool.query(
    `INSERT INTO mensajes_entrantes (
       canal_id, remitente, texto, de, fecha_texto, hora_texto, marca_tiempo, adjuntos, resumen
     ) VALUES ($1, $2, $3, 'cliente', $4, $5, $6, $7, $8)`,
    [
      canalRow.id,
      msg.name || clienteRow.contacto_principal || `+${telNormalizado}`,
      msg.text || '[Mensaje de WhatsApp]',
      fechaTexto,
      horaTexto,
      new Date(msg.timestamp),
      JSON.stringify(msg.adjuntos || []),
      metadataResumen,
    ]
  );

  console.log(`💬 [WhatsAppWebhook] Mensaje entrante registrado de ${msg.from} en conversación ${canalRow.codigo || canalRow.id}.`);

  // 4. Emitir notificación en tiempo real a los clientes de ORVEX conectados (SSE)
  notificar({
    tipo: 'nuevo_mensaje',
    canalId: canalRow.id,
    canal: 'wa',
    de: 'cliente',
    remitente: msg.name || clienteRow.contacto_principal,
  });
}

/**
 * Procesa notificaciones de estado de mensajes salientes (sent, delivered, read, failed)
 */
async function procesarEstadoMensaje(st) {
  const { rows: mensajes } = await pool.query(
    `SELECT id, canal_id, resumen FROM mensajes_entrantes
     WHERE resumen LIKE $1 LIMIT 1`,
    [`%"whatsappMessageId":"${st.id}"%`]
  );

  if (mensajes.length === 0) return;

  const msgRow = mensajes[0];
  let meta = {};
  try {
    meta = JSON.parse(msgRow.resumen || '{}');
  } catch (_) {}

  meta.estadoEnvio = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
  meta.ultimaActualizacionEstado = Date.now();
  if (st.errors && st.errors.length > 0) {
    meta.error = st.errors[0]?.message || 'Error en entrega de WhatsApp';
  }

  await pool.query(
    `UPDATE mensajes_entrantes SET resumen = $1 WHERE id = $2`,
    [JSON.stringify(meta), msgRow.id]
  );

  // Emitir evento en vivo a la interfaz para actualizar los ticks / insignias
  notificar({
    tipo: 'estado_mensaje',
    canalId: msgRow.canal_id,
    mensajeId: msgRow.id,
    whatsappMessageId: st.id,
    estadoEnvio: st.status,
    canal: 'wa',
  });
}

/**
 * Consulta el estado de configuración y conectividad de WhatsApp
 * GET /api/comunicaciones/whatsapp/estado
 */
const obtenerEstadoWhatsApp = (_req, res) => {
  const estado = whatsappService.obtenerEstado();
  res.json({ ok: true, data: estado });
};

module.exports = {
  verificarWebhook,
  recibirWebhook,
  obtenerEstadoWhatsApp,
  setNotificadorComunicaciones,
};
