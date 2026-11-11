import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { diasParaEntrega, estaActiva, textoPlazo } from '../utils/format.js'

// COMERCIAL / RECEPCIÓN: clientes, solicitudes y puente de aprobación con el cliente
export default function CommercialDashboard({ data, actions, irA }) {
  const [paginaEnviar, setPaginaEnviar] = useState(1)
  const POR_PAGINA = 5

  const contar = (estado) => data.requests.filter((s) => s.estado === estado).length
  const porEnviar = data.requests.filter((s) => s.estado === 'Pendiente')
  const devueltas = data.requests.filter((s) => s.estado === 'Devuelta' || s.estado === 'Rechazada')

  // Diseños pendientes de gestión comercial (enviados por el diseñador o enviados al cliente esperando respuesta)
  const disenosPorGestionar = data.orders.filter((o) => {
    const versiones = o.versiones || []
    if (versiones.length === 0) return false
    const ultima = versiones[versiones.length - 1]
    const est = String(ultima.estado || '').toLowerCase()
    return (
      est === 'en_revision_comercial' ||
      est === 'enviado_cliente' ||
      ultima.estado === 'En revisión comercial' ||
      ultima.estado === 'Enviado al cliente' ||
      ultima.estado === 'En revisión'
    )
  })

  const proximas = data.orders
    .filter((o) => estaActiva(o) && diasParaEntrega(o) >= 0 && diasParaEntrega(o) <= 7)
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  const totalPaginasEnviar = Math.max(1, Math.ceil(porEnviar.length / POR_PAGINA))
  const pagActual = Math.min(paginaEnviar, totalPaginasEnviar)
  const porEnviarVisibles = porEnviar.slice((pagActual - 1) * POR_PAGINA, pagActual * POR_PAGINA)

  return (
    <div>
      <PageHeader
        etiqueta="COMERCIAL · RECEPCIÓN Y GESTIÓN DE CLIENTES"
        titulo="Panel Comercial y Recepción"
        subtitulo="Recepción de solicitudes, cotizaciones y gestión de aprobaciones gráficas con clientes."
        icono="home"
        acciones={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-soft" onClick={() => irA('aprobacion_disenos')}>
              <Icon nombre="check-square" tamano={15} /> Bandeja de diseños ({disenosPorGestionar.length})
            </button>
            <button className="btn btn-primary" onClick={() => irA('nuevo')}>
              <Icon nombre="plus" tamano={16} /> Registrar solicitud
            </button>
          </div>
        }
      />

      {/* 4 indicadores clave de Comercial con redirección directa */}
      <div className="kpis">
        <StatCard
          titulo="Solicitudes por enviar"
          valor={porEnviar.length}
          icono="inbox"
          color={porEnviar.length > 0 ? 'amarillo' : 'azul'}
          detalle={`${contar('En validación')} en validación actualmente`}
          onClick={() => irA('solicitudes')}
        />
        <StatCard
          titulo="Solicitudes devueltas"
          valor={devueltas.length}
          icono="alert-triangle"
          color={devueltas.length > 0 ? 'rojo' : 'verde'}
          detalle={devueltas.length > 0 ? 'Requieren corrección comercial' : 'Sin devoluciones pendientes'}
          onClick={() => irA('solicitudes')}
        />
        <StatCard
          titulo="Diseños por gestionar"
          valor={disenosPorGestionar.length}
          icono="palette"
          color={disenosPorGestionar.length > 0 ? 'amarillo' : 'azul'}
          detalle="Puente Comercial ↔ Cliente"
          onClick={() => irA('aprobacion_disenos')}
        />
        <StatCard
          titulo="Entregas próximas (7 días)"
          valor={proximas.length}
          icono="truck"
          color="azul"
          detalle={`${data.orders.length} órdenes totales · ${data.clients.length} clientes`}
          onClick={() => irA('entregas')}
        />
      </div>

      <div className="grid-main">
        <Panel
          titulo="Solicitudes por enviar a validación"
          subtitulo="Revisa la cotización y remite la solicitud a Coordinación para iniciar producción."
          icono="inbox"
          etiqueta={`${porEnviar.length} pendientes`}
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('solicitudes')}>
              Ver todas <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          {porEnviar.length === 0 ? (
            <EmptyState
              icono="check-circle"
              titulo="Todo al día"
              texto="No hay solicitudes pendientes de envío a Coordinación."
            />
          ) : (
            <>
              <div className="table-wrap">
                <table className="table table-plain">
                  <thead>
                    <tr>
                      <th>Solicitud</th>
                      <th>Cliente</th>
                      <th>Producto</th>
                      <th>Entrega</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {porEnviarVisibles.map((s) => (
                      <tr key={s.id} className="fila-pendiente-envio">
                        <td>
                          <button className="link-inline" onClick={() => irA('solicitudes')}>
                            <strong>{s.id}</strong>
                          </button>
                        </td>
                        <td>{s.cliente}</td>
                        <td>{s.producto}</td>
                        <td>{s.fechaEntrega}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm btn-enviar-destacado"
                            onClick={() => actions.sendToValidation(s.id)}
                          >
                            <Icon nombre="send" tamano={13} /> Enviar a validación
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPaginasEnviar > 1 && (
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span className="sm mut">
                    Página {pagActual} de {totalPaginasEnviar} ({porEnviar.length} solicitudes)
                  </span>
                  <div className="row" style={{ gap: '6px' }}>
                    <button
                      className="btn btn-sm"
                      disabled={pagActual <= 1}
                      onClick={() => setPaginaEnviar((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={pagActual >= totalPaginasEnviar}
                      onClick={() => setPaginaEnviar((p) => Math.min(totalPaginasEnviar, p + 1))}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel
          titulo="Estado de las solicitudes"
          subtitulo="Distribución actual del flujo comercial."
          icono="bar-chart"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('solicitudes')}>
              Gestionar <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          <DonutChart
            subtitulo="solicitudes"
            items={[
              { label: 'Pendientes', value: contar('Pendiente'), color: 'amarillo' },
              { label: 'En validación', value: contar('En validación'), color: 'celeste' },
              { label: 'Aprobadas', value: contar('Aprobada'), color: 'azul' },
              { label: 'Devueltas / Rechazadas', value: devueltas.length, color: 'rojo' },
            ]}
          />
        </Panel>
      </div>

      <div className="grid-3">
        <Panel
          titulo="Atención prioritaria comercial"
          icono="bell"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('aprobacion_disenos')}>
              Bandeja de diseños <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          {devueltas.length === 0 && disenosPorGestionar.length === 0 ? (
            <EmptyState
              icono="check-circle"
              titulo="Sin alertas comerciales"
              texto="No tienes solicitudes devueltas ni diseños pendientes de envío al cliente."
            />
          ) : (
            <ul className="feed">
              {devueltas.slice(0, 3).map((s) => (
                <li key={s.id} className="feed-item">
                  <div>
                    <strong>{s.id} · {s.cliente}</strong>
                    <div className="timeline-meta">
                      Solicitud devuelta: {s.motivoDevolucion || s.motivoRechazo || 'Revisar observaciones'}
                    </div>
                  </div>
                  <button className="btn btn-sm btn-soft" onClick={() => irA('solicitudes')}>
                    Corregir
                  </button>
                </li>
              ))}
              {disenosPorGestionar.slice(0, 3).map((o) => {
                const ult = o.versiones[o.versiones.length - 1]
                return (
                  <li key={o.id} className="feed-item">
                    <div>
                      <strong>{o.id} · {o.cliente}</strong>
                      <div className="timeline-meta">
                        Propuesta v{ult?.numero || 1} ({ult?.estado || 'Pendiente'}) · {o.producto}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => irA('aprobacion_disenos')}>
                      Gestionar
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          titulo="Entregas próximas (7 días)"
          icono="truck"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('entregas')}>
              Ver despachos <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          {proximas.length === 0 ? (
            <EmptyState icono="truck" titulo="Sin entregas próximas" texto="No hay órdenes con entrega en los próximos 7 días." />
          ) : (
            <ul className="feed">
              {proximas.slice(0, 5).map((o) => (
                <li key={o.id} className="feed-item">
                  <div>
                    <button className="link-inline" onClick={() => irA('detalle', o.id)}>
                      <strong>{o.id} · {o.cliente}</strong>
                    </button>
                    <div className="timeline-meta">{o.producto} · {o.fechaEntrega}</div>
                  </div>
                  <StatusBadge estado={diasParaEntrega(o) <= 3 ? 'En riesgo' : 'En proceso'} texto={textoPlazo(o)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          titulo="Actividad reciente"
          icono="activity"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('pedidos')}>
              Ver órdenes <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          <ActivityFeed orders={data.orders} limite={5} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
