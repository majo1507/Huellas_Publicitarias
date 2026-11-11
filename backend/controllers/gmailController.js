// ============================================================
// controllers/gmailController.js — Controlador OAuth 2.0 de Gmail para ORVEX
// Integración Centralizada Corporativa: huellaspublicidad23@gmail.com
// ============================================================
const gmailService = require('../services/gmailService');

/**
 * GET /api/comunicaciones/gmail/admin/setup
 * Endpoint administrativo para configuración inicial y recuperación técnica.
 * Genera la URL con state firmado y redirige directamente a la pantalla de consentimiento de Google.
 */
const adminSetup = async (_req, res) => {
  try {
    const { url } = gmailService.generarUrlAutorizacion('admin_corporativo');
    return res.redirect(url);
  } catch (err) {
    console.error('[GmailController] Error al generar URL de configuración administrativa:', err.message);
    res.status(500).send(`<h3>Error al iniciar configuración de Gmail:</h3><p>${err.message}</p>`);
  }
};

/**
 * GET /api/comunicaciones/gmail/auth
 * Genera la URL de autorización con state criptográfico (formato JSON para herramientas técnicas).
 */
const iniciarAutorizacion = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id || 'admin_corporativo';
    const { url, state } = gmailService.generarUrlAutorizacion(usuarioId);
    res.json({ ok: true, url, state });
  } catch (err) {
    console.error('[GmailController] Error al generar URL de autorización:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/comunicaciones/gmail/callback
 * Endpoint público que recibe la redirección de Google Cloud Console.
 * Valida state, intercambia code por tokens, preserva refresh_token y muestra pantalla de confirmación.
 */
const procesarCallback = async (req, res) => {
  const { code, state, error: errorGoogle, error_description } = req.query;
  const frontendUrl = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',')[0].trim() : 'http://localhost:5173';

  // Si el usuario canceló en la pantalla de Google
  if (errorGoogle) {
    console.warn('[GmailController] Autorización cancelada en Google:', errorGoogle);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>ORVEX — Autorización Cancelada</title><meta charset="utf-8"></head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0;">
          <div style="background: #1e293b; padding: 32px 40px; border-radius: 12px; text-align: center; max-width: 450px; border: 1px solid #ef4444;">
            <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
            <h2 style="margin: 0 0 10px 0; color: #ef4444;">Autorización Cancelada</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">${error_description || errorGoogle}</p>
            <a href="${frontendUrl}/#/comunicaciones" style="background: #334155; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Volver a ORVEX</a>
          </div>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send(`<h3>Error de Callback</h3><p>Parámetros incompletos (falta code o state).</p>`);
  }

  try {
    const resultado = await gmailService.intercambiarCodigoPorTokens(String(code).trim(), String(state).trim());
    console.log(`[GmailController] ✅ Cuenta de Gmail conectada exitosamente a nivel corporativo: ${resultado.email}`);
    
    // Retornar pantalla de confirmación limpia e instruir el regreso a ORVEX
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>ORVEX — Gmail Corporativo Conectado</title><meta charset="utf-8"></head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0;">
          <div style="background: #1e293b; padding: 32px 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 480px; border: 1px solid #10b981;">
            <div style="font-size: 44px; margin-bottom: 12px;">✅</div>
            <h2 style="margin: 0 0 10px 0; color: #10b981;">Gmail Corporativo Conectado</h2>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              La cuenta <strong>${resultado.email}</strong> quedó vinculada de forma centralizada al sistema ORVEX.<br/>
              Los roles autorizados (Comercial/Recepción y Postventa) podrán enviar correos desde esta cuenta corporativa automáticamente sin requerir inicios de sesión adicionales.
            </p>
            <a href="${frontendUrl}/#/comunicaciones" style="display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Ir al Centro de Comunicaciones
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('[GmailController] Error en callback de Gmail:', err.message);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>ORVEX — Error de Vinculación</title><meta charset="utf-8"></head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0;">
          <div style="background: #1e293b; padding: 32px 40px; border-radius: 12px; text-align: center; max-width: 450px; border: 1px solid #ef4444;">
            <div style="font-size: 40px; margin-bottom: 12px;">❌</div>
            <h2 style="margin: 0 0 10px 0; color: #ef4444;">Error al Vincular Gmail</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px;">${err.message}</p>
            <a href="${frontendUrl}/#/comunicaciones" style="background: #334155; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Volver a ORVEX</a>
          </div>
        </body>
      </html>
    `);
  }
};

/**
 * GET /api/comunicaciones/gmail/estado
 * Consulta la disponibilidad de la integración para la interfaz.
 * Accesible a todos los roles autenticados (Comercial, Postventa, Coordinación, Gerencia).
 * No expone tokens ni claves secretas.
 */
const obtenerEstadoConexion = async (_req, res) => {
  try {
    const estado = gmailService.obtenerEstadoConexion();
    res.json(estado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/comunicaciones/gmail/desconectar
 * Endpoint técnico administrativo para revocar token y limpiar almacén.
 */
const desconectar = async (_req, res) => {
  try {
    const resp = await gmailService.desconectarGmail();
    res.json(resp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  adminSetup,
  iniciarAutorizacion,
  procesarCallback,
  obtenerEstadoConexion,
  desconectar,
};
