// ============================================================
// routes/disenos.js — Rutas de Diseños y Aprobación
// ============================================================
const express = require('express');
const router = express.Router();
const disenosController = require('../controllers/disenosController');
const upload = require('../middleware/upload');

// GET /api/disenos/orden/:orden_id - Listar versiones de arte de una orden
router.get('/orden/:orden_id', disenosController.listarVersionesPorOrden);

// POST /api/disenos/orden/:orden_id - Registrar nueva versión de arte
router.post('/orden/:orden_id', disenosController.crearVersion);

// PATCH /api/disenos/:id/aprobacion - Aprobar o rechazar un diseño
router.patch('/:id/aprobacion', disenosController.aprobarORechazarDiseno);

// POST /api/disenos/upload/orden/:orden_id - Subir archivo físico y registrar versión
router.post('/upload/orden/:orden_id', upload.single('archivo'), disenosController.subirArchivoVersion);

module.exports = router;
