// ============================================================
// routes/auth.js — Rutas de Autenticación JWT
// ============================================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken, verificarRol } = require('../middleware/auth');

// POST /api/auth/login — Iniciar sesión y recibir token JWT
router.post('/login', authController.login);

// POST /api/auth/register — Registrar nuevo usuario (restringido exclusivamente a Gerencia)
router.post('/register', verificarToken, verificarRol('gerente'), authController.register);

// GET /api/auth/perfil — Consultar datos del usuario autenticado
router.get('/perfil', verificarToken, authController.obtenerPerfil);

// POST /api/auth/logout — Cerrar sesión activa
router.post('/logout', verificarToken, authController.logout);

module.exports = router;
