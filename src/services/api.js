// Capa de acceso a datos de ORVEX — Huellas Publicidad.
// Conectada al backend real Express + PostgreSQL con soporte JWT y fallback automático
// al modo de demostración local (mockData) cuando PostgreSQL no está disponible.

import * as mock from '../data/mockData.js'

const USAR_MOCK = import.meta.env?.VITE_USE_MOCK === 'true'
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_KEY = 'orvex_auth_token'
const DEMO_FALLBACK_KEY = 'orvex_demo_fallback'
export const DEMO_STATE_KEY = 'orvex_demo_state_v1'

function crearEstadoInicialDemo() {
  return {
    clients: structuredClone(mock.initialClients),
    orders: structuredClone(mock.initialOrders),
    requests: structuredClone(mock.initialRequests),
    tasks: structuredClone(mock.initialTasks),
    cases: structuredClone(mock.initialCases),
    users: structuredClone(mock.initialUsers),
    comms: structuredClone(mock.initialComms),
    inventory: structuredClone(mock.initialInventory || []),
    suppliers: structuredClone(mock.initialSuppliers || []),
    inventoryMovements: structuredClone(mock.initialInventoryMovements || []),
  }
}

export function leerEstadoDemo() {
  const base = crearEstadoInicialDemo()
  if (typeof window === 'undefined' || !window.localStorage) return base
  try {
    const raw = window.localStorage.getItem(DEMO_STATE_KEY)
    if (!raw) {
      window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(base))
      return base
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return base

    // Garantizar que Pedro Morales y Carlos Gómez existan en usuarios aunque hubiera un estado previo
    const usersGuardados = Array.isArray(parsed.users) && parsed.users.length ? parsed.users : base.users
    const tienePedro = usersGuardados.some((u) => u.nombre === 'Pedro Morales')
    const usersFinal = tienePedro
      ? usersGuardados
      : [...usersGuardados, { id: 'U4-PM', nombre: 'Pedro Morales', cargo: 'Operario de taller', rol: 'Operario', correo: 'pedro.morales@huellas.co', estado: 'Activo' }]

    const tasksGuardadas = Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : base.tasks
    const tasksFinal = tasksGuardadas.map((t) => ({
      descripcion: '',
      instrucciones: '',
      notas: [],
      incidencias: [],
      deps: [],
      ...t,
    }))

    const clientsRaw = Array.isArray(parsed.clients) && parsed.clients.length ? parsed.clients : base.clients
    const clientsFinal = clientsRaw.map((c) => {
      const ref = base.clients.find((b) => b.id === c.id) || {}
      const ciudad = c.municipio || c.ciudad || ref.ciudad || 'Bogotá'
      return {
        tipoDocumento: 'NIT',
        nit: ref.nit || '900.000.000-1',
        tipoCliente: 'Persona Jurídica (Empresa)',
        pais: 'Colombia',
        departamento: ciudad === 'Medellín' ? 'Antioquia' : ciudad === 'Cali' ? 'Valle del Cauca' : 'Bogotá D.C.',
        municipio: ciudad,
        ciudad,
        ...ref,
        ...c,
      }
    })

    const casesRaw = Array.isArray(parsed.cases) && parsed.cases.length ? parsed.cases : base.cases
    // Si el almacenamiento previo no tenía casos categorizados (Satisfacción / Garantía / PQRSF), usar la nueva base enriquecida conservando registros nuevos
    const tieneNuevasCategorias = casesRaw.some((c) => c.categoria === 'Satisfacción' || String(c.id).startsWith('GAR-'))
    const casesCombinados = tieneNuevasCategorias
      ? casesRaw
      : [
          ...base.cases,
          ...casesRaw.filter((c) => !base.cases.some((b) => b.id === c.id) && !/^PV-00[1-8]$/.test(String(c.id))),
        ]
    const casesFinal = casesCombinados.map((c) => {
      const cat =
        c.categoria ||
        (c.tipo === 'Garantía' ? 'Garantía' : c.tipo === 'Satisfacción' ? 'Satisfacción' : 'PQRSF')
      const sub = c.subtipo || c.tipo || (cat === 'Garantía' ? 'Garantía' : cat === 'Satisfacción' ? 'Satisfacción' : 'Reclamo')
      return {
        categoria: cat,
        subtipo: sub,
        tipo: c.tipo || sub,
        motivo: c.motivo || (cat === 'Garantía' ? 'Incumplimiento de las especificaciones acordadas' : sub),
        prioridad: c.prioridad || 'Media',
        dictamenGarantia: c.dictamenGarantia || (cat === 'Garantía' ? 'Pendiente de evaluación' : ''),
        justificacionDictamen: c.justificacionDictamen || '',
        accionCorrectiva: c.accionCorrectiva || '',
        seguimiento: c.seguimiento || '',
        respuestaCliente: c.respuestaCliente || c.solucion || '',
        evidencias: Array.isArray(c.evidencias) ? c.evidencias : [],
        aspectosEvaluados: Array.isArray(c.aspectosEvaluados) ? c.aspectosEvaluados : [],
        historial:
          Array.isArray(c.historial) && c.historial.length
            ? c.historial
            : [
                {
                  fecha: c.fecha || '01/10/2026',
                  hora: '09:00',
                  autor: c.cliente || 'Cliente ORVEX',
                  estado: c.estado || 'Abierto',
                  accion: `Registro inicial (${cat} — ${sub})`,
                  detalle: c.descripcion || '',
                },
              ],
        ...c,
      }
    })

    return {
      clients: clientsFinal,
      orders: Array.isArray(parsed.orders) && parsed.orders.length ? parsed.orders : base.orders,
      requests: Array.isArray(parsed.requests) && parsed.requests.length ? parsed.requests : base.requests,
      tasks: tasksFinal,
      cases: casesFinal,
      users: usersFinal,
      comms: Array.isArray(parsed.comms) ? parsed.comms : base.comms,
      inventory: Array.isArray(parsed.inventory) && parsed.inventory.length ? parsed.inventory : base.inventory,
      suppliers: Array.isArray(parsed.suppliers) && parsed.suppliers.length ? parsed.suppliers : base.suppliers,
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : base.inventoryMovements,
    }
  } catch {
    return base
  }
}

export function guardarEstadoDemo(parcial = {}) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const actual = leerEstadoDemo()
    const siguiente = { ...actual, ...parcial, updatedAt: Date.now() }
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(siguiente))
  } catch {}
}

// Cuentas locales de prueba para demostración cuando PostgreSQL no está disponible
const CUENTAS_DEMO_LOCAL = [
  {
    id: 'U2',
    rol: 'coordinador',
    rolUi: 'coordinador',
    rolBd: 'coord',
    correo: 'carlos.gomez@huellas.co',
    email: 'carlos.gomez@huellas.co',
    aliases: ['carlos.gomez@huellas.co', 'carlos.ruiz@orvex.test', 'carlos gómez', 'carlos gomez', 'carlos ruiz'],
    clave: 'coord123',
    nombre: 'Carlos Gómez',
    nombre_completo: 'Carlos Gómez',
    cargo: 'Coordinador de producción',
    estado: 'Activo',
  },
  {
    id: 'U1',
    rol: 'comercial',
    rolUi: 'comercial',
    rolBd: 'ejecutiva',
    correo: 'ana.martinez@huellas.co',
    email: 'ana.martinez@huellas.co',
    aliases: ['ana.martinez@huellas.co', 'ana.martinez@orvex.test', 'ana martínez', 'ana martinez'],
    clave: 'comercial123',
    nombre: 'Ana Martínez',
    nombre_completo: 'Ana Martínez',
    cargo: 'Ejecutiva comercial',
    estado: 'Activo',
  },
  {
    id: 'U3',
    rol: 'disenador',
    rolUi: 'disenador',
    rolBd: 'disenador',
    correo: 'maria.lopez@huellas.co',
    email: 'maria.lopez@huellas.co',
    aliases: ['maria.lopez@huellas.co', 'maria.lopez@orvex.test', 'maría lópez', 'maria lopez'],
    clave: 'diseno123',
    nombre: 'María López',
    nombre_completo: 'María López',
    cargo: 'Diseñadora gráfica',
    estado: 'Activo',
  },
  {
    id: 'U4',
    rol: 'operario',
    rolUi: 'operario',
    rolBd: 'produccion',
    correo: 'pedro.morales@huellas.co',
    email: 'pedro.morales@huellas.co',
    aliases: ['pedro.morales@huellas.co', 'juan.perez@orvex.test', 'pedro.ramirez@orvex.test', 'pedro morales', 'juan pérez', 'juan perez'],
    clave: 'taller123',
    nombre: 'Pedro Morales',
    nombre_completo: 'Pedro Morales',
    cargo: 'Operario de taller',
    estado: 'Activo',
  },
  {
    id: 'U6',
    rol: 'postventa',
    rolUi: 'postventa',
    rolBd: 'postventa',
    correo: 'sofia.herrera@huellas.co',
    email: 'sofia.herrera@huellas.co',
    aliases: ['sofia.herrera@huellas.co', 'sofia.herrera@orvex.test', 'sofía herrera', 'sofia herrera'],
    clave: 'post123',
    nombre: 'Sofía Herrera',
    nombre_completo: 'Sofía Herrera',
    cargo: 'Atención postventa',
    estado: 'Activo',
  },
  {
    id: 'U7',
    rol: 'gerencia',
    rolUi: 'gerencia',
    rolBd: 'gerente',
    correo: 'laura.sanchez@huellas.co',
    email: 'laura.sanchez@huellas.co',
    aliases: ['laura.sanchez@huellas.co', 'andres.torres@orvex.test', 'laura sánchez', 'laura sanchez', 'andrés torres', 'andres torres'],
    clave: 'gerencia123',
    nombre: 'Laura Sánchez',
    nombre_completo: 'Laura Sánchez',
    cargo: 'Gerente general',
    estado: 'Activo',
  },
]

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

export function getModoDemoLocal() {
  if (USAR_MOCK) return true
  try {
    return sessionStorage.getItem(DEMO_FALLBACK_KEY) === 'true' || getAuthToken() === 'mock-jwt-token'
  } catch {
    return false
  }
}

export function setModoDemoLocal(activo) {
  try {
    if (activo) sessionStorage.setItem(DEMO_FALLBACK_KEY, 'true')
    else sessionStorage.removeItem(DEMO_FALLBACK_KEY)
  } catch {}
}

function buscarCuentaDemoLocal(credenciales = {}) {
  const idInput = String(credenciales.identificador || credenciales.email || credenciales.correo || '')
    .trim()
    .toLowerCase()
  const password = String(credenciales.clave || credenciales.password || '')

  return (
    CUENTAS_DEMO_LOCAL.find(
      (c) => c.aliases.includes(idInput) && c.clave === password
    ) || null
  )
}

function autenticarDemoLocal(credenciales = {}) {
  const cuenta = buscarCuentaDemoLocal(credenciales)

  if (!cuenta) {
    const err = new Error('Credenciales inválidas. Verifica tu correo y contraseña o selecciona uno de los accesos de demostración.')
    err.status = 401
    throw err
  }

  setModoDemoLocal(true)
  setAuthToken('mock-jwt-token')

  const { aliases, clave, ...usuarioLimpio } = cuenta
  return {
    token: 'mock-jwt-token',
    modoDemo: true,
    usuario: usuarioLimpio,
  }
}

// Simula la respuesta de un servidor en modo demostración
const simular = (valor, ms = 120) =>
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

async function consultarLista(ruta, datosMock, claveDemo = null) {
  const obtenerRespaldo = () => {
    if (claveDemo) {
      const estado = leerEstadoDemo()
      if (Array.isArray(estado[claveDemo])) return estado[claveDemo]
    }
    return datosMock
  }
  if (getModoDemoLocal()) return simular(obtenerRespaldo())
  try {
    const res = await pedir(ruta)
    return Array.isArray(res) ? res : res?.data || []
  } catch (err) {
    throw errorDeSesionReal(err)
  }
}

async function ejecutarConFallback(fnReal, valorFallback) {
  if (getModoDemoLocal()) return simular(valorFallback)
  try {
    return await fnReal()
  } catch (err) {
    throw errorDeSesionReal(err)
  }
}

export const api = {
  get usarMock() {
    return getModoDemoLocal()
  },

  // Autenticación (HU-02): intenta login real contra PostgreSQL; si PostgreSQL o el backend
  // no están disponibles, activa automáticamente el modo de demostración local.
  async login(credenciales) {
    if (USAR_MOCK) {
      return simular(autenticarDemoLocal(credenciales))
    }
    try {
      const res = await pedir('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credenciales),
      })
      setModoDemoLocal(false)
      if (res?.token) setAuthToken(res.token)
      return res
    } catch (err) {
      // Solo se entra al modo demostración cuando el servidor o PostgreSQL no están disponibles.
      // Un 401 real del servidor es un rechazo de credenciales y nunca se sustituye por datos locales.
      if (esErrorDeConexionOBaseDatos(err) && buscarCuentaDemoLocal(credenciales)) {
        return autenticarDemoLocal(credenciales)
      }
      throw errorDeSesionReal(err)
    }
  },

  async logout() {
    const eraMock = getModoDemoLocal()
    setAuthToken('')
    setModoDemoLocal(false)
    if (eraMock || USAR_MOCK) return simular({ ok: true })
    try {
      return await pedir('/auth/logout', { method: 'POST' })
    } catch {
      return { ok: true }
    }
  },

  async obtenerPerfil() {
    if (getModoDemoLocal()) return simular(null)
    try {
      const res = await pedir('/auth/perfil')
      return res?.data || res
    } catch (err) {
      if (esErrorDeConexionOBaseDatos(err)) return null
      throw err
    }
  },

  // Clientes
  listarClientes: () => consultarLista('/clientes', mock.initialClients, 'clients'),
  crearCliente: (cliente) =>
    ejecutarConFallback(
      () => pedir('/clientes', { method: 'POST', body: JSON.stringify(cliente) }),
      { modoMock: true, data: null }
    ),

  // Solicitudes (HU-03 a HU-06)
  listarSolicitudes: () => consultarLista('/solicitudes', mock.initialRequests, 'requests'),
  crearSolicitud: (solicitud) =>
    ejecutarConFallback(
      () => pedir('/solicitudes', { method: 'POST', body: JSON.stringify(solicitud) }),
      { modoMock: true, data: null }
    ),
  enviarAValidacion: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/enviar`, { method: 'PATCH' }),
      { modoMock: true, data: { id, estado: 'En validación' } }
    ),
  corregirSolicitud: (id, datos) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/corregir`, { method: 'PATCH', body: JSON.stringify(datos) }),
      { modoMock: true, data: { id, ...datos, estado: 'En validación' } }
    ),
  validarSolicitud: (id) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/validar`, { method: 'POST' }),
      { modoMock: true }
    ),
  devolverSolicitud: (id, motivo) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/devolver`, { method: 'PATCH', body: JSON.stringify({ motivo }) }),
      { modoMock: true, data: { id, estado: 'Devuelta para corrección', motivoRechazo: motivo } }
    ),
  rechazarSolicitud: (id, motivo) =>
    ejecutarConFallback(
      () => pedir(`/solicitudes/${id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo }) }),
      { modoMock: true, data: { id, estado: 'Rechazada', motivoRechazo: motivo } }
    ),

  // Órdenes de producción (HU-06, HU-13, HU-16, HU-17, HU-19, HU-20)
  listarOrdenes: () => consultarLista('/ordenes', mock.initialOrders, 'orders'),
  obtenerOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}`),
      leerEstadoDemo().orders.find((o) => o.id === id)
    ),
  avanzarEtapaOrden: (id, etapa) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/etapa`, {
          method: 'PATCH',
          body: JSON.stringify(etapa ? { etapa } : {}),
        }),
      { modoMock: true }
    ),
  asignarEquipoOrden: (id, datos) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/asignacion`, {
          method: 'PATCH',
          body: JSON.stringify(datos),
        }),
      { modoMock: true, data: datos }
    ),
  registrarEntrega: (ordenId, datosEntrega) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${ordenId}/entrega`, {
          method: 'POST',
          body: JSON.stringify(datosEntrega),
        }),
      { modoMock: true }
    ),
  cerrarOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
      { modoMock: true }
    ),
  reabrirOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/reabrir`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
      { modoMock: true }
    ),
  clonarOrden: (id, motivo) =>
    ejecutarConFallback(
      () =>
        pedir(`/ordenes/${id}/clonar`, {
          method: 'POST',
          body: JSON.stringify({ motivo }),
        }),
      { modoMock: true }
    ),
  obtenerHistorialOrden: (id) =>
    ejecutarConFallback(
      () => pedir(`/ordenes/${id}/historial`),
      mock.initialOrders.find((o) => o.id === id)?.historial || []
    ),

  // Diseño y versiones de arte (HU-11, HU-12, HU-13)
  crearVersionDiseno: (ordenId, payload = {}) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      { modoMock: true }
    ),
  enviarDiseno: (ordenId, observaciones = '') =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/enviar`, {
          method: 'PATCH',
          body: JSON.stringify({ observaciones }),
        }),
      { modoMock: true }
    ),
  responderDiseno: (ordenId, decision, comentario = '', decisor = '', extra = {}) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/aprobacion`, {
          method: 'PATCH',
          body: JSON.stringify({ estado: decision, comentario, decisor, ...extra }),
        }),
      { modoMock: true }
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
      },
      { modoMock: true }
    ),
  liberarParaImpresion: (ordenId) =>
    ejecutarConFallback(
      () =>
        pedir(`/disenos/orden/${ordenId}/liberar-impresion`, {
          method: 'PATCH',
        }),
      { modoMock: true }
    ),

  // Actividades de taller (HU-08, HU-10, HU-14, HU-15)
  listarActividades: () => consultarLista('/actividades', mock.initialTasks, 'tasks'),
  crearActividad: (tarea) =>
    ejecutarConFallback(
      () =>
        pedir('/actividades', {
          method: 'POST',
          body: JSON.stringify(tarea),
        }),
      { modoMock: true, data: null }
    ),
  asignarActividad: (id, responsable) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/asignar`, {
          method: 'PATCH',
          body: JSON.stringify({ responsable }),
        }),
      { modoMock: true }
    ),
  accionActividad: (id, accion) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/accion`, {
          method: 'PATCH',
          body: JSON.stringify({ accion }),
        }),
      { modoMock: true }
    ),
  actualizarAvanceActividad: (id, estado, pct) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/avance`, {
          method: 'PATCH',
          body: JSON.stringify({ estado, pct }),
        }),
      { modoMock: true }
    ),
  agregarNotaActividad: (id, texto, esIncidencia = false) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/notas`, {
          method: 'POST',
          body: JSON.stringify({ texto, esIncidencia }),
        }),
      { modoMock: true }
    ),
  resolverIncidenciaActividad: (id, index, solucion) =>
    ejecutarConFallback(
      () =>
        pedir(`/actividades/${id}/resolver-incidencia`, {
          method: 'PATCH',
          body: JSON.stringify({ index, solucion }),
        }),
      { modoMock: true }
    ),

  // Inventario, proveedores y movimientos de bodega
  listarInventario: () => consultarLista('/inventario', mock.initialInventory || [], 'inventory'),
  crearMaterialInventario: (material) =>
    ejecutarConFallback(
      () => pedir('/inventario', { method: 'POST', body: JSON.stringify(material) }),
      { modoMock: true, data: null }
    ),
  listarProveedores: () => consultarLista('/inventario/proveedores', mock.initialSuppliers || [], 'suppliers'),
  crearProveedor: (proveedor) =>
    ejecutarConFallback(
      () => pedir('/inventario/proveedores', { method: 'POST', body: JSON.stringify(proveedor) }),
      { modoMock: true, data: null }
    ),
  listarMovimientosInventario: () => consultarLista('/inventario/movimientos', mock.initialInventoryMovements || [], 'inventoryMovements'),
  registrarMovimientoInventario: (movimiento) =>
    ejecutarConFallback(
      () => pedir('/inventario/movimientos', { method: 'POST', body: JSON.stringify(movimiento) }),
      { modoMock: true, data: null }
    ),

  // Gestión de postventa (HU-18)
  listarCasos: () => consultarLista('/casos', mock.initialCases, 'cases'),
  crearCasoPostventa: (caso) =>
    ejecutarConFallback(
      () => pedir('/casos', { method: 'POST', body: JSON.stringify(caso) }),
      { modoMock: true }
    ),
  actualizarCasoPostventa: (id, cambios) =>
    ejecutarConFallback(
      () => pedir(`/casos/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
      { modoMock: true }
    ),
  resolverCasoPostventa: (id, solucion) =>
    ejecutarConFallback(
      () =>
        pedir(`/casos/${id}/resolver`, {
          method: 'PATCH',
          body: JSON.stringify({ solucion }),
        }),
      { modoMock: true }
    ),
  calificarCasoPostventa: (id, calificacion) =>
    ejecutarConFallback(
      () =>
        pedir(`/casos/${id}/calificar`, {
          method: 'PATCH',
          body: JSON.stringify({ calificacion }),
        }),
      { modoMock: true }
    ),

  // Usuarios y seguridad (HU-01)
  listarUsuarios: () => consultarLista('/usuarios', mock.initialUsers, 'users'),
  crearUsuario: (usuario) =>
    ejecutarConFallback(
      () => pedir('/usuarios', { method: 'POST', body: JSON.stringify(usuario) }),
      { modoMock: true, data: usuario }
    ),
  actualizarUsuario: (id, cambios) =>
    ejecutarConFallback(
      () => pedir(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
      { modoMock: true, data: { id, ...cambios } }
    ),
  cambiarEstadoUsuario: (id, estado) =>
    ejecutarConFallback(
      () => pedir(`/usuarios/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
      { modoMock: true, data: { id, estado } }
    ),

  // Comunicaciones omnicanal
  listarComunicaciones: () => consultarLista('/comunicaciones', mock.initialComms, 'comms'),
  enviarMensajeComunicacion: (id, mensaje) =>
    ejecutarConFallback(
      () =>
        pedir(`/comunicaciones/${id}/mensajes`, {
          method: 'POST',
          body: JSON.stringify(mensaje),
        }),
      { modoMock: true }
    ),
  reintentarMensajeComunicacion: (commId, mensajeId) =>
    ejecutarConFallback(
      () => pedir(`/comunicaciones/${commId}/mensajes/${mensajeId}/reintentar`, { method: 'POST' }),
      { modoMock: true }
    ),
  enviarNuevoCorreo: (datos) =>
    ejecutarConFallback(
      () =>
        pedir('/comunicaciones/nuevo-correo', {
          method: 'POST',
          body: JSON.stringify(datos),
        }),
      { modoMock: true }
    ),
  enviarNuevoWhatsApp: (datos) =>
    ejecutarConFallback(
      () =>
        pedir('/comunicaciones/nuevo-whatsapp', {
          method: 'POST',
          body: JSON.stringify(datos),
        }),
      { modoMock: true }
    ),
  sincronizarComunicaciones: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/gmail/sincronizar', { method: 'POST' }),
      { modoMock: true, data: { ok: true, sincronizados: 0, nuevos: 0 } }
    ),
  obtenerRevisionComunicaciones: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/revision'),
      { modoMock: true, total: 0, ultimoTs: 0, version: '0' }
    ),
  marcarConversacionLeida: (id) =>
    ejecutarConFallback(
      () => pedir(`/comunicaciones/${id}/leido`, { method: 'PATCH' }),
      { modoMock: true }
    ),
  API_URL,
  getAuthToken,

  // Integración Gmail OAuth 2.0
  obtenerEstadoGmail: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/gmail/estado'),
      { modoMock: true, data: { conectado: false, email: null, diasRestantes: 0 } }
    ),
  iniciarAutorizacionGmail: () =>
    pedir('/comunicaciones/gmail/auth'),
  desconectarGmail: () =>
    pedir('/comunicaciones/gmail/desconectar', { method: 'POST' }),

  // Integración Meta WhatsApp Cloud API
  obtenerEstadoWhatsApp: () =>
    ejecutarConFallback(
      () => pedir('/comunicaciones/whatsapp/estado'),
      { modoMock: true, data: { conectado: false, numeroOficial: '+57 311 608 8542' } }
    ),

  // Métricas ejecutivas y consolidadas del Dashboard de Gerencia (Fase 3.2)
  async obtenerDashboard() {
    try {
      const res = await pedir('/dashboard')
      return { ok: true, data: res }
    } catch (err) {
      // Manejo transparente de errores sin activar el modo demo global (setModoDemoLocal)
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
    if (getModoDemoLocal()) {
      return simular(leerEstadoDemo(), 40)
    }

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
