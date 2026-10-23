// Capa de acceso a datos de ORVEX - Huellas Publicidad.
//
// HOY: devuelve los datos simulados de src/data/mockData.js (con una pequeña demora para simular la red).
// MAÑANA: cuando el backend (API REST + PostgreSQL) esté listo, basta con poner USAR_MOCK = false
// y definir la variable VITE_API_URL en un archivo .env (ej: VITE_API_URL=http://localhost:3000/api).
// El resto de la aplicación no necesita cambios porque solo habla con este archivo.
//
// Endpoints que se esperan del backend (propuesta técnica acordada):
//   POST   /auth/login                       -> autenticar usuario con credenciales (retorna token JWT + perfil)
//   POST   /auth/logout                      -> cerrar sesión activa
//   POST   /usuarios                         -> registrar nuevo usuario
//   PATCH  /usuarios/:id                     -> editar usuario (nombre, correo, cargo, rol)
//   PATCH  /usuarios/:id/estado              -> activar / desactivar usuario
//   GET    /clientes            GET  /ordenes              GET   /solicitudes
//   GET    /actividades         GET  /casos                GET   /usuarios
//   POST   /solicitudes                      -> registrar solicitud
//   POST   /solicitudes/:id/validar          -> genera la orden de producción
//   PATCH  /ordenes/:id/etapa                -> avanzar etapa (el backend debe verificar regla de diseño aprobado)
//   POST   /ordenes/:id/versiones            -> crear / enviar / aprobar / rechazar versión de diseño (con multipart file)
//   POST   /ordenes/:id/entrega              -> registrar entrega, receptor y evidencia en storage (HU-17)
//   POST   /ordenes/:id/cerrar               -> cierre formal con verificación de requisitos (HU-20)
//   POST   /ordenes/:id/reabrir              -> reapertura autorizada de orden a postventa (HU-20)
//   GET    /ordenes/:id/historial            -> trazabilidad cronológica completa (HU-19)
//   PATCH  /actividades/:id                  -> iniciar, pausar, finalizar, reasignar
//   POST   /casos                            -> registrar caso de postventa (HU-18)
//   PATCH  /casos/:id/resolver               -> resolver caso con solución documentada (HU-18)
//   PATCH  /casos/:id/calificar              -> calificación del cliente (HU-18)

import * as mock from '../data/mockData.js'

const USAR_MOCK = true
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Simula la respuesta de un servidor (copia los datos para no modificar los originales)
const simular = (valor, ms = 650) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(valor)), ms))

// Petición real a la API REST
async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${API_URL}${ruta}`, { headers: { 'Content-Type': 'application/json' }, ...opciones })
  if (!respuesta.ok) throw new Error(`Error ${respuesta.status} al consultar ${ruta}`)
  return respuesta.json()
}

const consultar = (ruta, datosMock) => (USAR_MOCK ? simular(datosMock) : pedir(ruta))

export const api = {
  listarClientes: () => consultar('/clientes', mock.initialClients),
  listarOrdenes: () => consultar('/ordenes', mock.initialOrders),
  listarSolicitudes: () => consultar('/solicitudes', mock.initialRequests),
  crearSolicitud: (solicitud) => (USAR_MOCK ? simular(solicitud) : pedir('/solicitudes', { method: 'POST', body: JSON.stringify(solicitud) })),
  enviarAValidacion: (id) => (USAR_MOCK ? simular({ id, estado: 'En validación' }) : pedir(`/solicitudes/${id}/enviar`, { method: 'PATCH' })),
  validarSolicitud: (id) => (USAR_MOCK ? simular({ id, estado: 'Aprobada' }) : pedir(`/solicitudes/${id}/validar`, { method: 'POST' })),
  devolverSolicitud: (id, motivo) => (USAR_MOCK ? simular({ id, estado: 'Devuelta para corrección', motivoRechazo: motivo }) : pedir(`/solicitudes/${id}/devolver`, { method: 'PATCH', body: JSON.stringify({ motivo }) })),
  rechazarSolicitud: (id, motivo) => (USAR_MOCK ? simular({ id, estado: 'Rechazada', motivoRechazo: motivo }) : pedir(`/solicitudes/${id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo }) })),
  asignarActividad: (id, responsable) => (USAR_MOCK ? simular({ id, responsable }) : pedir(`/actividades/${id}/asignar`, { method: 'PATCH', body: JSON.stringify({ responsable }) })),
  listarActividades: () => consultar('/actividades', mock.initialTasks),
  listarCasos: () => consultar('/casos', mock.initialCases),
  listarUsuarios: () => consultar('/usuarios', mock.initialUsers),
  crearUsuario: (usuario) => (USAR_MOCK ? simular(usuario) : pedir('/usuarios', { method: 'POST', body: JSON.stringify(usuario) })),
  actualizarUsuario: (id, cambios) => (USAR_MOCK ? simular({ id, ...cambios }) : pedir(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })),
  cambiarEstadoUsuario: (id, estado) => (USAR_MOCK ? simular({ id, estado }) : pedir(`/usuarios/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) })),
  login: (credenciales) => (USAR_MOCK ? simular({ token: 'mock-jwt-token', usuario: credenciales }) : pedir('/auth/login', { method: 'POST', body: JSON.stringify(credenciales) })),
  logout: () => (USAR_MOCK ? simular({ ok: true }) : pedir('/auth/logout', { method: 'POST' })),
  listarComunicaciones: () => consultar('/comunicaciones', mock.initialComms),

  // Registro de entregas y evidencias (HU-17)
  registrarEntrega: (ordenId, datosEntrega) =>
    USAR_MOCK
      ? simular({ ordenId, ...datosEntrega, registrado: true })
      : pedir(`/ordenes/${ordenId}/entrega`, { method: 'POST', body: JSON.stringify(datosEntrega) }),

  // Gestión de postventa (HU-18)
  crearCasoPostventa: (caso) =>
    USAR_MOCK ? simular({ id: `CAS-MOCK`, ...caso }) : pedir('/casos', { method: 'POST', body: JSON.stringify(caso) }),
  resolverCasoPostventa: (id, solucion) =>
    USAR_MOCK
      ? simular({ id, estado: 'Resuelto', solucion })
      : pedir(`/casos/${id}/resolver`, { method: 'PATCH', body: JSON.stringify({ solucion }) }),
  calificarCasoPostventa: (id, calificacion) =>
    USAR_MOCK
      ? simular({ id, calificacion })
      : pedir(`/casos/${id}/calificar`, { method: 'PATCH', body: JSON.stringify({ calificacion }) }),

  // Trazabilidad cronológica (HU-19)
  obtenerHistorialOrden: (id) =>
    USAR_MOCK
      ? simular(mock.initialOrders.find((o) => o.id === id)?.historial || [])
      : pedir(`/ordenes/${id}/historial`),

  // Cierre y reapertura de órdenes (HU-20)
  cerrarOrden: (id, motivo) =>
    USAR_MOCK
      ? simular({ id, estado: 'Cerrada', motivo })
      : pedir(`/ordenes/${id}/cerrar`, { method: 'POST', body: JSON.stringify({ motivo }) }),
  reabrirOrden: (id, motivo) =>
    USAR_MOCK
      ? simular({ id, estado: 'Postventa', motivo })
      : pedir(`/ordenes/${id}/reabrir`, { method: 'POST', body: JSON.stringify({ motivo }) }),

  // Carga inicial de toda la información que necesita la aplicación
  async cargarTodo() {
    const [clients, orders, requests, tasks, cases, users, comms] = await Promise.all([
      this.listarClientes(),
      this.listarOrdenes(),
      this.listarSolicitudes(),
      this.listarActividades(),
      this.listarCasos(),
      this.listarUsuarios(),
      this.listarComunicaciones(),
    ])
    return { clients, orders, requests, tasks, cases, users, comms }
  },
}
