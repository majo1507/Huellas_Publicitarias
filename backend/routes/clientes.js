// ============================================================
// routes/clientes.js — Rutas para el módulo de Clientes
// ============================================================
const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, clientesController.listarClientes);
router.get('/:id', verificarToken, clientesController.obtenerClientePorId);
router.post('/', verificarToken, verificarRol('ejecutiva'), clientesController.crearCliente);
router.patch('/:id', verificarToken, verificarRol('ejecutiva'), clientesController.actualizarCliente);

module.exports = router;
