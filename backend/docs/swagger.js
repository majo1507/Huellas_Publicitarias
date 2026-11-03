// ============================================================
// docs/swagger.js — Especificación OpenAPI 3.0 para Huellas API
// ============================================================
const swaggerDoc = {
  openapi: '3.0.0',
  info: {
    title: 'Huellas Publicitarias — Backend API',
    version: '1.0.0',
    description: 'API REST empresarial para la gestión integral de órdenes publicitarias, flujo de diseño, clientes y postventa.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor Local de Desarrollo',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Estado de salud del servidor y PostgreSQL',
        tags: ['Sistema'],
        responses: {
          200: { description: 'Servidor y base de datos conectados' },
        },
      },
    },
    '/api/dashboard': {
      get: {
        summary: 'Métricas, KPIs y embudo Kanban de producción',
        tags: ['Dashboard'],
        responses: {
          200: { description: 'Resumen consolidado y estadísticas' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Iniciar sesión y obtener token JWT',
        tags: ['Autenticación'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'laura.gomez@huellas.com' },
                  password: { type: 'string', example: 'Huellas2026*' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login exitoso y retorno de JWT' },
          401: { description: 'Credenciales inválidas' },
        },
      },
    },
    '/api/auth/perfil': {
      get: {
        summary: 'Perfil del usuario autenticado',
        tags: ['Autenticación'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Datos del usuario autenticado' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/usuarios': {
      get: {
        summary: 'Listar usuarios del sistema',
        tags: ['Usuarios'],
        parameters: [
          { name: 'rol', in: 'query', schema: { type: 'string' }, description: 'Filtrar por rol: ejecutiva, disenador, coord, produccion, gerente' },
        ],
        responses: { 200: { description: 'Lista de usuarios' } },
      },
      post: {
        summary: 'Crear nuevo usuario',
        tags: ['Usuarios'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nombre_completo: { type: 'string', example: 'Carlos Diseñador' },
                  email: { type: 'string', example: 'carlos@huellas.com' },
                  rol: { type: 'string', example: 'disenador' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Usuario creado' } },
      },
    },
    '/api/clientes': {
      get: {
        summary: 'Listar clientes registrados',
        tags: ['Clientes'],
        responses: { 200: { description: 'Lista de clientes con ejecutiva asignada' } },
      },
      post: {
        summary: 'Registrar un cliente',
        tags: ['Clientes'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  empresa: { type: 'string', example: 'Postobón S.A.' },
                  nit: { type: 'string', example: '890903939-5' },
                  contacto_principal: { type: 'string', example: 'Andrés Mejía' },
                  telefono: { type: 'string', example: '3112345678' },
                  correo: { type: 'string', example: 'amejia@postobon.com' },
                  ejecutiva_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Cliente registrado' } },
      },
    },
    '/api/ordenes': {
      get: {
        summary: 'Listar órdenes de producción',
        tags: ['Órdenes'],
        parameters: [
          { name: 'cliente_id', in: 'query', schema: { type: 'string' } },
          { name: 'etapa', in: 'query', schema: { type: 'integer' } },
          { name: 'prioridad', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Lista de órdenes' } },
      },
      post: {
        summary: 'Crear orden de producción en transacción',
        tags: ['Órdenes'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cliente_id: { type: 'string', format: 'uuid' },
                  producto: { type: 'string', example: 'Valla 8x3m Iluminada' },
                  ejecutiva_id: { type: 'string', format: 'uuid' },
                  disenador_id: { type: 'string', format: 'uuid' },
                  prioridad: { type: 'string', example: 'Alta' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Orden creada exitosamente' } },
      },
    },
    '/api/ordenes/{id}/etapa': {
      patch: {
        summary: 'Avanzar etapa (0 a 8) y recalcular porcentaje',
        tags: ['Órdenes'],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  etapa: { type: 'integer', example: 4 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Etapa y porcentaje actualizados' } },
      },
    },
    '/api/disenos/orden/{orden_id}': {
      get: {
        summary: 'Consultar versiones de diseño de una orden',
        tags: ['Diseños y Arte'],
        parameters: [
          { name: 'orden_id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Historial de versiones de arte' } },
      },
    },
    '/api/disenos/upload/orden/{orden_id}': {
      post: {
        summary: 'Subir archivo físico y registrar nueva versión',
        tags: ['Diseños y Arte'],
        parameters: [
          { name: 'orden_id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  archivo: { type: 'string', format: 'binary' },
                  creador_id: { type: 'string', format: 'uuid' },
                  comentario: { type: 'string', example: 'Arte final con líneas de corte' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Archivo guardado y registrado' } },
      },
    },
    '/api/postventa': {
      get: {
        summary: 'Consultar tickets de postventa',
        tags: ['Postventa'],
        parameters: [
          { name: 'orden_id', in: 'query', schema: { type: 'integer' } },
          { name: 'tipo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Lista de registros' } },
      },
      post: {
        summary: 'Crear evaluación o garantía postventa',
        tags: ['Postventa'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orden_id: { type: 'integer' },
                  ejecutiva_id: { type: 'string', format: 'uuid' },
                  tipo: { type: 'string', example: 'Comentario' },
                  nivel_conformidad: { type: 'integer', example: 5 },
                  descripcion: { type: 'string', example: 'Entrega en tiempo récord' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Evaluación registrada' } },
      },
    },
  },
};

module.exports = swaggerDoc;
