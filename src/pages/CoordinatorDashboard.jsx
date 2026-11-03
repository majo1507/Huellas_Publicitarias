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

// COORDINADOR DE PRODUCCIÓN: control general, asignación de responsables, plazos, presupuesto e inventario
export default function CoordinatorDashboard({ data, actions, irA }) {
  const [filtroSupervision, setFiltroSupervision] = useState('todas')
  const [busquedaOrden, setBusquedaOrden] = useState('')
  const [ordenCoordinando, setOrdenCoordinando] = useState(null)

  // Estados del modal de coordinación de orden y equipo
  const [disenadorSel, setDisenadorSel] = useState('')
  const [responsableSel, setResponsableSel] = useState('')
  const [presupuestoEdit, setPresupuestoEdit] = useState(0)
  const [costoEdit, setCostoEdit] = useState(0)
  const [fechaEntregaEdit, setFechaEntregaEdit] = useState('')

  // Sub-formulario para agregar una nueva actividad a la orden desde el panel del coordinador
  const [nuevaActividadNombre, setNuevaActividadNombre] = useState('')
  const [nuevaActividadDesc, setNuevaActividadDesc] = useState('')
  const [nuevaActividadInst, setNuevaActividadInst] = useState('')
  const [nuevaActividadEtapa, setNuevaActividadEtapa] = useState('Impresión')
  const [nuevaActividadResp, setNuevaActividadResp] = useState('Pedro Morales')
  const [nuevaActividadPrioridad, setNuevaActividadPrioridad] = useState('Media')
  const [nuevaActividadFecha, setNuevaActividadFecha] = useState('')

  // Modal directo para asignar una actividad desde el panel del coordinador
  const [modalAsignarDirecto, setModalAsignarDirecto] = useState(false)
  const [ordenDirectaId, setOrdenDirectaId] = useState('')
  const [errorActividad, setErrorActividad] = useState('')

  const activas = data.orders.filter(estaActiva)
  const retrasadas = activas.filter(estaRetrasada)
  const alertas = activas.filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
  const bloqueadas = activas.filter((o) => puedeAvanzar(o).bloqueada && o.estado === 'Aprobación')
  const porValidar = data.requests.filter((s) => s.estado === 'En validación').length
  const tareasAbiertas = data.tasks.filter((t) => t.estado !== 'Finalizada')
  const enProduccion = activas.filter((o) => ['Impresión', 'Acabados'].includes(o.estado)).length
  const proximas = activas
    .filter((o) => diasParaEntrega(o) >= 0 && diasParaEntrega(o) <= 7)
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  const inventario = data.inventory || []
  const materialesCriticos = inventario.filter((m) => Number(m.stockActual) <= Number(m.stockMinimo))

  const presupuestoTotalOrdenes = data.orders.reduce((acc, o) => acc + (Number(o.presupuesto) || 0), 0)
  const costoInternoTotalOrdenes = data.orders.reduce((acc, o) => acc + (Number(o.costoInterno) || 0), 0)

  const porEtapa = ETAPAS.slice(1, 6).map((etapa) => ({
    label: etapa,
    value: activas.filter((o) => o.estado === etapa).length,
  }))

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

  const responsables = [...new Set(['Pedro Morales', 'María López', ...OPERARIOS])].map((nombre) => ({
    nombre,
    ordenes: activas.filter((o) => o.responsable === nombre || o.disenador === nombre).length,
    tareas: tareasAbiertas.filter((t) => t.responsable === nombre).length,
  }))

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
    setPresupuestoEdit(Number(orden.presupuesto || 0))
    setCostoEdit(Number(orden.costoInterno || 0))
    setFechaEntregaEdit(orden.fechaEntrega || '')
    setNuevaActividadNombre('')
    setNuevaActividadDesc('')
    setNuevaActividadInst('')
    setNuevaActividadEtapa(orden.estado === 'Diseño' ? 'Diseño' : 'Impresión')
    setNuevaActividadResp('Pedro Morales')
    setNuevaActividadPrioridad('Media')
    setNuevaActividadFecha(orden.fechaEntrega || '10/10/2026')
    setErrorActividad('')
  }

  function abrirModalAsignarDirecto() {
    const primera = activas[0] || data.orders[0]
    setOrdenDirectaId(primera?.id || '')
    setNuevaActividadNombre('')
    setNuevaActividadDesc('')
    setNuevaActividadInst('')
    setNuevaActividadEtapa('Impresión')
    setNuevaActividadResp('Pedro Morales')
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

  const ordenesSupervision = data.orders.filter((o) => {
    if (filtroSupervision === 'activas' && !estaActiva(o)) return false
    if (filtroSupervision === 'retrasadas' && !estaRetrasada(o)) return false
    if (filtroSupervision === 'riesgo' && !estaEnRiesgo(o)) return false
    if (filtroSupervision === 'entregadas' && estaActiva(o)) return false
    if (busquedaOrden.trim()) {
      const q = busquedaOrden.toLowerCase()
      const texto = `${o.id} ${o.cliente} ${o.producto} ${o.responsable} ${o.disenador} ${o.estado} ${o.material}`.toLowerCase()
      if (!texto.includes(q)) return false
    }
    return true
  })

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
        etiqueta="CONTROL OPERATIVO · PLANTA GRÁFICA"
        titulo="Panel del Coordinador de Producción"
        subtitulo="Supervisión de órdenes, asignación de responsables, control de vencimientos, costos e inventario."
        icono="home"
        acciones={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => irA('inventario')}>
              <Icon nombre="package" tamano={16} /> Inventario ({inventario.length})
            </button>
            <button className="btn" onClick={() => irA('tareas')}>
              <Icon nombre="list" tamano={16} /> Actividades
            </button>
            <button
              className="btn btn-soft"
              onClick={() => {
                generarReporteInventarioPDF(data)
                actions?.notify?.('Informe de inventario y materiales (PDF) descargado.', 'exito')
              }}
            >
              <Icon nombre="download" tamano={16} /> Informe de inventario (PDF)
            </button>
            <button className="btn btn-primary" onClick={() => irA('produccion')}>
              <Icon nombre="columns" tamano={16} /> Tablero de producción
            </button>
          </div>
        }
      />

      {bloqueadas.length > 0 && (
        <div className="prod-gate-alerts">
          {bloqueadas.map((o) => (
            <Alert
              key={o.id}
              tipo="bloqueo"
              titulo={`${o.id} no puede pasar a impresión`}
              accion={<button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver orden</button>}
            >
              El diseño aún no ha sido aprobado por el cliente.
            </Alert>
          ))}
        </div>
      )}

      {materialesCriticos.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Alert
            tipo="aviso"
            titulo={`Alerta de inventario: ${materialesCriticos.length} insumo(s) en nivel crítico o agotado`}
            accion={
              <button className="btn btn-sm" onClick={() => irA('inventario')}>
                Revisar inventario
              </button>
            }
          >
            Materiales por reabastecer:{' '}
            {materialesCriticos.map((m) => `${m.nombre} (${m.stockActual} ${m.unidad})`).join(' · ')}.
          </Alert>
        </div>
      )}

      {/* BLOQUE 1: Cabina de mando — Jerarquía de indicadores + Distribución por etapa */}
      <div className="prod-command-deck">
        <div className="prod-kpi-cluster">
          <div className="prod-kpi-primary">
            <StatCard
              variante="hero"
              titulo="Órdenes activas"
              valor={activas.length}
              icono="clipboard"
              detalle="En flujo operativo de planta"
              onClick={() => irA('pedidos')}
            />
            <StatCard
              variante="featured"
              titulo="Trabajos en producción"
              valor={enProduccion}
              icono="printer"
              detalle="En máquinas de impresión y acabados"
              onClick={() => irA('produccion')}
            />
          </div>

          <div className="prod-kpi-secondary kpis">
            <StatCard
              titulo="Órdenes retrasadas"
              valor={retrasadas.length}
              icono="alert-triangle"
              color={retrasadas.length ? 'rojo' : 'azul'}
              detalle="Atención prioritaria"
              onClick={() => setFiltroSupervision('retrasadas')}
            />
            <StatCard
              titulo="Órdenes en riesgo"
              valor={activas.filter(estaEnRiesgo).length}
              icono="clock"
              color="amarillo"
              detalle="Entrega próxima"
              onClick={() => setFiltroSupervision('riesgo')}
            />
            <StatCard
              variante="compacta"
              titulo="Solicitudes por validar"
              valor={porValidar}
              icono="inbox"
              color={porValidar ? 'amarillo' : 'azul'}
              detalle="Revisión técnica"
              onClick={() => irA('solicitudes')}
            />
            <StatCard
              variante="compacta"
              titulo="Alertas de stock"
              valor={materialesCriticos.length}
              icono="package"
              color={materialesCriticos.length ? 'amarillo' : 'verde'}
              detalle={`${inventario.length} materiales en bodega`}
              onClick={() => irA('inventario')}
            />
          </div>
        </div>

        <Panel
          etiqueta="FLUJO EN PLANTA"
          titulo="Órdenes activas por etapa"
          subtitulo="Distribución actual entre preprensa, taller y despacho"
          icono="layers"
          className="prod-stage-panel"
        >
          <DonutChart
            subtitulo="activas"
            items={porEtapa.map((e, i) => ({ ...e, color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i] }))}
          />
        </Panel>
      </div>

      {/* NUEVO BLOQUE CENTRAL DEL COORDINADOR: Supervisión integral de órdenes, responsables, plazos, presupuesto e insumos */}
      <Panel
        etiqueta="ORGANIZACIÓN Y SUPERVISIÓN DE PLANTA"
        titulo="Control de órdenes, asignación de equipo, plazos y presupuesto"
        subtitulo={`Presupuesto total estimado: ${formatoCOP(presupuestoTotalOrdenes)} · Costos internos asociados: ${formatoCOP(costoInternoTotalOrdenes)}`}
        icono="clipboard"
        style={{ marginBottom: '22px' }}
        accion={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-soft btn-sm" onClick={() => irA('inventario')}>
              <Icon nombre="package" tamano={14} /> Consultar inventario
            </button>
            <button className="btn btn-primary btn-sm" onClick={abrirModalAsignarDirecto}>
              <Icon nombre="plus" tamano={14} /> Asignar actividad a operario
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
            <strong>Estado de actividades en taller ({data.tasks.length}):</strong>
          </span>
          <div className="row" style={{ gap: '12px', flexWrap: 'wrap' }}>
            <span className="sm">
              Pendientes: <strong>{contarTareas('Pendiente')}</strong>
            </span>
            <span className="sm">
              En proceso: <strong>{contarTareas('En proceso')}</strong>
            </span>
            <span className="sm">
              Pausadas: <strong>{contarTareas('Pausada')}</strong>
            </span>
            <span className="sm">
              Finalizadas: <strong>{contarTareas('Finalizada')}</strong>
            </span>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div className="chips" style={{ marginBottom: 0 }}>
            <button className={filtroSupervision === 'todas' ? 'chip active' : 'chip'} onClick={() => setFiltroSupervision('todas')}>
              Todas ({data.orders.length})
            </button>
            <button className={filtroSupervision === 'activas' ? 'chip active' : 'chip'} onClick={() => setFiltroSupervision('activas')}>
              Activas ({activas.length})
            </button>
            <button className={filtroSupervision === 'retrasadas' ? 'chip active' : 'chip'} onClick={() => setFiltroSupervision('retrasadas')}>
              Retrasadas ({retrasadas.length})
            </button>
            <button className={filtroSupervision === 'riesgo' ? 'chip active' : 'chip'} onClick={() => setFiltroSupervision('riesgo')}>
              En riesgo ({activas.filter(estaEnRiesgo).length})
            </button>
            <button className={filtroSupervision === 'entregadas' ? 'chip active' : 'chip'} onClick={() => setFiltroSupervision('entregadas')}>
              Entregadas / Cerradas ({data.orders.length - activas.length})
            </button>
          </div>

          <input
            type="search"
            placeholder="Filtrar por orden, cliente, responsable o material..."
            value={busquedaOrden}
            onChange={(e) => setBusquedaOrden(e.target.value)}
            style={{ minWidth: '250px', maxWidth: '340px' }}
          />
        </div>

        <div className="table-wrap">
          <table className="table table-plain">
            <thead>
              <tr>
                <th>Orden / Cliente</th>
                <th>Estado y avance</th>
                <th>Equipo asignado (Diseño y Planta)</th>
                <th>Actividades y responsables</th>
                <th>Inicio, entrega y vencimiento</th>
                <th>Presupuesto y costos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenesSupervision.map((o) => {
                const tareasOrden = data.tasks.filter((t) => t.ordenId === o.id)
                const retrasada = estaRetrasada(o)
                const enRiesgo = estaEnRiesgo(o)
                const stockRef = consultarStockMaterialOrden(o)
                const stockBajo = stockRef && Number(stockRef.stockActual) <= Number(stockRef.stockMinimo)

                return (
                  <tr key={o.id}>
                    <td>
                      <button className="link-inline" onClick={() => irA('detalle', o.id)}>
                        <strong>{o.id}</strong>
                      </button>
                      <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{o.cliente}</div>
                      <small className="cell-sub">
                        {o.producto} ({o.cantidad} uds) · {o.material}
                      </small>
                      {stockRef && (
                        <small
                          className="cell-sub"
                          style={{
                            color: stockBajo ? 'var(--state-amber-text)' : 'var(--state-green-text)',
                            fontWeight: 600,
                          }}
                        >
                          Stock bodega: {stockRef.stockActual} {stockRef.unidad}
                          {stockBajo ? ' (Stock bajo)' : ' (Disponible)'}
                        </small>
                      )}
                    </td>

                    <td style={{ minWidth: '135px' }}>
                      <StatusBadge estado={o.estado === 'Entrega' ? 'Entregado' : o.estado} />
                      <div style={{ marginTop: '6px' }}>
                        <ProgressBar valor={progreso(o)} />
                      </div>
                    </td>

                    <td>
                      <div className="sm" style={{ marginBottom: '4px' }}>
                        <span className="mut">Diseño: </span>
                        <strong>{o.disenador || 'María López'}</strong>
                      </div>
                      <div className="sm">
                        <span className="mut">Planta: </span>
                        <strong>{o.responsable}</strong>
                      </div>
                    </td>

                    <td style={{ maxWidth: '240px' }}>
                      {tareasOrden.length === 0 ? (
                        <span className="sm mut">Sin actividades específicas</span>
                      ) : (
                        <div className="stack" style={{ gap: '3px' }}>
                          {tareasOrden.slice(0, 3).map((t) => (
                            <div key={t.id} className="sm" style={{ fontSize: '11.5px' }}>
                              • <strong>{t.actividad}</strong>:{' '}
                              <span className="mut">{t.responsable}</span> ({t.estado})
                            </div>
                          ))}
                          {tareasOrden.length > 3 && (
                            <small className="cell-sub">+{tareasOrden.length - 3} actividad(es) más</small>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="sm">
                        <span className="mut">Inicio:</span> {o.fechaSolicitud}
                      </div>
                      <div className="sm">
                        <span className="mut">Entrega:</span> <strong>{o.fechaEntrega}</strong>
                      </div>
                      <small
                        className={`cell-sub ${retrasada ? 'text-rojo' : enRiesgo ? 'text-amarillo' : ''}`}
                        style={{ fontWeight: retrasada || enRiesgo ? 700 : 500 }}
                      >
                        {textoPlazo(o)}
                      </small>
                    </td>

                    <td>
                      <div>
                        <strong>{formatoCOP(o.presupuesto)}</strong>
                      </div>
                      <small className="cell-sub">
                        Costo int.: {formatoCOP(o.costoInterno)}
                      </small>
                    </td>

                    <td>
                      <div className="row" style={{ gap: '5px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => abrirModalCoordinar(o)}
                          title="Asignar diseñador, operarios, actividades y presupuesto"
                        >
                          <Icon nombre="users" tamano={13} /> Coordinar
                        </button>
                        <button
                          className="btn btn-soft btn-sm"
                          onClick={() => {
                            generarReporteOrdenPDF(o, data)
                            actions?.notify?.(`Reporte PDF de ${o.id} descargado.`, 'exito')
                          }}
                          title={`Descargar reporte PDF de la orden ${o.id}`}
                        >
                          <Icon nombre="download" tamano={13} /> PDF
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => irA('detalle', o.id)}
                          title="Abrir expediente completo"
                        >
                          <Icon nombre="eye" tamano={13} />
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

      {/* BLOQUE 2: Cadencia semanal + Monitor de alertas de entrega */}
      <div className="prod-analytics-deck">
        <Panel
          etiqueta="CADENCIA SEMANAL"
          titulo="Órdenes recibidas y entregadas por semana"
          subtitulo="Comparativa de ingreso comercial frente a despachos completados"
          icono="trending-up"
        >
          <ColumnChart datos={serieSemanal(data.orders)} />
        </Panel>

        <Panel
          etiqueta="SUPERVISIÓN DE PLAZOS"
          titulo="Alertas de entrega y retrasos"
          subtitulo="Órdenes fuera de fecha o en ventana crítica de vencimiento"
          icono="alert-triangle"
        >
          {alertas.length === 0 ? (
            <EmptyState icono="check-circle" titulo="Sin alertas" texto="Ninguna orden está retrasada ni en riesgo." />
          ) : (
            <ul className="alert-list">
              {alertas.map((o) => (
                <li key={o.id} className={estaRetrasada(o) ? 'alert-row alert-row-rojo' : 'alert-row alert-row-amarillo'}>
                  <div className="alert-row-main">
                    <strong>{o.id} · {o.producto}</strong>
                    <span className="muted">{o.cliente} · Inicio {o.fechaSolicitud} · Entrega {o.fechaEntrega} · {textoPlazo(o)}</span>
                  </div>
                  <span className="alert-row-end">
                    <StatusBadge estado={o.estado} />
                    <Avatar nombre={o.responsable} tamano="sm" />
                    <button className="btn btn-sm" onClick={() => abrirModalCoordinar(o)}>Coordinar</button>
                    <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* BLOQUE 3: Capacidad del equipo, Despachos próximos y Trazabilidad en vivo */}
      <div className="prod-operations-deck">
        <Panel
          etiqueta="CAPACIDAD OPERATIVA"
          titulo="Carga por responsable"
          subtitulo="Órdenes asignadas y tareas activas por integrante"
          icono="users"
        >
          <BarChart items={responsables.map((r) => ({ label: r.nombre, value: r.ordenes + r.tareas }))} />
          <table className="table table-plain compact">
            <thead><tr><th>Responsable</th><th>Órdenes</th><th>Tareas</th></tr></thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.nombre}>
                  <td><span className="person"><Avatar nombre={r.nombre} tamano="xs" /> {r.nombre}</span></td>
                  <td>{r.ordenes}</td>
                  <td>{r.tareas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          etiqueta="AGENDA DE DESPACHO"
          titulo="Entregas próximas (7 días)"
          subtitulo="Compromisos de entrega en la semana en curso"
          icono="truck"
          accion={<button className="btn btn-ghost btn-sm" onClick={() => irA('entregas')}>Ver entregas</button>}
        >
          {proximas.length === 0 ? <EmptyState icono="truck" titulo="Sin entregas próximas" /> : (
            <table className="table table-plain">
              <thead><tr><th>Orden</th><th>Cliente</th><th>Etapa</th><th>Entrega</th></tr></thead>
              <tbody>
                {proximas.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.id}</strong></td>
                    <td>{o.cliente}</td>
                    <td><StatusBadge estado={o.estado} /></td>
                    <td>{o.fechaEntrega}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          etiqueta="BITÁCORA DE PLANTA"
          titulo="Actividad reciente"
          subtitulo="Últimos eventos registrados en las órdenes"
          icono="activity"
        >
          <ActivityFeed orders={data.orders} limite={6} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>

      {/* MODAL DE COORDINACIÓN INTEGRAL DE ORDEN: ASIGNAR EQUIPO, ACTIVIDADES, PLAZOS, PRESUPUESTO E INVENTARIO */}
      {ordenModalActual && (
        <div className="modal-backdrop" onClick={() => setOrdenCoordinando(null)}>
          <div
            className="modal"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Coordinar orden ${ordenModalActual.id}`}
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="users" tamano={20} />
              </span>
              <div>
                <h2>Coordinar orden {ordenModalActual.id}</h2>
                <p>
                  {ordenModalActual.cliente} · {ordenModalActual.producto} ({ordenModalActual.cantidad} uds) · Etapa: {ordenModalActual.estado}
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

              {/* Formulario principal: Asignación de diseñador, operario/responsable, plazos y costos */}
              <form onSubmit={handleGuardarCoordinacion} noValidate>
                <h4 style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                  1. Responsables principales, plazos y presupuesto de la orden
                </h4>
                <div className="form-grid">
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
                    <label className="field-label" htmlFor="coordCosto">Costo interno estimado (COP)</label>
                    <input
                      id="coordCosto"
                      type="number"
                      min="0"
                      value={costoEdit}
                      onChange={(e) => setCostoEdit(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label">Fecha de inicio</label>
                    <input value={ordenModalActual.fechaSolicitud} disabled />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="coordFechaEntrega">Fecha de entrega ({textoPlazo(ordenModalActual)})</label>
                    <input
                      id="coordFechaEntrega"
                      value={fechaEntregaEdit}
                      onChange={(e) => setFechaEntregaEdit(e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <Icon nombre="check" tamano={14} /> Guardar equipo, plazos y costos
                  </button>
                </div>
              </form>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '18px 0' }} />

              {/* Sección 2: Responsables por actividad específica dentro de la orden */}
              <h4 style={{ fontSize: '13.5px', margin: '0 0 10px' }}>
                2. Responsables por actividad de esta orden ({tareasOrdenModal.length})
              </h4>

              {tareasOrdenModal.length === 0 ? (
                <p className="sm mut" style={{ marginBottom: '12px' }}>
                  Esta orden aún no tiene actividades específicas desglosadas. Agrega una actividad abajo para asignar un operario o diseñador.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginBottom: '14px' }}>
                  <table className="table table-plain compact">
                    <thead>
                      <tr>
                        <th>Actividad</th>
                        <th>Etapa</th>
                        <th>Responsable asignado</th>
                        <th>Fecha límite</th>
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
                  + Asignar nueva actividad en la orden {ordenModalActual.id}
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
                      placeholder="Ej. Impresión lona, Laminado UV, Corte..."
                      value={nuevaActividadNombre}
                      onChange={(e) => {
                        setNuevaActividadNombre(e.target.value)
                        setErrorActividad('')
                      }}
                    />
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
                      <Icon nombre="check" tamano={14} /> Confirmar asignación
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
                <p>Selecciona la orden relacionada, el responsable (ej. Pedro Morales) y las instrucciones.</p>
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
                    value={nuevaActividadNombre}
                    onChange={(e) => {
                      setNuevaActividadNombre(e.target.value)
                      setErrorActividad('')
                    }}
                    placeholder="Ej. Impresión de pendones, Troquelado de cajas, Empaque..."
                    autoFocus
                  />
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
