// ============================================================
// routes/postventa.js — Rutas de Postventa y Calidad
// ============================================================
const express = require('express');
const router = express.Router();
const postventaController = require('../controllers/postventaController');
const upload = require('../middleware/upload');

// GET /api/postventa - Listar registros de postventa
router.get('/', postventaController.listarPostventa);

// POST /api/postventa - Registrar evaluación/reclamo (soporta foto o acta de entrega opcional)
router.post('/', upload.single('archivo'), postventaController.crearPostventa);

module.exports = router;
