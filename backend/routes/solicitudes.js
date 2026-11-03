// ============================================================
// routes/solicitudes.js — Rutas para el módulo de Solicitudes Comerciales
// ============================================================
const express = require('express');
const router = express.Router();
const solicitudesController = require('../controllers/solicitudesController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, solicitudesController.listarSolicitudes);

router.post(
  '/',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'gerente'),
  solicitudesController.crearSolicitud
);

router.patch(
  '/:id/enviar',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'gerente'),
  solicitudesController.enviarAValidacion
);

router.patch(
  '/:id/devolver',
  verificarToken,
  verificarRol('coord', 'gerente'),
  solicitudesController.devolverSolicitud
);

router.patch(
  '/:id/rechazar',
  verificarToken,
  verificarRol('coord', 'gerente'),
  solicitudesController.rechazarSolicitud
);

router.post(
  '/:id/validar',
  verificarToken,
  verificarRol('coord', 'gerente'),
  solicitudesController.validarSolicitud
);

module.exports = router;
