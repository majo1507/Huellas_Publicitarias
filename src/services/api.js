// Capa de acceso a datos de ORVEX — Huellas Publicidad.
// Conectada al backend real Express + PostgreSQL con soporte JWT y fallback opcional a mockData.

import * as mock from '../data/mockData.js'

const USAR_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_KEY = 'orvex_auth_token'

export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {}
}

// Simula la respuesta de un servidor (solo cuando VITE_USE_MOCK=true)
const simular = (valor, ms = 350) =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(valor)), ms))

// Petición real a la API REST con cabeceras JWT y manejo de errores JSON
async function pedir(ruta, opciones = {}) {
  const token = getAuthToken()
  const headers = {
    ...(opciones.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opciones.headers || {}),
  }

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers,
  })

  let payload = null
  const contentType = respuesta.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    payload = await respuesta.json()
  } else {
    const txt = await respuesta.text()
    payload = { error: txt || `Error HTTP ${respuesta.status}` }
  }

  if (!respuesta.ok) {
    const msg = payload?.motivo || payload?.error || payload?.mensaje || `Error ${respuesta.status} al consultar ${ruta}`
    const err = new Error(msg)
    err.status = respuesta.status
    err.payload = payload
    throw err
  }

  return payload
}

async function consultarLista(ruta, datosMock) {
  if (USAR_MOCK) return simular(datosMock)
  const res = await pedir(ruta)
  return Array.isArray(res) ? res : res?.data || []
}

export const api = {
  usarMock: USAR_MOCK,

  // Autenticación (HU-02)
  async login(credenciales) {
    if (USAR_MOCK) {
      return simular({ token: 'mock-jwt-token', usuario: credenciales })
    }
    const res = await pedir('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credenciales),
    })
    if (res?.token) setAuthToken(res.token)
    return res
  },

  async logout() {
    setAuthToken('')
    if (USAR_MOCK) return simular({ ok: true })
    try {
      return await pedir('/auth/logout', { method: 'POST' })
    } catch {
      return { ok: true }
    }
  },

  async obtenerPerfil() {
    if (USAR_MOCK) return simular(null)
    const res = await pedir('/auth/perfil')
    return res?.data || res
  },

  // Clientes
  listarClientes: () => consultarLista('/clientes', mock.initialClients),
  crearCliente: (cliente) =>
    USAR_MOCK
      ? simular(cliente)
      : pedir('/clientes', { method: 'POST', body: JSON.stringify(cliente) }),

  // Solicitudes (HU-03 a HU-06)
  listarSolicitudes: () => consultarLista('/solicitudes', mock.initialRequests),
  crearSolicitud: (solicitud) =>
    USAR_MOCK
      ? simular(solicitud)
      : pedir('/solicitudes', { method: 'POST', body: JSON.stringify(solicitud) }),
  enviarAValidacion: (id) =>
    USAR_MOCK
      ? simular({ data: { id, estado: 'En validación' } })
      : pedir(`/solicitudes/${id}/enviar`, { method: 'PATCH' }),
  validarSolicitud: (id) =>
    USAR_MOCK
      ? simular({ data: { id, estado: 'Aprobada' } })
      : pedir(`/solicitudes/${id}/validar`, { method: 'POST' }),
  devolverSolicitud: (id, motivo) =>
    USAR_MOCK
      ? simular({ data: { id, estado: 'Devuelta para corrección', motivoRechazo: motivo } })
      : pedir(`/solicitudes/${id}/devolver`, { method: 'PATCH', body: JSON.stringify({ motivo }) }),
  rechazarSolicitud: (id, motivo) =>
    USAR_MOCK
      ? simular({ data: { id, estado: 'Rechazada', motivoRechazo: motivo } })
      : pedir(`/solicitudes/${id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo }) }),

  // Órdenes de producción (HU-06, HU-13, HU-16, HU-17, HU-19, HU-20)
  listarOrdenes: () => consultarLista('/ordenes', mock.initialOrders),
  obtenerOrden: (id) =>
    USAR_MOCK
      ? simular(mock.initialOrders.find((o) => o.id === id))
      : pedir(`/ordenes/${id}`),
  avanzarEtapaOrden: (id, etapa) =>
    USAR_MOCK
      ? simular({ data: { id, estado: etapa } })
      : pedir(`/ordenes/${id}/etapa`, {
          method: 'PATCH',
          body: JSON.stringify(etapa ? { etapa } : {}),
        }),
  registrarEntrega: (ordenId, datosEntrega) =>
    USAR_MOCK
      ? simular({ ordenId, ...datosEntrega, registrado: true })
      : pedir(`/ordenes/${ordenId}/entrega`, {
          method: 'POST',
          body: JSON.stringify(datosEntrega),
        }),
  cerrarOrden: (id, motivo) =>
    USAR_MOCK
      ? simular({ id, estado: 'Cerrada', motivo })
      : pedir(`/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
  reabrirOrden: (id, motivo) =>
    USAR_MOCK
      ? simular({ id, estado: 'Postventa', motivo })
      : pedir(`/ordenes/${id}/reabrir`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
  clonarOrden: (id, motivo) =>
    USAR_MOCK
      ? simular({ id, motivo })
      : pedir(`/ordenes/${id}/clonar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
  obtenerHistorialOrden: (id) =>
    USAR_MOCK
      ? simular(mock.initialOrders.find((o) => o.id === id)?.historial || [])
      : pedir(`/ordenes/${id}/historial`),

  // Diseño y versiones de arte (HU-11, HU-12, HU-13)
  crearVersionDiseno: (ordenId, payload = {}) =>
    USAR_MOCK
      ? simular({ ordenId, ...payload })
      : pedir(`/disenos/orden/${ordenId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
  enviarDiseno: (ordenId, observaciones = '') =>
    USAR_MOCK
      ? simular({ ordenId, observaciones })
      : pedir(`/disenos/orden/${ordenId}/enviar`, {
          method: 'PATCH',
          body: JSON.stringify({ observaciones }),
        }),
  responderDiseno: (ordenId, decision, comentario = '', decisor = '') =>
    USAR_MOCK
      ? simular({ ordenId, decision, comentario })
      : pedir(`/disenos/orden/${ordenId}/aprobacion`, {
          method: 'PATCH',
          body: JSON.stringify({ estado: decision, comentario, decisor }),
        }),

  // Actividades de taller (HU-08, HU-10, HU-14, HU-15)
  listarActividades: () => consultarLista('/actividades', mock.initialTasks),
  asignarActividad: (id, responsable) =>
    USAR_MOCK
      ? simular({ id, responsable })
      : pedir(`/actividades/${id}/asignar`, {
          method: 'PATCH',
          body: JSON.stringify({ responsable }),
        }),
  accionActividad: (id, accion) =>
    USAR_MOCK
      ? simular({ id, accion })
      : pedir(`/actividades/${id}/accion`, {
          method: 'PATCH',
          body: JSON.stringify({ accion }),
        }),
  actualizarAvanceActividad: (id, estado, pct) =>
    USAR_MOCK
      ? simular({ id, estado, pct })
      : pedir(`/actividades/${id}/avance`, {
          method: 'PATCH',
          body: JSON.stringify({ estado, pct }),
        }),
  agregarNotaActividad: (id, texto, esIncidencia = false) =>
    USAR_MOCK
      ? simular({ id, texto, esIncidencia })
      : pedir(`/actividades/${id}/notas`, {
          method: 'POST',
          body: JSON.stringify({ texto, esIncidencia }),
        }),

  // Gestión de postventa (HU-18)
  listarCasos: () => consultarLista('/casos', mock.initialCases),
  crearCasoPostventa: (caso) =>
    USAR_MOCK
      ? simular({ id: 'CAS-MOCK', ...caso })
      : pedir('/casos', { method: 'POST', body: JSON.stringify(caso) }),
  actualizarCasoPostventa: (id, cambios) =>
    USAR_MOCK
      ? simular({ id, ...cambios })
      : pedir(`/casos/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  resolverCasoPostventa: (id, solucion) =>
    USAR_MOCK
      ? simular({ id, estado: 'Resuelto', solucion })
      : pedir(`/casos/${id}/resolver`, {
          method: 'PATCH',
          body: JSON.stringify({ solucion }),
        }),
  calificarCasoPostventa: (id, calificacion) =>
    USAR_MOCK
      ? simular({ id, calificacion })
      : pedir(`/casos/${id}/calificar`, {
          method: 'PATCH',
          body: JSON.stringify({ calificacion }),
        }),

  // Usuarios y seguridad (HU-01)
  listarUsuarios: () => consultarLista('/usuarios', mock.initialUsers),
  crearUsuario: (usuario) =>
    USAR_MOCK
      ? simular(usuario)
      : pedir('/usuarios', { method: 'POST', body: JSON.stringify(usuario) }),
  actualizarUsuario: (id, cambios) =>
    USAR_MOCK
      ? simular({ id, ...cambios })
      : pedir(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  cambiarEstadoUsuario: (id, estado) =>
    USAR_MOCK
      ? simular({ id, estado })
      : pedir(`/usuarios/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),

  // Comunicaciones omnicanal
  listarComunicaciones: () => consultarLista('/comunicaciones', mock.initialComms),
  enviarMensajeComunicacion: (id, mensaje) =>
    USAR_MOCK
      ? simular({ id, mensaje })
      : pedir(`/comunicaciones/${id}/mensajes`, {
          method: 'POST',
          body: JSON.stringify(mensaje),
        }),

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
