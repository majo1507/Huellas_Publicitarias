// ============================================================
// routes/solicitudes.js — Rutas para el módulo de Solicitudes Comerciales
// ============================================================
const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

router.get('/', verificarToken, solicitudesController.listarSolicitudes);

// Registro inicial de solicitudes en borrador (exclusivo Comercial / Recepción)
router.post(
  '/',
  verificarToken,
  asociarCapacidad('solicitudes.crear'),
  verificarRol('ejecutiva'),
  solicitudesController.crearSolicitud
);

// Envío formal de solicitud a validación técnica (exclusivo Comercial / Recepción)
router.patch(
  '/:id/enviar',
  verificarToken,
  asociarCapacidad('solicitudes.enviar'),
  verificarRol('ejecutiva'),
  solicitudesController.enviarAValidacion
);

// Corrección y reenvío de solicitud devuelta (exclusivo Comercial / Recepción)
router.patch(
  '/:id/corregir',
  verificarToken,
  asociarCapacidad('solicitudes.corregir'),
  verificarRol('ejecutiva'),
  solicitudesController.corregirSolicitud
);

// Devolución para corrección con observaciones (exclusivo Comercial / Recepción)
router.patch(
  '/:id/devolver',
  verificarToken,
  asociarCapacidad('solicitudes.devolver'),
  verificarRol('ejecutiva'),
  solicitudesController.devolverSolicitud
);

// Rechazo definitivo de solicitud inviable (exclusivo Comercial / Recepción)
router.patch(
  '/:id/rechazar',
  verificarToken,
  asociarCapacidad('solicitudes.rechazar'),
  verificarRol('ejecutiva'),
  solicitudesController.rechazarSolicitud
);

// Validación y conversión transaccional a Orden de Producción (exclusivo Comercial / Recepción; retirado de Coordinación)
router.post(
  '/:id/validar',
  verificarToken,
  asociarCapacidad('solicitudes.validar'),
  verificarRol('ejecutiva'),
  solicitudesController.validarSolicitud
);

module.exports = router;
