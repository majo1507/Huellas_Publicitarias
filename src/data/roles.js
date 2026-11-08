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
      { grupo: 'Comercial', page: 'comunicaciones', label: 'Comunicaciones', icono: 'message' },
      { grupo: 'Operación', page: 'pedidos', label: 'Órdenes generadas', icono: 'clipboard' },
      { grupo: 'Operación', page: 'entregas', label: 'Entregas', icono: 'truck' },
    ],
    notificaciones: [
      { texto: '2 solicitudes están pendientes de enviar a validación.', page: 'solicitudes', tipo: 'aviso' },
      { texto: 'Una solicitud fue rechazada por el coordinador.', page: 'solicitudes', tipo: 'error' },
    ],
  },
  coordinador: {
    id: 'coordinador',
    nombre: 'Coordinador de producción',
    usuario: { nombre: 'Carlos Gómez', cargo: 'Coordinador de producción' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'General', page: 'inicio', label: 'Panel de producción', icono: 'home' },
      { grupo: 'Gestión', page: 'solicitudes', label: 'Validar solicitudes', icono: 'inbox' },
      { grupo: 'Gestión', page: 'pedidos', label: 'Órdenes', icono: 'clipboard' },
      { grupo: 'Gestión', page: 'comunicaciones', label: 'Comunicaciones', icono: 'message' },
      { grupo: 'Producción', page: 'produccion', label: 'Tablero de producción', icono: 'columns' },
      { grupo: 'Producción', page: 'tareas', label: 'Actividades', icono: 'list' },
      { grupo: 'Producción', page: 'inventario', label: 'Inventario e insumos', icono: 'package' },
      { grupo: 'Producción', page: 'entregas', label: 'Entregas', icono: 'truck' },
    ],
    notificaciones: [
      { texto: '2 órdenes están retrasadas.', page: 'pedidos', tipo: 'error' },
      { texto: '2 solicitudes esperan validación.', page: 'solicitudes', tipo: 'aviso' },
    ],
  },
  disenador: {
    id: 'disenador',
    nombre: 'Diseñador gráfico',
    usuario: { nombre: 'María López', cargo: 'Diseñadora gráfica' },
    ordenPage: 'disenos',
    buscador: true,
    menu: [
      { grupo: 'General', page: 'inicio', label: 'Mis tareas', icono: 'home' },
      { grupo: 'Diseño', page: 'disenos', label: 'Diseños y aprobaciones', icono: 'pen' },
    ],
    notificaciones: [
      { texto: 'El cliente solicitó cambios en OP-2026-0004.', page: 'disenos', orderId: 'OP-2026-0004', tipo: 'error' },
      { texto: 'Nueva orden asignada: OP-2026-0007.', page: 'disenos', orderId: 'OP-2026-0007', tipo: 'info' },
    ],
  },
  operario: {
    id: 'operario',
    nombre: 'Operario',
    usuario: { nombre: 'Pedro Morales', cargo: 'Operario de taller' },
    ordenPage: null,
    buscador: false,
    menu: [{ grupo: 'General', page: 'inicio', label: 'Mis tareas', icono: 'list' }],
    notificaciones: [{ texto: 'Tienes 2 tareas de prioridad alta.', page: 'inicio', tipo: 'aviso' }],
  },
  postventa: {
    id: 'postventa',
    nombre: 'Atención postventa',
    usuario: { nombre: 'Sofía Herrera', cargo: 'Atención postventa' },
    ordenPage: 'detalle',
    buscador: true,
    menu: [
      { grupo: 'General', page: 'inicio', label: 'Casos', icono: 'life-buoy' },
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
      { grupo: 'General', page: 'inicio', label: 'Resumen general', icono: 'home' },
      { grupo: 'Análisis', page: 'comunicaciones', label: 'Comunicaciones', icono: 'message' },
      { grupo: 'Análisis', page: 'inventario', label: 'Inventario e insumos', icono: 'package' },
      { grupo: 'Análisis', page: 'reportes', label: 'Reportes', icono: 'bar-chart' },
      { grupo: 'Administración', page: 'usuarios', label: 'Usuarios', icono: 'shield' },
    ],
    notificaciones: [{ texto: 'Diseño es la etapa que concentra más órdenes.', page: 'reportes', tipo: 'info' }],
  },
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

// Orden en que aparecen en el selector del header
export const LISTA_ROLES = [
  ROLES.cliente,
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
