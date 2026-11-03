// ============================================================
// routes/dashboard.js — Rutas de Dashboard delegadas a Controlador
// ============================================================
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET /api/dashboard - Resumen ejecutivo de producción y operaciones
router.get('/', dashboardController.obtenerMetricas);

module.exports = router;
