const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth');
const {
  listarComunicaciones,
  enviarMensaje,
} = require('../controllers/comunicacionesController');

router.use(verificarToken);

router.get('/', listarComunicaciones);
router.post(
  '/:id/mensajes',
  verificarRol('ejecutiva', 'coord', 'disenador', 'produccion', 'postventa', 'gerente'),
  enviarMensaje
);

module.exports = router;
