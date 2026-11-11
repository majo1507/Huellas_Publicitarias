const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');
const {
  listarComunicaciones,
  enviarMensaje,
  reintentarEnvioMensaje,
  nuevoCorreo,
  nuevoWhatsApp,
  sincronizarGmailManual,
  marcarLeido,
  revisionComunicaciones,
  streamComunicaciones,
} = require('../controllers/comunicacionesController');
const {
  adminSetup,
  iniciarAutorizacion,
  procesarCallback,
  obtenerEstadoConexion,
  desconectar,
} = require('../controllers/gmailController');
const {
  verificarWebhook: verificarWebhookWhatsApp,
  recibirWebhook: recibirWebhookWhatsApp,
  obtenerEstadoWhatsApp,
} = require('../controllers/whatsappController');

// Acceso administrativo para configuración y callback de Google OAuth 2.0
router.get('/gmail/admin/setup', adminSetup);
router.get('/gmail/callback', procesarCallback);

// Webhooks públicos de Meta WhatsApp Cloud API (sin token JWT para permitir suscripción de Meta)
router.get('/whatsapp/webhook', verificarWebhookWhatsApp);
router.post('/whatsapp/webhook', recibirWebhookWhatsApp);

// A partir de aquí todas las rutas requieren sesión autenticada con token JWT
router.use(verificarToken);

// Consulta del estado de WhatsApp Cloud API
router.get(
  '/whatsapp/estado',
  verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'),
  obtenerEstadoWhatsApp
);

// Endpoints OAuth 2.0 de Gmail protegidos por rol
router.get(
  '/gmail/auth',
  verificarRol('gerente'),
  iniciarAutorizacion
);

router.get(
  '/gmail/estado',
  verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'),
  obtenerEstadoConexion
);

router.post(
  '/gmail/desconectar',
  verificarRol('gerente'),
  desconectar
);

// Stream de eventos Server-Sent Events (SSE) para actualización en tiempo real
router.get('/stream', streamComunicaciones);

// Verificación rápida de novedades (1ms) para sondeo inteligente
router.get('/revision', revisionComunicaciones);

// Sincronización manual bajo demanda de correos recibidos
router.post(
  '/gmail/sincronizar',
  verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'),
  sincronizarGmailManual
);

// Enviar nuevo correo electrónico a cualquier destinatario externo (sin cliente ni orden previa requerida)
router.post(
  '/nuevo-correo',
  asociarCapacidad('comunicaciones.responder'),
  verificarRol('ejecutiva', 'postventa'),
  nuevoCorreo
);

// Enviar nuevo mensaje de WhatsApp a cualquier destinatario externo
router.post(
  '/nuevo-whatsapp',
  asociarCapacidad('comunicaciones.responder'),
  verificarRol('ejecutiva', 'postventa'),
  nuevoWhatsApp
);

// Consulta centralizada de comunicaciones: Comercial, Coordinación, Postventa y Gerencia
router.get(
  '/',
  verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'),
  listarComunicaciones
);

// Administración de conversaciones y registro de acuerdos/respuestas con el cliente:
// Exclusivo de Comercial / Recepción (ejecutiva) y Atención Postventa (postventa).
// Coordinación y Gerencia tienen acceso de consulta y supervisión, sin administrar conversaciones.
router.post(
  '/:id/mensajes',
  asociarCapacidad('comunicaciones.responder'),
  verificarRol('ejecutiva', 'postventa'),
  enviarMensaje
);

// Marcar conversación como leída al abrirla
router.patch(
  '/:id/leido',
  asociarCapacidad('comunicaciones.responder'),
  verificarRol('ejecutiva', 'postventa'),
  marcarLeido
);

// Reintentar envío de correo fallido (idempotente y sin duplicar)
router.post(
  '/:id/mensajes/:mensajeId/reintentar',
  asociarCapacidad('comunicaciones.responder'),
  verificarRol('ejecutiva', 'postventa'),
  reintentarEnvioMensaje
);

module.exports = router;
