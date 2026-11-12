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

// Edición de datos generales de la orden (Coordinador y Gerencia)
router.patch('/:id', verificarToken, verificarRol('coord', 'gerente'), ordenesController.actualizarOrden);

// Archivar y restaurar órdenes de producción
router.patch('/:id/archivar', verificarToken, verificarRol('coord', 'gerente'), ordenesController.archivarOrden);
router.patch('/:id/restaurar', verificarToken, verificarRol('coord', 'gerente'), ordenesController.restaurarOrden);

// Eliminación permanente segura (verificando dependencias)
router.delete('/:id', verificarToken, verificarRol('coord', 'gerente'), ordenesController.eliminarOrden);

// Creación formal de orden de producción vinculada a solicitud (exclusivo Coordinador)
router.post(
  '/',
  verificarToken,
  asociarCapacidad('ordenes.crear'),
  verificarRol('coord'),
  ordenesController.crearOrden
);

// Transición de etapa global de la orden en planta (Exclusivo Coordinación de Producción)
router.patch(
  '/:id/etapa',
  verificarToken,
  asociarCapacidad('ordenes.etapa'),
  verificarRol('coord'),
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

// Registro formal de entrega y remisión (Coordinación de Producción o Postventa)
router.post(
  '/:id/entrega',
  verificarToken,
  asociarCapacidad('ordenes.entrega'),
  verificarRol('coord', 'postventa'),
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
