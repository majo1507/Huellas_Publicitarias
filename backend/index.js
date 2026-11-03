// ============================================================
// index.js — Servidor Express para el Sistema Empresarial Huellas
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, testConnection } = require('./db');

// Importar rutas modulares
const authRouter = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const clientesRouter = require('./routes/clientes');
const ordenesRouter = require('./routes/ordenes');
const disenosRouter = require('./routes/disenos');
const postventaRouter = require('./routes/postventa');
const dashboardRouter = require('./routes/dashboard');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./docs/swagger');

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Documentación Swagger / OpenAPI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Endpoint raíz informativo
app.get('/', (_req, res) => {
  res.json({
    sistema: 'Huellas Publicitarias - API Backend',
    version: '1.0.0',
    motor_bd: 'PostgreSQL',
    rutas_disponibles: {
      health: 'GET /api/health',
      usuarios: {
        listar: 'GET /api/usuarios',
        crear: 'POST /api/usuarios',
        detalle: 'GET /api/usuarios/:id',
      },
      clientes: {
        listar: 'GET /api/clientes',
        crear: 'POST /api/clientes',
        detalle: 'GET /api/clientes/:id',
      },
      ordenes: {
        listar: 'GET /api/ordenes',
        crear: 'POST /api/ordenes',
        detalle: 'GET /api/ordenes/:id',
        actualizar_etapa: 'PATCH /api/ordenes/:id/etapa',
      },
      disenos: {
        versiones_por_orden: 'GET /api/disenos/orden/:orden_id',
        nueva_version: 'POST /api/disenos/orden/:orden_id',
        aprobacion: 'PATCH /api/disenos/:id/aprobacion',
      },
    },
  });
});

// Endpoint de verificación de salud
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT 1 AS ok, NOW() AS server_time');
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        conectado: result.rows.length > 0 && result.rows[0].ok === 1,
        engine: 'PostgreSQL',
        server_time: result.rows[0]?.server_time,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      error: 'Error al conectar con la base de datos',
      detalle: err.message,
    });
  }
});

// Montaje de rutas API
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/ordenes', ordenesRouter);
app.use('/api/disenos', disenosRouter);
app.use('/api/postventa', postventaRouter);
app.use('/api/dashboard', dashboardRouter);

// Manejo de rutas inexistentes (404)
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Inicio del servidor
const server = app.listen(PORT, async () => {
  console.log(`===================================================`);
  console.log(`🚀  Servidor Huellas activo en: http://localhost:${PORT}`);
  console.log(`📌  Verificación de salud:    http://localhost:${PORT}/api/health`);
  console.log(`===================================================`);

  await testConnection();
});

// Cierre controlado de conexiones
const gracefulShutdown = async () => {
  console.log('\n🛑  Cerrando servidor y liberando conexiones a la base de datos...');
  server.close(async () => {
    try {
      await pool.end();
      console.log('🔒  Pool de PostgreSQL cerrado correctamente.');
      process.exit(0);
    } catch (err) {
      console.error('Error al cerrar el pool:', err.message);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
