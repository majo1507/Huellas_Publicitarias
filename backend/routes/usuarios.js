// ============================================================
// routes/usuarios.js — Rutas para el módulo de Usuarios
// ============================================================
const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verificarToken, verificarRol } = require('../middleware/auth');

router.get('/', verificarToken, usuariosController.listarUsuarios);
router.get('/:id', verificarToken, usuariosController.obtenerUsuarioPorId);
router.post('/', verificarToken, verificarRol('gerente'), usuariosController.crearUsuario);
router.patch('/:id', verificarToken, verificarRol('gerente'), usuariosController.actualizarUsuario);
router.patch('/:id/estado', verificarToken, verificarRol('gerente'), usuariosController.cambiarEstadoUsuario);

module.exports = router;
