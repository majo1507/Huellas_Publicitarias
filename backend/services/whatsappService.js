// ============================================================
// services/whatsappService.js — Servicio Oficial Meta WhatsApp Cloud API
// ============================================================
const crypto = require('crypto');

function getConfig() {
  return {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'orvex_wa_verify_2026_secure',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    numeroOficial: process.env.WHATSAPP_OFFICIAL_NUMBER || '+57 311 608 8542',
    numeroPrueba: process.env.WHATSAPP_TEST_NUMBER || '+1 555-182-2920',
  };
}

/**
 * Normaliza cualquier formato de teléfono a formato internacional E.164 sin '+' ni espacios
 * Ejemplo: '311 608 8542' -> '573116088542', '+57 300 111 2233' -> '573001112233'
 */
function normalizarTelefono(tel) {
  if (!tel) return '';
  let limpio = String(tel).replace(/\D/g, '');
  // Número móvil de Colombia de 10 dígitos que comienza con 3 -> anteponer 57
  if (limpio.length === 10 && limpio.startsWith('3')) {
    limpio = '57' + limpio;
  }
  return limpio;
}

/**
 * Comprueba si la integración de WhatsApp Cloud API tiene credenciales configuradas
 */
function estaConfigurado() {
  const cfg = getConfig();
  return Boolean(cfg.phoneNumberId && cfg.accessToken);
}

/**
 * Obtiene el estado resumido del canal de WhatsApp (sin exponer secretos)
 */
function obtenerEstado() {
  const cfg = getConfig();
  const configurado = estaConfigurado();
  return {
    conectado: configurado,
    numeroOficial: cfg.numeroOficial,
    numeroPrueba: cfg.numeroPrueba,
    phoneNumberIdConfigurado: Boolean(cfg.phoneNumberId),
    wabaIdConfigurado: Boolean(cfg.businessAccountId),
    apiVersion: cfg.apiVersion,
    modo: configurado ? 'cloud_api' : 'simulado_local',
    advertencia: configurado
      ? null
      : 'Credenciales de Meta WhatsApp Cloud API no detectadas. Operando en modo local.',
  };
}

/**
 * Valida el handshake GET de verificación de suscripción de webhook de Meta
 */
function validarVerifyToken(mode, token) {
  const cfg = getConfig();
  return mode === 'subscribe' && token === cfg.verifyToken;
}

/**
 * Valida la firma criptográfica HMAC SHA256 de las notificaciones entrantes de Meta
 */
function validarFirma(rawBody, signatureHeader) {
  const cfg = getConfig();
  if (!cfg.appSecret) {
    // Si no se ha configurado el APP_SECRET, se permite pasar con advertencia de desarrollo
    return true;
  }
  if (!signatureHeader || !rawBody) {
    return false;
  }

  try {
    const [algo, signature] = signatureHeader.split('=');
    if (algo !== 'sha256' || !signature) return false;

    const hmac = crypto.createHmac('sha256', cfg.appSecret);
    hmac.update(rawBody);
    const digest = hmac.digest('hex');

    const expectedBuffer = Buffer.from(signature, 'hex');
    const actualBuffer = Buffer.from(digest, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (err) {
    console.warn('[WhatsAppService] Error al validar firma HMAC:', err.message);
    return false;
  }
}

/**
 * Traduce los códigos de error de Meta Graph API a mensajes comprensibles para el usuario
 */
function traducirErrorMeta(errorData) {
  const code = errorData?.code || errorData?.error_subcode;
  const message = errorData?.message || 'Error desconocido';

  switch (code) {
    case 131026:
    case 131047:
      return 'La ventana de atención de 24 horas de WhatsApp ha expirado. Meta exige el uso de una plantilla pre-aprobada para iniciar contacto fuera de esta ventana.';
    case 131051:
      return 'Tipo de mensaje o formato no admitido por Meta WhatsApp API.';
    case 131009:
      return 'Parámetro requerido faltante o número de teléfono inválido en Meta.';
    case 130429:
      return 'Límite de tasa de envío de WhatsApp superado. Por favor, espera unos momentos antes de reintentar.';
    case 100:
      return 'Credenciales de Meta WhatsApp inválidas o vencidas. Verifica el Access Token y Phone Number ID.';
    case 190:
      return 'El token de acceso de Meta ha caducado. Debe generarse un nuevo token permanente en System Users.';
    default:
      return `Rechazo de WhatsApp Cloud API: ${message} (Código ${code || 'N/A'})`;
  }
}

/**
 * Envía un mensaje de texto a un cliente mediante Meta WhatsApp Cloud API
 */
async function enviarMensajeTexto({ to, texto, replyToMessageId }) {
  const cfg = getConfig();

  if (!estaConfigurado()) {
    const error = new Error('WhatsApp Cloud API no está configurada en las variables de entorno (falta WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID).');
    error.status = 503;
    error.noConfigurado = true;
    throw error;
  }

  const destLimpio = normalizarTelefono(to);
  if (!destLimpio || destLimpio.length < 8) {
    const error = new Error(`El número de teléfono del cliente (${to || 'vacío'}) no es válido para WhatsApp.`);
    error.status = 400;
    throw error;
  }

  const textoLimpio = String(texto || '').trim();
  if (!textoLimpio) {
    const error = new Error('El mensaje no puede estar vacío.');
    error.status = 400;
    throw error;
  }

  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: destLimpio,
    type: 'text',
    text: {
      preview_url: false,
      body: textoLimpio,
    },
  };

  if (replyToMessageId) {
    payload.context = { message_id: replyToMessageId };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) {
    const errorMeta = data.error || {};
    const mensajeAmigable = traducirErrorMeta(errorMeta);
    const error = new Error(mensajeAmigable);
    error.status = response.status || 502;
    error.metaError = errorMeta;
    error.codigoMeta = errorMeta.code;
    throw error;
  }

  const messageId = data?.messages?.[0]?.id || `wa-msg-${Date.now()}`;
  return {
    ok: true,
    messageId,
    to: destLimpio,
    data,
  };
}

/**
 * Parsea el payload entrante de un webhook de Meta y extrae mensajes y estados estructurados
 */
function procesarPayloadWebhook(body) {
  const resultado = {
    mensajes: [],
    estados: [],
  };

  if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
    return resultado;
  }

  for (const entry of body.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      if (!value) continue;

      // 1. Mensajes entrantes de clientes
      if (Array.isArray(value.messages)) {
        const metadata = value.metadata || {};
        const numeroEmpresarial = metadata.display_phone_number || '';
        const phoneNumberId = metadata.phone_number_id || '';

        const contactsMap = new Map();
        if (Array.isArray(value.contacts)) {
          for (const c of value.contacts) {
            contactsMap.set(c.wa_id, c.profile?.name || c.wa_id);
          }
        }

        for (const msg of value.messages) {
          const from = normalizarTelefono(msg.from);
          const name = contactsMap.get(msg.from) || contactsMap.get(from) || from;
          let texto = '';
          const adjuntos = [];

          if (msg.type === 'text') {
            texto = msg.text?.body || '';
          } else if (msg.type === 'image') {
            texto = msg.image?.caption || '[Imagen de WhatsApp]';
            if (msg.image?.id) adjuntos.push(`imagen_wa_${msg.image.id}.jpg`);
          } else if (msg.type === 'document') {
            texto = msg.document?.caption || msg.document?.filename || '[Documento adjunto]';
            if (msg.document?.filename) adjuntos.push(msg.document.filename);
          } else if (msg.type === 'audio' || msg.type === 'voice') {
            texto = '[Nota de voz de WhatsApp]';
            adjuntos.push(`audio_wa_${msg.id}.ogg`);
          } else if (msg.type === 'location') {
            texto = `[Ubicación compartida: Lat ${msg.location?.latitude}, Long ${msg.location?.longitude}]`;
          } else if (msg.type === 'sticker') {
            texto = '[Sticker de WhatsApp]';
          } else if (msg.type === 'reaction') {
            texto = msg.reaction?.emoji ? `[Reacción: ${msg.reaction.emoji}]` : '[Reacción de WhatsApp]';
          } else if (msg.type === 'contacts') {
            const nomC = msg.contacts?.[0]?.name?.formatted_name || msg.contacts?.[0]?.phones?.[0]?.phone || 'Contacto';
            texto = `[Contacto compartido: ${nomC}]`;
          } else if (msg.type === 'button' || msg.type === 'interactive') {
            texto = msg.button?.text || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Respuesta interactiva]';
          } else {
            texto = `[Mensaje de tipo ${msg.type}]`;
          }

          resultado.mensajes.push({
            id: msg.id,
            from,
            name,
            numeroEmpresarial,
            phoneNumberId,
            timestamp: msg.timestamp ? parseInt(msg.timestamp, 10) * 1000 : Date.now(),
            type: msg.type,
            text: texto,
            adjuntos,
            raw: msg,
          });
        }
      }

      // 2. Notificaciones de estado de entrega de mensajes salientes (sent, delivered, read, failed)
      if (Array.isArray(value.statuses)) {
        for (const st of value.statuses) {
          resultado.estados.push({
            id: st.id,
            status: st.status, // 'sent' | 'delivered' | 'read' | 'failed'
            timestamp: st.timestamp ? parseInt(st.timestamp, 10) * 1000 : Date.now(),
            recipientId: normalizarTelefono(st.recipient_id),
            errors: st.errors || null,
          });
        }
      }
    }
  }

  return resultado;
}

module.exports = {
  getConfig,
  normalizarTelefono,
  estaConfigurado,
  obtenerEstado,
  validarVerifyToken,
  validarFirma,
  enviarMensajeTexto,
  procesarPayloadWebhook,
};
