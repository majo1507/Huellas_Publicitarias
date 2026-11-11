// ============================================================
// routes/ordenes.js — Rutas para el módulo de Órdenes de Producción
// ============================================================
const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

router.get('/', verificarToken, ordenesController.listarOrdenes);
router.get('/:id', verificarToken, ordenesController.obtenerOrdenPorId);
router.get('/:id/historial', verificarToken, ordenesController.obtenerHistorialOrden);

// Creación formal de orden de producción vinculada a solicitud (exclusivo Coordinador)
router.post(
  '/',
  verificarToken,
  asociarCapacidad('ordenes.crear'),
  verificarRol('coord'),
  ordenesController.crearOrden
);

// Transición de etapa global de la orden en planta (controlada automáticamente por ORVEX según avance de actividades y aprobaciones; bloqueada para avance manual)
router.patch(
  '/:id/etapa',
  verificarToken,
  asociarCapacidad('ordenes.etapa'),
  verificarRol('sistema_automatico'),
  ordenesController.actualizarEtapa
);

// Asignación de equipo de trabajo (exclusivo Coordinador)
router.patch(
  '/:id/asignacion',
  verificarToken,
  asociarCapacidad('ordenes.asignar'),
  verificarRol('coord'),
  ordenesController.actualizarAsignacionOrden
);

// Registro formal de entrega y remisión (Comercial/Recepción y Postventa; retirado de Coordinación)
router.post(
  '/:id/entrega',
  verificarToken,
  asociarCapacidad('ordenes.entrega'),
  verificarRol('ejecutiva', 'postventa'),
  upload.single('evidencia'),
  ordenesController.registrarEntrega
);

// Cierre formal de la orden (exclusivo Coordinador con candado postventa)
router.post(
  '/:id/cerrar',
  verificarToken,
  asociarCapacidad('ordenes.cerrar'),
  verificarRol('coord'),
  ordenesController.cerrarOrden
);

// Reapertura justificada de la orden (exclusivo Coordinador)
router.post(
  '/:id/reabrir',
  verificarToken,
  asociarCapacidad('ordenes.reabrir'),
  verificarRol('coord'),
  ordenesController.reabrirOrden
);

// Autorización y emisión de orden de reimpresión (exclusivo Coordinador)
router.post(
  '/:id/clonar',
  verificarToken,
  asociarCapacidad('ordenes.clonar'),
  verificarRol('coord'),
  ordenesController.clonarOrden
);

module.exports = router;
