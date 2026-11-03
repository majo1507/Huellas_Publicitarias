const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth');
const {
  listarTareas,
  crearTarea,
  asignarTarea,
  ejecutarAccionTarea,
  actualizarAvanceTarea,
  agregarNotaTarea,
} = require('../controllers/tareasController');

router.use(verificarToken);

router.get('/', listarTareas);
router.post('/', verificarRol('coord', 'gerente'), crearTarea);
router.patch('/:id/asignar', verificarRol('coord', 'gerente'), asignarTarea);
router.patch('/:id/accion', verificarRol('produccion', 'disenador', 'coord', 'gerente'), ejecutarAccionTarea);
router.patch('/:id/avance', verificarRol('produccion', 'disenador', 'coord', 'gerente'), actualizarAvanceTarea);
router.post('/:id/notas', verificarRol('produccion', 'disenador', 'coord', 'gerente'), agregarNotaTarea);

module.exports = router;
