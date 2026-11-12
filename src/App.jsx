import { useEffect, useState, Component } from 'react'
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
import PublicPortal from './pages/PublicPortal.jsx'
import { logoutFirebase } from './config/firebase.js'
import { ROLES, normalizarRol, PAGINAS_AUTORIZADAS_POR_ROL } from './data/roles.js'
import { api, getAuthToken, setAuthToken, guardarEstadoDemo } from './services/api.js'
import { formatearFecha, formatearHora, formatearFechaBogota, formatearHoraBogota, puedeAvanzar, validarCierreOrden } from './utils/format.js'

// Dashboard (opción "Inicio") que corresponde a cada rol interno
const dashboards = {
  comercial: CommercialDashboard,
  coordinador: CoordinatorDashboard,
  disenador: DesignWorkspace,
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

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('Error visual capturado por ErrorBoundary:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px' }}>
          <Alert tipo="error" titulo="Ocurrió una novedad al renderizar esta vista">
            {this.state.error?.message || 'Error visual inesperado.'}
          </Alert>
          <button
            className="btn btn-primary"
            style={{ marginTop: '12px' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar vista
          </button>
        </div>
      )
    }
    return this.props.children
  }
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
  // Indicadores consolidados de PostgreSQL (GET /dashboard) para Gerencia y Reportes
  const [dashboard, setDashboard] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [datosListos, setDatosListos] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)

  // page.name indica la pantalla actual; page.orderId la orden seleccionada
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.replace(/^#\/?/, '').split('/')[0]
      if (h === 'portal') return { name: 'portal', orderId: null }
    }
    return { name: 'inicio', orderId: null }
  })

  // Usuario autenticado (HU-02)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (sessionStorage.getItem('orvex_auth_logged_out') === 'true') return null
      const token = getAuthToken()
      const guardado = sessionStorage.getItem('orvex_auth_user')
      if (guardado && (token || api.usarMock)) {
        const parsed = JSON.parse(guardado)
        if (parsed && typeof parsed === 'object') {
          let rolNormalizado = normalizarRol(parsed.rolUi || parsed.rol || 'coordinador')
          if (rolNormalizado === 'cliente') rolNormalizado = 'comercial'
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
      const norm = normalizarRol(guardadoRol || 'coordinador')
      return norm === 'cliente' ? 'comercial' : norm
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
    api.cargarTodo(currentUser?.rolUi || currentUser?.rol || role)
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
        setDashboard(d.dashboard || null)
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
  }, [intento, currentUser?.correo, currentUser?.rol, role])

  useEffect(() => { window.scrollTo(0, 0) }, [page])

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
    dashboard,
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

  // Navegación con protección estricta de rutas según rol (Regla 5 y HU-07)
  const irA = (name, orderId = null) => {
    // El portal público de clientes es de acceso universal y no requiere rol interno
    if (name === 'portal') {
      setPage({ name: 'portal', orderId: null })
      if (typeof window !== 'undefined') window.location.hash = '#/portal'
      return
    }

    const rolNormal = normalizarRol(role)
    const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rolNormal] || ['inicio']
    if (!permitidas.includes(name)) {
      notify(`Acceso denegado: el perfil de ${ROLES[rolNormal]?.nombre || rolNormal} no tiene autorización para acceder a "${name}".`, 'error')
      setPage({ name: 'inicio', orderId: null })
      if (typeof window !== 'undefined') window.location.hash = '#/inicio'
      return
    }
    setPage({ name, orderId })
    if (typeof window !== 'undefined') {
      window.location.hash = orderId ? `#/${name}/${orderId}` : `#/${name}`
    }
  }

  // Sincronización y validación estricta de rutas directas por URL hash (Regla 5)
  useEffect(() => {
    if (typeof window === 'undefined') return

    function sincronizarRutaDesdeHash() {
      const rawHash = window.location.hash.replace(/^#\/?/, '').trim()
      if (!rawHash) return

      const partes = rawHash.split('/')
      const targetPage = partes[0] || 'inicio'
      const targetOrderId = partes[1] || null

      // El portal público de clientes es de acceso universal y no requiere rol interno
      if (targetPage === 'portal') {
        setPage({ name: 'portal', orderId: null })
        return
      }

      const rolNormal = normalizarRol(role)
      const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rolNormal] || ['inicio']

      if (!permitidas.includes(targetPage)) {
        notify(`Acceso denegado por URL: el perfil de ${ROLES[rolNormal]?.nombre || rolNormal} no tiene autorización para acceder al módulo "${targetPage}".`, 'error')
        window.location.hash = '#/inicio'
        setPage({ name: 'inicio', orderId: null })
        return
      }

      setPage({ name: targetPage, orderId: targetOrderId })
    }

    sincronizarRutaDesdeHash()
    window.addEventListener('hashchange', sincronizarRutaDesdeHash)
    return () => window.removeEventListener('hashchange', sincronizarRutaDesdeHash)
  }, [role])

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
    logoutFirebase()
    setCurrentUser(null)
    setRole('coordinador')
    setOrders([])
    setRequests([])
    setTasks([])
    setCases([])
    setClients([])
    setUsers([])
    setComms([])
    setInventory([])
    setSuppliers([])
    setInventoryMovements([])
    setDashboard(null)
    setDatosListos(false)
    try {
      sessionStorage.setItem('orvex_auth_logged_out', 'true')
      sessionStorage.removeItem('orvex_auth_user')
      sessionStorage.removeItem('orvex_auth_role')
      localStorage.removeItem('orvex_auth_user')
      localStorage.removeItem('orvex_auth_role')
      localStorage.removeItem('orvex_auth_logged_out')
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
      refreshDashboard()
      return creado
    } catch (err) {
      notify(err.message || 'No se pudo registrar el cliente.', 'error')
      throw err
    }
  }

  async function editClient(id, cambios) {
    try {
      const res = await api.actualizarCliente(id, cambios)
      if (res?.data) {
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...res.data } : c)))
      }
      notify('Cliente actualizado exitosamente.', 'exito')
      refreshDashboard()
      return res?.data
    } catch (err) {
      notify(err.message || 'No se pudo actualizar el cliente.', 'error')
      throw err
    }
  }

  async function archiveClient(id) {
    try {
      await api.archivarCliente(id)
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, archivado: true } : c)))
      notify('Cliente archivado exitosamente.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo archivar el cliente.', 'error')
    }
  }

  async function restoreClient(id) {
    try {
      await api.restaurarCliente(id)
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, archivado: false } : c)))
      notify('Cliente restaurado exitosamente.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo restaurar el cliente.', 'error')
    }
  }

  async function deleteClient(id) {
    try {
      await api.eliminarCliente(id)
      setClients((prev) => prev.filter((c) => c.id !== id))
      notify('Cliente eliminado permanentemente.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar el cliente.', 'error')
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
            prioridad: datos.prioridad || ordenActual.prioridad || 'Media',
          }
          updateOrder(
            id,
            cambios,
            crearEvento(
              `Planificación y coordinación actualizada: Prioridad (${cambios.prioridad}), Entrega (${cambios.fechaEntrega}), Diseño (${cambios.disenador}), Responsable taller (${cambios.responsable})`,
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
    return api.crearSolicitud(form)
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
          'Solicitud registrada correctamente. Recuerda enviarla a Coordinación para iniciar su proceso de validación.',
          'exito'
        )
        return nueva
      })
      .catch((err) => {
        notify(err.message || 'Error al registrar la solicitud.', 'error')
        throw err
      })
  }

  const updateRequest = (id, cambios) =>
    setRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)))

  function sendToValidation(id) {
    api.enviarAValidacion(id)
      .then((res) => {
        const actualizada = res?.data || { id, estado: 'En validación' }
        updateRequest(id, actualizada)
        notify(
          'Solicitud enviada correctamente a Coordinación. Ahora está pendiente de validación.',
          'exito'
        )
      })
      .catch((err) => {
        notify(err.message || 'No se pudo enviar la solicitud a validación.', 'error')
      })
  }

  // Corregir y reenviar solicitud devuelta (Comercial / Recepción)
  function correctRequest(id, datos) {
    return api.corregirSolicitud(id, datos)
      .then((res) => {
        const actualizada = res?.data || { id, ...datos, estado: 'En validación' }
        updateRequest(id, actualizada)
        notify(
          `Solicitud ${id} corregida y reenviada a Coordinación exitosamente.`,
          'exito'
        )
        return actualizada
      })
      .catch((err) => {
        notify(err.message || 'No se pudo corregir y reenviar la solicitud.', 'error')
        throw err
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
        refreshDashboard()
      })
      .catch((err) => {
        notify(err.message || 'No se pudo rechazar la solicitud.', 'error')
      })
  }

  async function editRequest(id, cambios) {
    try {
      const res = await api.actualizarSolicitud(id, cambios)
      if (res?.data) {
        updateRequest(id, res.data)
      }
      notify('Solicitud actualizada exitosamente.', 'exito')
      refreshDashboard()
      return res?.data
    } catch (err) {
      notify(err.message || 'No se pudo actualizar la solicitud.', 'error')
      throw err
    }
  }

  async function archiveRequest(id) {
    try {
      await api.archivarSolicitud(id)
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, archivado: true } : r)))
      notify('Solicitud archivada.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo archivar la solicitud.', 'error')
    }
  }

  async function restoreRequest(id) {
    try {
      await api.restaurarSolicitud(id)
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, archivado: false } : r)))
      notify('Solicitud restaurada.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo restaurar la solicitud.', 'error')
    }
  }

  async function deleteRequest(id) {
    try {
      await api.eliminarSolicitud(id)
      setRequests((prev) => prev.filter((r) => r.id !== id))
      notify('Solicitud eliminada.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar la solicitud.', 'error')
    }
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
            cotizacionTotal: Number(s.cotizacionTotal || s.presupuesto) || 0,
            estadoPago: s.estadoPago || 'Pendiente de pago',
            totalAbonado: Number(s.totalAbonado || 0),
            saldoPendiente: Number(s.saldoPendiente != null ? s.saldoPendiente : (s.presupuesto || 0)),
            tipoPago: s.tipoPago || 'sin_pago',
            pagos: s.pagos || [],
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
    if (normalizarRol(role) === 'coordinador') {
      notify('El avance de etapas es automático según la ejecución de actividades de los operarios y las aprobaciones registradas.', 'aviso')
      return false
    }
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
    if (normalizarRol(role) === 'coordinador') {
      notify('El registro de entrega final al cliente corresponde a Comercial / Recepción y el seguimiento posterior a Postventa.', 'aviso')
      return false
    }
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
          const ahora = new Date()
          const fechaEnvioTexto = formatearFechaBogota(ahora)
          const horaEnvioTexto = formatearHoraBogota(ahora)
          updateOrder(
            id,
            (o) => {
              const ult = o.versiones?.[o.versiones.length - 1]
              return {
                versiones: cambiarUltimaVersion(o.versiones, {
                  estado: 'Pendiente de gestión comercial',
                  fechaEnvio: ult?.fechaEnvio || ahora.toISOString(),
                  fechaEnvioTexto: ult?.fechaEnvioTexto || fechaEnvioTexto,
                  horaEnvioTexto: ult?.horaEnvioTexto || horaEnvioTexto,
                  fechaHoraEnvio: `${ult?.fechaEnvioTexto || fechaEnvioTexto} ${ult?.horaEnvioTexto || horaEnvioTexto}`,
                  enviadoAComercialNombre: usuario,
                }),
                disenoEstado: 'Pendiente de gestión comercial',
                estado: 'Aprobación',
              }
            },
            crearEvento('Diseño enviado a Comercial para gestión con el cliente', usuario)
          )
          notify(`Diseño de ${id} enviado a Comercial para gestión con el cliente.`)
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Diseño de ${id} enviado a Comercial para gestión con el cliente.`)
      })
      .catch((err) => {
        notify(err.message || 'No se pudo enviar el diseño a Comercial.', 'error')
      })
  }

  function designCommercialManage(id, datosGestion) {
    return api.gestionarPropuestaComercial(id, datosGestion)
      .then((res) => {
        if (res?.modoMock) {
          const {
            accion,
            numero_version,
            fechaAprobacion,
            nombreAutoriza,
            canal,
            evidencia,
            observaciones,
          } = datosGestion
          const actualizarVersionElegida = (versiones = [], cambios = {}) => {
            if (!versiones.length) return []
            const targetNum = Number(numero_version || versiones[versiones.length - 1]?.numero)
            return versiones.map((v, idx) =>
              Number(v.numero) === targetNum || (!numero_version && idx === versiones.length - 1)
                ? { ...v, ...cambios }
                : v
            )
          }
          if (accion === 'aprobar') {
            updateOrder(
              id,
              (o) => ({
                versiones: actualizarVersionElegida(o.versiones, {
                  estado: 'Aprobado por el cliente',
                  contactoClienteNombre: nombreAutoriza,
                  contactoClienteCanal: canal,
                  contactoClienteFechaTexto: fechaAprobacion || fechaActual(),
                  contactoClienteHoraTexto: horaActual(),
                  contactoClienteEvidencia: evidencia,
                  comentario: observaciones || undefined,
                  soporte_validado: true,
                }),
                disenoEstado: 'Aprobado por el cliente',
                estado: o.estado === 'Diseño' ? 'Aprobación' : o.estado,
              }),
              crearEvento(
                `Diseño v${numero_version || 1} aprobado por el cliente (${nombreAutoriza}) vía ${canal}. Evidencia: ${evidencia}`,
                usuario
              )
            )
            notify(`Aprobación formal registrada con éxito para ${id}. Lista para verificación de Coordinación.`)
          } else if (accion === 'cambios') {
            updateOrder(
              id,
              (o) => ({
                versiones: actualizarVersionElegida(o.versiones, {
                  estado: 'Cambios solicitados',
                  contactoClienteNombre: nombreAutoriza,
                  contactoClienteCanal: canal,
                  contactoClienteFechaTexto: fechaActual(),
                  contactoClienteHoraTexto: horaActual(),
                  comentario: observaciones,
                  contactoClienteObservaciones: observaciones,
                }),
                disenoEstado: 'Cambios solicitados',
                estado: 'Diseño',
              }),
              crearEvento(
                `Cliente solicitó modificaciones vía ${canal}: "${observaciones}". Trabajo devuelto a Diseño.`,
                usuario,
                'Pendiente'
              )
            )
            notify(`Modificaciones registradas. Trabajo devuelto a Diseño para ${id}.`, 'aviso')
          } else if (accion === 'esperando') {
            updateOrder(
              id,
              (o) => ({
                versiones: actualizarVersionElegida(o.versiones, {
                  estado: 'Esperando respuesta del cliente',
                  contactoClienteNombre: nombreAutoriza,
                  contactoClienteCanal: canal,
                }),
                disenoEstado: 'Esperando respuesta del cliente',
              }),
              crearEvento(`Gestión iniciada vía ${canal}. Esperando respuesta del cliente`, usuario, 'Pendiente')
            )
            notify(`Estado actualizado a: Esperando respuesta del cliente (${id}).`)
          }
          return res
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(res?.message || `Gestión comercial registrada con éxito para ${id}.`)
        return res
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar la gestión comercial.', 'error')
        throw err
      })
  }

  function designReleasePrint(id) {
    return api.liberarParaImpresion(id)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            { disenoEstado: 'Listo para impresión' },
            crearEvento('Diseño verificado y liberado para impresión por Coordinación', usuario)
          )
          notify(`Orden ${id} liberada formalmente para impresión.`)
          return res
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(res?.message || `Orden ${id} liberada formalmente para impresión.`)
        return res
      })
      .catch((err) => {
        notify(err.message || 'No se pudo liberar la orden para impresión.', 'error')
        throw err
      })
  }

  function designApprove(id, comentario = '', extra = {}) {
    api.responderDiseno(id, 'aprobado', comentario, usuario, extra)
      .then((res) => {
        if (res?.modoMock) {
          updateOrder(
            id,
            (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Aprobado por el cliente' }), disenoEstado: 'Aprobado por el cliente' }),
            crearEvento('Diseño aprobado por el cliente', usuario)
          )
          notify(`Diseño de ${id} aprobado. La orden ya puede pasar a verificación de Coordinación.`)
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Diseño de ${id} aprobado. La orden ya puede pasar a verificación de Coordinación.`)
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
            (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Cambios solicitados', comentario }), disenoEstado: 'Cambios solicitados', estado: 'Diseño' }),
            crearEvento(`Cliente solicitó modificaciones: ${comentario}`, usuario, 'Pendiente')
          )
          notify(`Se solicitaron cambios al diseño de ${id}. Trabajo devuelto a Diseño.`, 'aviso')
          return
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(`Se solicitaron cambios al diseño de ${id}. Trabajo devuelto a Diseño.`, 'aviso')
      })
      .catch((err) => {
        notify(err.message || 'No se pudo registrar la solicitud de cambios del diseño.', 'error')
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
        if (res?.avanceAutomatico?.avanzada) {
          notify(`¡Etapa completada! La orden ${t.ordenId} avanzó automáticamente a ${res.avanceAutomatico.nuevaEtapa}.`, 'exito')
          if (Array.isArray(res.avanceAutomatico.nuevasTareas) && res.avanceAutomatico.nuevasTareas.length > 0) {
            setTasks((prev) => {
              const ids = new Set(res.avanceAutomatico.nuevasTareas.map((nt) => nt.id))
              return [...prev.filter((nt) => !ids.has(nt.id)), ...res.avanceAutomatico.nuevasTareas]
            })
          }
        } else {
          notify(`Tarea "${t.actividad}" ${verbo}.`, accion === 'pausar' ? 'aviso' : 'exito')
        }
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
          const registro = { fecha: formatearFecha(), hora: formatearHora(), texto, autor: usuario, resuelto: esIncidencia ? false : undefined }
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

  function resolveTaskIncident(id, index, solucion) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return Promise.reject(new Error('Actividad no encontrada.'))

    return api.resolverIncidenciaActividad(id, index, solucion)
      .then((res) => {
        if (res?.modoMock) {
          const incs = [...(t.incidencias || [])]
          if (incs.length > 0) {
            const idx = index !== undefined ? index : 0
            incs[idx] = { ...incs[idx], resuelto: true, resuelta: true, solucion }
          }
          updateTask(id, { incidencias: incs })
          updateOrder(t.ordenId, {}, crearEvento(`Incidencia técnica resuelta en "${t.actividad}": ${solucion}`, usuario, 'Completado', true))
          notify(`Incidencia resuelta en "${t.actividad}".`, 'exito')
          return
        }
        if (res?.data) updateTask(id, res.data)
        if (res?.orden) replaceOrderFromServer(res.orden)
        if (res?.avanceAutomatico?.avanzada) {
          notify(`¡Incidencia resuelta! La orden ${t.ordenId} avanzó automáticamente a ${res.avanceAutomatico.nuevaEtapa}.`, 'exito')
          if (Array.isArray(res.avanceAutomatico.nuevasTareas) && res.avanceAutomatico.nuevasTareas.length > 0) {
            setTasks((prev) => {
              const ids = new Set(res.avanceAutomatico.nuevasTareas.map((nt) => nt.id))
              return [...prev.filter((nt) => !ids.has(nt.id)), ...res.avanceAutomatico.nuevasTareas]
            })
          }
        } else {
          notify(`Incidencia resuelta en "${t.actividad}".`, 'exito')
        }
      })
      .catch((err) => {
        notify(err.message || 'No se pudo resolver la incidencia.', 'error')
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
        if (res?.avanceAutomatico?.avanzada) {
          notify(`¡Etapa completada! La orden ${t?.ordenId} avanzó automáticamente a ${res.avanceAutomatico.nuevaEtapa}.`, 'exito')
          if (Array.isArray(res.avanceAutomatico.nuevasTareas) && res.avanceAutomatico.nuevasTareas.length > 0) {
            setTasks((prev) => {
              const ids = new Set(res.avanceAutomatico.nuevasTareas.map((nt) => nt.id))
              return [...prev.filter((nt) => !ids.has(nt.id)), ...res.avanceAutomatico.nuevasTareas]
            })
          }
        } else {
          notify(`Actividad "${t?.actividad || ''}" actualizada a ${nuevoEstado} (${nuevoPct}%).`)
        }
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

          // RF-07: Validación estricta de aprobación documentada en la orden original
          const ultimaVer = ordenOriginal.versiones?.[ordenOriginal.versiones.length - 1]
          const tieneAprobacionOriginal =
            ['Aprobado', 'Aprobado por el cliente', 'Listo para impresión'].includes(ordenOriginal.disenoEstado) &&
            Boolean(ultimaVer && (ultimaVer.estado === 'Aprobada' || ultimaVer.estado === 'Aprobado por el cliente' || ultimaVer.estado_aprobacion === 'aprobado'))

          const eventoAprobado = (ordenOriginal.historial || []).find((h) =>
            (h.actividad || h.accion_texto || '').toLowerCase().includes('diseño aprobado') ||
            (h.actividad || h.accion_texto || '').toLowerCase().includes('diseno aprobado')
          )

          const aprobadorReal =
            ultimaVer?.aprobadoPor ||
            eventoAprobado?.responsable ||
            (tieneAprobacionOriginal ? (ordenOriginal.entrega?.contacto || ordenOriginal.cliente) : null)
          const fechaAprobacionReal =
            ultimaVer?.fechaAprobacion ||
            ultimaVer?.fecha ||
            eventoAprobado?.fecha ||
            null
          const versionAprobadaNum = ultimaVer?.numero || 1

          const estadoInicial = tieneAprobacionOriginal
            ? 'Impresión'
            : (ordenOriginal.versiones?.length ? 'Aprobación' : 'Diseño')
          const disenoEstadoInicial = tieneAprobacionOriginal
            ? 'Aprobado'
            : (ordenOriginal.disenoEstado === 'Enviado' ? 'Enviado' : 'Pendiente')

          const versionesClonadas = tieneAprobacionOriginal
            ? [
                {
                  ...ultimaVer,
                  numero: 1,
                  estado: 'Aprobada',
                  aprobadoPor: aprobadorReal,
                  fechaAprobacion: fechaAprobacionReal,
                  comentario: `Arte aprobado reutilizado de orden original ${id} (v${versionAprobadaNum}). Aprobado por: ${aprobadorReal} el ${fechaAprobacionReal}.`,
                },
              ]
            : (ordenOriginal.versiones || []).map((v) => ({
                ...v,
                estado: v.estado === 'Aprobada' ? 'Enviada' : v.estado,
              }))

          const eventosHistorial = [
            crearEvento(
              `Orden clonada a partir de ${id} para reimpresión. Motivo: ${motivo}`,
              usuario,
              'Completado'
            ),
          ]

          if (tieneAprobacionOriginal) {
            eventosHistorial.push(
              crearEvento(
                `Aprobación de arte reutilizada de ${id} (v${versionAprobadaNum}). Aprobado formalmente por: ${aprobadorReal} el ${fechaAprobacionReal}. Cumple RF-07 para impresión.`,
                usuario,
                'Completado'
              )
            )
          } else {
            eventosHistorial.push(
              crearEvento(
                `RF-07: Paso a impresión bloqueado. La orden original ${id} no contaba con aprobación formal documentada; requiere visto bueno del cliente antes de producir.`,
                usuario,
                'Pendiente'
              )
            )
          }

          const nuevaOrden = {
            ...ordenOriginal,
            id: nuevoId,
            fechaSolicitud: formatearFecha(),
            fechaEntrega: formatearFecha(entregaCalculada),
            estado: estadoInicial,
            disenoEstado: disenoEstadoInicial,
            esReimpresion: true,
            ordenOriginalId: id,
            versiones: versionesClonadas,
            historial: eventosHistorial,
            entrega: {
              ...ordenOriginal.entrega,
              contacto: ordenOriginal.entrega?.contacto || ordenOriginal.cliente,
              fechaReal: null,
              conformidad: null,
              evidencia: null,
            },
          }
          setOrders((prev) => [nuevaOrden, ...prev])
          if (tieneAprobacionOriginal) {
            notify(`Orden clonada con éxito: ${nuevoId} (Reimpresión autorizada de ${id}).`, 'exito')
          } else {
            notify(`Orden de reposición creada: ${nuevoId}. Bloqueada para impresión hasta obtener aprobación de diseño (RF-07).`, 'aviso')
          }
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
    return api.enviarMensajeComunicacion(commId, nuevoMensaje)
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
          return res
        }
        if (res?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? res.data : c)))
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(res?.mensaje || `Respuesta enviada a ${comm?.cliente || 'cliente'}.`)
        return res
      })
      .catch((err) => {
        if (err?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? err.data : c)))
        }
        notify(err.message || 'No se pudo enviar el mensaje.', 'error')
        throw err
      })
  }

  function retryCommMessage(commId, mensajeId) {
    return api.reintentarMensajeComunicacion(commId, mensajeId)
      .then((res) => {
        if (res?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? res.data : c)))
        }
        if (res?.orden) replaceOrderFromServer(res.orden)
        notify(res?.mensaje || 'Reintento exitoso.')
        return res
      })
      .catch((err) => {
        if (err?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? err.data : c)))
        }
        notify(err.message || 'Fallo al reintentar el envío del correo.', 'error')
        throw err
      })
  }

  function sendNewEmail(datos) {
    return api.enviarNuevoCorreo(datos)
      .then((res) => {
        if (res?.data) {
          setComms((prev) => [res.data, ...prev.filter((c) => c.id !== res.data.id)])
        }
        notify(res?.mensaje || 'Correo enviado exitosamente.', 'exito')
        return res
      })
      .catch((err) => {
        if (err?.data) {
          setComms((prev) => [err.data, ...prev.filter((c) => c.id !== err.data.id)])
        }
        notify(err.message || 'No se pudo enviar el correo.', 'error')
        throw err
      })
  }

  function sendNewWhatsApp(datos) {
    return api.enviarNuevoWhatsApp(datos)
      .then((res) => {
        if (res?.data) {
          setComms((prev) => [res.data, ...prev.filter((c) => c.id !== res.data.id)])
        }
        notify(res?.mensaje || 'Mensaje de WhatsApp enviado.', 'exito')
        return res
      })
      .catch((err) => {
        if (err?.data) {
          setComms((prev) => [err.data, ...prev.filter((c) => c.id !== err.data.id)])
        }
        notify(err.message || 'No se pudo enviar el WhatsApp.', 'error')
        throw err
      })
  }

  function syncComms() {
    return api.sincronizarComunicaciones()
      .catch(() => ({}))
      .then((res) => {
        return api.listarComunicaciones().then((lista) => {
          if (Array.isArray(lista)) {
            setComms(lista)
          }
          return res
        })
      })
      .catch((err) => {
        console.warn('[SyncComms] Error al sincronizar:', err.message)
      })
  }

  function syncCommsSilently() {
    return api.listarComunicaciones()
      .then((lista) => {
        if (Array.isArray(lista)) {
          setComms(lista)
        }
        return lista
      })
      .catch(() => {})
  }

  function markCommAsRead(commId) {
    if (!commId) return
    setComms((prev) =>
      prev.map((c) =>
        c.id === commId
          ? {
              ...c,
              tieneNoLeidos: false,
              noLeidos: 0,
              mensajes: c.mensajes.map((m) => (m.de === 'cliente' ? { ...m, leido: true } : m)),
            }
          : c
      )
    )
    api.marcarConversacionLeida(commId)
      .then((res) => {
        if (res?.data) {
          setComms((prev) => prev.map((c) => (c.id === commId ? res.data : c)))
        }
      })
      .catch(() => {})
  }

  function refreshDashboard() {
    if (role === 'gerencia' || role === 'coordinador') {
      api.obtenerDashboard().then((res) => {
        if (res?.ok && res?.data) {
          setDashboard(res.data)
        }
      }).catch((err) => {
        console.warn('Dashboard refresh warning:', err?.message)
      })
    }
  }

  async function editOrder(id, cambios) {
    try {
      const res = await api.actualizarOrden(id, cambios)
      if (res?.data) replaceOrderFromServer(res.data)
      notify('Orden actualizada exitosamente.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo actualizar la orden.', 'error')
    }
  }

  async function archiveOrder(id) {
    try {
      const res = await api.archivarOrden(id)
      if (res?.data) replaceOrderFromServer(res.data)
      else setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, archivado: true } : o)))
      notify(`Orden ${id} archivada.`, 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo archivar la orden.', 'error')
    }
  }

  async function restoreOrder(id) {
    try {
      const res = await api.restaurarOrden(id)
      if (res?.data) replaceOrderFromServer(res.data)
      else setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, archivado: false } : o)))
      notify(`Orden ${id} restaurada.`, 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo restaurar la orden.', 'error')
    }
  }

  async function deleteOrder(id) {
    try {
      await api.eliminarOrden(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      notify(`Orden ${id} eliminada permanentemente.`, 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar la orden.', 'error')
    }
  }

  async function editInventoryMaterial(id, cambios) {
    try {
      const res = await api.actualizarMaterialInventario(id, cambios)
      if (res?.data) setInventory((prev) => prev.map((m) => (m.id === id ? { ...m, ...res.data } : m)))
      notify('Material actualizado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo actualizar el material.', 'error')
    }
  }

  async function archiveInventoryMaterial(id) {
    try {
      await api.archivarMaterialInventario(id)
      setInventory((prev) => prev.map((m) => (m.id === id ? { ...m, archivado: true } : m)))
      notify('Material archivado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo archivar el material.', 'error')
    }
  }

  async function restoreInventoryMaterial(id) {
    try {
      await api.restaurarMaterialInventario(id)
      setInventory((prev) => prev.map((m) => (m.id === id ? { ...m, archivado: false } : m)))
      notify('Material restaurado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo restaurar el material.', 'error')
    }
  }

  async function deleteInventoryMaterial(id) {
    try {
      await api.eliminarMaterialInventario(id)
      setInventory((prev) => prev.filter((m) => m.id !== id))
      notify('Material eliminado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar el material.', 'error')
    }
  }

  async function editSupplier(id, cambios) {
    try {
      const res = await api.actualizarProveedor(id, cambios)
      if (res?.data) setSuppliers((prev) => prev.map((p) => (p.id === id ? { ...p, ...res.data } : p)))
      notify('Proveedor actualizado.', 'exito')
    } catch (err) {
      notify(err.message || 'No se pudo actualizar el proveedor.', 'error')
    }
  }

  async function archiveSupplier(id) {
    try {
      await api.archivarProveedor(id)
      setSuppliers((prev) => prev.map((p) => (p.id === id ? { ...p, archivado: true } : p)))
      notify('Proveedor archivado.', 'exito')
    } catch (err) {
      notify(err.message || 'No se pudo archivar el proveedor.', 'error')
    }
  }

  async function restoreSupplier(id) {
    try {
      await api.restaurarProveedor(id)
      setSuppliers((prev) => prev.map((p) => (p.id === id ? { ...p, archivado: false } : p)))
      notify('Proveedor restaurado.', 'exito')
    } catch (err) {
      notify(err.message || 'No se pudo restaurar el proveedor.', 'error')
    }
  }

  async function deleteSupplier(id) {
    try {
      await api.eliminarProveedor(id)
      setSuppliers((prev) => prev.filter((p) => p.id !== id))
      notify('Proveedor eliminado.', 'exito')
    } catch (err) {
      notify(err.message || 'No se pudo eliminar el proveedor.', 'error')
    }
  }

  async function editTask(id, cambios) {
    try {
      const res = await api.actualizarActividad(id, cambios)
      if (res?.data) updateTask(id, res.data)
      notify('Actividad actualizada.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo actualizar la actividad.', 'error')
    }
  }

  async function deleteTask(id) {
    try {
      await api.eliminarActividad(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      notify('Actividad eliminada.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar la actividad.', 'error')
    }
  }

  async function archiveCase(id) {
    try {
      await api.archivarCasoPostventa(id)
      setCases((prev) => prev.map((c) => (c.id === id ? { ...c, archivado: true } : c)))
      notify('Caso archivado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo archivar el caso.', 'error')
    }
  }

  async function restoreCase(id) {
    try {
      await api.restaurarCasoPostventa(id)
      setCases((prev) => prev.map((c) => (c.id === id ? { ...c, archivado: false } : c)))
      notify('Caso restaurado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo restaurar el caso.', 'error')
    }
  }

  async function deleteCase(id) {
    try {
      await api.eliminarCasoPostventa(id)
      setCases((prev) => prev.filter((c) => c.id !== id))
      notify('Caso eliminado.', 'exito')
      refreshDashboard()
    } catch (err) {
      notify(err.message || 'No se pudo eliminar el caso.', 'error')
    }
  }

  const actions = {
    addRequest,
    editRequest,
    archiveRequest,
    restoreRequest,
    deleteRequest,
    sendToValidation,
    correctRequest,
    returnRequest,
    rejectRequest,
    validateRequest,
    advanceStage,
    assignOrderTeam,
    editOrder,
    archiveOrder,
    restoreOrder,
    deleteOrder,
    registerDelivery,
    designNewVersion,
    designSend,
    designCommercialManage,
    designReleasePrint,
    designApprove,
    designReject,
    createTask,
    editTask,
    deleteTask,
    taskAction,
    addTaskNote,
    resolveTaskIncident,
    assignTask,
    updateTaskProgress,
    addInventoryMaterial,
    editInventoryMaterial,
    archiveInventoryMaterial,
    restoreInventoryMaterial,
    deleteInventoryMaterial,
    addSupplier,
    editSupplier,
    archiveSupplier,
    restoreSupplier,
    deleteSupplier,
    registerInventoryMovement,
    sendCommMessage,
    retryCommMessage,
    sendNewEmail,
    sendNewWhatsApp,
    syncComms,
    syncCommsSilently,
    markCommAsRead,
    createCase,
    updateCase,
    archiveCase,
    restoreCase,
    deleteCase,
    closeOrder,
    reopenOrder,
    cloneOrder,
    addUser,
    updateUser,
    toggleUserStatus,
    addClient,
    editClient,
    archiveClient,
    restoreClient,
    deleteClient,
    refreshDashboard,
    notify,
  }

  const rolActivo = normalizarRol(role)
  const props = { data, actions, irA, role: rolActivo, order: selectedOrder, usuarioActual: currentUser }

  function renderPage() {
    const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rolActivo] || ['inicio']
    if (!permitidas.includes(page.name)) {
      const Dashboard = dashboards[rolActivo] || CoordinatorDashboard
      return <Dashboard {...props} />
    }

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
      case 'aprobacion_disenos':
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
      case 'portal':
        return <PublicPortal onVolverLogin={() => {
          if (typeof window !== 'undefined') window.location.hash = ''
          setPage({ name: 'inicio', orderId: null })
        }} />
      default:
        return <EnConstruccion titulo={tituloMenu} />
    }
  }

  // Si la ruta activa es el portal público de clientes (#/portal), renderizarlo directamente
  if (page.name === 'portal' || (typeof window !== 'undefined' && window.location.hash.replace(/^#\/?/, '').split('/')[0] === 'portal')) {
    return (
      <>
        <PublicPortal onVolverLogin={() => {
          if (typeof window !== 'undefined') window.location.hash = '#/inicio'
          setPage({ name: 'inicio', orderId: null })
        }} />
        <ToastStack toasts={toasts} onClose={cerrarToast} />
      </>
    )
  }

  // Pantalla de inicio de sesión si no hay usuario autenticado (HU-02)
  if (!currentUser) {
    return (
      <>
        <Login
          onLogin={handleLogin}
          onIrAlPortal={() => {
            if (typeof window !== 'undefined') window.location.hash = '#/portal'
            setPage({ name: 'portal', orderId: null })
          }}
        />
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
        usuarioActual={currentUser}
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
          usuarioNombre={currentUser?.nombre || ''}
          modoDemo={api.usarMock}
        />
        <main className="content">
          <div key={`${rolActivo}-${page.name}-${page.orderId || ''}`} className="page-transition">
            <ErrorBoundary key={`${rolActivo}-${page.name}`}>
              {renderPage()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onClose={cerrarToast} />
    </div>
  )
}
