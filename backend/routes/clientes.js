// ============================================================
// routes/clientes.js — Rutas para el módulo de Clientes
// ============================================================
const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'), clientesController.listarClientes);
router.get('/:id', verificarToken, verificarRol('ejecutiva', 'coord', 'postventa', 'gerente'), clientesController.obtenerClientePorId);
router.post('/', verificarToken, verificarRol('ejecutiva', 'gerente'), clientesController.crearCliente);
router.patch('/:id', verificarToken, verificarRol('ejecutiva', 'gerente'), clientesController.actualizarCliente);
router.patch('/:id/archivar', verificarToken, verificarRol('ejecutiva', 'gerente'), clientesController.archivarCliente);
router.patch('/:id/restaurar', verificarToken, verificarRol('ejecutiva', 'gerente'), clientesController.restaurarCliente);
router.delete('/:id', verificarToken, verificarRol('ejecutiva', 'gerente'), clientesController.eliminarCliente);

module.exports = router;
