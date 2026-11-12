// ============================================================
// routes/portal.js — Portal Público de Clientes (Huellas Publicidad)
// ============================================================
const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const upload = require('../middleware/upload');

// 1. Consulta pública de estado de pedido (con verificación segura de cliente)
router.post('/pedidos/consultar', portalController.consultarPedidoPublico);

// 2. Radicación pública de PQRSF y Garantías
router.post('/pqrsf/radicar', upload.single('evidencia'), portalController.radicarPqrsfPublico);

// 3. Consulta pública de estado de radicado PQRSF / Garantía
router.post('/pqrsf/consultar', portalController.consultarRadicadoPublico);

module.exports = router;
