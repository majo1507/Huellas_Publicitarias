// ============================================================
// routes/disenos.js — Rutas para el módulo de Archivos de Arte
// ============================================================
const express = require('express');
const router = express.Router();
const disenosController = require('../controllers/disenosController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

router.get('/orden/:orden_id', verificarToken, disenosController.listarVersionesPorOrden);

// Registro de nuevas versiones de arte (exclusivo Diseñador y Coordinador)
router.post(
  '/orden/:orden_id',
  verificarToken,
  asociarCapacidad('disenos.crear'),
  verificarRol('disenador', 'coord'),
  disenosController.crearVersion
);

// Envío formal de propuesta gráfica a revisión (exclusivo Diseñador y Coordinador)
router.patch(
  '/orden/:orden_id/enviar',
  verificarToken,
  asociarCapacidad('disenos.enviar'),
  verificarRol('disenador', 'coord'),
  disenosController.enviarDiseno
);

// Decisión formal de aprobación o rechazo de diseño (Cliente, Comercial, Coordinador)
router.patch(
  '/orden/:orden_id/aprobacion',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva', 'coord', 'cliente'),
  disenosController.aprobarORechazarDiseno
);

router.patch(
  '/:id/aprobacion',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva', 'coord', 'cliente'),
  disenosController.aprobarORechazarDiseno
);

// Adjuntar soporte documental de aprobación externa
router.patch(
  '/orden/:orden_id/soporte',
  verificarToken,
  asociarCapacidad('disenos.soporte'),
  verificarRol('ejecutiva', 'coord'),
  upload.single('archivo'),
  disenosController.adjuntarSoporteAprobacion
);

router.patch(
  '/:id/soporte',
  verificarToken,
  asociarCapacidad('disenos.soporte'),
  verificarRol('ejecutiva', 'coord'),
  upload.single('archivo'),
  disenosController.adjuntarSoporteAprobacion
);

// Carga física de archivo para una versión
router.post(
  '/upload/orden/:orden_id',
  verificarToken,
  asociarCapacidad('disenos.upload'),
  verificarRol('disenador', 'coord'),
  upload.single('archivo'),
  disenosController.subirArchivoVersion
);

module.exports = router;
