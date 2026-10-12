// Capa de acceso a datos de ORVEX.
//
// HOY: devuelve los datos simulados de src/data/mockData.js (con una pequeña demora para simular la red).
// MAÑANA: cuando el backend (API REST + PostgreSQL) esté listo, basta con poner USAR_MOCK = false
// y definir la variable VITE_API_URL en un archivo .env (ej: VITE_API_URL=http://localhost:3000/api).
// El resto de la aplicación no necesita cambios porque solo habla con este archivo.
//
// Endpoints que se esperan del backend (propuesta):
//   GET    /clientes            GET  /ordenes              GET   /solicitudes
//   GET    /actividades         GET  /casos                GET   /usuarios
//   POST   /solicitudes                      -> registrar solicitud
//   POST   /solicitudes/:id/validar          -> genera la orden de producción
//   PATCH  /ordenes/:id/etapa                -> avanzar etapa (el backend debe repetir la regla del diseño aprobado)
//   POST   /ordenes/:id/versiones            -> crear / enviar / aprobar / rechazar versión de diseño
//   PATCH  /actividades/:id                  -> iniciar, pausar, finalizar, reasignar
//   PATCH  /casos/:id                        -> actualizar caso de postventa

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
  listarActividades: () => consultar('/actividades', mock.initialTasks),
  listarCasos: () => consultar('/casos', mock.initialCases),
  listarUsuarios: () => consultar('/usuarios', mock.initialUsers),
  listarComunicaciones: () => consultar('/comunicaciones', mock.initialComms),

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
