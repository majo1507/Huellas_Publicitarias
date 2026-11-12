// ============================================================
// routes/solicitudes.js — Rutas para el módulo de Solicitudes Comerciales
// ============================================================
const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

router.get('/', verificarToken, verificarRol('ejecutiva', 'coord', 'gerente'), solicitudesController.listarSolicitudes);

// Edición de datos generales de la solicitud (previo a conversión)
router.patch('/:id', verificarToken, verificarRol('ejecutiva', 'gerente'), solicitudesController.actualizarSolicitud);

// Archivar y restaurar solicitudes
router.patch('/:id/archivar', verificarToken, verificarRol('ejecutiva', 'gerente'), solicitudesController.archivarSolicitud);
router.patch('/:id/restaurar', verificarToken, verificarRol('ejecutiva', 'gerente'), solicitudesController.restaurarSolicitud);

// Eliminación permanente segura (solo solicitudes no convertidas)
router.delete('/:id', verificarToken, verificarRol('ejecutiva', 'gerente'), solicitudesController.eliminarSolicitud);

// Registro inicial de solicitudes en borrador (exclusivo Comercial / Recepción y Gerencia)
router.post(
  '/',
  verificarToken,
  asociarCapacidad('solicitudes.crear'),
  verificarRol('ejecutiva', 'gerente'),
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

// Devolución para corrección con observaciones técnicas (Coordinación de producción, Comercial o Gerencia)
router.patch(
  '/:id/devolver',
  verificarToken,
  asociarCapacidad('solicitudes.devolver'),
  verificarRol('coord', 'ejecutiva', 'gerente'),
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

// Validación y conversión transaccional a Orden de Producción (Exclusivo Coordinación de Producción)
router.post(
  '/:id/validar',
  verificarToken,
  asociarCapacidad('solicitudes.validar'),
  verificarRol('coord'),
  solicitudesController.validarSolicitud
);

module.exports = router;
