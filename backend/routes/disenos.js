// ============================================================
// routes/disenos.js — Rutas para el módulo de Archivos de Arte
// ============================================================
const express = require('express');
const router = express.Router();
const disenosController = require('../controllers/disenosController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/orden/:orden_id', verificarToken, disenosController.listarVersionesPorOrden);

router.post(
  '/orden/:orden_id',
  verificarToken,
  verificarRol('disenador', 'coord', 'gerente'),
  disenosController.crearVersion
);

router.patch(
  '/orden/:orden_id/enviar',
  verificarToken,
  verificarRol('disenador', 'coord', 'gerente'),
  disenosController.enviarDiseno
);

router.patch(
  '/orden/:orden_id/aprobacion',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'disenador', 'gerente', 'cliente'),
  disenosController.aprobarORechazarDiseno
);

router.patch(
  '/:id/aprobacion',
  verificarToken,
  verificarRol('ejecutiva', 'coord', 'disenador', 'gerente', 'cliente'),
  disenosController.aprobarORechazarDiseno
);

router.post(
  '/upload/orden/:orden_id',
  verificarToken,
  verificarRol('disenador', 'coord', 'gerente'),
  upload.single('archivo'),
  disenosController.subirArchivoVersion
);

module.exports = router;
