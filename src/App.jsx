import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Loader from './components/Loader.jsx'
import Alert from './components/Alert.jsx'
import ToastStack from './components/ToastStack.jsx'
import EnConstruccion from './pages/EnConstruccion.jsx'
import ClientDashboard from './pages/ClientDashboard.jsx'
import CommercialDashboard from './pages/CommercialDashboard.jsx'
import CoordinatorDashboard from './pages/CoordinatorDashboard.jsx'
import DesignerDashboard from './pages/DesignerDashboard.jsx'
import OperatorDashboard from './pages/OperatorDashboard.jsx'
import AfterSalesDashboard from './pages/AfterSalesDashboard.jsx'
import ManagementDashboard from './pages/ManagementDashboard.jsx'
import Orders from './pages/Orders.jsx'
import NewOrder from './pages/NewOrder.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import DesignApproval from './pages/DesignApproval.jsx'
import DesignWorkspace from './pages/DesignWorkspace.jsx'
import AfterSales from './pages/AfterSales.jsx'
import Requests from './pages/Requests.jsx'
import Clients from './pages/Clients.jsx'
import Deliveries from './pages/Deliveries.jsx'
import Communications from './pages/Communications.jsx'
import Production from './pages/Production.jsx'
import Tasks from './pages/Tasks.jsx'
import Inventory from './pages/Inventory.jsx'
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import Login from './pages/Login.jsx'
import { ROLES, normalizarRol } from './data/roles.js'
import { api, getAuthToken, setAuthToken, DEMO_STATE_KEY, guardarEstadoDemo, leerEstadoDemo } from './services/api.js'
import { formatearFecha, formatearHora, puedeAvanzar, validarCierreOrden } from './utils/format.js'

// Dashboard (opción "Inicio") que corresponde a cada rol
const dashboards = {
  cliente: ClientDashboard,
  comercial: CommercialDashboard,
  coordinador: CoordinatorDashboard,
  disenador: DesignerDashboard,
  operario: OperatorDashboard,
  postventa: AfterSalesDashboard,
  gerencia: ManagementDashboard,
}

// Crea un evento para el historial de una orden con la fecha y hora actuales (HU-19)
function crearEvento(actividad, responsable, estado = 'Completado', interno = false, extra = {}) {
  const ahora = new Date()
  return {
    fecha: formatearFecha(ahora),
    hora: formatearHora(ahora),
    actividad,
    responsable,
    estado,
    interno,
    estadoAnterior: extra.estadoAnterior || null,
    nuevoEstado: extra.nuevoEstado || null,
    motivo: extra.motivo || extra.observaciones || null,
  }
}

function cambiarUltimaVersion(versiones, cambios) {
  if (!Array.isArray(versiones) || versiones.length === 0) return []
  return versiones.map((v, idx) => (idx === versiones.length - 1 ? { ...v, ...cambios } : v))
}

export default function App() {
  const [orders, setOrders] = useState([])
  const [requests, setRequests] = useState([])
  const [tasks, setTasks] = useState([])
  const [cases, setCases] = useState([])
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [comms, setComms] = useState([])
  const [inventory, setInventory] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [inventoryMovements, setInventoryMovements] = useState([])
  const [cargando, setCargando] = useState(false)
  const [datosListos, setDatosListos] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)

  // page.name indica la pantalla actual; page.orderId la orden seleccionada
  const [page, setPage] = useState({ name: 'inicio', orderId: null })

  // Usuario autenticado (HU-02)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (sessionStorage.getItem('orvex_auth_logged_out') === 'true') return null
      const token = getAuthToken()
      const guardado = sessionStorage.getItem('orvex_auth_user')
      if (guardado && (token || api.usarMock)) {
        const parsed = JSON.parse(guardado)
        if (parsed && typeof parsed === 'object') {
          const rolNormalizado = normalizarRol(parsed.rolUi || parsed.rol || 'coordinador')
          return {
            ...parsed,
            rol: rolNormalizado,
            rolAutenticado: normalizarRol(parsed.rolAutenticado || rolNormalizado),
          }
        }
      }
      return null
    } catch {
      return null
    }
  })

  // Rol activo (controla vistas, menús y permisos)
  const [role, setRole] = useState(() => {
    try {
      if (sessionStorage.getItem('orvex_auth_logged_out') === 'true') return 'coordinador'
      const guardadoRol = sessionStorage.getItem('orvex_auth_role')
      return normalizarRol(guardadoRol || 'coordinador')
    } catch {
      return 'coordinador'
    }
  })

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [sidebarColapsado, setSidebarColapsado] = useState(false)
  const [toasts, setToasts] = useState([])

  function toggleMenu() {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      setMenuAbierto((prev) => !prev)
    } else {
      setSidebarColapsado((prev) => !prev)
    }
  }

  // Carga de datos desde PostgreSQL (o modo demostración local) cuando el usuario está autenticado
  useEffect(() => {
    if (!currentUser) {
      setCargando(false)
      return
    }
    let cancelado = false
    setCargando(true)
    setErrorCarga('')
    api.cargarTodo()
      .then((d) => {
        if (cancelado) return
        setOrders(d.orders || [])
        setRequests(d.requests || [])
        setTasks(d.tasks || [])
        setCases(d.cases || [])
        setClients(d.clients || [])
        setUsers(d.users || [])
        setComms(d.comms || [])
        setInventory(d.inventory || [])
        setSuppliers(d.suppliers || [])
        setInventoryMovements(d.inventoryMovements || [])
        setDatosListos(true)
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        if (e.status === 401) {
          setAuthToken('')
          setCurrentUser(null)
          setCargando(false)
          return
        }
        setErrorCarga(e.message || 'No se pudo conectar con el servidor.')
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [intento, currentUser?.correo])

  useEffect(() => { window.scrollTo(0, 0) }, [page])

  // Persistencia automática del estado compartido en modo demostración local
  useEffect(() => {
    if (!datosListos || !api.usarMock) return
    guardarEstadoDemo({
      orders,
      requests,
      tasks,
      cases,
      clients,
      users,
      comms,
      inventory,
      suppliers,
      inventoryMovements,
    })
  }, [
    datosListos,
    orders,
    requests,
    tasks,
    cases,
    clients,
    users,
    comms,
    inventory,
    suppliers,
    inventoryMovements,
  ])

  // Sincronización en tiempo real entre pestañas/perfiles abiertos simultáneamente
  useEffect(() => {
    function handleStorageSync(e) {
      if (e.key && e.key !== DEMO_STATE_KEY) return
      if (!api.usarMock) return
      const sincronizado = leerEstadoDemo()
      setOrders(sincronizado.orders || [])
      setRequests(sincronizado.requests || [])
      setTasks(sincronizado.tasks || [])
      setCases(sincronizado.cases || [])
      setClients(sincronizado.clients || [])
      setUsers(sincronizado.users || [])
      setComms(sincronizado.comms || [])
      setInventory(sincronizado.inventory || [])
      setSuppliers(sincronizado.suppliers || [])
      setInventoryMovements(sincronizado.inventoryMovements || [])
    }
    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [])

  const usuario = currentUser?.nombre || ROLES[role]?.usuario?.nombre || 'Usuario'
  const data = {
    orders,
    requests,
    tasks,
    cases,
    clients,
    users,
    comms,
    inventory,
    suppliers,
    inventoryMovements,
  }

  function notify(texto, tipo = 'exito') {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, texto, tipo }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }
  const cerrarToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  // Reemplaza una orden completa en memoria tras actualización del servidor
  function replaceOrderFromServer(ordenActualizada) {
    if (!ordenActualizada || !ordenActualizada.id) return
    setOrders((prev) => {
      const existe = prev.some((o) => o.id === ordenActualizada.id)
      if (!existe) return [ordenActualizada, ...prev]
      return prev.map((o) => (o.id === ordenActualizada.id ? ordenActualizada : o))
    })
  }

  // Navegación con protección de rutas según rol (HU-02 y HU-07)
  // El Coordinador no tiene acceso a 'comunicaciones'
  const irA = (name, orderId = null) => {
    const paginasComunes = ['inicio', 'detalle', 'aprobacion', 'historial', 'disenos']
    const itemMenu = ROLES[role]?.menu.find((m) => m.page === name)
    if (!itemMenu && !paginasComunes.includes(name)) {
      notify(`Acceso restringido: tu rol (${ROLES[role]?.nombre || role}) no tiene acceso a "${name}".`, 'aviso')
      setPage({ name: 'inicio', orderId: null })
      return
    }
    setPage({ name, orderId })
  }

  // Inicio de sesión (HU-02)
  function handleLogin(usuarioElegido, rolElegido) {
    const rolSeguro = normalizarRol(rolElegido || usuarioElegido?.rolUi || usuarioElegido?.rol || 'coordinador')
    const usrConRolBase = {
      ...usuarioElegido,
      rol: rolSeguro,
      rolAutenticado: normalizarRol(usuarioElegido.rolAutenticado || rolSeguro),
    }
    setCurrentUser(usrConRolBase)
    setRole(rolSeguro)
    try {
      sessionStorage.removeItem('orvex_auth_logged_out')
      sessionStorage.setItem('orvex_auth_user', JSON.stringify(usrConRolBase))
      sessionStorage.setItem('orvex_auth_role', rolSeguro)
    } catch {}
    setPage({ name: 'inicio', orderId: null })
    notify(`Bienvenido/a, ${usuarioElegido.nombre}. Sesión activa como ${ROLES[rolSeguro]?.nombre || rolSeguro}.`, 'exito')
  }

  // Cierre de sesión (HU-02)
  function handleLogout() {
    api.logout()
    setCurrentUser(null)
    try {
      sessionStorage.setItem('orvex_auth_logged_out', 'true')
      sessionStorage.removeItem('orvex_auth_user')
    } catch {}
    notify('Sesión cerrada correctamente.', 'info')
  }

  function cambiarRol(nuevoRol) {
    const destino = normalizarRol(nuevoRol)
    const rolReal = normalizarRol(currentUser?.rolAutenticado || currentUser?.rol || role)
    if (!api.usarMock && rolReal !== 'gerencia' && destino !== rolReal) {
      notify(
        `Por seguridad, tu sesión autenticada (${ROLES[rolReal]?.nombre || rolReal}) no permite elevar privilegios a ${ROLES[destino]?.nombre || destino}. Cierra sesión e ingresa con la cuenta correspondiente.`,
        'aviso'
      )
      return
    }

    setRole(destino)
    try {
      sessionStorage.setItem('orvex_auth_role', destino)
    } catch {}
    setPage({ name: 'inicio', orderId: null })
    notify(`Vista cambiada a: ${ROLES[destino]?.nombre || destino}`, 'info')
  }

  // ---------------- Gestión de usuarios (HU-01) ----------------
  function addUser(nuevo) {
    api.crearUsuario(nuevo)
      .then((res) => {
        const creado = res?.data || nuevo
        setUsers((prev) => [...prev.filter((u) => u.id !== creado.id), creado])
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar el usuario.', 'error')
      })
  }

  function updateUser(id, cambios) {
    api.actualizarUsuario(id, cambios)
      .then((res) => {
        const actualizado = res?.data || { id, ...cambios }
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...actualizado } : u)))
      })
      .catch((err) => {
        notify(err.message || 'No se pudo actualizar el usuario.', 'error')
      })
  }

  function toggleUserStatus(id) {
    const objetivo = users.find((u) => u.id === id)
    if (!objetivo) return
    const nuevoEstado = objetivo.estado === 'Activo' ? 'Inactivo' : 'Activo'

    api.cambiarEstadoUsuario(id, nuevoEstado)
      .then((res) => {
        const actualizado = res?.data || { ...objetivo, estado: nuevoEstado }
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...actualizado } : u)))
      })
      .catch((err) => {
        notify(err.message || 'No se pudo cambiar el estado del usuario.', 'error')
      })
  }

  // ---------------- Gestión de clientes ----------------
  async function addClient(nuevo) {
    try {
      const res = await api.crearCliente(nuevo)
      const creado = res?.data || {
        id: `C${clients.length + 1}`,
        ...nuevo,
      }
      setClients((prev) => [...prev.filter((c) => c.id !== creado.id), creado])
      notify(`Cliente ${creado.nombre} registrado con éxito.`, 'exito')
      return creado
    } catch (err) {
      notify(err.message || 'No se pudo registrar el cliente.', 'error')
      throw err
    }
  }

  const selectedOrder = orders.find((o) => o.id === page.orderId)
  const tituloMenu = ROLES[role]?.menu.find((m) => m.page === page.name)?.label || 'Módulo'

  function updateOrder(id, cambios, evento) {
    setOrders((prev) => {
      const next = prev.map((o) => {
        if (o.id !== id) return o
        const nuevos = typeof cambios === 'function' ? cambios(o) : cambios
        return { ...o, ...nuevos, historial: evento ? [...o.historial, evento] : o.historial }
      })
      if (api.usarMock) guardarEstadoDemo({ orders: next })
      return next
    })
  }

  // ---------------- Coordinación de responsables y presupuesto en una orden ----------------
  function assignOrderTeam(id, datos) {
    const ordenActual = orders.find((o) => o.id === id)
    if (!ordenActual) return false

    api.asignarEquipoOrden(id, datos)
      .then((res) => {
        if (res?.modoMock || !res?.data?.id) {
          const cambios = {
            disenador: datos.disenador || ordenActual.disenador,
            responsable: datos.responsable || ordenActual.responsable,
            presupuesto: datos.presupuesto !== undefined ? Number(datos.presupuesto) : ordenActual.presupuesto,
            costoInterno: datos.costoInterno !== undefined ? Number(datos.costoInterno) : ordenActual.costoInterno,
            fechaEntrega: datos.fechaEntrega || ordenActual.fechaEntrega,
          }
          updateOrder(
            id,
            cambios,
            crearEvento(
              `Coordinación de orden actualizada: Diseño (${cambios.disenador}), Responsable operativo (${cambios.responsable})`,
              usuario,
              'Completado',
              true
            )
          )
          notify(`Equipo y parámetros de la orden ${id} actualizados con éxito.`, 'exito')
          return
        }
        replaceOrderFromServer(res.data)
        notify(`Equipo y parámetros de la orden ${id} actualizados con éxito.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo actualizar la asignación de la orden.', 'error')
      })

    return true
  }

  // ---------------- Solicitudes (HU-03, HU-04, HU-05, HU-06) ----------------
  function addRequest(form) {
    api.crearSolicitud(form)
      .then((res) => {
        const nueva = res?.data || {
          ...form,
          id: `SOL-2026-${String(requests.length + 1).padStart(4, '0')}`,
          fechaSolicitud: formatearFecha(),
          estado: 'Pendiente',
          ordenId: null,
          motivoRechazo: '',
          archivosReferencia: form.archivosReferencia || [],
        }
        // Preservar los archivos adjuntos cargados en el formulario si el backend no los devolvió completos
        if (form.archivosReferencia?.length > 0 && (!nueva.archivosReferencia || nueva.archivosReferencia.length === 0)) {
          nueva.archivosReferencia = form.archivosReferencia
        }
        setRequests((prev) => [...prev, nueva])
        irA('solicitudes')
        notify(
          `Solicitud ${nueva.id} registrada con éxito${nueva.archivosReferencia?.length ? ` (${nueva.archivosReferencia.length} archivo(s) de referencia adjunto(s))` : ''}.`,
          'exito'
        )
      })
      .catch((err) => {
        notify(err.message || 'Error al registrar la solicitud.', 'error')
      })
  }

  const updateRequest = (id, cambios) =>
    setRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)))

  function sendToValidation(id) {
    api.enviarAValidacion(id)
      .then((res) => {
        const actualizada = res?.data || { id, estado: 'En validación' }
        updateRequest(id, actualizada)
        notify(`Solicitud ${id} enviada a validación del coordinador.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo enviar la solicitud a validación.', 'error')
      })
  }

  // Devolver solicitud para corrección (HU-05)
  function returnRequest(id, motivo) {
    api.devolverSolicitud(id, motivo)
      .then((res) => {
        const actualizada = res?.data || { id, estado: 'Devuelta para corrección', motivoRechazo: motivo }
        updateRequest(id, actualizada)
        notify(`Solicitud ${id} devuelta al área comercial para corrección.`, 'aviso')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo devolver la solicitud.', 'error')
      })
  }

  // Rechazar solicitud definitivamente (HU-05)
  function rejectRequest(id, motivo) {
    api.rechazarSolicitud(id, motivo)
      .then((res) => {
        const actualizada = res?.data || { id, estado: 'Rechazada', motivoRechazo: motivo }
        updateRequest(id, actualizada)
        notify(`Solicitud ${id} rechazada formalmente.`, 'aviso')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo rechazar la solicitud.', 'error')
      })
  }

  // Validar solicitud y generar orden de producción transfiriendo archivos de referencia (HU-06)
  function validateRequest(id) {
    const s = requests.find((r) => r.id === id)
    if (!s) {
      notify('Solicitud no encontrada.', 'error')
      return false
    }

    if (s.ordenId || s.estado === 'Aprobada') {
      notify(`La solicitud ${id} ya generó una orden previamente (${s.ordenId}). No se permiten órdenes duplicadas.`, 'error')
      return false
    }
    if (s.estado !== 'En validación') {
      notify(`La solicitud ${id} debe encontrarse en estado "En validación" para ser aprobada.`, 'aviso')
      return false
    }

    api.validarSolicitud(id)
      .then((res) => {
        if (res?.modoMock) {
          const cliente = clients.find((c) => c.id === s.clienteId) || {
            nombre: s.cliente,
            direccion: 'Sede comercial',
            ciudad: 'Bogotá',
            contacto: s.cliente,
          }
          const ordenId = `OP-2026-${String(orders.length + 1).padStart(4, '0')}`
          const nueva = {
            id: ordenId,
            solicitudId: s.id,
            clienteId: s.clienteId,
            cliente: s.cliente,
            producto: s.producto,
            cantidad: Number(s.cantidad),
            material: s.material,
            dimensiones: s.dimensiones,
            colores: 'Por definir en pre-prensa',
            acabados: 'Corte y empaque estándar',
            fechaSolicitud: s.fechaSolicitud,
            fechaEntrega: s.fechaEntrega,
            estado: 'Diseño',
            disenoEstado: 'Pendiente',
            responsable: 'María López',
            disenador: 'María López',
            presupuesto: Number(s.presupuesto) || 0,
            costoInterno: Math.round((Number(s.presupuesto) || 0) * 0.6),
            requerimientos: s.requerimientos || 'Sin especificaciones adicionales',
            observaciones: s.observaciones || '',
            archivosReferencia: s.archivosReferencia || [],
            entrega: {
              direccion: cliente.direccion ? `${cliente.direccion}, ${cliente.ciudad || 'Bogotá'}` : 'Dirección en sede comercial',
              metodo: 'Domicilio',
              contacto: cliente.contacto || s.cliente,
            },
            versiones: [],
            historial: [
              crearEvento(`Solicitud ${s.id} registrada en comercial`, 'Ana Martínez'),
              crearEvento(`Orden generada desde solicitud ${s.id}`, usuario),
              crearEvento('Actividad asignada: propuesta gráfica a María López', usuario, 'Completado', true),
            ],
          }
          setOrders((prev) => [...prev, nueva])
          updateRequest(id, { estado: 'Aprobada', ordenId, motivoRechazo: '' })
          notify(`Solicitud validada. Se generó la orden ${ordenId} y se asignó a diseño.`, 'exito')
          return
        }
        const solActualizada = res?.data
        const ordenCreada = res?.orden
        if (ordenCreada) {
          if (s.archivosReferencia?.length > 0 && (!ordenCreada.archivosReferencia || ordenCreada.archivosReferencia.length === 0)) {
            ordenCreada.archivosReferencia = s.archivosReferencia
          }
          replaceOrderFromServer(ordenCreada)
        }
        if (solActualizada) updateRequest(id, solActualizada)
        notify(`Solicitud validada. Se generó la orden ${ordenCreada?.id || solActualizada?.ordenId} y se asignó a diseño.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo validar la solicitud.', 'error')
      })

    return true
  }

  // ---------------- Flujo de la orden ----------------
  function advanceStage(id) {
    const order = orders.find((o) => o.id === id)
    if (!order) return false
    const regla = puedeAvanzar(order)

    if (!regla.ok && !regla.bloqueada) {
      notify(regla.motivo, 'info')
      return false
    }

    api.avanzarEtapaOrden(id, regla.siguiente)
      .then((res) => {
        if (res?.modoMock) {
          if (regla.bloqueada) {
            updateOrder(
              id,
              {},
              crearEvento(`Avance bloqueado: se intentó pasar a ${regla.siguiente} sin diseño aprobado`, usuario, 'Pendiente', false, {
                estadoAnterior: order.estado,
                nuevoEstado: regla.siguiente,
                motivo: regla.motivo,
              })
            )
            notify(regla.motivo, 'error')
            return
          }
          updateOrder(
            id,
            { estado: regla.siguiente },
            crearEvento(`Etapa cambiada a ${regla.siguiente}`, usuario, 'En proceso', false, {
              estadoAnterior: order.estado,
              nuevoEstado: regla.siguiente,
            })
          )
          notify(`La orden ${id} avanzó a ${regla.siguiente}.`)
          return
        }
        if (res?.data) replaceOrderFromServer(res.data)
        notify(`La orden ${id} avanzó a ${res?.data?.estado || regla.siguiente}.`)
      })
      .catch((err) => {
        if (err.payload?.data) {
          replaceOrderFromServer(err.payload.data)
        } else if (regla.bloqueada) {
          updateOrder(
            id,
            {},
            crearEvento(`Avance bloqueado: se intentó pasar a ${regla.siguiente} sin diseño aprobado`, usuario, 'Pendiente', false, {
              estadoAnterior: order.estado,
              nuevoEstado: regla.siguiente,
              motivo: regla.motivo,
            })
          )
        }
        notify(err.message || regla.motivo, 'error')
      })

    return !regla.bloqueada
  }

  // ---------------- Registro de entregas y evidencias (HU-17) ----------------
  function registerDelivery(ordenId, datosEntrega) {
    const orden = orders.find((o) => o.id === ordenId)
    if (!orden) return false

    api.registrarEntrega(ordenId, datosEntrega)
      .then((res) => {
        if (res?.modoMock) {
          const nuevaInfoEntrega = {
            ...orden.entrega,
            contacto: datosEntrega.contacto || orden.cliente,
            documento: datosEntrega.documento || '',
            cargo: datosEntrega.cargo || 'Recepción cliente',
            telefono: datosEntrega.telefono || '',
            fechaReal: datosEntrega.fechaReal || formatearFecha(),
            conformidad: datosEntrega.conformidad || 'Conforme',
            observaciones: datosEntrega.observaciones || '',
            evidencia: datosEntrega.evidencia || (orden.entrega?.evidencia || null),
          }
          updateOrder(
            ordenId,
            { estado: 'Entrega', entrega: nuevaInfoEntrega },
            crearEvento(
              `Entrega formal registrada a ${datosEntrega.contacto}${datosEntrega.documento ? ` (Doc: ${datosEntrega.documento})` : ''}`,
              usuario,
              'Completado',
              false,
              {
                estadoAnterior: orden.estado,
                nuevoEstado: 'Entrega',
                motivo: `Conformidad: ${datosEntrega.conformidad}`,
                observaciones: datosEntrega.observaciones,
              }
            )
          )
          notify(`Entrega de ${ordenId} registrada con éxito. Acta/evidencia asociada a la orden.`, 'exito')
          return
        }
        if (res?.data) replaceOrderFromServer(res.data)
        notify(`Entrega de ${ordenId} registrada con éxito. Acta/evidencia asociada a la orden.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar la entrega.', 'error')
      })

    return true
  }

  // ---------------- Diseño ----------------
  function designNewVersion(id, archivoNombre, observacionesDisenador) {
    api.crearVersionDiseno(id, { archivoNombre, observacionesDisenador })
      .then((res) => {
        if (res?.modoMock) {
          const ord = orders.find((o) => o.id === id)
          const numero = (ord?.versiones?.length || 0) + 1
          const version = {
            numero,
            fecha: formatearFecha(),
            disenador: ord?.disenador || 'María López',
            estado: 'En proceso',
            comentario: '',
            archivoNombre,
            observacionesDisenador,
          }
          updateOrder(
            id,
            (o) => ({ versiones: [...o.versiones, version], disenoEstado: 'En proceso', estado: 'Diseño' }),
            crearEvento(`Diseño creado (versión ${numero})`, usuario)
          )
          notify(`Versión ${numero} creada para ${id}.`)
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Versión ${res?.data?.numero || ''} creada para ${id}.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo crear la versión de diseño.', 'error')
      })
  }

  function designSend(id, observaciones = '') {
    api.enviarDiseno(id, observaciones)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Enviada' }), disenoEstado: 'Enviado', estado: 'Aprobación' }),
            crearEvento('Diseño enviado para aprobación', usuario)
          )
          notify(`Diseño de ${id} enviado para aprobación del cliente.`)
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Diseño de ${id} enviado para aprobación del cliente.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo enviar el diseño a aprobación.', 'error')
      })
  }

  function designApprove(id, comentario = '') {
    api.responderDiseno(id, 'aprobado', comentario, usuario)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Aprobada' }), disenoEstado: 'Aprobado' }),
            crearEvento('Diseño aprobado', usuario)
          )
          notify(`Diseño de ${id} aprobado. La orden ya puede pasar a impresión.`)
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Diseño de ${id} aprobado. La orden ya puede pasar a impresión.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar la aprobación del diseño.', 'error')
      })
  }

  function designReject(id, comentario) {
    api.responderDiseno(id, 'rechazado', comentario, usuario)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Rechazada', comentario }), disenoEstado: 'Requiere cambios', estado: 'Diseño' }),
            crearEvento(`Diseño rechazado: ${comentario}`, usuario, 'Pendiente')
          )
          notify(`Se solicitaron cambios al diseño de ${id}.`, 'aviso')
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Se solicitaron cambios al diseño de ${id}.`, 'aviso')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar el rechazo del diseño.', 'error')
      })
  }

  // ---------------- Actividades de taller (HU-08 y HU-10) ----------------
  const updateTask = (id, cambios) =>
    setTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...cambios } : t))
      if (api.usarMock) guardarEstadoDemo({ tasks: next })
      return next
    })

  function createTask(nuevaTarea) {
    const numId = tasks.length + 1
    const tempId = `T-${String(numId).padStart(3, '0')}`
    const plantillaLocal = {
      id: tempId,
      ordenId: nuevaTarea.ordenId,
      actividad: nuevaTarea.actividad,
      descripcion: nuevaTarea.descripcion || '',
      instrucciones: nuevaTarea.instrucciones || '',
      etapa: nuevaTarea.etapa || 'Impresión',
      responsable: nuevaTarea.responsable || 'Pedro Morales',
      prioridad: nuevaTarea.prioridad || 'Media',
      fechaLimite: nuevaTarea.fechaLimite || formatearFecha(),
      estado: 'Pendiente',
      pct: 0,
      deps: nuevaTarea.deps || [],
      notas: [],
      incidencias: [],
    }

    const aplicarCreacion = (creada) => {
      const tareaCompleta = {
        ...plantillaLocal,
        ...creada,
        descripcion: creada.descripcion ?? plantillaLocal.descripcion,
        instrucciones: creada.instrucciones ?? plantillaLocal.instrucciones,
      }
      setTasks((prev) => {
        const next = [...prev.filter((t) => t.id !== tareaCompleta.id), tareaCompleta]
        if (api.usarMock) guardarEstadoDemo({ tasks: next })
        return next
      })
      if (tareaCompleta.ordenId) {
        updateOrder(
          tareaCompleta.ordenId,
          {},
          crearEvento(
            `Nueva actividad programada: "${tareaCompleta.actividad}" asignada a ${tareaCompleta.responsable}`,
            usuario,
            'Completado',
            true
          )
        )
      }
      notify(`Actividad "${tareaCompleta.actividad}" asignada a ${tareaCompleta.responsable}.`, 'exito')
    }

    if (api.usarMock) {
      aplicarCreacion(plantillaLocal)
      return plantillaLocal
    }

    api.crearActividad(nuevaTarea)
      .then((res) => {
        aplicarCreacion(res?.data || plantillaLocal)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo crear la actividad.', 'error')
      })
    return plantillaLocal
  }

  function taskAction(id, accion) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const verbo = { iniciar: 'iniciada', pausar: 'pausada', finalizar: 'finalizada' }[accion] || 'actualizada'
    const nuevoEstado = { iniciar: 'En proceso', pausar: 'Pausada', finalizar: 'Finalizada' }[accion]
    const pctBase = Number(t.pct || 0)
    const nuevoPct =
      accion === 'finalizar'
        ? 100
        : accion === 'iniciar'
          ? pctBase > 0 && pctBase < 100
            ? pctBase
            : 50
          : pctBase > 0 && pctBase < 100
            ? pctBase
            : 50

    const aplicarAccionMock = () => {
      updateTask(id, { estado: nuevoEstado, pct: nuevoPct })
      updateOrder(
        t.ordenId,
        {},
        crearEvento(`Tarea "${t.actividad}" ${verbo} por ${usuario} (${nuevoPct}%)`, usuario, nuevoEstado, true)
      )
      notify(`Tarea "${t.actividad}" ${verbo}.`, accion === 'pausar' ? 'aviso' : 'exito')
    }

    if (api.usarMock) {
      aplicarAccionMock()
      return
    }

    api.accionActividad(id, accion)
      .then((res) => {
        if (res?.modoMock) {
          aplicarAccionMock()
          return
        }
        if (res?.data) updateTask(id, { ...res.data, pct: res.data.pct ?? nuevoPct })
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Tarea "${t.actividad}" ${verbo}.`, accion === 'pausar' ? 'aviso' : 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo actualizar la actividad.', 'error')
      })
  }

  function addTaskNote(id, tipo, texto) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const esIncidencia = tipo === 'incidencias'
    const etiqueta = esIncidencia ? 'Incidencia' : 'Observación'

    api.agregarNotaActividad(id, texto, esIncidencia)
      .then((res) => {
        if (res?.modoMock) {
          const registro = { fecha: formatearFecha(), hora: formatearHora(), texto, autor: usuario }
          updateTask(id, { [tipo]: [...(t[tipo] || []), registro] })
          updateOrder(t.ordenId, {}, crearEvento(`${etiqueta} en "${t.actividad}": ${texto}`, usuario, 'Pendiente', true))
          notify(`${etiqueta} registrada.`, esIncidencia ? 'aviso' : 'exito')
          return
        }
        if (res?.data) updateTask(id, res.data)
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`${etiqueta} registrada.`, esIncidencia ? 'aviso' : 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo guardar la nota en la actividad.', 'error')
      })
  }

  // Asignación y cambio de responsable con trazabilidad completa (HU-08 y HU-10)
  function assignTask(id, responsable) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const anterior = t.responsable || 'Sin asignar'
    if (anterior === responsable) return

    api.asignarActividad(id, responsable)
      .then((res) => {
        if (res?.modoMock) {
          updateTask(id, { responsable })
          updateOrder(
            t.ordenId,
            {},
            crearEvento(`Actividad "${t.actividad}": responsable reasignado de ${anterior} a ${responsable}`, usuario, 'Completado', true)
          )
          notify(`Actividad "${t.actividad}" asignada a ${responsable}.`, 'exito')
          return
        }
        if (res?.data) updateTask(id, res.data)
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Actividad "${t.actividad}" asignada a ${responsable}.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo reasignar la actividad.', 'error')
      })
  }

  function updateTaskProgress(taskId, nuevoEstado, nuevoPct) {
    const t = tasks.find((x) => x.id === taskId)
    api.actualizarAvanceActividad(taskId, nuevoEstado, nuevoPct)
      .then((res) => {
        if (res?.modoMock) {
          updateTask(taskId, { estado: nuevoEstado, pct: nuevoPct })
          if (t?.ordenId) {
            updateOrder(
              t.ordenId,
              {},
              crearEvento(`Avance en actividad "${t.actividad}": ${nuevoEstado} (${nuevoPct}%)`, usuario, nuevoEstado, true)
            )
          }
          notify(`Actividad "${t?.actividad || ''}" actualizada a ${nuevoEstado} (${nuevoPct}%).`)
          return
        }
        if (res?.data) updateTask(taskId, res.data)
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Actividad "${t?.actividad || ''}" actualizada a ${nuevoEstado} (${nuevoPct}%).`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo actualizar el avance de la actividad.', 'error')
      })
  }

  // ---------------- Inventario, proveedores y movimientos ----------------
  function addInventoryMaterial(nuevo) {
    const idMat = nuevo.id || `MAT-${String(inventory.length + 1).padStart(3, '0')}`
    api.crearMaterialInventario({ ...nuevo, id: idMat })
      .then((res) => {
        const creado = res?.data || {
          id: idMat,
          ...nuevo,
          fechaActualizacion: formatearFecha(),
        }
        setInventory((prev) => [...prev.filter((m) => m.id !== creado.id), creado])
        notify(`Material "${creado.nombre}" registrado en inventario.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar el material.', 'error')
      })
  }

  function addSupplier(nuevo) {
    const idProv = nuevo.id || `PRV-${String(suppliers.length + 1).padStart(2, '0')}`
    api.crearProveedor({ ...nuevo, id: idProv })
      .then((res) => {
        const creado = res?.data || {
          id: idProv,
          ...nuevo,
          estado: nuevo.estado || 'Activo',
        }
        setSuppliers((prev) => [...prev.filter((p) => p.id !== creado.id), creado])
        notify(`Proveedor "${creado.nombre}" registrado con éxito.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar el proveedor.', 'error')
      })
  }

  function registerInventoryMovement(mov) {
    const mat = inventory.find((m) => m.id === mov.materialId)
    if (!mat) return false

    const cant = Number(mov.cantidad || 0)
    const esSalida = mov.tipo === 'Salida'
    const idMov = `MOV-${String(inventoryMovements.length + 1).padStart(3, '0')}`
    const payload = {
      id: idMov,
      fecha: formatearFecha(),
      hora: formatearHora(),
      tipo: mov.tipo,
      materialId: mat.id,
      material: mat.nombre,
      cantidad: cant,
      unidad: mat.unidad,
      costoTotal: Math.round(cant * Number(mat.costoUnitario || 0)),
      ordenId: mov.ordenId || null,
      responsable: usuario,
      observacion: mov.observacion || '',
    }

    api.registrarMovimientoInventario(payload)
      .then((res) => {
        const movCreado = res?.data || payload
        setInventoryMovements((prev) => [movCreado, ...prev])
        setInventory((prev) =>
          prev.map((m) => {
            if (m.id !== mat.id) return m
            const nuevoStock = esSalida
              ? Math.max(0, Number(m.stockActual) - cant)
              : Number(m.stockActual) + cant
            const nuevaUtilizada = esSalida
              ? Number(m.cantidadUtilizada || 0) + cant
              : Number(m.cantidadUtilizada || 0)
            return {
              ...m,
              stockActual: nuevoStock,
              cantidadUtilizada: nuevaUtilizada,
              fechaActualizacion: formatearFecha(),
            }
          })
        )
        if (mov.ordenId) {
          updateOrder(
            mov.ordenId,
            {},
            crearEvento(
              `${mov.tipo} de inventario: ${cant} ${mat.unidad} de "${mat.nombre}"`,
              usuario,
              'Completado',
              true
            )
          )
        }
        notify(`Movimiento de ${mov.tipo.toLowerCase()} registrado para "${mat.nombre}".`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar el movimiento de inventario.', 'error')
      })

    return true
  }

  // ---------------- Postventa (HU-18: Satisfacción, PQRSF y Garantías) ----------------
  function createCase(nuevoCaso) {
    const categoria =
      nuevoCaso.categoria ||
      (nuevoCaso.tipo === 'Garantía'
        ? 'Garantía'
        : nuevoCaso.tipo === 'Satisfacción'
        ? 'Satisfacción'
        : 'PQRSF')
    const subtipo =
      nuevoCaso.subtipo ||
      nuevoCaso.tipo ||
      (categoria === 'Garantía' ? 'Garantía' : categoria === 'Satisfacción' ? 'Satisfacción' : 'Reclamo')
    const prefijo = categoria === 'Garantía' ? 'GAR' : categoria === 'Satisfacción' ? 'SAT' : 'PV'
    const num = cases.length + 1
    const tempId = nuevoCaso.id || `${prefijo}-${String(num).padStart(3, '0')}`
    const fechaActual = formatearFecha()
    const horaActual = formatearHora()
    const estadoInicial = categoria === 'Satisfacción' ? 'Cerrado' : (nuevoCaso.estado || 'Abierto')

    const construirCasoLocal = (baseServer = {}) => {
      const ordenAsociada = orders.find((o) => o.id === nuevoCaso.ordenId)
      const historialInicial =
        Array.isArray(nuevoCaso.historial) && nuevoCaso.historial.length > 0
          ? nuevoCaso.historial
          : [
              {
                fecha: fechaActual,
                hora: horaActual,
                autor: nuevoCaso.autor || usuario || nuevoCaso.cliente || ordenAsociada?.cliente || 'Cliente',
                estado: estadoInicial,
                accion:
                  categoria === 'Satisfacción'
                    ? `Calificación post-entrega registrada (${nuevoCaso.calificacion || 5}/5 estrellas)`
                    : categoria === 'Garantía'
                    ? `Solicitud de garantía radicada — ${nuevoCaso.motivo || 'Revisión técnica'}`
                    : `PQRSF radicada (${subtipo}) — ${nuevoCaso.motivo || subtipo}`,
                detalle: nuevoCaso.descripcion || '',
              },
            ]
      return {
        id: tempId,
        fecha: fechaActual,
        categoria,
        subtipo,
        tipo: subtipo,
        motivo: nuevoCaso.motivo || subtipo,
        prioridad: nuevoCaso.prioridad || 'Media',
        estado: estadoInicial,
        responsable: nuevoCaso.responsable || (categoria === 'Satisfacción' ? 'Sofía Herrera' : ''),
        dictamenGarantia: nuevoCaso.dictamenGarantia || (categoria === 'Garantía' ? 'Pendiente de evaluación' : ''),
        justificacionDictamen: nuevoCaso.justificacionDictamen || '',
        accionCorrectiva: nuevoCaso.accionCorrectiva || '',
        seguimiento: nuevoCaso.seguimiento || '',
        respuestaCliente: nuevoCaso.respuestaCliente || '',
        solucion: nuevoCaso.solucion || (categoria === 'Satisfacción' ? 'Calificación registrada en expediente de calidad.' : ''),
        calificacion: nuevoCaso.calificacion ?? null,
        aspectosEvaluados: Array.isArray(nuevoCaso.aspectosEvaluados) ? nuevoCaso.aspectosEvaluados : [],
        evidencias: Array.isArray(nuevoCaso.evidencias) ? nuevoCaso.evidencias : [],
        ...nuevoCaso,
        ...baseServer,
        cliente: baseServer.cliente || nuevoCaso.cliente || ordenAsociada?.cliente || 'Cliente',
        producto: baseServer.producto || nuevoCaso.producto || ordenAsociada?.producto || '',
        historial:
          Array.isArray(baseServer.historial) && baseServer.historial.length > 0
            ? baseServer.historial
            : historialInicial,
      }
    }

    api.crearCasoPostventa({ ...nuevoCaso, categoria, subtipo, tipo: subtipo })
      .then((res) => {
        if (res?.modoMock) {
          const casoCompleto = construirCasoLocal()
          setCases((prev) => {
            const next = [casoCompleto, ...prev]
            if (api.usarMock) guardarEstadoDemo({ cases: next })
            return next
          })
          if (nuevoCaso.ordenId) {
            updateOrder(
              nuevoCaso.ordenId,
              {},
              crearEvento(
                `Postventa ${tempId} (${categoria} — ${subtipo}): ${nuevoCaso.motivo || nuevoCaso.descripcion}`,
                usuario,
                estadoInicial === 'Cerrado' ? 'Completado' : 'Pendiente',
                false,
                { motivo: `${categoria}: ${nuevoCaso.motivo || subtipo}`, observaciones: nuevoCaso.descripcion }
              )
            )
          }
          const etiquetaExito =
            categoria === 'Satisfacción'
              ? `Calificación de satisfacción ${tempId} registrada con éxito.`
              : categoria === 'Garantía'
              ? `Solicitud de garantía ${tempId} radicada para evaluación técnica.`
              : `PQRSF ${tempId} (${subtipo}) registrada con éxito.`
          notify(etiquetaExito, 'exito')
          return
        }
        const casoCreado = construirCasoLocal(res?.data || {})
        setCases((prev) => [casoCreado, ...prev.filter((c) => c.id !== casoCreado.id)])
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Registro de postventa ${casoCreado.id} guardado con éxito.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar en postventa.', 'error')
      })

    return tempId
  }

  function updateCase(id, cambios, mensaje) {
    const casoActual = cases.find((c) => c.id === id)
    const fechaActual = formatearFecha()
    const horaActual = formatearHora()

    const construirHistorialActualizado = (casoBase) => {
      const prevHist = Array.isArray(casoBase?.historial) ? [...casoBase.historial] : []
      if (Array.isArray(cambios.historial)) return cambios.historial

      const partes = []
      if (cambios.estado && cambios.estado !== casoBase?.estado) {
        partes.push(`Estado actualizado a "${cambios.estado}"`)
      }
      if (cambios.responsable !== undefined && cambios.responsable !== casoBase?.responsable) {
        partes.push(`Responsable asignado: ${cambios.responsable || 'Sin asignar'}`)
      }
      if (cambios.dictamenGarantia && cambios.dictamenGarantia !== casoBase?.dictamenGarantia) {
        partes.push(`Dictamen de garantía: ${cambios.dictamenGarantia}`)
      }
      if (cambios.accionCorrectiva && cambios.accionCorrectiva !== casoBase?.accionCorrectiva) {
        partes.push(`Acción definida: ${cambios.accionCorrectiva}`)
      }
      if (cambios.seguimiento && cambios.seguimiento !== casoBase?.seguimiento) {
        partes.push(`Seguimiento: ${cambios.seguimiento}`)
      }
      if (cambios.respuestaCliente && cambios.respuestaCliente !== casoBase?.respuestaCliente) {
        partes.push(`Respuesta al cliente: ${cambios.respuestaCliente}`)
      }
      if (cambios.solucion && cambios.solucion !== casoBase?.solucion) {
        partes.push(`Solución: ${cambios.solucion}`)
      }
      if (cambios.calificacion && cambios.calificacion !== casoBase?.calificacion) {
        partes.push(`Calificación registrada: ${cambios.calificacion}/5`)
      }
      if (cambios.notaHistorial) {
        partes.push(cambios.notaHistorial)
      }

      if (partes.length > 0) {
        prevHist.push({
          fecha: fechaActual,
          hora: horaActual,
          autor: usuario || 'Postventa ORVEX',
          estado: cambios.estado || casoBase?.estado || 'En trámite',
          accion: partes[0],
          detalle: partes.join(' · '),
        })
      }
      return prevHist
    }

    const historialNuevo = construirHistorialActualizado(casoActual)
    const payload = { ...cambios, historial: historialNuevo }

    api.actualizarCasoPostventa(id, payload)
      .then((res) => {
        if (res?.modoMock) {
          setCases((prev) => {
            const next = prev.map((c) => (c.id === id ? { ...c, ...payload } : c))
            if (api.usarMock) guardarEstadoDemo({ cases: next })
            return next
          })
          if (casoActual?.ordenId && (cambios.estado || cambios.dictamenGarantia || cambios.solucion)) {
            updateOrder(
              casoActual.ordenId,
              {},
              crearEvento(
                `Postventa ${id}: ${cambios.estado || casoActual.estado}${cambios.dictamenGarantia ? ` (${cambios.dictamenGarantia})` : ''}${cambios.solucion ? ` - ${cambios.solucion}` : ''}`,
                usuario,
                cambios.estado === 'Resuelto' || cambios.estado === 'Cerrado' ? 'Completado' : 'Pendiente',
                false,
                { estadoAnterior: casoActual.estado, nuevoEstado: cambios.estado || casoActual.estado, motivo: cambios.solucion || cambios.dictamenGarantia || null }
              )
            )
          }
          if (mensaje) notify(mensaje, 'exito')
          return
        }
        if (res?.data) {
          setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...payload, ...res.data } : c)))
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        if (mensaje) notify(mensaje, 'exito')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo actualizar el caso de postventa.', 'error')
      })
  }

  // ---------------- Cierre y reapertura de órdenes (HU-20) ----------------
  function closeOrder(id, motivo = 'Cierre formal de producción y entrega') {
    const orden = orders.find((o) => o.id === id)
    if (!orden) return false

    const validacion = validarCierreOrden(orden, tasks, cases)
    if (!validacion.puedeCerrar) {
      notify(`No se puede cerrar la orden ${id}: existen requisitos pendientes.`, 'error')
      return false
    }

    api.cerrarOrden(id, motivo)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            { estado: 'Cerrada', cerradoPor: usuario, fechaCierre: formatearFecha(), motivoCierre: motivo },
            crearEvento(`Orden cerrada formalmente por ${usuario}`, usuario, 'Completado', false, {
              estadoAnterior: orden.estado,
              nuevoEstado: 'Cerrada',
              motivo,
            })
          )
          notify(`La orden ${id} ha sido cerrada formalmente.`, 'exito')
          return
        }
        if (res?.data) replaceOrderFromServer(res.data)
        notify(`La orden ${id} ha sido cerrada formalmente.`, 'exito')
      })
      .catch((err) => {
        notify(err.message || `No se pudo cerrar la orden ${id}.`, 'error')
      })

    return true
  }

  function reopenOrder(id, motivo = 'Reapertura para gestión postventa') {
    const orden = orders.find((o) => o.id === id)
    if (!orden) return false

    api.reabrirOrden(id, motivo)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            { estado: 'Postventa', reabiertoPor: usuario, fechaReapertura: formatearFecha() },
            crearEvento(`Orden reabierta por ${usuario} a etapa Postventa`, usuario, 'En proceso', false, {
              estadoAnterior: orden.estado,
              nuevoEstado: 'Postventa',
              motivo,
            })
          )
          notify(`La orden ${id} ha sido reabierta a Postventa.`, 'aviso')
          return
        }
        if (res?.data) replaceOrderFromServer(res.data)
        notify(`La orden ${id} ha sido reabierta a Postventa.`, 'aviso')
      })
      .catch((err) => {
        notify(err.message || `No se pudo reabrir la orden ${id}.`, 'error')
      })

    return true
  }

  // ---------------- Clonación de órdenes para reimpresión ----------------
  function cloneOrder(id, motivo = 'Reimpresión o reposición de producto') {
    const ordenOriginal = orders.find((o) => o.id === id)
    if (!ordenOriginal) return null

    api.clonarOrden(id, motivo)
      .then((res) => {
        if (res?.modoMock) {
          const nuevoNumero = orders.length + 1
          const nuevoId = `OP-2026-${String(nuevoNumero).padStart(4, '0')}`
          const entregaCalculada = new Date()
          entregaCalculada.setDate(entregaCalculada.getDate() + 4)
          const nuevaOrden = {
            ...ordenOriginal,
            id: nuevoId,
            fechaSolicitud: formatearFecha(),
            fechaEntrega: formatearFecha(entregaCalculada),
            estado: 'Impresión',
            disenoEstado: 'Aprobado',
            esReimpresion: true,
            ordenOriginalId: id,
            historial: [
              crearEvento(
                `Orden clonada a partir de ${id} para reimpresión. Motivo: ${motivo}`,
                usuario,
                'Completado'
              ),
            ],
            entrega: {
              ...ordenOriginal.entrega,
              contacto: ordenOriginal.entrega?.contacto || ordenOriginal.cliente,
              fechaReal: null,
              conformidad: null,
              evidencia: null,
            },
          }
          setOrders((prev) => [nuevaOrden, ...prev])
          notify(`Orden clonada con éxito: ${nuevoId} (Reimpresión de ${id}).`, 'exito')
          irA('detalle', nuevoId)
          return
        }
        const nuevaOrden = res?.data
        if (nuevaOrden) {
          replaceOrderFromServer(nuevaOrden)
          notify(`Orden clonada con éxito: ${nuevaOrden.id} (Reimpresión de ${id}).`, 'exito')
          irA('detalle', nuevaOrden.id)
        }
      })
      .catch((err) => {
        notify(err.message || `No se pudo clonar la orden ${id}.`, 'error')
      })

    return id
  }

  // ---------------- Comunicaciones ----------------
  function sendCommMessage(commId, nuevoMensaje) {
    const comm = comms.find((c) => c.id === commId)
    api.enviarMensajeComunicacion(commId, nuevoMensaje)
      .then((res) => {
        if (res?.modoMock) {
          setComms((prev) =>
            prev.map((c) => (c.id === commId ? { ...c, estado: 'Respondida', mensajes: [...c.mensajes, nuevoMensaje] } : c))
          )
          if (comm?.ordenId) {
            updateOrder(
              comm.ordenId,
              {},
              crearEvento(
                `Respuesta enviada al cliente por ${comm.canal === 'wa' ? 'WhatsApp' : comm.canal === 'mail' ? 'Correo' : 'Telefonía'}`,
                usuario
              )
            )
          }
          notify(`Respuesta enviada a ${comm?.cliente || 'cliente'}.`)
          return
        }
        if (res?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? res.data : c)))
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Respuesta enviada a ${comm?.cliente || 'cliente'}.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo enviar el mensaje.', 'error')
      })
  }

  const actions = {
    addRequest,
    sendToValidation,
    returnRequest,
    rejectRequest,
    validateRequest,
    advanceStage,
    assignOrderTeam,
    registerDelivery,
    designNewVersion,
    designSend,
    designApprove,
    designReject,
    createTask,
    taskAction,
    addTaskNote,
    assignTask,
    updateTaskProgress,
    addInventoryMaterial,
    addSupplier,
    registerInventoryMovement,
    sendCommMessage,
    createCase,
    updateCase,
    closeOrder,
    reopenOrder,
    cloneOrder,
    addUser,
    updateUser,
    toggleUserStatus,
    addClient,
    notify,
  }

  const rolActivo = normalizarRol(role)
  const props = { data, actions, irA, role: rolActivo, order: selectedOrder, usuarioActual: currentUser }

  function renderPage() {
    switch (page.name) {
      case 'inicio': {
        const Dashboard = dashboards[rolActivo] || CoordinatorDashboard
        return <Dashboard {...props} />
      }
      case 'solicitudes':
        return <Requests {...props} />
      case 'nuevo':
        return <NewOrder clients={clients} onSubmit={addRequest} irA={irA} clienteInicialId={page.orderId} />
      case 'clientes':
        return <Clients {...props} />
      case 'pedidos':
        return <Orders {...props} />
      case 'comunicaciones':
        return <Communications {...props} />
      case 'detalle':
        return <OrderDetail key={page.orderId} {...props} />
      case 'historial':
        return <OrderDetail key={`h-${page.orderId}`} {...props} tabInicial="historial" />
      case 'aprobacion':
        return <DesignApproval {...props} />
      case 'disenos':
        return <DesignWorkspace key={page.orderId || 'lista'} {...props} />
      case 'produccion':
        return <Production {...props} />
      case 'tareas':
        return <Tasks {...props} />
      case 'inventario':
        return <Inventory {...props} />
      case 'entregas':
        return <Deliveries {...props} />
      case 'postventa':
        return <AfterSales {...props} />
      case 'reportes':
        return <Reports {...props} />
      case 'usuarios':
        return <Users {...props} />
      default:
        return <EnConstruccion titulo={tituloMenu} />
    }
  }

  // Pantalla de inicio de sesión si no hay usuario autenticado (HU-02)
  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ToastStack toasts={toasts} onClose={cerrarToast} />
      </>
    )
  }

  if (cargando) return <Loader />

  if (errorCarga) {
    return (
      <div className="loader-screen">
        <div className="loader-card">
          <Alert tipo="error" titulo="No se pudo cargar la información">{errorCarga}</Alert>
          <button className="btn btn-primary" onClick={() => setIntento(intento + 1)}>Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`app${sidebarColapsado ? ' app-sidebar-collapsed' : ''}`}>
      <Sidebar
        role={rolActivo}
        current={page.name}
        irA={irA}
        onChangeRole={cambiarRol}
        abierto={menuAbierto}
        colapsado={sidebarColapsado}
        onClose={() => setMenuAbierto(false)}
        onLogout={handleLogout}
        onToggleColapso={toggleMenu}
      />
      <div className="main">
        <Header
          role={rolActivo}
          current={page.name}
          data={data}
          irA={irA}
          colapsado={sidebarColapsado}
          abierto={menuAbierto}
          onMenu={toggleMenu}
          onLogout={handleLogout}
          onToggleColapso={toggleMenu}
        />
        <main className="content">
          <div key={`${rolActivo}-${page.name}-${page.orderId || ''}`} className="page-transition">
            {renderPage()}
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onClose={cerrarToast} />
    </div>
  )
}
