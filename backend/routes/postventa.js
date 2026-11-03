// ============================================================
// routes/postventa.js — Rutas para el módulo de Postventa
// ============================================================
const express = require('express');
const router = express.Router();
const postventaController = require('../controllers/postventaController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, postventaController.listarPostventa);

router.post(
  '/',
  verificarToken,
  verificarRol('postventa', 'ejecutiva', 'coord', 'gerente', 'cliente'),
  upload.single('archivo'),
  postventaController.crearPostventa
);

router.patch(
  '/:id',
  verificarToken,
  verificarRol('postventa', 'ejecutiva', 'coord', 'gerente', 'cliente'),
  postventaController.actualizarPostventa
);

router.patch(
  '/:id/resolver',
  verificarToken,
  verificarRol('postventa', 'ejecutiva', 'coord', 'gerente'),
  (req, res, next) => {
    req.body.estado = 'Resuelto';
    next();
  },
  postventaController.actualizarPostventa
);

router.patch(
  '/:id/calificar',
  verificarToken,
  verificarRol('postventa', 'ejecutiva', 'coord', 'gerente', 'cliente'),
  postventaController.actualizarPostventa
);

module.exports = router;
