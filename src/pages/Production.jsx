import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { puedeAvanzar, estaRetrasada, estaEnRiesgo, prioridadOrden, textoPlazo, estaActiva, progreso } from '../utils/format.js'

const COLUMNAS_PLANTA = [
  { id: 'Pendiente', label: 'Pendiente de inicio', icono: 'clock', etapas: ['Impresión'], estadoFiltro: 'pendiente' },
  { id: 'Produccion', label: 'En producción / Taller', icono: 'printer', etapas: ['Impresión', 'Acabados'], estadoFiltro: 'produccion' },
  { id: 'Calidad', label: 'Control de calidad', icono: 'check-circle', etapas: ['Acabados', 'Despacho'], estadoFiltro: 'calidad' },
  { id: 'Listo', label: 'Listo para entrega', icono: 'package', etapas: ['Despacho', 'Entrega'], estadoFiltro: 'listo' },
]

const ETAPAS_FLUJO = [
  { id: 'Diseño', label: 'Diseño', icono: 'pen' },
  { id: 'Aprobación', label: 'Aprobación', icono: 'check-circle' },
  { id: 'Impresión', label: 'Impresión', icono: 'printer' },
  { id: 'Acabados', label: 'Acabados', icono: 'scissors' },
  { id: 'Despacho', label: 'Despacho', icono: 'truck' },
  { id: 'Entrega', label: 'Entregado', icono: 'package' },
]

export default function Production({ data, actions, irA, role }) {
  const [vistaTablero, setVistaTablero] = useState('planta') // 'planta' | 'flujo'

  // Órdenes que esperan aprobación y NO pueden entrar a producción
  const bloqueadasPorDiseno = data.orders.filter((o) => o.estado === 'Aprobación' && o.disenoEstado !== 'Aprobado')

  // En vista de planta, clasificamos las órdenes aprobadas o en producción
  function getOrdenesColumnaPlanta(colId) {
    return data.orders.filter((o) => {
      if (colId === 'Pendiente') {
        return o.estado === 'Impresión' && o.historial.every((h) => !h.actividad.includes('Impresión finalizada'))
      }
      if (colId === 'Produccion') {
        return o.estado === 'Impresión' || (o.estado === 'Acabados' && !o.blocked)
      }
      if (colId === 'Calidad') {
        return o.estado === 'Acabados' || o.estado === 'Despacho'
      }
      if (colId === 'Listo') {
        return o.estado === 'Despacho' || o.estado === 'Entrega' || o.estado === 'Postventa'
      }
      return false
    })
  }

  return (
    <div>
      <PageHeader
        titulo="Control y tablero de producción"
        subtitulo="Gestión operativa de órdenes en planta, prioridades, cuellos de botella y avance de taller."
        icono="columns"
        acciones={
          <div className="view-toggle">
            <button
              className={vistaTablero === 'planta' ? 'active' : ''}
              onClick={() => setVistaTablero('planta')}
              aria-label="Tablero de taller por estado operativo"
            >
              <Icon nombre="columns" tamano={15} /> Planta operativa
            </button>
            <button
              className={vistaTablero === 'flujo' ? 'active' : ''}
              onClick={() => setVistaTablero('flujo')}
              aria-label="Tablero por etapas del proceso"
            >
              <Icon nombre="layers" tamano={15} /> Por etapas
            </button>
          </div>
        }
      />

      {/* Alerta de bloqueo de diseño para producción */}
      {bloqueadasPorDiseno.length > 0 && (
        <div className="ban am" style={{ marginBottom: '20px' }}>
          <Icon nombre="lock" tamano={18} />
          <div>
            <strong>Control de calidad y preprensa:</strong> {bloqueadasPorDiseno.length}{' '}
            {bloqueadasPorDiseno.length === 1 ? 'orden espera' : 'órdenes esperan'} aprobación de diseño del cliente antes de ingresar a impresión:{' '}
            {bloqueadasPorDiseno.map((o) => (
              <button
                key={o.id}
                className="link-inline"
                style={{ marginRight: '6px' }}
                onClick={() => irA('aprobacion', o.id)}
              >
                {o.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tablero Kanban */}
      <div className="kanban">
        {vistaTablero === 'planta' ? (
          COLUMNAS_PLANTA.map((col) => {
            const ordenes = getOrdenesColumnaPlanta(col.id)
            return (
              <section key={col.id} className="kanban-col" aria-label={`Columna ${col.label}`}>
                <h3>
                  <span className="row" style={{ gap: '8px' }}>
                    <Icon nombre={col.icono} tamano={16} /> {col.label}
                  </span>
                  <span className="kanban-count">{ordenes.length}</span>
                </h3>

                {ordenes.length === 0 ? (
                  <p className="kanban-empty">Sin órdenes en este estado</p>
                ) : (
                  ordenes.map((o) => {
                    const regla = puedeAvanzar(o)
                    const alertaColor = estaRetrasada(o) ? 'kc-rojo' : estaEnRiesgo(o) ? 'kc-amarillo' : ''
                    return (
                      <article key={o.id} className={`kanban-card ${alertaColor}`}>
                        <div className="kanban-top">
                          <strong>{o.id}</strong>
                          {estaActiva(o) && <StatusBadge estado={prioridadOrden(o)} />}
                        </div>

                        <span className="kanban-title">{o.producto}</span>
                        <small className="mut">{o.cliente}</small>
                        <small>
                          <Icon nombre="calendar" tamano={12} /> Entrega: {o.fechaEntrega} · {textoPlazo(o)}
                        </small>

                        {/* Barra de avance */}
                        <div style={{ margin: '4px 0' }}>
                          <ProgressBar valor={progreso(o)} />
                        </div>

                        {/* Alerta de bloqueo por material */}
                        {o.blocked && (
                          <div className="kanban-block-alert">
                            <Icon nombre="lock" tamano={12} /> Bloqueo: {o.blockReason}
                          </div>
                        )}

                        <div className="kanban-foot">
                          <span className="person">
                            <Avatar nombre={o.responsable} tamano="xs" />
                            {o.responsable}
                          </span>
                          <StatusBadge estado={o.estado} />
                        </div>

                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>
                            <Icon nombre="eye" tamano={13} /> Ver orden
                          </button>
                          {o.estado !== 'Entrega' && o.estado !== 'Postventa' && (
                            <button
                              className={regla.bloqueada ? 'btn btn-sm btn-locked' : 'btn btn-sm btn-soft'}
                              onClick={() => actions.advanceStage(o.id)}
                              title={regla.bloqueada ? regla.motivo : `Avanzar a ${regla.siguiente}`}
                            >
                              {regla.bloqueada ? (
                                <>
                                  <Icon nombre="lock" tamano={13} /> Bloqueada
                                </>
                              ) : (
                                <>
                                  Avanzar <Icon nombre="arrow-right" tamano={13} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })
                )}
              </section>
            )
          })
        ) : (
          ETAPAS_FLUJO.map((etapa) => {
            const ordenes = data.orders.filter((o) => o.estado === etapa.id || (etapa.id === 'Entrega' && o.estado === 'Postventa'))
            return (
              <section key={etapa.id} className="kanban-col" aria-label={`Etapa ${etapa.label}`}>
                <h3>
                  <span className="row" style={{ gap: '8px' }}>
                    <Icon nombre={etapa.icono} tamano={16} /> {etapa.label}
                  </span>
                  <span className="kanban-count">{ordenes.length}</span>
                </h3>

                {ordenes.length === 0 ? (
                  <p className="kanban-empty">Sin órdenes</p>
                ) : (
                  ordenes.map((o) => {
                    const regla = puedeAvanzar(o)
                    const alertaColor = estaRetrasada(o) ? 'kc-rojo' : estaEnRiesgo(o) ? 'kc-amarillo' : ''
                    return (
                      <article key={o.id} className={`kanban-card ${alertaColor}`}>
                        <div className="kanban-top">
                          <strong>{o.id}</strong>
                          {estaActiva(o) && <StatusBadge estado={prioridadOrden(o)} />}
                        </div>

                        <span className="kanban-title">{o.producto}</span>
                        <small className="mut">{o.cliente}</small>
                        <small>
                          <Icon nombre="calendar" tamano={12} /> {o.fechaEntrega} · {textoPlazo(o)}
                        </small>

                        <div className="kanban-foot">
                          <span className="person">
                            <Avatar nombre={o.responsable} tamano="xs" />
                            {o.responsable.split(' ')[0]}
                          </span>
                          {etapa.id === 'Aprobación' && (
                            <StatusBadge estado={o.disenoEstado} texto={o.disenoEstado === 'Enviado' ? 'Por aprobar' : undefined} />
                          )}
                        </div>

                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver</button>
                          {etapa.id !== 'Entrega' && (
                            <button
                              className={regla.bloqueada ? 'btn btn-sm btn-locked' : 'btn btn-sm btn-soft'}
                              onClick={() => actions.advanceStage(o.id)}
                            >
                              {regla.bloqueada ? (
                                <>
                                  <Icon nombre="lock" tamano={13} /> Bloqueada
                                </>
                              ) : (
                                <>
                                  Avanzar <Icon nombre="arrow-right" tamano={13} />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
