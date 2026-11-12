const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.use(verificarToken);
router.get('/', verificarRol('gerente', 'coord'), dashboardController.obtenerMetricas);

module.exports = router;
