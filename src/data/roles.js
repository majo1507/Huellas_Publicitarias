// Roles del sistema ORVEX.
// Cada rol tiene su propio menú lateral (agrupado por módulos), un usuario de ejemplo y notificaciones.
// El campo "page" de cada opción del menú debe coincidir con una pantalla en App.jsx.
// La opción 'inicio' de cada rol muestra un dashboard distinto (ver "dashboards" en App.jsx).
//
// ordenPage: pantalla que abre el buscador del encabezado al elegir una orden.
// buscador: false oculta el buscador global (el operario tiene una interfaz mínima).

export const ROLES = {
  cliente: {
    id: 'cliente',
    nombre: 'Cliente',
    clienteId: 'C1', // el usuario cliente simulado pertenece a "Empresa ABC"
    usuario: { nombre: 'Laura Gómez', cargo: 'Empresa ABC' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'Seguimiento', page: 'inicio', label: 'Mis pedidos', icono: 'clipboard' },
      { grupo: 'Atención', page: 'postventa', label: 'Postventa', icono: 'life-buoy' },
    ],
    notificaciones: [
      { texto: 'Tu diseño de OP-2026-0003 está listo para aprobación.', page: 'aprobacion', orderId: 'OP-2026-0003', tipo: 'aviso' },
      { texto: 'Tu pedido OP-2026-0001 pasó a impresión.', page: 'detalle', orderId: 'OP-2026-0001', tipo: 'info' },
    ],
  },
  comercial: {
    id: 'comercial',
    nombre: 'Comercial / Recepción',
    usuario: { nombre: 'Ana Martínez', cargo: 'Comercial' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'General', page: 'inicio', label: 'Inicio', icono: 'home' },
      { grupo: 'Comercial', page: 'clientes', label: 'Clientes', icono: 'users' },
      { grupo: 'Comercial', page: 'nuevo', label: 'Registrar solicitud', icono: 'file-plus' },
      { grupo: 'Comercial', page: 'solicitudes', label: 'Solicitudes', icono: 'inbox' },
      { grupo: 'Comercial', page: 'aprobacion_disenos', label: 'Gestión de diseños', icono: 'check-circle' },
      { grupo: 'Comercial', page: 'comunicaciones', label: 'Comunicaciones', icono: 'message' },
      { grupo: 'Seguimiento', page: 'pedidos', label: 'Órdenes en curso', icono: 'clipboard' },
    ],
    notificaciones: [
      { texto: '2 solicitudes están pendientes de enviar a validación.', page: 'solicitudes', tipo: 'aviso' },
      { texto: 'Una solicitud fue rechazada por el coordinador.', page: 'solicitudes', tipo: 'error' },
    ],
  },
  coordinador: {
    id: 'coordinador',
    nombre: 'Coordinador de producción',
    usuario: { nombre: 'Carlos Ruiz', cargo: 'Coordinador de producción' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'Planificación', page: 'inicio', label: 'Panel de producción', icono: 'home' },
      { grupo: 'Planificación', page: 'pedidos', label: 'Programación de órdenes', icono: 'clipboard' },
      { grupo: 'Ejecución', page: 'tareas', label: 'Asignación de actividades', icono: 'list' },
      { grupo: 'Recursos', page: 'inventario', label: 'Inventario y materiales', icono: 'package' },
    ],
    notificaciones: [
      { texto: '2 órdenes requieren atención por fecha comprometida.', page: 'pedidos', tipo: 'error' },
      { texto: 'Supervisa las actividades en curso y la carga de taller.', page: 'tareas', tipo: 'info' },
    ],
  },
  disenador: {
    id: 'disenador',
    nombre: 'Diseñador gráfico',
    usuario: { nombre: 'María López', cargo: 'Diseñadora gráfica' },
    ordenPage: 'disenos',
    buscador: true,
    menu: [
      { grupo: 'Diseño', page: 'inicio', label: 'Mesa de diseño', icono: 'pen' },
    ],
    notificaciones: [
      { texto: 'El cliente solicitó cambios en OP-2026-0004.', page: 'disenos', orderId: 'OP-2026-0004', tipo: 'error' },
      { texto: 'Nueva orden asignada: OP-2026-0007.', page: 'disenos', orderId: 'OP-2026-0007', tipo: 'info' },
    ],
  },
  operario: {
    id: 'operario',
    nombre: 'Operario',
    usuario: { nombre: 'Juan Pérez', cargo: 'Operario de impresión' },
    ordenPage: null,
    buscador: false,
    menu: [{ grupo: 'Taller', page: 'inicio', label: 'Mis actividades', icono: 'list' }],
    notificaciones: [{ texto: 'Tienes actividades asignadas en estación de trabajo.', page: 'inicio', tipo: 'aviso' }],
  },
  postventa: {
    id: 'postventa',
    nombre: 'Atención postventa',
    usuario: { nombre: 'Sofía Herrera', cargo: 'Atención postventa' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'General', page: 'inicio', label: 'Casos y garantías', icono: 'life-buoy' },
      { grupo: 'Atención', page: 'comunicaciones', label: 'Comunicaciones', icono: 'message' },
      { grupo: 'Consulta', page: 'pedidos', label: 'Órdenes entregadas', icono: 'package' },
    ],
    notificaciones: [{ texto: 'Hay 2 casos abiertos sin responsable.', page: 'inicio', tipo: 'aviso' }],
  },
  gerencia: {
    id: 'gerencia',
    nombre: 'Gerencia',
    usuario: { nombre: 'Andrés Torres', cargo: 'Gerente general' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'Supervisión', page: 'inicio', label: 'Resumen general', icono: 'home' },
      { grupo: 'Auditoría', page: 'pedidos', label: 'Expediente de órdenes', icono: 'clipboard' },
      { grupo: 'Análisis', page: 'inventario', label: 'Inventario y costos', icono: 'package' },
      { grupo: 'Análisis', page: 'reportes', label: 'Reportes e indicadores', icono: 'bar-chart' },
    ],
    notificaciones: [{ texto: 'Diseño es la etapa que concentra más órdenes.', page: 'reportes', tipo: 'info' }],
  },
}

// Lista blanca estricta de páginas autorizadas por rol para control de rutas y URL directa (Regla 5)
export const PAGINAS_AUTORIZADAS_POR_ROL = {
  comercial: ['inicio', 'clientes', 'nuevo', 'solicitudes', 'aprobacion', 'aprobacion_disenos', 'comunicaciones', 'pedidos', 'entregas', 'detalle', 'historial'],
  coordinador: ['inicio', 'pedidos', 'tareas', 'inventario', 'detalle', 'historial'],
  disenador: ['inicio', 'disenos', 'aprobacion'],
  operario: ['inicio'],
  postventa: ['inicio', 'comunicaciones', 'pedidos', 'detalle', 'historial'],
  gerencia: ['inicio', 'pedidos', 'inventario', 'reportes', 'detalle', 'historial'],
  cliente: ['inicio', 'postventa', 'detalle', 'historial', 'aprobacion'],
}

// Mapa de compatibilidad entre el ENUM de PostgreSQL (rol_usuario), etiquetas de interfaz y claves de ROLES
const ALIAS_ROLES = {
  cliente: 'cliente',
  comercial: 'comercial',
  ejecutiva: 'comercial',
  'comercial / recepción': 'comercial',
  coordinador: 'coordinador',
  coord: 'coordinador',
  'coordinador de producción': 'coordinador',
  disenador: 'disenador',
  diseñador: 'disenador',
  'diseñador gráfico': 'disenador',
  'diseñadora gráfica': 'disenador',
  operario: 'operario',
  produccion: 'operario',
  producción: 'operario',
  'operario de taller': 'operario',
  postventa: 'postventa',
  'atención postventa': 'postventa',
  gerencia: 'gerencia',
  gerente: 'gerencia',
  'gerencia general': 'gerencia',
}

// Normaliza cualquier identificador de rol (BD o UI) a una clave válida de ROLES
export function normalizarRol(rolInput) {
  if (!rolInput) return 'coordinador'
  const limpio = String(rolInput).trim().toLowerCase()
  return ALIAS_ROLES[limpio] || (ROLES[limpio] ? limpio : 'coordinador')
}

export function obtenerConfigRol(rolInput) {
  return ROLES[normalizarRol(rolInput)] || ROLES.coordinador
}

// Definir alias no enumerables en ROLES para que cualquier acceso directo ROLES['coord'], ROLES['ejecutiva'], etc. nunca sea undefined
Object.entries({
  coord: 'coordinador',
  ejecutiva: 'comercial',
  produccion: 'operario',
  gerente: 'gerencia',
  Comercial: 'comercial',
  Coordinador: 'coordinador',
  Diseñador: 'disenador',
  Operario: 'operario',
  Postventa: 'postventa',
  Gerencia: 'gerencia',
  Cliente: 'cliente',
}).forEach(([alias, target]) => {
  if (!(alias in ROLES)) {
    Object.defineProperty(ROLES, alias, {
      get: () => ROLES[target],
      enumerable: false,
    })
  }
})

// Orden en que aparecen en el selector del header (exclusivo equipo interno Huellas Publicidad)
export const LISTA_ROLES = [
  ROLES.comercial,
  ROLES.coordinador,
  ROLES.disenador,
  ROLES.operario,
  ROLES.postventa,
  ROLES.gerencia,
]

export const CLIENTE_ACTUAL = {
  id: ROLES.cliente.clienteId || 'C1',
  empresa: ROLES.cliente.usuario.cargo || 'Empresa ABC',
  nombre: ROLES.cliente.usuario.nombre || 'Laura Gómez',
}
