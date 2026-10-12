import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { diasParaEntrega, estaActiva, textoPlazo } from '../utils/format.js'

// COMERCIAL / RECEPCIÓN: clientes y solicitudes
export default function CommercialDashboard({ data, actions, irA }) {
  const contar = (estado) => data.requests.filter((s) => s.estado === estado).length
  const porEnviar = data.requests.filter((s) => s.estado === 'Pendiente')
  const proximas = data.orders
    .filter((o) => estaActiva(o) && diasParaEntrega(o) >= 0 && diasParaEntrega(o) <= 7)
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  const acceso = [
    ['file-plus', 'Registrar solicitud', 'nuevo'],
    ['inbox', 'Ver solicitudes', 'solicitudes'],
    ['users', 'Consultar clientes', 'clientes'],
    ['truck', 'Entregas', 'entregas'],
  ]

  return (
    <div>
      <PageHeader
        titulo="Inicio"
        subtitulo="Recepción y seguimiento de solicitudes de clientes."
        icono="home"
        acciones={<button className="btn btn-primary" onClick={() => irA('nuevo')}><Icon nombre="plus" tamano={16} /> Registrar solicitud</button>}
      />

      <div className="kpis">
        <StatCard titulo="Solicitudes pendientes" valor={contar('Pendiente')} icono="inbox" color={contar('Pendiente') ? 'amarillo' : 'azul'} onClick={() => irA('solicitudes')} />
        <StatCard titulo="En validación" valor={contar('En validación')} icono="clock" onClick={() => irA('solicitudes')} />
        <StatCard titulo="Órdenes generadas" valor={data.orders.length} icono="clipboard" onClick={() => irA('pedidos')} />
        <StatCard titulo="Solicitudes rechazadas" valor={contar('Rechazada')} icono="x-circle" color={contar('Rechazada') ? 'rojo' : 'azul'} />
        <StatCard titulo="Entregas próximas (7 días)" valor={proximas.length} icono="truck" onClick={() => irA('entregas')} />
        <StatCard titulo="Clientes" valor={data.clients.length} icono="users" onClick={() => irA('clientes')} />
      </div>

      <div className="grid-main">
        <Panel titulo="Solicitudes por enviar a validación" icono="inbox" accion={<button className="btn btn-ghost btn-sm" onClick={() => irA('solicitudes')}>Ver todas</button>}>
          {porEnviar.length === 0 ? (
            <EmptyState icono="check-circle" titulo="Todo al día" texto="No hay solicitudes pendientes de envío." />
          ) : (
            <table className="table table-plain">
              <thead><tr><th>Solicitud</th><th>Cliente</th><th>Producto</th><th>Entrega</th><th></th></tr></thead>
              <tbody>
                {porEnviar.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.id}</strong></td><td>{s.cliente}</td><td>{s.producto}</td><td>{s.fechaEntrega}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => actions.sendToValidation(s.id)}><Icon nombre="send" tamano={14} /> Enviar a validación</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel titulo="Estado de las solicitudes" icono="bar-chart">
          <DonutChart
            subtitulo="solicitudes"
            items={[
              { label: 'Pendientes', value: contar('Pendiente'), color: 'amarillo' },
              { label: 'En validación', value: contar('En validación'), color: 'celeste' },
              { label: 'Aprobadas', value: contar('Aprobada'), color: 'azul' },
              { label: 'Rechazadas', value: contar('Rechazada'), color: 'rojo' },
            ]}
          />
        </Panel>
      </div>

      <div className="grid-3">
        <Panel titulo="Accesos rápidos" icono="layers">
          <div className="quick-grid">
            {acceso.map(([icono, texto, pagina]) => (
              <button key={pagina} className="quick" onClick={() => irA(pagina)}>
                <Icon nombre={icono} tamano={22} />
                <span>{texto}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel titulo="Entregas próximas" icono="truck">
          {proximas.length === 0 ? <EmptyState icono="truck" titulo="Sin entregas próximas" /> : (
            <ul className="feed">
              {proximas.map((o) => (
                <li key={o.id} className="feed-item">
                  <div>
                    <strong>{o.id} · {o.cliente}</strong>
                    <div className="timeline-meta">{o.producto} · {o.fechaEntrega}</div>
                  </div>
                  <StatusBadge estado={diasParaEntrega(o) <= 3 ? 'En riesgo' : 'En proceso'} texto={textoPlazo(o)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel titulo="Actividad reciente" icono="activity">
          <ActivityFeed orders={data.orders} limite={5} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
