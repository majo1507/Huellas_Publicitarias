// ============================================================
// routes/clientes.js — Rutas de Clientes delegadas a Controlador
// ============================================================
const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');

// GET /api/clientes - Listar clientes
router.get('/', clientesController.listarClientes);

// GET /api/clientes/:id - Obtener un cliente específico
router.get('/:id', clientesController.obtenerClientePorId);

// POST /api/clientes - Registrar un nuevo cliente
router.post('/', clientesController.crearCliente);

module.exports = router;
