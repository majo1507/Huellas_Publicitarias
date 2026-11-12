const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol, asociarCapacidad } = require('../middleware/auth');
const {
  listarTareas,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  asignarTarea,
  ejecutarAccionTarea,
  actualizarAvanceTarea,
  agregarNotaTarea,
  resolverIncidenciaTarea,
} = require('../controllers/tareasController');

router.use(verificarToken);

router.get('/', listarTareas);
router.post('/', asociarCapacidad('tareas.crear'), verificarRol('coord'), crearTarea);
router.patch('/:id', verificarRol('coord', 'gerente'), actualizarTarea);
router.delete('/:id', verificarRol('coord', 'gerente'), eliminarTarea);
router.patch('/:id/asignar', asociarCapacidad('tareas.asignar'), verificarRol('coord'), asignarTarea);
router.patch('/:id/accion', verificarRol('produccion', 'disenador', 'coord'), ejecutarAccionTarea);
router.patch('/:id/avance', verificarRol('produccion', 'disenador', 'coord'), actualizarAvanceTarea);
router.post('/:id/notas', verificarRol('produccion', 'disenador', 'coord'), agregarNotaTarea);
router.patch('/:id/resolver-incidencia', verificarRol('produccion', 'coord'), resolverIncidenciaTarea);

module.exports = router;
