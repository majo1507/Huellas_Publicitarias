import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ColumnChart from '../components/ColumnChart.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import Alert from '../components/Alert.jsx'
import Avatar from '../components/Avatar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Icon from '../components/Icon.jsx'
import { ETAPAS, OPERARIOS } from '../data/mockData.js'
import { ACTIVIDADES_TALLER_POR_ETAPA } from '../data/catalogos.js'
import {
  diasParaEntrega,
  estaActiva,
  estaRetrasada,
  estaEnRiesgo,
  puedeAvanzar,
  serieSemanal,
  textoPlazo,
  formatoCOP,
  progreso,
} from '../utils/format.js'
import { generarReporteOrdenPDF, generarReporteInventarioPDF } from '../utils/pdfReport.js'

// CABINA DE PLANIFICACIÓN Y SUPERVISIÓN — COORDINACIÓN DE PRODUCCIÓN (HUELLAS PUBLICIDAD S.A.S.)
// Seis pilares operativos:
// 1. Planificación y programación  2. Prioridades  3. Asignación de personal
// 4. Inventario y materiales       5. Costos       6. Supervisión (avances, carga, incidencias y cuellos de botella)
export default function CoordinatorDashboard({ data, actions, irA }) {
  const [filtroSupervision, setFiltroSupervision] = useState('todas')
  const [busquedaOrden, setBusquedaOrden] = useState('')
  const [ordenCoordinando, setOrdenCoordinando] = useState(null)
  const [pestañaPrincipal, setPestañaPrincipal] = useState('control') // 'control' | 'capacidad' | 'costos_inventario' | 'cronograma'
  const [paginaOrdenes, setPaginaOrdenes] = useState(1)
  const [expandirBloqueadas, setExpandirBloqueadas] = useState(false)
  const POR_PAGINA_ORDENES = 6

  // Estados del modal de planificación y coordinación de orden
  const [disenadorSel, setDisenadorSel] = useState('')
  const [responsableSel, setResponsableSel] = useState('')
  const [prioridadEdit, setPrioridadEdit] = useState('Media')
  const [presupuestoEdit, setPresupuestoEdit] = useState(0)
  const [costoEdit, setCostoEdit] = useState(0)
  const [fechaEntregaEdit, setFechaEntregaEdit] = useState('')

  // Sub-formulario para programar una nueva actividad en la orden
  const [nuevaActividadNombre, setNuevaActividadNombre] = useState('')
  const [nuevaActividadDesc, setNuevaActividadDesc] = useState('')
  const [nuevaActividadInst, setNuevaActividadInst] = useState('')
  const [nuevaActividadEtapa, setNuevaActividadEtapa] = useState('Impresión')
  const [nuevaActividadResp, setNuevaActividadResp] = useState('Pedro Morales')
  const [nuevaActividadPrioridad, setNuevaActividadPrioridad] = useState('Media')
  const [nuevaActividadFecha, setNuevaActividadFecha] = useState('')

  // Modal directo para asignar una actividad desde la cabina
  const [modalAsignarDirecto, setModalAsignarDirecto] = useState(false)
  const [ordenDirectaId, setOrdenDirectaId] = useState('')
  const [errorActividad, setErrorActividad] = useState('')

  // Estado para resolver incidencias técnicas de taller desde supervisión
  const [resolviendoIncidencia, setResolviendoIncidencia] = useState(null) // { taskId, index, actividad, ordenId, texto }
  const [solucionIncidencia, setSolucionIncidencia] = useState('')

  const activas = data.orders.filter(estaActiva)
  const retrasadas = activas.filter(estaRetrasada)
  const enRiesgoList = activas.filter(estaEnRiesgo)
  const urgentes = activas.filter((o) => (o.prioridad || 'Media') === 'Alta' || estaRetrasada(o))
  const alertas = activas.filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
  const bloqueadas = activas.filter((o) => puedeAvanzar(o).bloqueada && o.estado === 'Aprobación')

  const tareasConIncidencias = (data.tasks || []).filter((t) =>
    (t.incidencias || []).some((inc) => !inc?.resuelto && !inc?.resuelta)
  )
  const incidenciasTaller = (data.tasks || []).reduce((acc, t) => {
    const pend = (t.incidencias || []).filter((inc) => !inc?.resuelto && !inc?.resuelta).length
    return acc + pend
  }, 0)

  const tareasAbiertas = data.tasks.filter((t) => t.estado !== 'Finalizada')
  const enProduccion = activas.filter((o) => ['Impresión', 'Acabados', 'Despacho'].includes(o.estado)).length
  const proximas = activas
    .filter((o) => diasParaEntrega(o) >= 0 && diasParaEntrega(o) <= 7)
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  const inventario = data.inventory || []
  const materialesCriticos = inventario.filter((m) => Number(m.stockActual) <= Number(m.stockMinimo))

  const presupuestoTotalOrdenes = data.orders.reduce((acc, o) => acc + (Number(o.presupuesto) || 0), 0)
  const costoInternoTotalOrdenes = data.orders.reduce((acc, o) => acc + (Number(o.costoInterno) || 0), 0)
  const ordenesSobrecosto = data.orders.filter(
    (o) => Number(o.presupuesto) > 0 && Number(o.costoInterno) > Number(o.presupuesto) * 0.85
  )

  const porEtapa = ETAPAS.slice(1, 6).map((etapa) => ({
    label: etapa,
    value: activas.filter((o) => o.estado === etapa).length,
  }))

  // Detección real de cuello de botella por concentración de órdenes o tareas pausadas
  const etapaCuelloBotella = [...porEtapa].sort((a, b) => b.value - a.value)[0]

  const usuariosEquipo = data.users?.length
    ? data.users.filter((u) => u.estado === 'Activo' && u.rol !== 'Cliente')
    : []

  const listaDisenadores = usuariosEquipo.some((u) => u.rol === 'Diseñador')
    ? usuariosEquipo.filter((u) => u.rol === 'Diseñador' || u.rol === 'Coordinador').map((u) => u.nombre)
    : ['María López', 'Carlos Gómez']

  const listaOperarios = [
    ...new Set([
      'Pedro Morales',
      ...OPERARIOS,
      ...usuariosEquipo.map((u) => u.nombre),
      'María López',
      'Carlos Gómez',
    ]),
  ]

  const responsables = [...new Set(['Pedro Morales', 'María López', ...OPERARIOS])].map((nombre) => {
    const ordAsig = activas.filter((o) => o.responsable === nombre || o.disenador === nombre).length
    const tarAct = tareasAbiertas.filter((t) => t.responsable === nombre).length
    const tarFin = data.tasks.filter((t) => t.responsable === nombre && t.estado === 'Finalizada').length
    return {
      nombre,
      ordenes: ordAsig,
      tareas: tarAct,
      finalizadas: tarFin,
      cargaTotal: ordAsig + tarAct,
    }
  })

  const contarTareas = (est) => data.tasks.filter((t) => t.estado === est).length

  // Verifica en el inventario si el material requerido por la orden tiene stock disponible
  function consultarStockMaterialOrden(orden) {
    if (!orden?.material || inventario.length === 0) return null
    const matLower = orden.material.toLowerCase()
    const encontrado = inventario.find(
      (m) =>
        m.nombre.toLowerCase().includes(matLower) ||
        matLower.includes(m.nombre.toLowerCase().split(' ')[0])
    )
    return encontrado || inventario[0]
  }

  function abrirModalCoordinar(orden) {
    setOrdenCoordinando(orden)
    setDisenadorSel(orden.disenador || 'María López')
    setResponsableSel(orden.responsable || 'Pedro Morales')
    setPrioridadEdit(orden.prioridad || (estaRetrasada(orden) ? 'Alta' : 'Media'))
    setPresupuestoEdit(Number(orden.presupuesto || 0))
    setCostoEdit(Number(orden.costoInterno || 0))
    setFechaEntregaEdit(orden.fechaEntrega || '')
    setNuevaActividadNombre('')
    setNuevaActividadDesc('')
    setNuevaActividadInst('')
    setNuevaActividadEtapa(orden.estado === 'Diseño' ? 'Diseño' : 'Impresión')
    setNuevaActividadResp(orden.responsable || 'Pedro Morales')
    setNuevaActividadPrioridad(orden.prioridad || 'Media')
    setNuevaActividadFecha(orden.fechaEntrega || '10/10/2026')
    setErrorActividad('')
  }

  function abrirModalAsignarDirecto(responsablePreseleccionado = 'Pedro Morales') {
    const primera = activas[0] || data.orders[0]
    setOrdenDirectaId(primera?.id || '')
    setNuevaActividadNombre('')
    setNuevaActividadDesc('')
    setNuevaActividadInst('')
    setNuevaActividadEtapa('Impresión')
    setNuevaActividadResp(typeof responsablePreseleccionado === 'string' ? responsablePreseleccionado : 'Pedro Morales')
    setNuevaActividadPrioridad('Media')
    setNuevaActividadFecha(primera?.fechaEntrega || '10/10/2026')
    setErrorActividad('')
    setModalAsignarDirecto(true)
  }

  function handleGuardarCoordinacion(e) {
    e.preventDefault()
    if (!ordenCoordinando) return
    actions?.assignOrderTeam?.(ordenCoordinando.id, {
      disenador: disenadorSel,
      responsable: responsableSel,
      prioridad: prioridadEdit,
      presupuesto: Number(presupuestoEdit) || 0,
      costoInterno: Number(costoEdit) || 0,
      fechaEntrega: fechaEntregaEdit.trim() || ordenCoordinando.fechaEntrega,
    })
    setOrdenCoordinando(null)
  }

  function handleAgregarActividadAOrden(e) {
    e.preventDefault()
    if (!ordenCoordinando || !nuevaActividadNombre.trim()) {
      setErrorActividad('Ingresa el nombre de la actividad a asignar.')
      return
    }
    actions?.createTask?.({
      ordenId: ordenCoordinando.id,
      actividad: nuevaActividadNombre.trim(),
      descripcion: nuevaActividadDesc.trim(),
      instrucciones: nuevaActividadInst.trim(),
      etapa: nuevaActividadEtapa,
      responsable: nuevaActividadResp || 'Pedro Morales',
      prioridad: nuevaActividadPrioridad,
      fechaLimite: nuevaActividadFecha.trim() || ordenCoordinando.fechaEntrega,
    })
    setNuevaActividadNombre('')
    setNuevaActividadDesc('')
    setNuevaActividadInst('')
    setErrorActividad('')
  }

  function handleGuardarAsignacionDirecta(e) {
    e.preventDefault()
    if (!ordenDirectaId || !nuevaActividadNombre.trim()) {
      setErrorActividad('Selecciona la orden de producción e ingresa el nombre de la actividad.')
      return
    }
    const ordRef = data.orders.find((o) => o.id === ordenDirectaId)
    actions?.createTask?.({
      ordenId: ordenDirectaId,
      actividad: nuevaActividadNombre.trim(),
      descripcion: nuevaActividadDesc.trim(),
      instrucciones: nuevaActividadInst.trim(),
      etapa: nuevaActividadEtapa,
      responsable: nuevaActividadResp || 'Pedro Morales',
      prioridad: nuevaActividadPrioridad,
      fechaLimite: nuevaActividadFecha.trim() || ordRef?.fechaEntrega || '10/10/2026',
    })
    setModalAsignarDirecto(false)
  }

  function handleConfirmarResolucionIncidencia(e) {
    e.preventDefault()
    if (!resolviendoIncidencia || !solucionIncidencia.trim()) return
    actions?.resolveTaskIncident?.(
      resolviendoIncidencia.taskId,
      resolviendoIncidencia.index,
      solucionIncidencia.trim()
    )
    setResolviendoIncidencia(null)
    setSolucionIncidencia('')
  }

  const ordenesSupervision = data.orders.filter((o) => {
    if (filtroSupervision === 'activas' && !estaActiva(o)) return false
    if (filtroSupervision === 'urgentes' && !((o.prioridad || 'Media') === 'Alta' || estaRetrasada(o))) return false
    if (filtroSupervision === 'retrasadas' && !estaRetrasada(o)) return false
    if (filtroSupervision === 'riesgo' && !estaEnRiesgo(o)) return false
    if (filtroSupervision === 'incidencias') {
      const tieneInc = (data.tasks || []).some(
        (t) => t.ordenId === o.id && (t.incidencias || []).some((inc) => !inc?.resuelto && !inc?.resuelta)
      )
      if (!tieneInc) return false
    }
    if (filtroSupervision === 'entregadas' && estaActiva(o)) return false
    if (busquedaOrden.trim()) {
      const q = busquedaOrden.toLowerCase()
      const texto = `${o.id} ${o.cliente} ${o.producto} ${o.responsable} ${o.disenador} ${o.estado} ${o.material} ${o.prioridad || ''}`.toLowerCase()
      if (!texto.includes(q)) return false
    }
    return true
  })

  // Paginación compacta de órdenes
  const totalPaginasOrd = Math.max(1, Math.ceil(ordenesSupervision.length / POR_PAGINA_ORDENES))
  const pagActualOrd = Math.min(paginaOrdenes, totalPaginasOrd)
  const ordenesVisibles = ordenesSupervision.slice(
    (pagActualOrd - 1) * POR_PAGINA_ORDENES,
    pagActualOrd * POR_PAGINA_ORDENES
  )

  // Sincronizar orden activa en modal si cambió en data.orders
  const ordenModalActual = ordenCoordinando
    ? data.orders.find((o) => o.id === ordenCoordinando.id) || ordenCoordinando
    : null
  const tareasOrdenModal = ordenModalActual
    ? data.tasks.filter((t) => t.ordenId === ordenModalActual.id)
    : []
  const stockMaterialModal = ordenModalActual ? consultarStockMaterialOrden(ordenModalActual) : null

  return (
    <div className="prod-dashboard">
      <PageHeader
        etiqueta="CABINA DE PLANIFICACIÓN Y SUPERVISIÓN · PLANTA GRÁFICA"
        titulo="Panel de Coordinación de Producción"
        subtitulo="Planificación de órdenes, prioridades, asignación de personal, inventario, control de costos y supervisión automática de taller."
        icono="home"
        acciones={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => irA('pedidos')}>
              <Icon nombre="clipboard" tamano={16} /> Programación de órdenes ({activas.length})
            </button>
            <button className="btn" onClick={() => irA('tareas')}>
              <Icon nombre="list" tamano={16} /> Actividades ({tareasAbiertas.length})
            </button>
            <button className="btn" onClick={() => irA('inventario')}>
              <Icon nombre="package" tamano={16} /> Inventario ({inventario.length})
            </button>
            <button
              className="btn btn-soft"
              onClick={() => {
                generarReporteInventarioPDF(data)
                actions?.notify?.('Informe de inventario y materiales (PDF) descargado.', 'exito')
              }}
            >
              <Icon nombre="download" tamano={16} /> Informe PDF
            </button>
            <button className="btn btn-primary" onClick={() => abrirModalAsignarDirecto()}>
              <Icon nombre="plus" tamano={16} /> Asignar actividad
            </button>
          </div>
        }
      />

      {bloqueadas.length > 0 && (
        <div className="prod-gate-alerts" style={{ marginBottom: '16px' }}>
          <Alert
            tipo="bloqueo"
            titulo={`${bloqueadas.length} orden(es) en espera de aprobación comercial de diseño antes de pasar a impresión`}
            accion={
              <button
                className="btn btn-sm"
                onClick={() => setExpandirBloqueadas((prev) => !prev)}
                title="Mostrar u ocultar listado de órdenes con control automático de aprobación"
              >
                {expandirBloqueadas ? 'Ocultar listado' : `Ver órdenes (${bloqueadas.length})`}
              </button>
            }
          >
            Control automático ORVEX: el sistema verifica la aprobación del cliente gestionada por Comercial antes de habilitar impresión.
            {expandirBloqueadas && (
              <div className="row" style={{ gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {bloqueadas.map((o) => (
                  <button
                    key={o.id}
                    className="btn btn-soft btn-xs"
                    onClick={() => irA('detalle', o.id)}
                    style={{ fontSize: '11.5px', padding: '3px 8px' }}
                    title={`Consultar trazabilidad de ${o.id}`}
                  >
                    <Icon nombre="lock" tamano={12} /> {o.id} · {o.cliente}
                  </button>
                ))}
              </div>
            )}
          </Alert>
        </div>
      )}

      {materialesCriticos.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Alert
            tipo="aviso"
            titulo={`Alerta de materiales faltantes / críticos: ${materialesCriticos.length} insumo(s) por debajo del mínimo`}
            accion={
              <button className="btn btn-sm" onClick={() => irA('inventario')}>
                Gestionar inventario
              </button>
            }
          >
            Insumos requeridos para producción:{' '}
            {materialesCriticos.map((m) => `${m.nombre} (${m.stockActual} ${m.unidad} / mín. ${m.stockMinimo})`).join(' · ')}.
          </Alert>
        </div>
      )}

      {/* BLOQUE 1: CABINA DE MANDO — INDICADORES CLAVE + FLUJO POR ETAPA Y CUELLO DE BOTELLA */}
      <div className="prod-command-deck">
        <div className="prod-kpi-cluster">
          <div className="prod-kpi-primary">
            <StatCard
              variante="hero"
              titulo="Órdenes programadas activas"
              valor={activas.length}
              icono="clipboard"
              detalle={`${enProduccion} en ejecución de planta`}
              onClick={() => irA('pedidos')}
            />
            <StatCard
              variante="featured"
              titulo="Prioridad alta y urgentes"
              valor={urgentes.length}
              icono="zap"
              detalle="Atención preferente en programación"
              onClick={() => {
                setPestañaPrincipal('control')
                setFiltroSupervision('urgentes')
                setPaginaOrdenes(1)
              }}
            />
          </div>

          <div className="prod-kpi-secondary kpis">
            <StatCard
              titulo="Órdenes retrasadas"
              valor={retrasadas.length}
              icono="alert-triangle"
              color={retrasadas.length ? 'rojo' : 'azul'}
              detalle={`${enRiesgoList.length} en riesgo de vencimiento`}
              onClick={() => {
                setPestañaPrincipal('control')
                setFiltroSupervision('retrasadas')
                setPaginaOrdenes(1)
              }}
            />
            <StatCard
              titulo="Actividades activas"
              valor={tareasAbiertas.length}
              icono="list"
              color="azul"
              detalle={`${contarTareas('Finalizada')} finalizadas por operarios`}
              onClick={() => irA('tareas')}
            />
            <StatCard
              variante="compacta"
              titulo="Incidencias en taller"
              valor={incidenciasTaller}
              icono="alert-triangle"
              color={incidenciasTaller > 0 ? 'rojo' : 'verde'}
              detalle={incidenciasTaller > 0 ? 'Requieren resolución técnica' : 'Flujo sin bloqueos'}
              onClick={() => setPestañaPrincipal('cronograma')}
            />
            <StatCard
              variante="compacta"
              titulo="Insumos críticos"
              valor={materialesCriticos.length}
              icono="package"
              color={materialesCriticos.length ? 'amarillo' : 'verde'}
              detalle={`Costo interno: ${formatoCOP(costoInternoTotalOrdenes)}`}
              onClick={() => setPestañaPrincipal('costos_inventario')}
            />
          </div>
        </div>

        <Panel
          etiqueta="FLUJO AUTOMÁTICO EN PLANTA"
          titulo="Órdenes activas por etapa"
          subtitulo={
            etapaCuelloBotella && etapaCuelloBotella.value > 0
              ? `Mayor concentración actual: ${etapaCuelloBotella.label} (${etapaCuelloBotella.value} órdenes)`
              : 'Distribución actual entre diseño, taller y despacho'
          }
          icono="layers"
          className="prod-stage-panel"
        >
          <DonutChart
            subtitulo="activas"
            items={porEtapa.map((e, i) => ({
              ...e,
              color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i % 5],
            }))}
          />
        </Panel>
      </div>

      {/* NAVEGACIÓN DE LAS 6 FUNCIONES OPERATIVAS DEL COORDINADOR */}
      <div className="tabs" role="tablist" aria-label="Vistas del panel de coordinación" style={{ marginBottom: '18px' }}>
        <button
          type="button"
          role="tab"
          aria-selected={pestañaPrincipal === 'control'}
          className={pestañaPrincipal === 'control' ? 'on' : ''}
          onClick={() => { setPestañaPrincipal('control'); setPaginaOrdenes(1); }}
        >
          <Icon nombre="clipboard" tamano={15} /> 1. Planificación, prioridades y avance <span className="pill">{ordenesSupervision.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestañaPrincipal === 'capacidad'}
          className={pestañaPrincipal === 'capacidad' ? 'on' : ''}
          onClick={() => setPestañaPrincipal('capacidad')}
        >
          <Icon nombre="users" tamano={15} /> 2. Asignación de personal y carga <span className="pill">{responsables.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestañaPrincipal === 'costos_inventario'}
          className={pestañaPrincipal === 'costos_inventario' ? 'on' : ''}
          onClick={() => setPestañaPrincipal('costos_inventario')}
        >
          <Icon nombre="package" tamano={15} /> 3. Costos e inventario de materiales <span className="pill">{materialesCriticos.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestañaPrincipal === 'cronograma'}
          className={pestañaPrincipal === 'cronograma' ? 'on' : ''}
          onClick={() => setPestañaPrincipal('cronograma')}
        >
          <Icon nombre="activity" tamano={15} /> 4. Supervisión, cuellos de botella e incidencias <span className="pill">{incidenciasTaller + alertas.length}</span>
        </button>
      </div>

      {/* PESTAÑA 1: PLANIFICACIÓN, PRIORIDADES, ASIGNACIÓN Y TRAZABILIDAD */}
      {pestañaPrincipal === 'control' && (
        <>
          <Panel
            etiqueta="PLANIFICACIÓN Y SEGUIMIENTO AUTOMÁTICO DE ÓRDENES"
            titulo="Matriz de programación, prioridades y avance de producción"
            subtitulo="Los operarios ejecutan sus actividades asignadas y ORVEX avanza automáticamente cada etapa al cumplirse las condiciones técnicas."
            icono="clipboard"
            style={{ marginBottom: '22px' }}
            accion={
              <div className="row" style={{ gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {ordenesSupervision.length > POR_PAGINA_ORDENES && (
                  <div className="row" style={{ gap: '4px', alignItems: 'center', marginRight: '6px' }}>
                    <button
                      className="btn btn-ghost btn-xs"
                      disabled={pagActualOrd <= 1}
                      onClick={() => setPaginaOrdenes((p) => Math.max(1, p - 1))}
                      title="Página anterior"
                      style={{ padding: '3px 8px' }}
                    >
                      ◀
                    </button>
                    <span className="sm mut" style={{ fontSize: '11.5px' }}>
                      {pagActualOrd} / {totalPaginasOrd}
                    </span>
                    <button
                      className="btn btn-ghost btn-xs"
                      disabled={pagActualOrd >= totalPaginasOrd}
                      onClick={() => setPaginaOrdenes((p) => Math.min(totalPaginasOrd, p + 1))}
                      title="Página siguiente"
                      style={{ padding: '3px 8px' }}
                    >
                      ▶
                    </button>
                  </div>
                )}
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => irA('pedidos')}
                  title="Abrir programación completa de órdenes"
                >
                  <Icon nombre="clipboard" tamano={14} /> Programación completa
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => abrirModalAsignarDirecto()}
                  title="Crear y asignar actividad operativa a un integrante del taller"
                >
                  <Icon nombre="plus" tamano={14} /> Asignar actividad
                </button>
              </div>
            }
          >
            <div
              className="row"
              style={{
                gap: '10px',
                marginBottom: '12px',
                padding: '8px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-light)',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}
            >
              <span className="sm">
                <strong>Ejecución en tiempo real ({data.tasks.length} actividades):</strong>
              </span>
              <div className="row" style={{ gap: '14px', flexWrap: 'wrap' }}>
                <span className="sm">
                  Pendientes: <strong>{contarTareas('Pendiente')}</strong>
                </span>
                <span className="sm">
                  En proceso: <strong>{contarTareas('En proceso')}</strong>
                </span>
                <span className="sm">
                  Pausadas: <strong>{contarTareas('Pausada')}</strong>
                </span>
                <span className="sm" style={{ color: 'var(--state-green-text)' }}>
                  Finalizadas: <strong>{contarTareas('Finalizada')}</strong>
                </span>
                {incidenciasTaller > 0 && (
                  <span className="sm" style={{ color: 'var(--state-red-text)', fontWeight: 700 }}>
                    Incidencias activas: {incidenciasTaller}
                  </span>
                )}
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <div className="chips" style={{ marginBottom: 0 }}>
                <button
                  className={filtroSupervision === 'todas' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('todas'); setPaginaOrdenes(1); }}
                >
                  Todas ({data.orders.length})
                </button>
                <button
                  className={filtroSupervision === 'activas' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('activas'); setPaginaOrdenes(1); }}
                >
                  Activas ({activas.length})
                </button>
                <button
                  className={filtroSupervision === 'urgentes' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('urgentes'); setPaginaOrdenes(1); }}
                >
                  Prioridad Alta / Urgentes ({urgentes.length})
                </button>
                <button
                  className={filtroSupervision === 'retrasadas' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('retrasadas'); setPaginaOrdenes(1); }}
                >
                  Retrasadas ({retrasadas.length})
                </button>
                <button
                  className={filtroSupervision === 'riesgo' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('riesgo'); setPaginaOrdenes(1); }}
                >
                  En riesgo ({enRiesgoList.length})
                </button>
                {incidenciasTaller > 0 && (
                  <button
                    className={filtroSupervision === 'incidencias' ? 'chip active' : 'chip'}
                    onClick={() => { setFiltroSupervision('incidencias'); setPaginaOrdenes(1); }}
                  >
                    Con incidencias ({tareasConIncidencias.length})
                  </button>
                )}
                <button
                  className={filtroSupervision === 'entregadas' ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSupervision('entregadas'); setPaginaOrdenes(1); }}
                >
                  Entregadas / Cerradas ({data.orders.length - activas.length})
                </button>
              </div>

              <input
                type="search"
                placeholder="Filtrar orden, cliente, material, responsable..."
                value={busquedaOrden}
                onChange={(e) => { setBusquedaOrden(e.target.value); setPaginaOrdenes(1); }}
                style={{ minWidth: '240px', maxWidth: '320px' }}
              />
            </div>

            <div className="table-wrap">
              <table className="table table-plain compact">
                <thead>
                  <tr>
                    <th style={{ width: '175px' }}>Orden / Cliente / Material</th>
                    <th style={{ width: '140px' }}>Prioridad y Compromiso</th>
                    <th style={{ width: '140px' }}>Etapa y Avance</th>
                    <th style={{ width: '140px' }}>Equipo asignado</th>
                    <th style={{ width: '160px' }}>Actividades / Incidencias</th>
                    <th style={{ width: '130px' }}>Presupuesto / Costo</th>
                    <th style={{ width: '165px' }}>Planificación</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenesVisibles.map((o) => {
                    const tareasOrden = data.tasks.filter((t) => t.ordenId === o.id)
                    const tareasFin = tareasOrden.filter((t) => t.estado === 'Finalizada').length
                    const incsOrden = tareasOrden.reduce(
                      (acc, t) => acc + (t.incidencias || []).filter((inc) => !inc?.resuelto && !inc?.resuelta).length,
                      0
                    )
                    const retrasada = estaRetrasada(o)
                    const enRiesgo = estaEnRiesgo(o)
                    const prio = o.prioridad || (retrasada ? 'Alta' : 'Media')
                    const stockRef = consultarStockMaterialOrden(o)
                    const stockBajo = stockRef && Number(stockRef.stockActual) <= Number(stockRef.stockMinimo)
                    const pctOrden = progreso(o)

                    return (
                      <tr key={o.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <button className="link-inline" onClick={() => irA('detalle', o.id)} title="Ver detalle de la orden">
                              <strong style={{ fontSize: '13px' }}>{o.id}</strong>
                            </button>
                            {o.esArteCliente && (
                              <span className="pill" style={{ fontSize: '10px', padding: '1px 5px' }} title="Diseño suministrado por el cliente">
                                Arte cliente
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '1px' }}>{o.cliente}</div>
                          <small
                            className="cell-sub cell-truncate"
                            style={{ display: 'block', maxWidth: '170px', marginTop: '1px', fontSize: '11px' }}
                            title={`${o.producto} (${o.cantidad} uds) · ${o.material}${stockRef ? ` · Stock: ${stockRef.stockActual} ${stockRef.unidad}` : ''}`}
                          >
                            {o.producto} ({o.cantidad}u) · {o.material}
                          </small>
                          {stockBajo && (
                            <small
                              className="cell-sub"
                              style={{ color: 'var(--state-amber-text)', fontWeight: 600, fontSize: '10.5px' }}
                            >
                              Insumo crítico: {stockRef.stockActual} {stockRef.unidad}
                            </small>
                          )}
                        </td>

                        <td>
                          <StatusBadge estado={prio} />
                          <div style={{ fontSize: '11.5px', marginTop: '3px' }}>
                            <strong>{o.fechaEntrega}</strong>
                            <small
                              className={`cell-sub ${retrasada ? 'text-rojo' : enRiesgo ? 'text-amarillo' : ''}`}
                              style={{ display: 'block', fontWeight: retrasada || enRiesgo ? 700 : 500, fontSize: '11px' }}
                            >
                              {textoPlazo(o)}
                            </small>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <StatusBadge estado={o.estado === 'Entrega' ? 'Entregado' : o.estado} />
                            <strong style={{ fontSize: '11px' }}>{pctOrden}%</strong>
                          </div>
                          <div style={{ marginTop: '5px' }}>
                            <ProgressBar valor={pctOrden} />
                          </div>
                        </td>

                        <td>
                          <div style={{ fontSize: '11.5px', lineHeight: '1.4' }}>
                            <div><span className="mut">D: </span><strong>{o.disenador || 'María López'}</strong></div>
                            <div><span className="mut">T: </span><strong>{o.responsable}</strong></div>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>
                              {tareasFin}/{tareasOrden.length} compl.
                            </span>
                            {incsOrden > 0 && (
                              <span
                                className="badge badge-rojo"
                                style={{ fontSize: '10px', padding: '1px 5px' }}
                                title="Incidencias técnicas reportadas por operarios"
                              >
                                {incsOrden} inc.
                              </span>
                            )}
                          </div>
                          <div
                            className="cell-truncate mut"
                            style={{ fontSize: '11px', maxWidth: '155px' }}
                            title={tareasOrden.map((t) => `${t.actividad} (${t.responsable || 'Taller'})`).join(', ')}
                          >
                            {tareasOrden.length === 0
                              ? 'Sin actividades'
                              : tareasOrden.map((t) => t.actividad).slice(0, 2).join(', ') + (tareasOrden.length > 2 ? ` (+${tareasOrden.length - 2})` : '')}
                          </div>
                        </td>

                        <td>
                          <strong style={{ fontSize: '12.5px' }}>{formatoCOP(o.presupuesto)}</strong>
                          <small
                            className="cell-sub"
                            style={{
                              display: 'block',
                              fontSize: '11px',
                              marginTop: '2px',
                              color:
                                Number(o.presupuesto) > 0 && Number(o.costoInterno) > Number(o.presupuesto)
                                  ? 'var(--state-red-text)'
                                  : undefined,
                              fontWeight:
                                Number(o.presupuesto) > 0 && Number(o.costoInterno) > Number(o.presupuesto)
                                  ? 700
                                  : undefined,
                            }}
                          >
                            Costo: {formatoCOP(o.costoInterno)}
                          </small>
                        </td>

                        <td>
                          <div className="row-actions" style={{ gap: '4px', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => abrirModalCoordinar(o)}
                              title="Programar fechas, prioridad, personal, actividades y costos"
                            >
                              <Icon nombre="sliders" tamano={12} /> Planificar
                            </button>
                            <button
                              className="btn btn-soft btn-xs"
                              onClick={() => irA('detalle', o.id)}
                              title={`Consultar expediente y trazabilidad completa de ${o.id}`}
                            >
                              <Icon nombre="eye" tamano={12} /> Trazabilidad
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => {
                                generarReporteOrdenPDF(o, data)
                                actions?.notify?.(`Reporte PDF de ${o.id} descargado.`, 'exito')
                              }}
                              title={`Descargar orden de producción ${o.id} en PDF`}
                            >
                              <Icon nombre="download" tamano={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            etiqueta="TRAZABILIDAD EN TIEMPO REAL"
            titulo="Historial reciente de movimientos en planta"
            subtitulo="Bitácora auditable de planificación, ejecución de operarios y transiciones automáticas de etapa"
            icono="activity"
          >
            <ActivityFeed orders={data.orders} limite={6} onAbrir={(id) => irA('detalle', id)} />
          </Panel>
        </>
      )}

      {/* PESTAÑA 2: ASIGNACIÓN DE PERSONAL Y CARGA DE TRABAJO */}
      {pestañaPrincipal === 'capacidad' && (
        <div className="prod-operations-deck">
          <Panel
            etiqueta="CAPACIDAD Y ASIGNACIÓN DE PERSONAL"
            titulo="Carga de trabajo por diseñador y operario"
            subtitulo="Distribución actual de órdenes y actividades operativas en planta"
            icono="users"
            accion={
              <button className="btn btn-primary btn-sm" onClick={() => abrirModalAsignarDirecto()}>
                <Icon nombre="plus" tamano={14} /> Asignar actividad
              </button>
            }
          >
            <BarChart items={responsables.map((r) => ({ label: r.nombre, value: r.cargaTotal }))} />
            <table className="table table-plain compact" style={{ marginTop: '14px' }}>
              <thead>
                <tr>
                  <th>Integrante del equipo</th>
                  <th>Órdenes activas</th>
                  <th>Actividades en curso</th>
                  <th>Finalizadas</th>
                  <th>Nivel de carga</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {responsables.map((r) => {
                  const nivel =
                    r.cargaTotal >= 6 ? 'Alta carga' : r.cargaTotal >= 3 ? 'Carga óptima' : 'Disponible'
                  const colorBadge =
                    r.cargaTotal >= 6 ? 'Pausada' : r.cargaTotal >= 3 ? 'En proceso' : 'Completado'
                  return (
                    <tr key={r.nombre}>
                      <td>
                        <span className="person">
                          <Avatar nombre={r.nombre} tamano="xs" /> <strong>{r.nombre}</strong>
                        </span>
                      </td>
                      <td>{r.ordenes}</td>
                      <td>{r.tareas}</td>
                      <td>{r.finalizadas}</td>
                      <td>
                        <StatusBadge estado={colorBadge} texto={nivel} />
                      </td>
                      <td>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={() => abrirModalAsignarDirecto(r.nombre)}
                        >
                          <Icon nombre="plus" tamano={12} /> Asignar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>

          <Panel
            etiqueta="EJECUCIÓN DE OPERARIOS"
            titulo="Balance de actividades en taller"
            subtitulo={`${data.tasks.length} actividades totales registradas en el flujo productivo`}
            icono="list"
            accion={
              <button className="btn btn-soft btn-sm" onClick={() => irA('tareas')}>
                Abrir módulo de actividades
              </button>
            }
          >
            <div className="stack" style={{ gap: '10px' }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <span>Pendientes por iniciar:</span>
                <strong>{contarTareas('Pendiente')}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <span>En ejecución en estación de trabajo:</span>
                <strong>{contarTareas('En proceso')}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <span>Pausadas / En revisión técnica:</span>
                <strong>{contarTareas('Pausada')}</strong>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <span>Finalizadas (avance automático habilitado):</span>
                <strong style={{ color: 'var(--state-green-text)' }}>{contarTareas('Finalizada')}</strong>
              </div>
              <div
                style={{
                  marginTop: '6px',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)',
                  background: 'var(--surface)',
                }}
              >
                <div className="sm" style={{ fontWeight: 700, marginBottom: '4px' }}>
                  Detección de cuellos de botella por etapa
                </div>
                <p className="sm mut" style={{ margin: 0 }}>
                  {etapaCuelloBotella && etapaCuelloBotella.value > 0
                    ? `La etapa de ${etapaCuelloBotella.label} concentra actualmente ${etapaCuelloBotella.value} orden(es) activa(s). Revisa la asignación de operarios para balancear la línea.`
                    : 'No se detectan acumulaciones críticas en las etapas de producción.'}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* PESTAÑA 3: COSTOS E INVENTARIO DE MATERIALES */}
      {pestañaPrincipal === 'costos_inventario' && (
        <div className="prod-operations-deck">
          <Panel
            etiqueta="SUPERVISIÓN DE COSTOS DE PRODUCCIÓN"
            titulo="Control de presupuestos y costos internos"
            subtitulo={`Presupuesto total: ${formatoCOP(presupuestoTotalOrdenes)} · Costo interno acumulado: ${formatoCOP(costoInternoTotalOrdenes)}`}
            icono="dollar-sign"
          >
            <div
              className="row"
              style={{
                gap: '12px',
                marginBottom: '14px',
                padding: '10px 12px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <span className="sm">
                Margen bruto estimado:{' '}
                <strong style={{ color: 'var(--state-green-text)' }}>
                  {formatoCOP(Math.max(0, presupuestoTotalOrdenes - costoInternoTotalOrdenes))}
                </strong>
              </span>
              <span className="sm">
                Órdenes con costo interno elevado (&gt;85%):{' '}
                <strong style={{ color: ordenesSobrecosto.length > 0 ? 'var(--state-amber-text)' : undefined }}>
                  {ordenesSobrecosto.length}
                </strong>
              </span>
            </div>

            <div className="table-wrap">
              <table className="table table-plain compact">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Producto / Material</th>
                    <th>Presupuesto</th>
                    <th>Costo interno</th>
                    <th>Relación costo</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 8).map((o) => {
                    const pres = Number(o.presupuesto) || 0
                    const cost = Number(o.costoInterno) || 0
                    const ratio = pres > 0 ? Math.round((cost / pres) * 100) : 0
                    const alertaCosto = ratio > 85
                    return (
                      <tr key={o.id}>
                        <td>
                          <button className="link-inline" onClick={() => irA('detalle', o.id)}>
                            <strong>{o.id}</strong>
                          </button>
                          <small className="cell-sub">{o.cliente}</small>
                        </td>
                        <td>
                          {o.producto}
                          <small className="cell-sub">{o.material}</small>
                        </td>
                        <td><strong>{formatoCOP(pres)}</strong></td>
                        <td>{formatoCOP(cost)}</td>
                        <td>
                          <span
                            className="sm"
                            style={{
                              fontWeight: 700,
                              color: ratio > 100 ? 'var(--state-red-text)' : alertaCosto ? 'var(--state-amber-text)' : 'var(--state-green-text)',
                            }}
                          >
                            {ratio}%
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-soft btn-xs" onClick={() => abrirModalCoordinar(o)}>
                            Ajustar costos
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            etiqueta="INVENTARIO Y MATERIALES DE PLANTA"
            titulo={`Existencias y materiales críticos (${materialesCriticos.length} alertas)`}
            subtitulo="Consulta rápida de sustratos, tintas e insumos requeridos por las órdenes"
            icono="package"
            accion={
              <button className="btn btn-primary btn-sm" onClick={() => irA('inventario')}>
                Abrir bodega de inventario
              </button>
            }
          >
            {inventario.length === 0 ? (
              <EmptyState icono="package" titulo="Sin materiales registrados" />
            ) : (
              <div className="table-wrap">
                <table className="table table-plain compact">
                  <thead>
                    <tr>
                      <th>Insumo / Material</th>
                      <th>Disponible</th>
                      <th>Mínimo</th>
                      <th>Costo unit.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map((m) => {
                      const critico = Number(m.stockActual) <= Number(m.stockMinimo)
                      return (
                        <tr key={m.id}>
                          <td>
                            <strong>{m.nombre}</strong>
                            <small className="cell-sub">{m.categoria || 'Insumo gráfico'}</small>
                          </td>
                          <td>
                            <strong>{m.stockActual} {m.unidad}</strong>
                          </td>
                          <td>{m.stockMinimo} {m.unidad}</td>
                          <td>{formatoCOP(m.costoUnitario)}</td>
                          <td>
                            <StatusBadge
                              estado={critico ? 'Retrasada' : 'Completado'}
                              texto={critico ? 'Faltante / Reponer' : 'Disponible'}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* PESTAÑA 4: SUPERVISIÓN DE PLAZOS, INCIDENCIAS Y CUELLOS DE BOTELLA */}
      {pestañaPrincipal === 'cronograma' && (
        <div className="prod-analytics-deck">
          <Panel
            etiqueta="INCIDENCIAS TÉCNICAS Y CUELLOS DE BOTELLA"
            titulo={`Incidencias activas reportadas por operarios (${incidenciasTaller})`}
            subtitulo="Atención y desbloqueo de novedades técnicas registradas desde las estaciones de trabajo"
            icono="alert-triangle"
            accion={
              <button className="btn btn-soft btn-sm" onClick={() => irA('tareas')}>
                Ver actividades de taller
              </button>
            }
          >
            {tareasConIncidencias.length === 0 ? (
              <EmptyState
                icono="check-circle"
                titulo="Sin incidencias técnicas activas"
                texto="Todas las estaciones de trabajo operan sin bloqueos reportados."
              />
            ) : (
              <ul className="alert-list">
                {tareasConIncidencias.map((t) => {
                  const incIdx = (t.incidencias || []).findIndex((inc) => !inc?.resuelto && !inc?.resuelta)
                  const incObj = t.incidencias?.[incIdx]
                  return (
                    <li key={t.id} className="alert-row alert-row-rojo">
                      <div className="alert-row-main">
                        <strong>{t.ordenId} · {t.actividad} ({t.etapa})</strong>
                        <span className="muted">
                          Responsable: {t.responsable} · Reporte: «{incObj?.texto || 'Novedad técnica en taller'}» ({incObj?.fecha || ''})
                        </span>
                      </div>
                      <span className="alert-row-end">
                        <StatusBadge estado={t.estado} />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setResolviendoIncidencia({
                              taskId: t.id,
                              index: incIdx >= 0 ? incIdx : 0,
                              actividad: t.actividad,
                              ordenId: t.ordenId,
                              texto: incObj?.texto || '',
                            })
                            setSolucionIncidencia('')
                          }}
                        >
                          Resolver incidencia
                        </button>
                        <button className="btn btn-sm" onClick={() => irA('detalle', t.ordenId)}>
                          Orden
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel
            etiqueta="SUPERVISIÓN DE FECHAS COMPROMETIDAS"
            titulo="Alertas de entrega y retrasos"
            subtitulo="Órdenes fuera de fecha comprometida o en ventana crítica de vencimiento"
            icono="clock"
          >
            {alertas.length === 0 ? (
              <EmptyState icono="check-circle" titulo="Sin retrasos ni alertas" texto="Todas las órdenes activas cumplen el cronograma comprometido." />
            ) : (
              <ul className="alert-list">
                {alertas.map((o) => (
                  <li key={o.id} className={estaRetrasada(o) ? 'alert-row alert-row-rojo' : 'alert-row alert-row-amarillo'}>
                    <div className="alert-row-main">
                      <strong>{o.id} · {o.producto}</strong>
                      <span className="muted">
                        {o.cliente} · Prioridad: {o.prioridad || 'Media'} · Compromiso: {o.fechaEntrega} · {textoPlazo(o)}
                      </span>
                    </div>
                    <span className="alert-row-end">
                      <StatusBadge estado={o.estado} />
                      <Avatar nombre={o.responsable} tamano="sm" />
                      <button className="btn btn-sm" onClick={() => abrirModalCoordinar(o)}>Reprogramar</button>
                      <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Trazabilidad</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            etiqueta="CADENCIA SEMANAL DE PLANTA"
            titulo="Órdenes programadas vs. finalizadas por semana"
            subtitulo="Comparativa de carga recibida frente a órdenes completadas"
            icono="trending-up"
          >
            <ColumnChart datos={serieSemanal(data.orders)} />
          </Panel>
        </div>
      )}

      {/* MODAL DE RESOLUCIÓN DE INCIDENCIA TÉCNICA */}
      {resolviendoIncidencia && (
        <div className="modal-backdrop" onClick={() => setResolviendoIncidencia(null)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="check-circle" tamano={20} />
              </span>
              <div>
                <h2>Resolver incidencia técnica ({resolviendoIncidencia.ordenId})</h2>
                <p>Actividad: {resolviendoIncidencia.actividad}</p>
              </div>
              <button className="icon-btn" onClick={() => setResolviendoIncidencia(null)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>
            <form onSubmit={handleConfirmarResolucionIncidencia} className="modal-body">
              <div className="ban am" style={{ marginBottom: '12px' }}>
                <Icon nombre="alert-triangle" tamano={16} />
                <span>Reporte del operario: <strong>{resolviendoIncidencia.texto}</strong></span>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="solIncCoord">Acción correctiva o solución aplicada *</label>
                <textarea
                  id="solIncCoord"
                  rows={3}
                  required
                  value={solucionIncidencia}
                  onChange={(e) => setSolucionIncidencia(e.target.value)}
                  placeholder="Describe el ajuste de material, máquina o reprogramación aplicada..."
                  autoFocus
                />
              </div>
              <div className="modal-foot" style={{ marginTop: '16px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setResolviendoIncidencia(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Marcar incidencia resuelta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PLANIFICACIÓN INTEGRAL DE ORDEN: PRIORIDAD, EQUIPO, ACTIVIDADES, PLAZOS, COSTOS E INVENTARIO */}
      {ordenModalActual && (
        <div className="modal-backdrop" onClick={() => setOrdenCoordinando(null)}>
          <div
            className="modal"
            style={{ maxWidth: '740px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Planificar orden ${ordenModalActual.id}`}
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="sliders" tamano={20} />
              </span>
              <div>
                <h2>Planificar y coordinar orden {ordenModalActual.id}</h2>
                <p>
                  {ordenModalActual.cliente} · {ordenModalActual.producto} ({ordenModalActual.cantidad} uds) · Etapa actual: {ordenModalActual.estado} ({progreso(ordenModalActual)}%)
                </p>
              </div>
              <button className="icon-btn" onClick={() => setOrdenCoordinando(null)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>

            <div className="modal-body">
              {/* Verificación de disponibilidad de material en bodega antes de programar */}
              {stockMaterialModal && (
                <div
                  className={`ban ${Number(stockMaterialModal.stockActual) <= Number(stockMaterialModal.stockMinimo) ? 'am' : 'ban-verde'}`}
                  style={{ marginBottom: '16px' }}
                >
                  <Icon nombre="package" tamano={18} />
                  <div style={{ flex: 1 }}>
                    <strong>Disponibilidad en inventario para «{ordenModalActual.material}»:</strong>
                    <div className="sm" style={{ marginTop: '2px' }}>
                      Insumo asociado: <strong>{stockMaterialModal.nombre}</strong> ({stockMaterialModal.id}) · Disponible:{' '}
                      <strong>{stockMaterialModal.stockActual} {stockMaterialModal.unidad}</strong> · Stock mínimo:{' '}
                      {stockMaterialModal.stockMinimo} {stockMaterialModal.unidad} · Costo unitario:{' '}
                      {formatoCOP(stockMaterialModal.costoUnitario)}.
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => { setOrdenCoordinando(null); irA('inventario') }}>
                    Ver bodega
                  </button>
                </div>
              )}

              {/* Formulario principal: Prioridad, Asignación de diseñador, operario/responsable, plazos y costos */}
              <form onSubmit={handleGuardarCoordinacion} noValidate>
                <h4 style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                  1. Programación de fechas, prioridad, personal asignado y costos
                </h4>
                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="coordPrioridad">Prioridad operativa</label>
                    <select
                      id="coordPrioridad"
                      value={prioridadEdit}
                      onChange={(e) => setPrioridadEdit(e.target.value)}
                    >
                      <option value="Alta">Alta (Urgente / Prioritaria)</option>
                      <option value="Media">Media (Programación estándar)</option>
                      <option value="Baja">Baja (Flexible)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordFechaEntrega">Fecha comprometida ({textoPlazo(ordenModalActual)})</label>
                    <input
                      id="coordFechaEntrega"
                      value={fechaEntregaEdit}
                      onChange={(e) => setFechaEntregaEdit(e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordDisenador">Diseñador(a) asignado(a)</label>
                    <select
                      id="coordDisenador"
                      value={disenadorSel}
                      onChange={(e) => setDisenadorSel(e.target.value)}
                    >
                      {[...new Set([...listaDisenadores, disenadorSel])].filter(Boolean).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordOperario">Responsable operativo / taller</label>
                    <select
                      id="coordOperario"
                      value={responsableSel}
                      onChange={(e) => setResponsableSel(e.target.value)}
                    >
                      {[...new Set([...listaOperarios, responsableSel])].filter(Boolean).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordPresupuesto">Presupuesto estimado (COP)</label>
                    <input
                      id="coordPresupuesto"
                      type="number"
                      min="0"
                      value={presupuestoEdit}
                      onChange={(e) => setPresupuestoEdit(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordCosto">Costo interno de producción (COP)</label>
                    <input
                      id="coordCosto"
                      type="number"
                      min="0"
                      value={costoEdit}
                      onChange={(e) => setCostoEdit(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Icon nombre="check" tamano={14} /> Guardar planificación, personal y costos
                  </button>
                </div>
              </form>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '18px 0' }} />

              {/* Sección 2: Responsables por actividad específica dentro de la orden */}
              <h4 style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                2. Actividades programadas en esta orden ({tareasOrdenModal.length})
              </h4>

              {tareasOrdenModal.length === 0 ? (
                <p className="sm mut" style={{ marginBottom: '12px' }}>
                  Esta orden aún no tiene actividades específicas desglosadas. Programa una actividad abajo para asignarla a un operario o diseñador.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginBottom: '14px' }}>
                  <table className="table table-plain compact">
                    <thead>
                      <tr>
                        <th>Actividad</th>
                        <th>Etapa</th>
                        <th>Operario / Responsable</th>
                        <th>Fecha límite</th>
                        <th>Avance</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tareasOrdenModal.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <strong>{t.actividad}</strong>
                            {t.descripcion && <small className="cell-sub">{t.descripcion}</small>}
                            {t.instrucciones && (
                              <small className="cell-sub" style={{ color: 'var(--blue-600)' }}>
                                Instrucciones: {t.instrucciones}
                              </small>
                            )}
                          </td>
                          <td>{t.etapa}</td>
                          <td>
                            <select
                              className="inline-select"
                              value={t.responsable}
                              onChange={(e) => actions.assignTask(t.id, e.target.value)}
                            >
                              {[...new Set([...listaOperarios, t.responsable])].map((nom) => (
                                <option key={nom} value={nom}>{nom}</option>
                              ))}
                            </select>
                          </td>
                          <td>{t.fechaLimite}</td>
                          <td><strong>{t.pct ?? 0}%</strong></td>
                          <td><StatusBadge estado={t.estado} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-formulario completo para asignar una nueva actividad a la orden */}
              <form
                onSubmit={handleAgregarActividadAOrden}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div className="sm" style={{ fontWeight: 700, marginBottom: '8px' }}>
                  + Programar nueva actividad en la orden {ordenModalActual.id}
                </div>
                {errorActividad && (
                  <div className="ban rd" style={{ marginBottom: '8px' }}>
                    <Icon nombre="alert-triangle" tamano={14} /> <span>{errorActividad}</span>
                  </div>
                )}
                <div className="form-grid" style={{ gap: '8px' }}>
                  <div className="field">
                    <label className="field-label">Nombre de la actividad *</label>
                    <input
                      list="sug-actividades-coord-sub"
                      placeholder="Ej. Impresión lona, Laminado UV, Corte..."
                      value={nuevaActividadNombre}
                      onChange={(e) => {
                        setNuevaActividadNombre(e.target.value)
                        setErrorActividad('')
                      }}
                    />
                    <datalist id="sug-actividades-coord-sub">
                      {(ACTIVIDADES_TALLER_POR_ETAPA[nuevaActividadEtapa] || []).map((sug) => (
                        <option key={sug} value={sug} />
                      ))}
                    </datalist>
                  </div>
                  <div className="field">
                    <label className="field-label">Responsable asignado *</label>
                    <select value={nuevaActividadResp} onChange={(e) => setNuevaActividadResp(e.target.value)}>
                      {listaOperarios.map((nom) => (
                        <option key={nom} value={nom}>{nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Etapa</label>
                    <select value={nuevaActividadEtapa} onChange={(e) => setNuevaActividadEtapa(e.target.value)}>
                      <option value="Diseño">Diseño</option>
                      <option value="Impresión">Impresión</option>
                      <option value="Acabados">Acabados</option>
                      <option value="Despacho">Despacho</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Prioridad</label>
                    <select value={nuevaActividadPrioridad} onChange={(e) => setNuevaActividadPrioridad(e.target.value)}>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Fecha límite</label>
                    <input
                      placeholder="DD/MM/AAAA"
                      value={nuevaActividadFecha}
                      onChange={(e) => setNuevaActividadFecha(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Descripción</label>
                    <input
                      placeholder="Descripción del trabajo a realizar..."
                      value={nuevaActividadDesc}
                      onChange={(e) => setNuevaActividadDesc(e.target.value)}
                    />
                  </div>
                  <div className="field full" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="field-label">Instrucciones operativas</label>
                      <input
                        placeholder="Instrucciones específicas para el operario..."
                        value={nuevaActividadInst}
                        onChange={(e) => setNuevaActividadInst(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', height: '36px' }}>
                      <Icon nombre="check" tamano={14} /> Confirmar actividad
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  const idAbrir = ordenModalActual.id
                  setOrdenCoordinando(null)
                  irA('historial', idAbrir)
                }}
              >
                <Icon nombre="activity" tamano={15} /> Ver historial completo ({ordenModalActual.historial?.length || 0})
              </button>
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  generarReporteOrdenPDF(ordenModalActual, data)
                  actions?.notify?.(`Orden de producción ${ordenModalActual.id} (PDF) descargada.`, 'exito')
                }}
              >
                <Icon nombre="download" tamano={15} /> Orden de producción (PDF)
              </button>
              <button type="button" className="btn" onClick={() => setOrdenCoordinando(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIRECTO DE ASIGNACIÓN DE ACTIVIDAD DESDE EL PANEL DEL COORDINADOR */}
      {modalAsignarDirecto && (
        <div className="modal-backdrop" onClick={() => setModalAsignarDirecto(false)}>
          <div
            className="modal"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Asignar actividad a operario"
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="plus" tamano={20} />
              </span>
              <div>
                <h2>Asignar actividad de producción</h2>
                <p>Selecciona la orden relacionada, el responsable operativo y las instrucciones técnicas.</p>
              </div>
              <button className="icon-btn" onClick={() => setModalAsignarDirecto(false)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>
            <form onSubmit={handleGuardarAsignacionDirecta} className="modal-body" noValidate>
              {errorActividad && (
                <div className="ban rd" style={{ marginBottom: '12px' }}>
                  <Icon nombre="alert-triangle" tamano={15} /> <span>{errorActividad}</span>
                </div>
              )}
              <div className="form-grid">
                <div className="field full">
                  <label className="field-label" htmlFor="dirOrden">Orden relacionada *</label>
                  <select
                    id="dirOrden"
                    value={ordenDirectaId}
                    onChange={(e) => {
                      const idSel = e.target.value
                      setOrdenDirectaId(idSel)
                      const ordObj = data.orders.find((o) => o.id === idSel)
                      if (ordObj?.fechaEntrega) setNuevaActividadFecha(ordObj.fechaEntrega)
                    }}
                  >
                    {data.orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} · {o.cliente} — {o.producto} ({o.estado})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="dirResp">Responsable asignado *</label>
                  <select id="dirResp" value={nuevaActividadResp} onChange={(e) => setNuevaActividadResp(e.target.value)}>
                    {listaOperarios.map((nom) => (
                      <option key={nom} value={nom}>{nom}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="dirEtapa">Etapa</label>
                  <select id="dirEtapa" value={nuevaActividadEtapa} onChange={(e) => setNuevaActividadEtapa(e.target.value)}>
                    <option value="Diseño">Diseño</option>
                    <option value="Impresión">Impresión</option>
                    <option value="Acabados">Acabados</option>
                    <option value="Despacho">Despacho</option>
                  </select>
                </div>
                <div className="field full">
                  <label className="field-label" htmlFor="dirNombre">Nombre de la actividad *</label>
                  <input
                    id="dirNombre"
                    list="sug-actividades-coord-dir"
                    value={nuevaActividadNombre}
                    onChange={(e) => {
                      setNuevaActividadNombre(e.target.value)
                      setErrorActividad('')
                    }}
                    placeholder="Ej. Selecciona una sugerencia o escribe la actividad..."
                    autoFocus
                  />
                  <datalist id="sug-actividades-coord-dir">
                    {(ACTIVIDADES_TALLER_POR_ETAPA[nuevaActividadEtapa] || []).map((sug) => (
                      <option key={sug} value={sug} />
                    ))}
                  </datalist>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {(ACTIVIDADES_TALLER_POR_ETAPA[nuevaActividadEtapa] || []).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="btn btn-soft btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                        onClick={() => {
                          setNuevaActividadNombre(sug)
                          setErrorActividad('')
                        }}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field full">
                  <label className="field-label" htmlFor="dirDesc">Descripción</label>
                  <input
                    id="dirDesc"
                    value={nuevaActividadDesc}
                    onChange={(e) => setNuevaActividadDesc(e.target.value)}
                    placeholder="Descripción detallada del trabajo a realizar..."
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="dirPrio">Prioridad</label>
                  <select id="dirPrio" value={nuevaActividadPrioridad} onChange={(e) => setNuevaActividadPrioridad(e.target.value)}>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="dirFecha">Fecha límite</label>
                  <input
                    id="dirFecha"
                    value={nuevaActividadFecha}
                    onChange={(e) => setNuevaActividadFecha(e.target.value)}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
                <div className="field full">
                  <label className="field-label" htmlFor="dirInst">Instrucciones</label>
                  <textarea
                    id="dirInst"
                    rows={2}
                    value={nuevaActividadInst}
                    onChange={(e) => setNuevaActividadInst(e.target.value)}
                    placeholder="Instrucciones técnicas y de control de calidad para el operario..."
                  />
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalAsignarDirecto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Confirmar asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
