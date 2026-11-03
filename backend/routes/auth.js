// ============================================================
// routes/auth.js — Rutas de Autenticación delegadas a Controlador
// ============================================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middleware/auth');

// POST /api/auth/login - Iniciar sesión
router.post('/login', authController.login);

// POST /api/auth/register - Registrar nuevo usuario
router.post('/register', authController.register);

// GET /api/auth/perfil - Obtener perfil del usuario autenticado
router.get('/perfil', verificarToken, authController.obtenerPerfil);

module.exports = router;
