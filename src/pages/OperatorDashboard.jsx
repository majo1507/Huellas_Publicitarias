import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'

const FILTROS = [
  ['Activas de hoy', 'activas'],
  ['Pendientes', 'Pendiente'],
  ['En proceso', 'En proceso'],
  ['Pausadas', 'Pausada'],
  ['Finalizadas', 'Finalizada'],
  ['Todas', 'todas'],
]

// OPERARIO: interfaz centrada en sus tareas asignadas en planta (ej. Pedro Morales)
export default function OperatorDashboard({ data, actions, usuarioActual }) {
  const nombre = usuarioActual?.nombre || usuarioActual?.nombre_completo || ROLES.operario.usuario.nombre
  // Una tarea es mía si me pertenece por id (owner_id); el nombre solo se usa si no hay propietario
  const idUsuario = usuarioActual?.uuid || usuarioActual?.dbId || usuarioActual?.id
  const misTareas = (data?.tasks || []).filter((t) => {
    if (idUsuario && t.owner_id && (t.owner_id === idUsuario || t.owner_id === usuarioActual?.uuid)) return true
    return t.responsable === nombre || (usuarioActual?.nombre_completo && t.responsable === usuarioActual.nombre_completo)
  })

  // Filtro por defecto en "activas" para enfocar la jornada en tareas operativas
  const [filtro, setFiltro] = useState('activas')
  // Selector de vista: 'lista' (planilla compacta) o 'tarjetas' (tarjetas táctiles)
  const [vista, setVista] = useState('lista')
  // Modal abierto: { id: 'T-001', tipo: 'notas' | 'incidencias' } o null
  const [modal, setModal] = useState(null)
  // Modal de resolución de incidencia: { id: 'T-001', index: number } o null
  const [modalResolver, setModalResolver] = useState(null)
  // Modal de consulta de instrucciones técnicas completas: tarea o null
  const [tareaInstrucciones, setTareaInstrucciones] = useState(null)
  // Tareas con detalles expandidos (en vista tarjetas): { [tareaId]: boolean }
  const [detallesExpandidos, setDetallesExpandidos] = useState({})

  const toggleDetalle = (tareaId) => {
    setDetallesExpandidos((prev) => ({ ...prev, [tareaId]: !prev[tareaId] }))
  }

  const contar = (estado) => misTareas.filter((t) => t.estado === estado).length
  const activasCount = misTareas.filter((t) => t.estado !== 'Finalizada').length

  const orden = (ordenId) => (data?.orders || []).find((o) => o.id === ordenId || o.codigo === ordenId || String(o.dbId) === String(ordenId))

  // Filtrado de la lista
  const lista = misTareas.filter((t) => {
    if (filtro === 'activas') return t.estado !== 'Finalizada'
    if (filtro === 'todas') return true
    return t.estado === filtro
  })

  const avance = { Pendiente: 0, 'En proceso': 50, Pausada: 50, Finalizada: 100 }

  return (
    <div>
      <PageHeader
        etiqueta="ESTACIÓN DE TALLER · EJECUCIÓN EN PLANTA"
        titulo="Mis tareas de planta"
        subtitulo={`Actividades operativas asignadas a ${nombre}.`}
        icono="list"
      />

      {/* 4 Indicadores clave de la estación con filtrado directo */}
      <div className="kpis">
        <StatCard
          titulo="Activas de hoy"
          valor={activasCount}
          icono="activity"
          color="azul"
          detalle={`${misTareas.length} tareas totales asignadas`}
          onClick={() => setFiltro('activas')}
        />
        <StatCard
          titulo="En proceso en máquina"
          valor={contar('En proceso')}
          icono="play"
          color="azul"
          detalle="Trabajo en curso en mi turno"
          onClick={() => setFiltro('En proceso')}
        />
        <StatCard
          titulo="Pendientes en estación"
          valor={contar('Pendiente')}
          icono="clock"
          color={contar('Pendiente') > 0 ? 'amarillo' : 'azul'}
          detalle="En cola de trabajo de hoy"
          onClick={() => setFiltro('Pendiente')}
        />
        <StatCard
          titulo="Finalizadas"
          valor={contar('Finalizada')}
          icono="check-circle"
          color="verde"
          detalle={`${contar('Pausada')} pausada(s)`}
          onClick={() => setFiltro('Finalizada')}
        />
      </div>

      {/* FILTROS Y SELECTOR DE VISTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
        <div className="tabs" role="tablist" aria-label="Filtrar mis tareas por estado" style={{ margin: 0 }}>
          {FILTROS.map(([texto, valor]) => {
            const conteo =
              valor === 'activas'
                ? activasCount
                : valor === 'todas'
                ? misTareas.length
                : contar(valor)

            return (
              <button
                key={texto}
                type="button"
                role="tab"
                aria-selected={filtro === valor}
                className={filtro === valor ? 'on' : ''}
                onClick={() => setFiltro(valor)}
              >
                {texto} <span className="pill">{conteo}</span>
              </button>
            )
          })}
        </div>

        {/* SELECTOR DE MODO DE VISTA: PLANILLA COMPACTA VS TARJETAS TÁCTILES */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--surface-sunken)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
          role="group"
          aria-label="Selector de visualización"
        >
          <button
            type="button"
            className={`btn btn-xs ${vista === 'lista' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setVista('lista')}
            title="Vista compacta de alta densidad para consultar y ejecutar múltiples actividades"
          >
            <Icon nombre="list" tamano={13} /> Planilla compacta
          </button>
          <button
            type="button"
            className={`btn btn-xs ${vista === 'tarjetas' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '5px 11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setVista('tarjetas')}
            title="Vista en tarjetas grandes ideal para pantallas táctiles de taller"
          >
            <Icon nombre="grid" tamano={13} /> Tarjetas táctiles
          </button>
        </div>
      </div>

      {lista.length === 0 && (
        <div className="card">
          <EmptyState
            icono="check-circle"
            titulo="No hay tareas en esta vista"
            texto="Selecciona otro filtro o consulta la vista de tareas activas."
            accion={
              filtro !== 'activas' && (
                <button className="btn btn-sm" onClick={() => setFiltro('activas')}>
                  Ver tareas activas de hoy
                </button>
              )
            }
          />
        </div>
      )}

      {/* VISTA 1: PLANILLA COMPACTA DE ALTA DENSIDAD */}
      {lista.length > 0 && vista === 'lista' && (
        <div className="table-wrap table-card-flush" style={{ marginBottom: '24px' }}>
          <table className="table table-plain compact">
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Orden / Cliente</th>
                <th>Actividad / Especificaciones</th>
                <th style={{ width: '120px' }}>Prioridad</th>
                <th style={{ width: '160px' }}>Estado y Avance</th>
                <th style={{ width: '115px' }}>Límite</th>
                <th style={{ width: '140px' }}>Incidencias</th>
                <th style={{ width: '220px' }}>Acciones operativas</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => {
                const finalizada = t.estado === 'Finalizada'
                const o = orden(t.ordenId)
                const pctActual = t.pct !== undefined && t.pct > 0 ? t.pct : avance[t.estado] ?? 0
                const incidenciasActivas = (t.incidencias || []).filter((inc) => !inc?.resuelto)
                const tieneIncidenciasActivas = incidenciasActivas.length > 0
                const totalNotas = (t.notas?.length || 0) + (t.incidencias?.length || 0)

                return (
                  <tr
                    key={t.id}
                    className={`fila-tarea ${finalizada ? 'done muted' : ''}`}
                    style={{
                      background: tieneIncidenciasActivas ? 'var(--state-red-bg, #fef2f2)' : undefined,
                    }}
                  >
                    <td>
                      <div>
                        <strong style={{ fontSize: '13px' }}>{t.ordenId}</strong>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '1px' }}>
                        {o?.cliente || 'Cliente registrado'}
                      </div>
                      <small className="cell-sub cell-truncate" style={{ display: 'block', maxWidth: '140px', fontSize: '11px' }} title={o?.producto}>
                        {o?.producto || 'Trabajo gráfico'}
                      </small>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px' }}>{t.actividad}</strong>
                        <span className="pill" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {t.etapa}
                        </span>
                      </div>
                      {o && (o.material || o.dimensiones) && (
                        <small className="cell-sub cell-truncate" style={{ display: 'block', maxWidth: '280px', marginTop: '2px', fontSize: '11px' }}>
                          {o.material} {o.dimensiones ? `· ${o.dimensiones}` : ''} {o.cantidad ? `· ${o.cantidad}u` : ''}
                        </small>
                      )}
                      {(t.instrucciones || t.descripcion) && (
                        <small
                          className="cell-sub cell-truncate"
                          style={{ display: 'block', maxWidth: '280px', marginTop: '1px', fontSize: '11px', color: t.instrucciones ? 'var(--blue-600)' : undefined }}
                          title={t.instrucciones ? `Instrucciones: ${t.instrucciones}` : t.descripcion}
                        >
                          {t.instrucciones ? `Inst: ${t.instrucciones}` : t.descripcion}
                        </small>
                      )}
                    </td>

                    <td>
                      <StatusBadge estado={t.prioridad} />
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <StatusBadge estado={t.estado} />
                        <strong style={{ fontSize: '11px' }}>{pctActual}%</strong>
                      </div>
                      <div className="progress" style={{ height: '6px', marginTop: '4px' }}>
                        <div className="progress-fill" style={{ width: `${pctActual}%` }} />
                      </div>
                      {!finalizada && t.estado === 'En proceso' && (
                        <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                          {[25, 50, 75].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              className={`btn btn-xs ${pctActual === pct ? 'btn-primary' : 'btn-soft'}`}
                              style={{ padding: '1px 5px', fontSize: '10px' }}
                              onClick={() => actions.updateTaskProgress(t.id, 'En proceso', pct)}
                              title={`Avance rápido al ${pct}%`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      )}
                    </td>

                    <td>
                      <span style={{ fontSize: '11.5px', fontWeight: 500 }}>{t.fechaLimite}</span>
                    </td>

                    <td>
                      {tieneIncidenciasActivas ? (
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
                          <span
                            className="badge badge-rojo"
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                            title="Incidencia reportada en estación"
                          >
                            <Icon nombre="alert-triangle" tamano={10} /> {incidenciasActivas.length} activa(s)
                          </span>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            style={{ padding: '1px 6px', fontSize: '10px', marginTop: '2px' }}
                            onClick={() => setModalResolver({ id: t.id, index: (t.incidencias || []).findIndex((x) => !x?.resuelto) })}
                          >
                            Resolver
                          </button>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: '11.5px' }}>
                          {t.incidencias?.length > 0 ? '✓ Resueltas' : '— Sin novedad'}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="row-actions" style={{ gap: '4px', flexWrap: 'wrap' }}>
                        {/* ACCIONES DE ESTADO */}
                        {t.estado === 'Pendiente' && (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => actions.taskAction(t.id, 'iniciar')}
                            title="Iniciar actividad"
                          >
                            <Icon nombre="play" tamano={12} /> Iniciar
                          </button>
                        )}
                        {t.estado === 'Pausada' && (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => actions.taskAction(t.id, 'iniciar')}
                            title="Reanudar actividad"
                          >
                            <Icon nombre="play" tamano={12} /> Reanudar
                          </button>
                        )}
                        {t.estado === 'En proceso' && (
                          <>
                            <button
                              className="btn btn-soft btn-xs"
                              onClick={() => actions.taskAction(t.id, 'pausar')}
                              title="Pausar actividad"
                            >
                              <Icon nombre="pause" tamano={12} /> Pausar
                            </button>
                            <button
                              className="btn btn-success btn-xs"
                              disabled={tieneIncidenciasActivas}
                              onClick={() => actions.taskAction(t.id, 'finalizar')}
                              title={tieneIncidenciasActivas ? 'Resuelve la incidencia activa antes de finalizar' : 'Finalizar actividad'}
                            >
                              <Icon nombre="check" tamano={12} /> Finalizar
                            </button>
                          </>
                        )}
                        {finalizada && (
                          <span className="badge badge-verde" style={{ fontSize: '10.5px' }}>
                            ✓ Hecha
                          </span>
                        )}

                        {/* REGISTRO TÉCNICO Y FICHA */}
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => setModal({ id: t.id, tipo: 'notas' })}
                          title="Registrar observación de taller"
                        >
                          <Icon nombre="message" tamano={12} />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs danger-text"
                          onClick={() => setModal({ id: t.id, tipo: 'incidencias' })}
                          title="Reportar incidencia técnica"
                        >
                          <Icon nombre="alert-triangle" tamano={12} />
                        </button>
                        <button
                          className="btn btn-soft btn-xs"
                          onClick={() => setTareaInstrucciones(t)}
                          title={`Ver especificaciones técnicas e historial (${totalNotas})`}
                        >
                          <Icon nombre="file-text" tamano={12} /> Ficha
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 2: CUADRÍCULA DE TARJETAS TÁCTILES */}
      {lista.length > 0 && vista === 'tarjetas' && (
        <div className="task-grid">
        {lista.map((t) => {
          const finalizada = t.estado === 'Finalizada'
          const o = orden(t.ordenId)
          const pctActual = t.pct !== undefined && t.pct > 0 ? t.pct : avance[t.estado] ?? 0
          const totalNotas = (t.notas?.length || 0) + (t.incidencias?.length || 0)
          const incidenciasActivas = (t.incidencias || []).filter((inc) => !inc?.resuelto)
          const tieneIncidenciasActivas = incidenciasActivas.length > 0
          const tieneIncidencias = tieneIncidenciasActivas
          const expandido = Boolean(detallesExpandidos[t.id])

          return (
            <article
              key={t.id}
              className={`card task-card prioridad-${(t.prioridad || 'Media').toLowerCase()}${
                finalizada ? ' done' : ''
              }`}
              style={{ display: 'flex', flexDirection: 'column' }}
            >
              <header>
                <div>
                  <span className="order-id">{t.ordenId}</span>
                  <h3 style={{ fontSize: '15px', margin: '4px 0' }}>{t.actividad}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: '12.5px' }}>
                    {o ? `${o.producto} · ${o.cliente}` : `Orden ${t.ordenId}`}
                  </p>
                </div>
                <StatusBadge estado={t.estado} />
              </header>

              {/* METADATOS BÁSICOS EN FILA COMPACTA */}
              <dl className="order-meta" style={{ margin: '10px 0 8px' }}>
                <div>
                  <dt>Etapa</dt>
                  <dd>{t.etapa}</dd>
                </div>
                <div>
                  <dt>Prioridad</dt>
                  <dd>
                    <StatusBadge estado={t.prioridad} />
                  </dd>
                </div>
                <div>
                  <dt>Límite</dt>
                  <dd>{t.fechaLimite}</dd>
                </div>
              </dl>

              {/* ESPECIFICACIONES TÉCNICAS DEL TRABAJO */}
              {o && (o.material || o.dimensiones || o.medidas || o.cantidad || o.acabados) && (
                <div
                  style={{
                    background: 'var(--bg-subtle, #f8fafc)',
                    border: '1px solid var(--border-light, #e2e8f0)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: '8px 10px',
                    margin: '4px 0 10px',
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-muted, #64748b)',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '10.5px',
                    }}
                  >
                    Especificaciones técnicas:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '4px 8px' }}>
                    {o.material && (
                      <div>
                        <span className="mut">Material: </span>
                        <strong>{o.material}</strong>
                      </div>
                    )}
                    {(o.dimensiones || o.medidas) && (
                      <div>
                        <span className="mut">Medidas: </span>
                        <strong>{o.dimensiones || o.medidas}</strong>
                      </div>
                    )}
                    {o.cantidad && (
                      <div>
                        <span className="mut">Cantidad: </span>
                        <strong>{o.cantidad} {o.unidad || 'uds'}</strong>
                      </div>
                    )}
                    {o.acabados && (
                      <div>
                        <span className="mut">Acabados: </span>
                        <strong>{o.acabados}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BARRA DE AVANCE */}
              <div className="progress" title={`${pctActual}% de avance`} style={{ marginBottom: '8px' }}>
                <div className="progress-fill" style={{ width: `${pctActual}%` }} />
                <span className="progress-text">{pctActual}%</span>
              </div>

              {/* SELECTOR RÁPIDO DE PORCENTAJE DE AVANCE */}
              {!finalizada && t.estado === 'En proceso' && (
                <div className="row" style={{ gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Avance rápido:</span>
                  {[25, 50, 75].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`btn btn-xs ${pctActual === pct ? 'btn-primary' : 'btn-soft'}`}
                      style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
                      onClick={() => actions.updateTaskProgress(t.id, 'En proceso', pct)}
                      title={`Reportar avance al ${pct}%`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              )}

              {/* ALERTA DE INCIDENCIAS ACTIVAS */}
              {tieneIncidenciasActivas && (
                <div
                  style={{
                    background: 'var(--state-red-bg, #fef2f2)',
                    border: '1px solid var(--state-red-border, #fecaca)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    marginBottom: '10px',
                    fontSize: '11.5px',
                    color: 'var(--state-red-text, #991b1b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Icon nombre="alert-triangle" tamano={13} /> {incidenciasActivas.length} incidencia(s) activa(s)
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                    onClick={() => setModalResolver({ id: t.id, index: (t.incidencias || []).findIndex((x) => !x?.resuelto) })}
                  >
                    Resolver
                  </button>
                </div>
              )}

              {/* ACCIONES OPERATIVAS PRINCIPALES (SIEMPRE VISIBLES) */}
              <div className="task-actions" style={{ marginBottom: '8px' }}>
                <button
                  className="btn btn-primary"
                  disabled={t.estado === 'En proceso' || finalizada}
                  onClick={() => actions.taskAction(t.id, 'iniciar')}
                  title="Marcar inicio de actividad y computar tiempo en taller"
                >
                  <Icon nombre="play" tamano={15} /> {t.estado === 'Pausada' ? 'Reanudar' : 'Iniciar'}
                </button>
                <button
                  className="btn"
                  disabled={t.estado !== 'En proceso'}
                  onClick={() => actions.taskAction(t.id, 'pausar')}
                  title="Pausar actividad por novedad o cambio de turno"
                >
                  <Icon nombre="pause" tamano={15} /> Pausar
                </button>
                <button
                  className="btn btn-success"
                  disabled={finalizada || tieneIncidenciasActivas}
                  onClick={() => actions.taskAction(t.id, 'finalizar')}
                  title={tieneIncidenciasActivas ? 'Debes resolver las incidencias activas antes de finalizar la actividad' : 'Completar actividad al 100%'}
                >
                  <Icon nombre="check" tamano={15} /> Finalizar
                </button>
              </div>

              {/* ACCIONES SECUNDARIAS DE REGISTRO */}
              <div className="task-actions secondary" style={{ marginBottom: '10px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModal({ id: t.id, tipo: 'notas' })}
                  title="Añadir nota a la bitácora técnica de esta actividad"
                >
                  <Icon nombre="message" tamano={13} /> Observación
                </button>
                <button
                  className="btn btn-ghost btn-sm danger-text"
                  onClick={() => setModal({ id: t.id, tipo: 'incidencias' })}
                  title="Reportar problema técnico, falla de máquina o daño de insumo"
                >
                  <Icon nombre="alert-triangle" tamano={13} /> Incidencia
                </button>
              </div>

              {/* BOTÓN COLAPSABLE DE INSTRUCCIONES E HISTORIAL TÉCNICO */}
              {(t.descripcion || t.instrucciones || totalNotas > 0) && (
                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => toggleDetalle(t.id)}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      fontSize: '11.5px',
                      padding: '4px 8px',
                      color: tieneIncidenciasActivas ? 'var(--state-red-text)' : 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <Icon nombre={tieneIncidenciasActivas ? 'alert-triangle' : 'list'} tamano={13} />
                      Instrucciones e historial ({totalNotas})
                    </span>
                    <span>{expandido ? '▲ Ocultar' : '▼ Ver'}</span>
                  </button>

                  {/* SECCIÓN EXPANDIBLE */}
                  {expandido && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'var(--bg-subtle, #f8fafc)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        border: '1px solid var(--border-light, #e2e8f0)',
                      }}
                    >
                      {t.descripcion && (
                        <p className="sm" style={{ margin: '0 0 6px' }}>
                          <strong>Descripción:</strong> {t.descripcion}
                        </p>
                      )}
                      {t.instrucciones && (
                        <p className="sm" style={{ margin: '0 0 8px' }}>
                          <strong>Instrucciones técnicas:</strong> {t.instrucciones}
                        </p>
                      )}

                      {totalNotas > 0 && (
                        <div className="stack" style={{ gap: '6px', marginTop: '6px' }}>
                          {[
                            ...(t.notas || []).map((n) => ({ ...n, tipo: 'Observación' })),
                            ...(t.incidencias || []).map((n, idx) => ({ ...n, tipo: 'Incidencia', rawIndex: idx })),
                          ].map((r, i) => {
                            const esIncidencia = r.tipo === 'Incidencia'
                            return (
                              <div
                                key={i}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  background: esIncidencia
                                    ? r.resuelto
                                      ? 'var(--state-green-bg, #f0fdf4)'
                                      : 'var(--state-red-bg, #fef2f2)'
                                    : 'var(--bg-card, #fff)',
                                  border: `1px solid ${
                                    esIncidencia
                                      ? r.resuelto
                                        ? 'var(--state-green-border, #bbf7d0)'
                                        : 'var(--state-red-border, #fecaca)'
                                      : 'var(--border-light, #e2e8f0)'
                                  }`,
                                }}
                              >
                                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                  <strong
                                    style={{
                                      color: esIncidencia
                                        ? r.resuelto
                                          ? 'var(--state-green-text, #166534)'
                                          : 'var(--state-red-text, #991b1b)'
                                        : 'inherit',
                                    }}
                                  >
                                    {r.tipo} {esIncidencia && (r.resuelto ? '(Resuelta)' : '(Activa)')}
                                  </strong>
                                  <span className="mut">{r.fecha} {r.hora}</span>
                                </div>
                                <div style={{ marginTop: '3px' }}>{r.texto || r.nota || (typeof r === 'string' ? r : '')}</div>
                                {esIncidencia && r.resuelto && (
                                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--state-green-text, #166534)' }}>
                                    <strong>Solución:</strong> {r.solucion || 'Resuelto'} ({r.resueltoPor || 'Taller'})
                                  </div>
                                )}
                                {esIncidencia && !r.resuelto && (
                                  <div style={{ marginTop: '5px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-primary"
                                      style={{ padding: '2px 7px', fontSize: '10.5px' }}
                                      onClick={() => setModalResolver({ id: t.id, index: r.rawIndex })}
                                    >
                                      Resolver incidencia
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
      )}

      {/* MODAL DE OBSERVACIÓN / INCIDENCIA */}
      {modal && (
        <Modal
          titulo={modal.tipo === 'incidencias' ? 'Registrar incidencia operativa' : 'Registrar observación de taller'}
          subtitulo={`Actividad ${modal.id}`}
          icono={modal.tipo === 'incidencias' ? 'alert-triangle' : 'message'}
          tipoBoton={modal.tipo === 'incidencias' ? 'danger' : 'primary'}
          etiqueta={modal.tipo === 'incidencias' ? 'Describe la novedad o problema ocurrido en taller' : 'Escribe tu observación técnica'}
          ayuda="Quedará registrado permanentemente en la bitácora de la orden."
          onClose={() => setModal(null)}
          onConfirm={(texto) => {
            actions.addTaskNote(modal.id, modal.tipo, texto)
            setModal(null)
          }}
        />
      )}

      {/* MODAL PARA RESOLVER INCIDENCIA */}
      {modalResolver && (
        <Modal
          titulo="Resolver incidencia técnica"
          subtitulo={`Actividad ${modalResolver.id}`}
          icono="check-circle"
          tipoBoton="success"
          etiqueta="Describe la solución técnica aplicada (corrección de máquina, cambio de material, ajuste)"
          ayuda="Quedará registrado permanentemente en la bitácora y se desbloqueará el avance de la actividad."
          onClose={() => setModalResolver(null)}
          onConfirm={(solucion) => {
            actions.resolveTaskIncident(modalResolver.id, modalResolver.index, solucion)
            setModalResolver(null)
          }}
        />
      )}

      {/* MODAL DE FICHA TÉCNICA E HISTORIAL PARA VISTA DE PLANILLA */}
      {tareaInstrucciones && (() => {
        const o = orden(tareaInstrucciones.ordenId)
        const notasEIncidencias = [
          ...(tareaInstrucciones.notas || []).map((n) => ({ ...n, tipo: 'Observación' })),
          ...(tareaInstrucciones.incidencias || []).map((n, idx) => ({ ...n, tipo: 'Incidencia', rawIndex: idx })),
        ]

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(9, 13, 22, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: 16,
            }}
          >
            <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
              <div className="card-header">
                <div>
                  <span className="order-id">{tareaInstrucciones.ordenId}</span>
                  <h2 style={{ margin: '4px 0 0' }}>{tareaInstrucciones.actividad}</h2>
                  <div className="muted" style={{ fontSize: '12.5px', marginTop: '2px' }}>
                    Etapa: <strong>{tareaInstrucciones.etapa}</strong> · Prioridad: <StatusBadge estado={tareaInstrucciones.prioridad} />
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setTareaInstrucciones(null)} aria-label="Cerrar ficha">
                  <Icon nombre="x" tamano={16} />
                </button>
              </div>

              <div style={{ padding: '16px', display: 'grid', gap: '12px', fontSize: '13px' }}>
                {/* ESPECIFICACIONES TÉCNICAS DE LA ORDEN */}
                {o && (
                  <div style={{ background: 'var(--surface-sunken)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Especificaciones de la orden
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '6px' }}>
                      <div><span className="mut">Cliente: </span><strong>{o.cliente}</strong></div>
                      <div><span className="mut">Producto: </span><strong>{o.producto}</strong></div>
                      {o.material && <div><span className="mut">Material: </span><strong>{o.material}</strong></div>}
                      {(o.dimensiones || o.medidas) && <div><span className="mut">Medidas: </span><strong>{o.dimensiones || o.medidas}</strong></div>}
                      {o.cantidad && <div><span className="mut">Cantidad: </span><strong>{o.cantidad} {o.unidad || 'uds'}</strong></div>}
                      {o.acabados && <div><span className="mut">Acabados: </span><strong>{o.acabados}</strong></div>}
                    </div>
                  </div>
                )}

                {/* DESCRIPCIÓN E INSTRUCCIONES */}
                {tareaInstrucciones.descripcion && (
                  <div>
                    <strong>Descripción del trabajo:</strong>
                    <div style={{ marginTop: '2px', color: 'var(--text-body)' }}>{tareaInstrucciones.descripcion}</div>
                  </div>
                )}
                {tareaInstrucciones.instrucciones && (
                  <div style={{ background: 'var(--state-blue-bg, #eff6ff)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--state-blue-border, #bfdbfe)' }}>
                    <strong style={{ color: 'var(--state-blue-text, #1d4ed8)' }}>Instrucciones técnicas de producción:</strong>
                    <div style={{ marginTop: '4px' }}>{tareaInstrucciones.instrucciones}</div>
                  </div>
                )}

                {/* BITÁCORA TÉCNICA */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong>Bitácora técnica e incidencias ({notasEIncidencias.length})</strong>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-soft btn-xs"
                        onClick={() => {
                          setModal({ id: tareaInstrucciones.id, tipo: 'notas' })
                          setTareaInstrucciones(null)
                        }}
                      >
                        <Icon nombre="message" tamano={11} /> + Observación
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft btn-xs danger-text"
                        onClick={() => {
                          setModal({ id: tareaInstrucciones.id, tipo: 'incidencias' })
                          setTareaInstrucciones(null)
                        }}
                      >
                        <Icon nombre="alert-triangle" tamano={11} /> + Incidencia
                      </button>
                    </div>
                  </div>

                  {notasEIncidencias.length === 0 ? (
                    <div className="muted" style={{ fontSize: '12px', fontStyle: 'italic' }}>
                      No se han registrado observaciones ni novedades en esta actividad.
                    </div>
                  ) : (
                    <div className="stack" style={{ gap: '6px' }}>
                      {notasEIncidencias.map((r, i) => {
                        const esIncidencia = r.tipo === 'Incidencia'
                        return (
                          <div
                            key={i}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              background: esIncidencia
                                ? r.resuelto ? 'var(--state-green-bg, #f0fdf4)' : 'var(--state-red-bg, #fef2f2)'
                                : 'var(--surface-sunken)',
                              border: `1px solid ${
                                esIncidencia
                                  ? r.resuelto ? 'var(--state-green-border, #bbf7d0)' : 'var(--state-red-border, #fecaca)'
                                  : 'var(--border)'
                              }`,
                            }}
                          >
                            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: esIncidencia ? (r.resuelto ? 'var(--state-green-text, #166534)' : 'var(--state-red-text, #991b1b)') : 'inherit' }}>
                                {r.tipo} {esIncidencia && (r.resuelto ? '(Resuelta)' : '(Activa)')}
                              </strong>
                              <span className="mut" style={{ fontSize: '11px' }}>{r.fecha} {r.hora}</span>
                            </div>
                            <div style={{ marginTop: '3px' }}>{r.texto || r.nota || (typeof r === 'string' ? r : '')}</div>
                            {esIncidencia && r.resuelto && (
                              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--state-green-text, #166534)' }}>
                                <strong>Solución:</strong> {r.solucion || 'Resuelto'} ({r.resueltoPor || 'Taller'})
                              </div>
                            )}
                            {esIncidencia && !r.resuelto && (
                              <div style={{ marginTop: '6px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-primary"
                                  onClick={() => {
                                    setModalResolver({ id: tareaInstrucciones.id, index: r.rawIndex })
                                    setTareaInstrucciones(null)
                                  }}
                                >
                                  Resolver incidencia técnica
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
