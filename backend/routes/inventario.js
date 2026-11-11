// ============================================================
// routes/inventario.js — Rutas para el módulo de Inventario
// ============================================================
const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', inventarioController.listarInventario);
router.post('/', verificarRol('coord'), inventarioController.crearMaterial);

router.get('/proveedores', inventarioController.listarProveedores);
router.post('/proveedores', verificarRol('coord'), inventarioController.crearProveedor);

router.get('/movimientos', inventarioController.listarMovimientos);
router.post('/movimientos', verificarRol('coord', 'produccion'), inventarioController.registrarMovimiento);

router.post('/reservar', verificarRol('coord'), inventarioController.reservarMateriales);
router.post('/liberar/:orden_id', verificarRol('coord'), inventarioController.liberarReservas);

module.exports = router;
