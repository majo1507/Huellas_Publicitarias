// ============================================================
// routes/disenos.js — Rutas para el módulo de Archivos de Arte
// ORVEX — Huellas Publicidad S.A.S.
// Flujo: Diseño -> Comercial / Recepción -> Cliente -> Coordinación / Taller
// ============================================================
const express = require('express');
const router = express.Router();
const disenosController = require('../controllers/disenosController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

// Consulta de versiones de arte de una orden
router.get('/orden/:orden_id', verificarToken, disenosController.listarVersionesPorOrden);

// Registro de nuevas versiones de arte (exclusivo Diseñador y Coordinador)
router.post(
  '/orden/:orden_id',
  verificarToken,
  asociarCapacidad('disenos.crear'),
  verificarRol('disenador', 'coord'),
  disenosController.crearVersion
);

// Envío formal de propuesta gráfica a Comercial (exclusivo Diseñador y Coordinador)
router.patch(
  '/orden/:orden_id/enviar',
  verificarToken,
  asociarCapacidad('disenos.enviar'),
  verificarRol('disenador', 'coord'),
  disenosController.enviarDiseno
);

router.patch(
  '/orden/:orden_id/enviar-comercial',
  verificarToken,
  asociarCapacidad('disenos.enviar'),
  verificarRol('disenador', 'coord'),
  disenosController.enviarDiseno
);

// Gestión comercial de la propuesta con el cliente (exclusivo Comercial / Recepción; retirado de Coordinación)
// Permite registrar: aprobación con evidencia, solicitud de modificaciones o espera de respuesta
router.patch(
  '/orden/:orden_id/gestion-comercial',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva'),
  upload.single('archivo'),
  disenosController.gestionarPropuestaComercial
);

router.patch(
  '/:id/gestion-comercial',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva'),
  upload.single('archivo'),
  disenosController.gestionarPropuestaComercial
);

// Compatibilidad formal de aprobación o rechazo (exclusivo Comercial / Recepción; Coordinación y diseñador bloqueados)
router.patch(
  '/orden/:orden_id/aprobacion',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva'),
  disenosController.aprobarORechazarDiseno
);

router.patch(
  '/:id/aprobacion',
  verificarToken,
  asociarCapacidad('disenos.aprobar'),
  verificarRol('ejecutiva'),
  disenosController.aprobarORechazarDiseno
);

// Liberación formal para impresión tras verificación de aprobación (automática / Comercial; retirado de Coordinación)
router.patch(
  '/orden/:orden_id/liberar-impresion',
  verificarToken,
  asociarCapacidad('disenos.liberar'),
  verificarRol('ejecutiva'),
  disenosController.liberarParaImpresion
);

// Adjuntar soporte documental de aprobación externa (exclusivo Comercial / Recepción)
router.patch(
  '/orden/:orden_id/soporte',
  verificarToken,
  asociarCapacidad('disenos.soporte'),
  verificarRol('ejecutiva'),
  upload.single('archivo'),
  disenosController.adjuntarSoporteAprobacion
);

router.patch(
  '/:id/soporte',
  verificarToken,
  asociarCapacidad('disenos.soporte'),
  verificarRol('ejecutiva'),
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
