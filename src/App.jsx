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
import Login from './pages/Login.jsx'
import { ROLES } from './data/roles.js'
import { api } from './services/api.js'
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

// Reemplaza la última versión del diseño por una versión modificada
function cambiarUltimaVersion(versiones, cambios) {
  return versiones.map((v, i) => (i === versiones.length - 1 ? { ...v, ...cambios } : v))
}

export default function App() {
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

  // Usuario autenticado (HU-02)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      if (sessionStorage.getItem('orvex_auth_logged_out') === 'true') return null
      const guardado = sessionStorage.getItem('orvex_auth_user')
      if (guardado) return JSON.parse(guardado)
      return {
        nombre: ROLES.coordinador.usuario.nombre,
        correo: 'carlos.gomez@huellas.co',
        cargo: ROLES.coordinador.usuario.cargo,
        rol: 'coordinador',
      }
    } catch {
      return null
    }
  })

  // Rol activo (controla vistas, menús y permisos)
  const [role, setRole] = useState(() => {
    try {
      if (sessionStorage.getItem('orvex_auth_logged_out') === 'true') return 'coordinador'
      return sessionStorage.getItem('orvex_auth_role') || 'coordinador'
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

  // Carga inicial de datos
  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga('')
    api.cargarTodo()
      .then((d) => {
        if (cancelado) return
        setOrders(d.orders)
        setRequests(d.requests)
        setTasks(d.tasks)
        setCases(d.cases)
        setClients(d.clients)
        setUsers(d.users)
        setComms(d.comms || [])
        setCargando(false)
      })
      .catch((e) => {
        if (cancelado) return
        setErrorCarga(e.message || 'No se pudo conectar con el servidor.')
        setCargando(false)
      })
    return () => { cancelado = true }
  }, [intento])

  useEffect(() => { window.scrollTo(0, 0) }, [page])

  const usuario = currentUser?.nombre || ROLES[role]?.usuario?.nombre || 'Usuario'
  const data = { orders, requests, tasks, cases, clients, users, comms }

  function notify(texto, tipo = 'exito') {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, texto, tipo }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500)
  }
  const cerrarToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  // Navegación con protección de rutas según rol (HU-02 y HU-07)
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
    setCurrentUser(usuarioElegido)
    setRole(rolElegido)
    try {
      sessionStorage.removeItem('orvex_auth_logged_out')
      sessionStorage.setItem('orvex_auth_user', JSON.stringify(usuarioElegido))
      sessionStorage.setItem('orvex_auth_role', rolElegido)
    } catch {}
    setPage({ name: 'inicio', orderId: null })
    notify(`Bienvenido/a, ${usuarioElegido.nombre}. Sesión activa como ${ROLES[rolElegido].nombre}.`, 'exito')
  }

  // Cierre de sesión (HU-02)
  function handleLogout() {
    setCurrentUser(null)
    try {
      sessionStorage.setItem('orvex_auth_logged_out', 'true')
      sessionStorage.removeItem('orvex_auth_user')
    } catch {}
    notify('Sesión cerrada correctamente.', 'info')
  }

  // Cambio de rol simulado (sincroniza usuario y contexto)
  function cambiarRol(nuevoRol) {
    setRole(nuevoRol)
    const nuevoUsuario = {
      nombre: ROLES[nuevoRol]?.usuario?.nombre || 'Usuario',
      correo: `${nuevoRol}@huellas.co`,
      cargo: ROLES[nuevoRol]?.usuario?.cargo || nuevoRol,
      rol: nuevoRol,
    }
    setCurrentUser(nuevoUsuario)
    try {
      sessionStorage.removeItem('orvex_auth_logged_out')
      sessionStorage.setItem('orvex_auth_user', JSON.stringify(nuevoUsuario))
      sessionStorage.setItem('orvex_auth_role', nuevoRol)
    } catch {}
    setPage({ name: 'inicio', orderId: null })
    notify(`Vista cambiada a: ${ROLES[nuevoRol].nombre}`, 'info')
  }

  // Gestión de usuarios (HU-01)
  function addUser(nuevo) {
    setUsers((prev) => [...prev, nuevo])
  }

  function updateUser(id, cambios) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...cambios } : u)))
  }

  function toggleUserStatus(id) {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u
        const nuevoEstado = u.estado === 'Activo' ? 'Inactivo' : 'Activo'
        return { ...u, estado: nuevoEstado }
      })
    )
  }

  const selectedOrder = orders.find((o) => o.id === page.orderId)
  const tituloMenu = ROLES[role]?.menu.find((m) => m.page === page.name)?.label || 'Módulo'

  function updateOrder(id, cambios, evento) {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o
        const nuevos = typeof cambios === 'function' ? cambios(o) : cambios
        return { ...o, ...nuevos, historial: evento ? [...o.historial, evento] : o.historial }
      })
    )
  }

  // ---------------- Solicitudes (HU-03, HU-04, HU-05, HU-06) ----------------
  function addRequest(form) {
    const numero = String(requests.length + 1).padStart(4, '0')
    const id = `SOL-2026-${numero}`
    const nueva = {
      ...form,
      id,
      fechaSolicitud: formatearFecha(),
      estado: 'Pendiente',
      ordenId: null,
      motivoRechazo: '',
    }
    setRequests([...requests, nueva])
    irA('solicitudes')
    notify(`Solicitud ${id} registrada con éxito. Quedó pendiente de envío a validación.`, 'exito')
  }

  const updateRequest = (id, cambios) =>
    setRequests((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambios } : s)))

  function sendToValidation(id) {
    updateRequest(id, { estado: 'En validación' })
    notify(`Solicitud ${id} enviada a validación del coordinador.`)
  }

  // Devolver solicitud para corrección (HU-05)
  function returnRequest(id, motivo) {
    updateRequest(id, { estado: 'Devuelta para corrección', motivoRechazo: motivo })
    notify(`Solicitud ${id} devuelta al área comercial para corrección.`, 'aviso')
  }

  // Rechazar solicitud definitivamente (HU-05)
  function rejectRequest(id, motivo) {
    updateRequest(id, { estado: 'Rechazada', motivoRechazo: motivo })
    notify(`Solicitud ${id} rechazada formalmente.`, 'aviso')
  }

  // Validar solicitud y generar orden de producción (HU-06)
  function validateRequest(id) {
    const s = requests.find((r) => r.id === id)
    if (!s) {
      notify('Solicitud no encontrada.', 'error')
      return false
    }

    // Regla HU-06: Prevenir órdenes duplicadas y estados no válidos
    if (s.ordenId || s.estado === 'Aprobada') {
      notify(`La solicitud ${id} ya generó una orden previamente (${s.ordenId}). No se permiten órdenes duplicadas.`, 'error')
      return false
    }
    if (s.estado !== 'En validación') {
      notify(`La solicitud ${id} debe encontrarse en estado "En validación" para ser aprobada.`, 'aviso')
      return false
    }

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

    setOrders([...orders, nueva])
    updateRequest(id, { estado: 'Aprobada', ordenId, motivoRechazo: '' })
    notify(`Solicitud validada. Se generó la orden ${ordenId} y se asignó a diseño.`, 'exito')
    return true
  }

  // ---------------- Flujo de la orden ----------------
  function advanceStage(id) {
    const order = orders.find((o) => o.id === id)
    const regla = puedeAvanzar(order)

    if (!regla.ok) {
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
      } else {
        notify(regla.motivo, 'info')
      }
      return false
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
    return true
  }

  // ---------------- Registro de entregas y evidencias (HU-17) ----------------
  function registerDelivery(ordenId, datosEntrega) {
    const orden = orders.find((o) => o.id === ordenId)
    if (!orden) return false

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

    const estadoAnterior = orden.estado
    const nuevoEstado = 'Entrega'

    updateOrder(
      ordenId,
      {
        estado: nuevoEstado,
        entrega: nuevaInfoEntrega,
      },
      crearEvento(
        `Entrega formal registrada a ${datosEntrega.contacto}${datosEntrega.documento ? ` (Doc: ${datosEntrega.documento})` : ''}`,
        usuario,
        'Completado',
        false,
        {
          estadoAnterior,
          nuevoEstado,
          motivo: `Conformidad: ${datosEntrega.conformidad}`,
          observaciones: datosEntrega.observaciones,
        }
      )
    )

    notify(`Entrega de ${ordenId} registrada con éxito. Acta/evidencia asociada a la orden.`, 'exito')
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

  // ---------------- Actividades de taller (HU-08 y HU-10) ----------------
  const updateTask = (id, cambios) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...cambios } : t)))

  function taskAction(id, accion) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const nuevoEstado = { iniciar: 'En proceso', pausar: 'Pausada', finalizar: 'Finalizada' }[accion]
    const verbo = { iniciar: 'iniciada', pausar: 'pausada', finalizar: 'finalizada' }[accion]
    updateTask(id, { estado: nuevoEstado })
    updateOrder(t.ordenId, {}, crearEvento(`Tarea "${t.actividad}" ${verbo}`, usuario, nuevoEstado, true))
    notify(`Tarea "${t.actividad}" ${verbo}.`, accion === 'pausar' ? 'aviso' : 'exito')
  }

  function addTaskNote(id, tipo, texto) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const registro = { fecha: formatearFecha(), hora: formatearHora(), texto, autor: usuario }
    updateTask(id, { [tipo]: [...t[tipo], registro] })
    const etiqueta = tipo === 'incidencias' ? 'Incidencia' : 'Observación'
    updateOrder(t.ordenId, {}, crearEvento(`${etiqueta} en "${t.actividad}": ${texto}`, usuario, 'Pendiente', true))
    notify(`${etiqueta} registrada.`, tipo === 'incidencias' ? 'aviso' : 'exito')
  }

  // Asignación y cambio de responsable con trazabilidad completa (HU-08 y HU-10)
  function assignTask(id, responsable) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    const anterior = t.responsable || 'Sin asignar'
    if (anterior === responsable) return

    updateTask(id, { responsable })
    updateOrder(
      t.ordenId,
      {},
      crearEvento(`Actividad "${t.actividad}": responsable reasignado de ${anterior} a ${responsable}`, usuario, 'Completado', true)
    )
    notify(`Actividad "${t.actividad}" asignada a ${responsable}.`, 'exito')
  }

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

  // ---------------- Postventa (HU-18) ----------------
  function createCase(nuevoCaso) {
    const num = cases.length + 1
    const nuevoId = `CAS-${String(num).padStart(3, '0')}`
    const ordenAsociada = orders.find((o) => o.id === nuevoCaso.ordenId)
    const casoCompleto = {
      id: nuevoId,
      fecha: formatearFecha(),
      estado: 'Abierto',
      responsable: nuevoCaso.responsable || null,
      calificacion: null,
      solucion: null,
      ...nuevoCaso,
      cliente: nuevoCaso.cliente || ordenAsociada?.cliente || 'Cliente',
    }

    setCases((prev) => [casoCompleto, ...prev])

    if (nuevoCaso.ordenId) {
      updateOrder(
        nuevoCaso.ordenId,
        {},
        crearEvento(
          `Caso de postventa ${nuevoId} registrado (${nuevoCaso.tipo}): ${nuevoCaso.descripcion}`,
          usuario,
          'Pendiente',
          false,
          {
            motivo: `Clasificación: ${nuevoCaso.tipo}`,
            observaciones: nuevoCaso.descripcion,
          }
        )
      )
    }

    notify(`Caso de postventa ${nuevoId} registrado con éxito.`, 'exito')
    return nuevoId
  }

  function updateCase(id, cambios, mensaje) {
    setCases((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        return { ...c, ...cambios }
      })
    )

    const caso = cases.find((c) => c.id === id)
    if (caso?.ordenId && cambios.estado) {
      updateOrder(
        caso.ordenId,
        {},
        crearEvento(
          `Caso postventa ${id}: ${cambios.estado}${cambios.solucion ? ` - Solución: ${cambios.solucion}` : ''}`,
          usuario,
          cambios.estado === 'Resuelto' ? 'Completado' : 'Pendiente',
          false,
          {
            estadoAnterior: caso.estado,
            nuevoEstado: cambios.estado,
            motivo: cambios.solucion || null,
          }
        )
      )
    }

    if (mensaje) notify(mensaje)
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

    const estadoAnterior = orden.estado
    updateOrder(
      id,
      {
        estado: 'Cerrada',
        cerradoPor: usuario,
        fechaCierre: formatearFecha(),
        motivoCierre: motivo,
      },
      crearEvento(`Orden cerrada formalmente por ${usuario}`, usuario, 'Completado', false, {
        estadoAnterior,
        nuevoEstado: 'Cerrada',
        motivo,
      })
    )

    notify(`La orden ${id} ha sido cerrada formalmente.`, 'exito')
    return true
  }

  function reopenOrder(id, motivo = 'Reapertura para gestión postventa') {
    const orden = orders.find((o) => o.id === id)
    if (!orden) return false

    const estadoAnterior = orden.estado
    updateOrder(
      id,
      {
        estado: 'Postventa',
        reabiertoPor: usuario,
        fechaReapertura: formatearFecha(),
      },
      crearEvento(`Orden reabierta por ${usuario} a etapa Postventa`, usuario, 'En proceso', false, {
        estadoAnterior,
        nuevoEstado: 'Postventa',
        motivo,
      })
    )

    notify(`La orden ${id} ha sido reabierta a Postventa.`, 'aviso')
    return true
  }

  // ---------------- Clonación de órdenes para reimpresión (Requerimiento Funcional) ----------------
  function cloneOrder(id, motivo = 'Reimpresión o reposición de producto') {
    const ordenOriginal = orders.find((o) => o.id === id)
    if (!ordenOriginal) return null

    const nuevoNumero = orders.length + 1
    const nuevoId = `ORD-2024-${String(nuevoNumero).padStart(3, '0')}`
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
    return nuevoId
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

  const actions = {
    addRequest,
    sendToValidation,
    returnRequest,
    rejectRequest,
    validateRequest,
    advanceStage,
    registerDelivery,
    designNewVersion,
    designSend,
    designApprove,
    designReject,
    taskAction,
    addTaskNote,
    assignTask,
    updateTaskProgress,
    sendCommMessage,
    createCase,
    updateCase,
    closeOrder,
    reopenOrder,
    cloneOrder,
    addUser,
    updateUser,
    toggleUserStatus,
    notify,
  }

  const props = { data, actions, irA, role, order: selectedOrder, usuarioActual: currentUser }

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

  // Pantalla de inicio de sesión si no hay usuario autenticado (HU-02)
  if (!currentUser) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ToastStack toasts={toasts} onClose={cerrarToast} />
      </>
    )
  }

  return (
    <div className={`app${sidebarColapsado ? ' app-sidebar-collapsed' : ''}`}>
      <Sidebar
        role={role}
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
          role={role}
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
          <div key={`${role}-${page.name}-${page.orderId || ''}`} className="page-transition">
            {renderPage()}
          </div>
        </main>
      </div>
      <ToastStack toasts={toasts} onClose={cerrarToast} />
    </div>
  )
}
