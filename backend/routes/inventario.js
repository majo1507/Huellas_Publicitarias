// ============================================================
// routes/inventario.js — Rutas para el módulo de Inventario
// ============================================================
const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.use(verificarToken);

router.get('/', verificarRol('coord', 'gerente', 'produccion'), inventarioController.listarInventario);
router.post('/', verificarRol('coord', 'gerente'), inventarioController.crearMaterial);
router.patch('/:id', verificarRol('coord', 'gerente'), inventarioController.actualizarMaterial);
router.patch('/:id/archivar', verificarRol('coord', 'gerente'), inventarioController.archivarMaterial);
router.patch('/:id/restaurar', verificarRol('coord', 'gerente'), inventarioController.restaurarMaterial);
router.delete('/:id', verificarRol('coord', 'gerente'), inventarioController.eliminarMaterial);

router.get('/proveedores', verificarRol('coord', 'gerente'), inventarioController.listarProveedores);
router.post('/proveedores', verificarRol('coord', 'gerente'), inventarioController.crearProveedor);
router.patch('/proveedores/:id', verificarRol('coord', 'gerente'), inventarioController.actualizarProveedor);
router.patch('/proveedores/:id/archivar', verificarRol('coord', 'gerente'), inventarioController.archivarProveedor);
router.patch('/proveedores/:id/restaurar', verificarRol('coord', 'gerente'), inventarioController.restaurarProveedor);
router.delete('/proveedores/:id', verificarRol('coord', 'gerente'), inventarioController.eliminarProveedor);

router.get('/movimientos', verificarRol('coord', 'gerente', 'produccion'), inventarioController.listarMovimientos);
router.post('/movimientos', verificarRol('coord', 'produccion'), inventarioController.registrarMovimiento);

router.post('/reservar', verificarRol('coord'), inventarioController.reservarMateriales);
router.post('/liberar/:orden_id', verificarRol('coord'), inventarioController.liberarReservas);

module.exports = router;
