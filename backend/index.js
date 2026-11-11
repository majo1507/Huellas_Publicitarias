// ============================================================
// index.js — Servidor Express para ORVEX — Huellas Publicidad
// ============================================================
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, testConnection } = require('./db');

// Importar rutas modulares
const authRouter = require('./routes/auth');
const usuariosRouter = require('./routes/usuarios');
const clientesRouter = require('./routes/clientes');
const solicitudesRouter = require('./routes/solicitudes');
const ordenesRouter = require('./routes/ordenes');
const disenosRouter = require('./routes/disenos');
const tareasRouter = require('./routes/tareas');
const postventaRouter = require('./routes/postventa');
const comunicacionesRouter = require('./routes/comunicaciones');
const inventarioRouter = require('./routes/inventario');
const dashboardRouter = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

const swaggerUi = require('swagger-ui-express');
const swaggerDoc = require('./docs/swagger');

// Middlewares globales
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: allowedOrigins || true,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Documentación Swagger / OpenAPI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

// Endpoint raíz informativo
app.get('/', (_req, res) => {
  res.json({
    sistema: 'ORVEX — Huellas Publicidad API Backend',
    version: '2.0.0',
    motor_bd: 'PostgreSQL',
    rutas_disponibles: {
      health: 'GET /api/health',
      auth: 'POST /api/auth/login | GET /api/auth/perfil | POST /api/auth/register',
      usuarios: 'GET /api/usuarios | POST /api/usuarios | PATCH /api/usuarios/:id | PATCH /api/usuarios/:id/estado',
      clientes: 'GET /api/clientes | POST /api/clientes | PATCH /api/clientes/:id',
      solicitudes: 'GET /api/solicitudes | POST /api/solicitudes | PATCH /api/solicitudes/:id/enviar | POST /api/solicitudes/:id/validar',
      ordenes: 'GET /api/ordenes | POST /api/ordenes | PATCH /api/ordenes/:id/etapa | POST /api/ordenes/:id/entrega | POST /api/ordenes/:id/cerrar',
      disenos: 'POST /api/disenos/orden/:orden_id | PATCH /api/disenos/orden/:orden_id/aprobacion',
      tareas: 'GET /api/tareas | PATCH /api/tareas/:id/avance | PATCH /api/tareas/:id/accion | POST /api/tareas/:id/notas',
      postventa: 'GET /api/postventa | POST /api/postventa | PATCH /api/postventa/:id',
      comunicaciones: 'GET /api/comunicaciones | POST /api/comunicaciones/:id/mensajes',
      dashboard: 'GET /api/dashboard',
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
app.use('/api/solicitudes', solicitudesRouter);
app.use('/api/ordenes', ordenesRouter);
app.use('/api/disenos', disenosRouter);
app.use('/api/tareas', tareasRouter);
app.use('/api/actividades', tareasRouter);
app.use('/api/postventa', postventaRouter);
app.use('/api/casos', postventaRouter);
app.use('/api/comunicaciones', comunicacionesRouter);
app.use('/api/inventario', inventarioRouter);
// Alias de compatibilidad para acceso directo a proveedores (/api/proveedores)
app.use('/api/proveedores', (req, res, next) => {
  req.url = '/proveedores' + (req.url === '/' ? '' : req.url);
  inventarioRouter(req, res, next);
});
app.use('/api/dashboard', dashboardRouter);

// Manejo de rutas inexistentes (404)
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware global de manejo de errores (incluye errores de Multer y JSON inválido)
app.use((err, _req, res, _next) => {
  if (err && (err.name === 'MulterError' || /Formato no permitido/i.test(err.message || ''))) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON mal formado en el cuerpo de la petición.' });
  }
  console.error('[API Error]', err);
  return res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor.',
  });
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

module.exports = { app, server };
