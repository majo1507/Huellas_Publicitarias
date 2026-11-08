// ============================================================
// routes/inventario.js — Rutas para el módulo de Inventario
// ============================================================
const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', inventarioController.listarInventario);
router.post('/', verificarRol('coord', 'gerente'), inventarioController.crearMaterial);

router.get('/proveedores', inventarioController.listarProveedores);
router.post('/proveedores', verificarRol('coord', 'gerente'), inventarioController.crearProveedor);

router.get('/movimientos', inventarioController.listarMovimientos);
router.post('/movimientos', verificarRol('coord', 'produccion', 'gerente'), inventarioController.registrarMovimiento);

router.post('/reservar', verificarRol('coord', 'gerente'), inventarioController.reservarMateriales);
router.post('/liberar/:orden_id', verificarRol('coord', 'gerente'), inventarioController.liberarReservas);

module.exports = router;
