// ============================================================
// routes/usuarios.js — Rutas de Personal / Usuarios
// ============================================================
const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

// GET /api/usuarios - Listar todos los usuarios activos
router.get('/', usuariosController.listarUsuarios);

// GET /api/usuarios/:id - Obtener un usuario por ID
router.get('/:id', usuariosController.obtenerUsuarioPorId);

// POST /api/usuarios - Crear un nuevo usuario
router.post('/', usuariosController.crearUsuario);

module.exports = router;
