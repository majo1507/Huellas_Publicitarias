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
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import { ROLES } from './data/roles.js'
import { api } from './services/api.js'
import { formatearFecha, formatearHora, puedeAvanzar } from './utils/format.js'

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

// Crea un evento para el historial de una orden con la fecha y hora actuales
function crearEvento(actividad, responsable, estado = 'Completado', interno = false) {
  const ahora = new Date()
  return { fecha: formatearFecha(ahora), hora: formatearHora(ahora), actividad, responsable, estado, interno }
}

// Reemplaza la última versión del diseño por una versión modificada
function cambiarUltimaVersion(versiones, cambios) {
  return versiones.map((v, i) => (i === versiones.length - 1 ? { ...v, ...cambios } : v))
}

export default function App() {
  // TODOS los roles trabajan sobre estos mismos datos (viven en memoria, se pierden al recargar).
  // Se cargan con src/services/api.js, que hoy devuelve datos simulados y mañana llamará a la API REST.
  const [orders, setOrders] = useState([])
  const [requests, setRequests] = useState([])
  const [tasks, setTasks] = useState([])
  const [cases, setCases] = useState([])
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [comms, setComms] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [intento, setIntento] = useState(0)

  // page.name indica la pantalla actual; page.orderId la orden seleccionada
  const [page, setPage] = useState({ name: 'inicio', orderId: null })
  // Rol simulado (sin autenticación real): define menú, dashboard y acciones disponibles
  const [role, setRole] = useState('cliente')
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [toasts, setToasts] = useState([])

  // Carga inicial de datos
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga('')
    api.cargarTodo()
      .then((d) => {
        if (cancelado) return
        setOrders(d.orders); setRequests(d.requests); setTasks(d.tasks)
        setCases(d.cases); setClients(d.clients); setUsers(d.users); setComms(d.comms || [])
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setErrorCarga(e.message || 'No se pudo conectar con el servidor.')
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [intento])

  // Cada vez que se cambia de pantalla se vuelve arriba
  useEffect(() => { window.scrollTo(0, 0) }, [page])

  const usuario = ROLES[role].usuario.nombre // quien realiza las acciones (se guarda en el historial)
  const data = { orders, requests, tasks, cases, clients, users, comms }

  // Mensajes de éxito / error / aviso
  function notify(texto, tipo = 'exito') {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, texto, tipo }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }
  const cerrarToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const irA = (name, orderId = null) => setPage({ name, orderId })

  // Al cambiar de rol se vuelve al inicio de esa interfaz
  function cambiarRol(nuevoRol) {
    setRole(nuevoRol)
    irA('inicio')
    notify(`Vista cambiada a: ${ROLES[nuevoRol].nombre}`, 'info')
  }

  const selectedOrder = orders.find((o) => o.id === page.orderId)
  const tituloMenu = ROLES[role].menu.find((m) => m.page === page.name)?.label || 'Módulo'

  // Modifica una orden y agrega (opcionalmente) un evento al historial.
  // "cambios" puede ser un objeto o una función que recibe la orden actual.
  function updateOrder(id, cambios, evento) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const nuevos = typeof cambios === 'function' ? cambios(o) : cambios
        return { ...o, ...nuevos, historial: evento ? [...o.historial, evento] : o.historial }
      })
    )
  }

  // ---------------- Solicitudes ----------------
  function addRequest(form) {
    const numero = String(requests.length + 1).padStart(4, '0')
    const id = `SOL-2026-${numero}`
    const nueva = { ...form, id, fechaSolicitud: formatearFecha(), estado: 'Pendiente', ordenId: null, motivoRechazo: '' }
    setRequests([...requests, nueva])
    irA('solicitudes')
    notify(`Solicitud ${id} registrada. Quedó pendiente de envío a validación.`)
  }

  const updateRequest = (id, cambios) => setRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)))

  function sendToValidation(id) {
    updateRequest(id, { estado: 'En validación' })
    notify(`Solicitud ${id} enviada a validación.`)
  }

  function rejectRequest(id, motivo) {
    updateRequest(id, { estado: 'Rechazada', motivoRechazo: motivo })
    notify(`Solicitud ${id} rechazada.`, 'aviso')
  }

  // El coordinador valida la solicitud y se genera la orden de producción
  function validateRequest(id) {
    const s = requests.find((r) => r.id === id)
    const cliente = clients.find((c) => c.id === s.clienteId)
    const ordenId = `OP-2026-${String(orders.length + 1).padStart(4, '0')}`
    const nueva = {
      id: ordenId,
      clienteId: s.clienteId,
      cliente: s.cliente,
      producto: s.producto,
      cantidad: s.cantidad,
      material: s.material,
      dimensiones: s.dimensiones,
      colores: 'Por definir',
      acabados: 'Por definir',
      fechaSolicitud: s.fechaSolicitud,
      fechaEntrega: s.fechaEntrega,
      estado: 'Diseño',
      disenoEstado: 'Pendiente',
      responsable: 'María López',
      disenador: 'María López',
      presupuesto: s.presupuesto,
      costoInterno: Math.round(s.presupuesto * 0.6),
      requerimientos: s.requerimientos,
      observaciones: s.observaciones,
      entrega: { direccion: `${cliente.direccion}, ${cliente.ciudad}`, metodo: 'Domicilio', contacto: cliente.contacto },
      versiones: [],
      historial: [
        crearEvento('Solicitud creada', 'Ana Martínez'),
        crearEvento('Orden generada', usuario),
        crearEvento('Actividad asignada: diseño a María López', usuario, 'Completado', true),
      ],
    }
    setOrders([...orders, nueva])
    updateRequest(id, { estado: 'Aprobada', ordenId })
    notify(`Solicitud validada. Se generó la orden ${ordenId} y se asignó a diseño.`)
  }

  // ---------------- Flujo de la orden ----------------
  // Pasa la orden a la siguiente etapa. REGLA: no se puede pasar a Impresión sin diseño aprobado.
  function advanceStage(id) {
    const order = orders.find((o) => o.id === id)
    const regla = puedeAvanzar(order)

    if (!regla.ok) {
      if (regla.bloqueada) {
        // Se registra el intento en el historial y se explica el motivo
        updateOrder(id, {}, crearEvento(`Avance bloqueado: se intentó pasar a ${regla.siguiente} sin diseño aprobado`, usuario, 'Pendiente'))
        notify(regla.motivo, 'error')
      } else {
        notify(regla.motivo, 'info')
      }
      return false
    }

    updateOrder(id, { estado: regla.siguiente }, crearEvento(`Etapa cambiada a ${regla.siguiente}`, usuario, 'En proceso'))
    notify(`La orden ${id} avanzó a ${regla.siguiente}.`)
    return true
  }

  // ---------------- Diseño ----------------
  function designNewVersion(id) {
    const numero = orders.find((o) => o.id === id).versiones.length + 1
    const version = { numero, fecha: formatearFecha(), disenador: 'María López', estado: 'En proceso', comentario: '' }
    updateOrder(
      id,
      (o) => ({ versiones: [...o.versiones, version], disenoEstado: 'En proceso', estado: 'Diseño' }),
      crearEvento(`Diseño creado (versión ${numero})`, usuario)
    )
    notify(`Versión ${numero} creada para ${id}.`)
  }

  function designSend(id) {
    updateOrder(
      id,
      (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Enviada' }), disenoEstado: 'Enviado', estado: 'Aprobación' }),
      crearEvento('Diseño enviado para aprobación', usuario)
    )
    notify(`Diseño de ${id} enviado para aprobación del cliente.`)
  }

  function designApprove(id) {
    updateOrder(
      id,
      (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Aprobada' }), disenoEstado: 'Aprobado' }),
      crearEvento('Diseño aprobado', usuario)
    )
    notify(`Diseño de ${id} aprobado. La orden ya puede pasar a impresión.`)
  }

  function designReject(id, comentario) {
    updateOrder(
      id,
      (o) => ({ versiones: cambiarUltimaVersion(o.versiones, { estado: 'Rechazada', comentario }), disenoEstado: 'Requiere cambios', estado: 'Diseño' }),
      crearEvento(`Diseño rechazado: ${comentario}`, usuario, 'Pendiente')
    )
    notify(`Se solicitaron cambios al diseño de ${id}.`, 'aviso')
  }

  // ---------------- Actividades de producción ----------------
  const updateTask = (id, cambios) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)))

  // accion: 'iniciar' | 'pausar' | 'finalizar'
  function taskAction(id, accion) {
    const t = tasks.find((x) => x.id === id)
    const nuevoEstado = { iniciar: 'En proceso', pausar: 'Pausada', finalizar: 'Finalizada' }[accion]
    const verbo = { iniciar: 'iniciada', pausar: 'pausada', finalizar: 'finalizada' }[accion]
    updateTask(id, { estado: nuevoEstado })
    updateOrder(t.ordenId, {}, crearEvento(`Tarea "${t.actividad}" ${verbo}`, usuario, nuevoEstado, true))
    notify(`Tarea "${t.actividad}" ${verbo}.`, accion === 'pausar' ? 'aviso' : 'exito')
  }

  // tipo: 'notas' (observación) | 'incidencias'
  function addTaskNote(id, tipo, texto) {
    const t = tasks.find((x) => x.id === id)
    const registro = { fecha: formatearFecha(), hora: formatearHora(), texto, autor: usuario }
    updateTask(id, { [tipo]: [...t[tipo], registro] })
    const etiqueta = tipo === 'incidencias' ? 'Incidencia' : 'Observación'
    updateOrder(t.ordenId, {}, crearEvento(`${etiqueta} en "${t.actividad}": ${texto}`, usuario, 'Pendiente', true))
    notify(`${etiqueta} registrada.`, tipo === 'incidencias' ? 'aviso' : 'exito')
  }

  function assignTask(id, responsable) {
    const t = tasks.find((x) => x.id === id)
    updateTask(id, { responsable })
    updateOrder(t.ordenId, {}, crearEvento(`Actividad "${t.actividad}" asignada a ${responsable}`, usuario, 'Completado', true))
    notify(`Actividad asignada a ${responsable}.`)
  }

  // ---------------- Postventa ----------------
  function updateCase(id, cambios, mensaje) {
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...cambios } : c)))
    if (mensaje) notify(mensaje)
  }

  // ---------------- Comunicaciones ----------------
  function sendCommMessage(commId, nuevoMensaje) {
    setComms((prev) =>
      prev.map((c) => {
        if (c.id !== commId) return c
        return {
          ...c,
          estado: 'Respondida',
          mensajes: [...c.mensajes, nuevoMensaje],
        }
      })
    )

    const comm = comms.find((c) => c.id === commId)
    if (comm?.ordenId) {
      updateOrder(
        comm.ordenId,
        {},
        crearEvento(`Respuesta enviada al cliente por ${comm.canal === 'wa' ? 'WhatsApp' : comm.canal === 'mail' ? 'Correo' : 'Telefonía'}`, usuario)
      )
    }
    notify(`Respuesta enviada a ${comm?.cliente || 'cliente'}.`)
  }

  // ---------------- Tareas con avance ----------------
  function updateTaskProgress(taskId, nuevoEstado, nuevoPct) {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        return {
          ...t,
          estado: nuevoEstado,
          pct: nuevoPct,
        }
      })
    )

    const t = tasks.find((x) => x.id === taskId)
    if (t?.ordenId) {
      updateOrder(
        t.ordenId,
        {},
        crearEvento(`Avance en actividad "${t.actividad}": ${nuevoEstado} (${nuevoPct}%)`, usuario, nuevoEstado, true)
      )
    }
    notify(`Actividad "${t?.actividad || ''}" actualizada a ${nuevoEstado} (${nuevoPct}%).`)
  }

  // Todas las acciones que pueden ejecutar las pantallas
  const actions = {
    addRequest, sendToValidation, validateRequest, rejectRequest,
    advanceStage,
    designNewVersion, designSend, designApprove, designReject,
    taskAction, addTaskNote, assignTask, updateTaskProgress,
    sendCommMessage,
    updateCase,
    notify,
  }

  const props = { data, actions, irA, role, order: selectedOrder }

  function renderPage() {
    switch (page.name) {
      case 'inicio': {
        const Dashboard = dashboards[role]
        return <Dashboard {...props} />
      }
      case 'solicitudes':
        return <Requests {...props} />
      case 'nuevo':
        return <NewOrder clients={clients} onSubmit={addRequest} irA={irA} />
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
    <div className="app">
      <Sidebar role={role} current={page.name} irA={irA} abierto={menuAbierto} onClose={() => setMenuAbierto(false)} />
      <div className="main">
        <Header role={role} onChangeRole={cambiarRol} data={data} irA={irA} onMenu={() => setMenuAbierto(true)} />
        <main className="content">{renderPage()}</main>
      </div>
      <ToastStack toasts={toasts} onClose={cerrarToast} />
    </div>
  )
}
