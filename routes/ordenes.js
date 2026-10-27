// ============================================================
// routes/ordenes.js — Rutas del Flujo Productivo de Órdenes
// ============================================================
const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');

// GET /api/ordenes - Listar todas las órdenes con filtros
router.get('/', ordenesController.listarOrdenes);

// GET /api/ordenes/:id - Detalle de una orden e historial
router.get('/:id', ordenesController.obtenerOrdenPorId);

// POST /api/ordenes - Crear una orden (transacción con auditoría inmutable)
router.post('/', ordenesController.crearOrden);

// PATCH /api/ordenes/:id/etapa - Avanzar etapa (con candado de calidad y descuento de insumos)
router.patch('/:id/etapa', ordenesController.actualizarEtapa);

module.exports = router;
