// ============================================================
// routes/ordenes.js — Rutas para el módulo de Órdenes
// ============================================================
const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, ordenesController.listarOrdenes);
router.get('/:id', verificarToken, ordenesController.obtenerOrdenPorId);
router.get('/:id/historial', verificarToken, ordenesController.obtenerHistorialOrden);

router.post(
  '/',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'gerente'),
  ordenesController.crearOrden
);

router.patch(
  '/:id/etapa',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'produccion', 'disenador', 'postventa', 'gerente'),
  ordenesController.actualizarEtapa
);

router.patch(
  '/:id/asignacion',
  verificarToken,
  verificarRol('coord', 'gerente'),
  ordenesController.actualizarAsignacionOrden
);

router.post(
  '/:id/entrega',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'produccion', 'postventa', 'gerente'),
  ordenesController.registrarEntrega
);

router.post(
  '/:id/cerrar',
  verificarToken,
  verificarRol('coord', 'postventa', 'ejecutiva', 'gerente'),
  ordenesController.cerrarOrden
);

router.post(
  '/:id/reabrir',
  verificarToken,
  verificarRol('coord', 'postventa', 'ejecutiva', 'gerente'),
  ordenesController.reabrirOrden
);

router.post(
  '/:id/clonar',
  verificarToken,
  verificarRol('coord', 'postventa', 'ejecutiva', 'gerente'),
  ordenesController.clonarOrden
);

module.exports = router;
