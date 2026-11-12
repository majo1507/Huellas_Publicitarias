// Capa de acceso a datos de ORVEX — Huellas Publicidad.
// Conectada al backend real Express + PostgreSQL con JWT. No existe modo demostración:
// si el servidor no responde se informa el error, nunca se sustituye por datos locales.

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_KEY = 'orvex_auth_token'

// Limpieza de restos del antiguo modo demostración en el navegador
try {
  sessionStorage.removeItem('orvex_demo_fallback')
  localStorage.removeItem('orvex_demo_state_v1')
  if (sessionStorage.getItem(TOKEN_KEY) === 'mock-jwt-token') sessionStorage.removeItem(TOKEN_KEY)
  if (localStorage.getItem(TOKEN_KEY) === 'mock-jwt-token') localStorage.removeItem(TOKEN_KEY)
} catch {}

// Compatibilidad: ya no se persiste ningún estado local de demostración
export function guardarEstadoDemo() {}
export function getAuthToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      sessionStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch {}
}

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

// Determina si el error proviene de falta de conexión al backend o de PostgreSQL no disponible.
// Solo se usa al INICIAR SESIÓN: el modo demostración nunca se activa en silencio a mitad de una
// sesión real, para no presentar datos simulados como si estuvieran guardados en el servidor.
function esErrorDeConexionOBaseDatos(err) {
  if (!err || !err.status) return true // Fallo de red (backend apagado o inaccesible)
  if (err.status >= 500) return true   // Error 500 por PostgreSQL desconectado o sin configurar
  return false
}

// Las sesiones reales propagan el error del servidor; la interfaz lo muestra al usuario.
function errorDeSesionReal(err) {
  if (!err.status) {
    const e = new Error('No hay conexión con el servidor ORVEX. La operación no se guardó; verifica que el backend esté en ejecución.')
    e.status = 0
    return e
  }
  return err
}

async function consultarLista(ruta) {
  try {
    const res = await pedir(ruta)
    return Array.isArray(res) ? res : res?.data || []
  } catch (err) {
    throw errorDeSesionReal(err)
  }
}

async function ejecutarConFallback(fnReal) {
  try {
    return await fnReal()
  } catch (err) {
    throw errorDeSesionReal(err)
  }
}

export const api = {
  // El modo demostración fue eliminado: siempre se opera contra PostgreSQL
  get usarMock() {
    return false
  },

  // Autenticación: Firebase Authentication + verificación del ID token y rol en PostgreSQL
  async firebaseLogin(idToken) {
    const res = await pedir('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
    if (res?.token) setAuthToken(res.token)
    return res
  },

  // Respaldo bcrypt en PostgreSQL; ante fallos de red se propaga el error real
  async login(credenciales) {
    try {
      const res = await pedir('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credenciales),
      })
      if (res?.token) setAuthToken(res.token)
      return res
    } catch (err) {
      throw errorDeSesionReal(err)
    }
  },

  async logout() {
    setAuthToken('')
    try {
      return await pedir('/auth/logout', { method: 'POST' })
    } catch {
      return { ok: true }
    }
  },

  async obtenerPerfil() {
    try {
      const res = await pedir('/auth/perfil')
      return res?.data || res
    } catch (err) {
      if (esErrorDeConexionOBaseDatos(err)) return null
      throw err
    }
  },
  // Clientes
  listarClientes: () => consultarLista('/clientes'),
  crearCliente: (cliente) =>
    ejecutarConFallback(
      () => pedir('/clientes', { method: 'POST', body: JSON.stringify(cliente) })
    ),
  actualizarCliente: (id, cliente) =>
    ejecutarConFallback(
      () => pedir(`/clientes/${id}`, { method: 'PATCH', body: JSON.stringify(cliente) })
    ),
  archivarCliente: (id) =>
    ejecutarConFallback(
      () => pedir(`/clientes/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarCliente: (id) =>
    ejecutarConFallback(
      () => pedir(`/clientes/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarCliente: (id) =>
    ejecutarConFallback(
      () => pedir(`/clientes/${id}`, { method: 'DELETE' })
    ),

  // Solicitudes (HU-03 a HU-06)
  listarSolicitudes: () => consultarLista('/solicitudes'),
  crearSolicitud: (solicitud) =>
    ejecutarConFallback(
      () => pedir('/solicitudes', { method: 'POST', body: JSON.stringify(solicitud) })
    ),
  actualizarSolicitud: (id, solicitud) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}`, { method: 'PATCH', body: JSON.stringify(solicitud) })
    ),
  archivarSolicitud: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarSolicitud: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarSolicitud: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}`, { method: 'DELETE' })
    ),
  enviarAValidacion: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/enviar`, { method: 'PATCH' })
    ),
  corregirSolicitud: (id, datos) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/corregir`, { method: 'PATCH', body: JSON.stringify(datos) })
    ),
  validarSolicitud: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/validar`, { method: 'POST' })
    ),
  devolverSolicitud: (id, motivo) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/devolver`, { method: 'PATCH', body: JSON.stringify({ motivo }) })
    ),
  rechazarSolicitud: (id, motivo) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo }) })
    ),

  // Órdenes de producción (HU-06, HU-13, HU-16, HU-17, HU-19, HU-20)
  listarOrdenes: () => consultarLista('/ordenes'),
  obtenerOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}`)
    ),
  actualizarOrden: (id, orden) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}`, { method: 'PATCH', body: JSON.stringify(orden) })
    ),
  archivarOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}`, { method: 'DELETE' })
    ),
  avanzarEtapaOrden: (id, etapa) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/etapa`, {
          method: 'PATCH',
          body: JSON.stringify(etapa ? { etapa } : {}),
        })
    ),
  asignarEquipoOrden: (id, datos) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/asignacion`, {
          method: 'PATCH',
          body: JSON.stringify(datos),
        })
    ),
  registrarEntrega: (ordenId, datosEntrega) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${ordenId}/entrega`, {
          method: 'POST',
          body: JSON.stringify(datosEntrega),
        })
    ),
  cerrarOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        })
    ),
  reabrirOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/reabrir`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        })
    ),
  clonarOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/clonar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        })
    ),
  obtenerHistorialOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}/historial`)
    ),

  // Diseño y versiones de arte (HU-11, HU-12, HU-13)
  crearVersionDiseno: (ordenId, payload = {}) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
    ),
  enviarDiseno: (ordenId, observaciones = '') =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/enviar`, {
          method: 'PATCH',
          body: JSON.stringify({ observaciones }),
        })
    ),
  responderDiseno: (ordenId, decision, comentario = '', decisor = '', extra = {}) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/aprobacion`, {
          method: 'PATCH',
          body: JSON.stringify({ estado: decision, comentario, decisor, ...extra }),
        })
    ),
  gestionarPropuestaComercial: (ordenId, datos) =>
    ejecutarConFallback(
      () => {
        if (typeof FormData !== 'undefined' && datos?.archivo instanceof File) {
          const formData = new FormData()
          Object.entries(datos).forEach(([k, v]) => {
            if (v !== undefined && v !== null && k !== 'archivo') {
              formData.append(k, String(v))
            }
          })
          formData.append('archivo', datos.archivo)
          return pedir(`/disenos/orden/${ordenId}/gestion-comercial`, {
            method: 'PATCH',
            body: formData,
          })
        }
        const { archivo, ...payloadJson } = datos || {}
        return pedir(`/disenos/orden/${ordenId}/gestion-comercial`, {
          method: 'PATCH',
          body: JSON.stringify(payloadJson),
        })
      }
    ),
  liberarParaImpresion: (ordenId) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/liberar-impresion`, {
          method: 'PATCH',
        })
    ),

  // Actividades de taller (HU-08, HU-10, HU-14, HU-15)
  listarActividades: () => consultarLista('/actividades'),
  crearActividad: (tarea) =>
    ejecutarConFallback(
      () =>
        pedir('/actividades', {
          method: 'POST',
          body: JSON.stringify(tarea),
        })
    ),
  actualizarActividad: (id, tarea) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(tarea),
        })
    ),
  eliminarActividad: (id) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}`, {
          method: 'DELETE',
        })
    ),
  asignarActividad: (id, responsable) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/asignar`, {
          method: 'PATCH',
          body: JSON.stringify({ responsable }),
        })
    ),
  accionActividad: (id, accion) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/accion`, {
          method: 'PATCH',
          body: JSON.stringify({ accion }),
        })
    ),
  actualizarAvanceActividad: (id, estado, pct) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/avance`, {
          method: 'PATCH',
          body: JSON.stringify({ estado, pct }),
        })
    ),
  agregarNotaActividad: (id, texto, esIncidencia = false) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/notas`, {
          method: 'POST',
          body: JSON.stringify({ texto, esIncidencia }),
        })
    ),
  resolverIncidenciaActividad: (id, index, solucion) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/resolver-incidencia`, {
          method: 'PATCH',
          body: JSON.stringify({ index, solucion }),
        })
    ),

  // Inventario, proveedores y movimientos de bodega
  listarInventario: () => consultarLista('/inventario'),
  crearMaterialInventario: (material) =>
    ejecutarConFallback(
      () => pedir('/inventario', { method: 'POST', body: JSON.stringify(material) })
    ),
  actualizarMaterialInventario: (id, material) =>
    ejecutarConFallback(
      () => pedir(`/inventario/${id}`, { method: 'PATCH', body: JSON.stringify(material) })
    ),
  archivarMaterialInventario: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarMaterialInventario: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarMaterialInventario: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/${id}`, { method: 'DELETE' })
    ),
  listarProveedores: () => consultarLista('/inventario/proveedores'),
  crearProveedor: (proveedor) =>
    ejecutarConFallback(
      () => pedir('/inventario/proveedores', { method: 'POST', body: JSON.stringify(proveedor) })
    ),
  actualizarProveedor: (id, proveedor) =>
    ejecutarConFallback(
      () => pedir(`/inventario/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(proveedor) })
    ),
  archivarProveedor: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/proveedores/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarProveedor: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/proveedores/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarProveedor: (id) =>
    ejecutarConFallback(
      () => pedir(`/inventario/proveedores/${id}`, { method: 'DELETE' })
    ),
  listarMovimientosInventario: () => consultarLista('/inventario/movimientos'),
  registrarMovimientoInventario: (movimiento) =>
    ejecutarConFallback(
      () => pedir('/inventario/movimientos', { method: 'POST', body: JSON.stringify(movimiento) })
    ),

  // Gestión de postventa (HU-18)
  listarCasos: () => consultarLista('/casos'),
  crearCasoPostventa: (caso) =>
    ejecutarConFallback(
      () => pedir('/casos', { method: 'POST', body: JSON.stringify(caso) })
    ),
  actualizarCasoPostventa: (id, cambios) =>
    ejecutarConFallback(
      () => pedir(`/casos/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    ),
  archivarCasoPostventa: (id) =>
    ejecutarConFallback(
      () => pedir(`/casos/${id}/archivar`, { method: 'PATCH' })
    ),
  restaurarCasoPostventa: (id) =>
    ejecutarConFallback(
      () => pedir(`/casos/${id}/restaurar`, { method: 'PATCH' })
    ),
  eliminarCasoPostventa: (id) =>
    ejecutarConFallback(
      () => pedir(`/casos/${id}`, { method: 'DELETE' })
    ),
  resolverCasoPostventa: (id, solucion) =>
    ejecutarConFallback(
      () =>
        pedir(`/casos/${id}/resolver`, {
          method: 'PATCH',
          body: JSON.stringify({ solucion }),
        })
    ),
  calificarCasoPostventa: (id, calificacion) =>
    ejecutarConFallback(
      () =>
        pedir(`/casos/${id}/calificar`, {
          method: 'PATCH',
          body: JSON.stringify({ calificacion }),
        })
    ),

  // Portal Público de Atención al Cliente (Huellas Publicidad)
  consultarPedidoPublico: (datos) =>
    pedir('/portal/pedidos/consultar', { method: 'POST', body: JSON.stringify(datos) }),
  radicarPQRSFPublico: (datos) => {
    if (typeof FormData !== 'undefined' && datos instanceof FormData) {
      return pedir('/portal/pqrsf/radicar', { method: 'POST', body: datos })
    }
    return pedir('/portal/pqrsf/radicar', { method: 'POST', body: JSON.stringify(datos) })
  },
  consultarPQRSFPublico: (datos) =>
    pedir('/portal/pqrsf/consultar', { method: 'POST', body: JSON.stringify(datos) }),

  // Usuarios y seguridad (HU-01)
  listarUsuarios: () => consultarLista('/usuarios'),
  crearUsuario: (usuario) =>
    ejecutarConFallback(
      () => pedir('/usuarios', { method: 'POST', body: JSON.stringify(usuario) })
    ),
  actualizarUsuario: (id, cambios) =>
    ejecutarConFallback(
      () => pedir(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    ),
  cambiarEstadoUsuario: (id, estado) =>
    ejecutarConFallback(
      () => pedir(`/usuarios/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) })
    ),

  // Comunicaciones omnicanal
  listarComunicaciones: () => consultarLista('/comunicaciones'),
  enviarMensajeComunicacion: (id, mensaje) =>
    ejecutarConFallback(
      () =>
        pedir(`/comunicaciones/${id}/mensajes`, {
          method: 'POST',
          body: JSON.stringify(mensaje),
        })
    ),
  reintentarMensajeComunicacion: (commId, mensajeId) =>
    ejecutarConFallback(
      () => pedir(`/comunicaciones/${commId}/mensajes/${mensajeId}/reintentar`, { method: 'POST' })
    ),
  enviarNuevoCorreo: (datos) =>
    ejecutarConFallback(
      () =>
        pedir('/comunicaciones/nuevo-correo', {
          method: 'POST',
          body: JSON.stringify(datos),
        })
    ),
  enviarNuevoWhatsApp: (datos) =>
    ejecutarConFallback(
      () =>
        pedir('/comunicaciones/nuevo-whatsapp', {
          method: 'POST',
          body: JSON.stringify(datos),
        })
    ),
  sincronizarComunicaciones: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/gmail/sincronizar', { method: 'POST' })
    ),
  obtenerRevisionComunicaciones: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/revision')
    ),
  marcarConversacionLeida: (id) =>
    ejecutarConFallback(
      () => pedir(`/comunicaciones/${id}/leido`, { method: 'PATCH' })
    ),
  API_URL,
  getAuthToken,

  // Integración Gmail OAuth 2.0
  obtenerEstadoGmail: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/gmail/estado')
    ),
  iniciarAutorizacionGmail: () =>
    pedir('/comunicaciones/gmail/auth'),
  desconectarGmail: () =>
    pedir('/comunicaciones/gmail/desconectar', { method: 'POST' }),

  // Integración Meta WhatsApp Cloud API
  obtenerEstadoWhatsApp: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/whatsapp/estado')
    ),

  // Métricas ejecutivas y consolidadas del Dashboard de Gerencia (Fase 3.2)
  async obtenerDashboard() {
    try {
      const res = await pedir('/dashboard')
      return { ok: true, data: res }
    } catch (err) {
      // Manejo transparente de errores de métricas
      if (err.status === 401 || err.status === 403) {
        throw err // Propagar errores de autenticación y autorización
      }
      return {
        ok: false,
        error: err.message || 'Error al consultar las métricas del dashboard en PostgreSQL.',
        status: err.status || 500,
        data: null,
      }
    }
  },

  // Carga inicial de toda la información que necesita la aplicación según el rol activo
  async cargarTodo(rolParam) {
    // Resolver rol activo de manera resiliente (parámetro -> sessionStorage -> fallback)
    let rol = rolParam
    if (!rol && typeof sessionStorage !== 'undefined') {
      try {
        const guardadoUser = sessionStorage.getItem('orvex_auth_user')
        if (guardadoUser) {
          const u = JSON.parse(guardadoUser)
          rol = u.rolUi || u.rol || u.rolBd
        }
        if (!rol) {
          rol = sessionStorage.getItem('orvex_auth_role')
        }
      } catch {}
    }
    const r = (rol || '').toString().trim().toLowerCase()

    // Helper para tolerar errores 403 Forbidden o 404 Not Found en recursos no autorizados o ausentes
    const tolerar = (promesa, fallback = []) =>
      promesa.catch((err) => {
        if (err && (err.status === 403 || err.status === 404)) {
          return fallback
        }
        return Promise.reject(err)
      })

    // 1. Rol Operario: Interfaz mínima exclusiva de taller (Pedro Morales / Juan Pérez)
    // Solo requiere sus tareas asignadas y órdenes para contexto técnico
    if (r === 'operario' || r === 'produccion') {
      const [orders, tasks] = await Promise.all([
        tolerar(this.listarOrdenes()),
        tolerar(this.listarActividades()),
      ])
      return {
        clients: [],
        orders: orders || [],
        requests: [],
        tasks: tasks || [],
        cases: [],
        users: [],
        comms: [],
        inventory: [],
        suppliers: [],
        inventoryMovements: [],
        dashboard: null,
      }
    }

    // 2. Rol Diseñador: Mesa de diseño técnico y aprobaciones (María López)
    // Requiere órdenes, tareas, solicitudes para briefing, clientes y usuarios
    if (r === 'disenador' || r === 'diseno' || r === 'diseñador') {
      const [clients, orders, requests, tasks, users] = await Promise.all([
        tolerar(this.listarClientes()),
        tolerar(this.listarOrdenes()),
        tolerar(this.listarSolicitudes()),
        tolerar(this.listarActividades()),
        tolerar(this.listarUsuarios()),
      ])
      return {
        clients: clients || [],
        orders: orders || [],
        requests: requests || [],
        tasks: tasks || [],
        cases: [],
        users: users || [],
        comms: [],
        inventory: [],
        suppliers: [],
        inventoryMovements: [],
        dashboard: null,
      }
    }

    // 3. Rol Postventa: Casos, garantías y atención
    if (r === 'postventa') {
      const [clients, orders, cases, users, comms, tasks] = await Promise.all([
        tolerar(this.listarClientes()),
        tolerar(this.listarOrdenes()),
        tolerar(this.listarCasos()),
        tolerar(this.listarUsuarios()),
        tolerar(this.listarComunicaciones()),
        tolerar(this.listarActividades()),
      ])
      return {
        clients: clients || [],
        orders: orders || [],
        requests: [],
        tasks: tasks || [],
        cases: cases || [],
        users: users || [],
        comms: comms || [],
        inventory: [],
        suppliers: [],
        inventoryMovements: [],
        dashboard: null,
      }
    }

    // 4. Rol Comercial / Recepción (Ana Martínez):
    // Clientes, órdenes, solicitudes, tareas, casos, usuarios, comunicaciones
    if (r === 'comercial' || r === 'ejecutiva') {
      const [clients, orders, requests, tasks, cases, users, comms] = await Promise.all([
        tolerar(this.listarClientes()),
        tolerar(this.listarOrdenes()),
        tolerar(this.listarSolicitudes()),
        tolerar(this.listarActividades()),
        tolerar(this.listarCasos()),
        tolerar(this.listarUsuarios()),
        tolerar(this.listarComunicaciones()),
      ])
      return {
        clients: clients || [],
        orders: orders || [],
        requests: requests || [],
        tasks: tasks || [],
        cases: cases || [],
        users: users || [],
        comms: comms || [],
        inventory: [],
        suppliers: [],
        inventoryMovements: [],
        dashboard: null,
      }
    }

    // 5. Coordinador y Gerencia (o cualquier otro rol administrativo):
    // Carga completa con protección 403 en cada recurso individual
    const [
      clients,
      orders,
      requests,
      tasks,
      cases,
      users,
      comms,
      inventory,
      suppliers,
      inventoryMovements,
      dashboardResult,
    ] = await Promise.all([
      tolerar(this.listarClientes()),
      tolerar(this.listarOrdenes()),
      tolerar(this.listarSolicitudes()),
      tolerar(this.listarActividades()),
      tolerar(this.listarCasos()),
      tolerar(this.listarUsuarios()),
      tolerar(this.listarComunicaciones()),
      tolerar(this.listarInventario()),
      tolerar(this.listarProveedores()),
      tolerar(this.listarMovimientosInventario()),
      this.obtenerDashboard().catch((err) => ({ ok: false, error: err.message, status: err.status })),
    ])
    return {
      clients: clients || [],
      orders: orders || [],
      requests: requests || [],
      tasks: tasks || [],
      cases: cases || [],
      users: users || [],
      comms: comms || [],
      inventory: inventory || [],
      suppliers: suppliers || [],
      inventoryMovements: inventoryMovements || [],
      dashboard: dashboardResult?.ok ? dashboardResult.data : (dashboardResult?.error ? { error: dashboardResult.error, status: dashboardResult.status } : null),
    }
  },
}

export default api
