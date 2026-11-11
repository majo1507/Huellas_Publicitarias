// ============================================================
// routes/postventa.js — Rutas para el módulo de Postventa
// ============================================================
const express = require('express');
const router = express.Router();
const postventaController = require('../controllers/postventaController');
const upload = require('../middleware/upload');
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');

router.get('/', verificarToken, postventaController.listarPostventa);

// Radicación de casos, quejas y solicitudes de garantía
router.post(
  '/',
  verificarToken,
  asociarCapacidad('postventa.crear'),
  // Gerencia supervisa y consulta; no radica casos (acción operativa de Postventa, Comercial o Coordinación).
  verificarRol('postventa', 'ejecutiva', 'coord'),
  upload.single('archivo'),
  postventaController.crearPostventa
);

// Actualización y seguimiento de caso de postventa
router.patch(
  '/:id',
  verificarToken,
  asociarCapacidad('postventa.editar'),
  verificarRol('postventa', 'coord'),
  postventaController.actualizarPostventa
);

// Resolución y dictamen técnico formal de reclamación / garantía (excluye Comercial y Gerencia directa)
router.patch(
  '/:id/resolver',
  verificarToken,
  asociarCapacidad('postventa.resolver'),
  verificarRol('postventa', 'coord'),
  (req, res, next) => {
    req.body.estado = 'Resuelto';
    next();
  },
  postventaController.actualizarPostventa
);

// Calificación de satisfacción del servicio (1 a 5 estrellas, cliente o postventa tras llamada)
router.patch(
  '/:id/calificar',
  verificarToken,
  asociarCapacidad('postventa.calificar'),
  verificarRol('cliente', 'postventa'),
  postventaController.actualizarPostventa
);

// Solicitud formal de reimpresión por garantía (Postventa y Coordinación)
router.patch(
  '/:id/solicitar-reimpresion',
  verificarToken,
  asociarCapacidad('postventa.solicitar_reimpresion'),
  verificarRol('postventa', 'coord'),
  postventaController.solicitarReimpresion
);

// Autorización técnica y generación formal de OP de reimpresión a costo cero (EXCLUSIVO Coordinación)
router.post(
  '/:id/autorizar-reimpresion',
  verificarToken,
  asociarCapacidad('reimpresiones.autorizar'),
  verificarRol('coord'),
  postventaController.autorizarReimpresion
);

module.exports = router;
