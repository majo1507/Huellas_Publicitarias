const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.use(verificarToken);
router.get('/', dashboardController.obtenerMetricas);

module.exports = router;
