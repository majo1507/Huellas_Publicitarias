import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import OrderCard from '../components/OrderCard.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'
import { estaActiva, etiquetaDiseno, textoPlazo } from '../utils/format.js'

// CLIENTE: portal de seguimiento. Solo muestra los pedidos del cliente y nada interno.
export default function ClientDashboard({ data, irA }) {
  const { usuario, clienteId } = ROLES.cliente
  const misPedidos = data.orders.filter((o) => o.clienteId === clienteId)
  const activos = misPedidos.filter(estaActiva)
  const porAprobar = misPedidos.filter((o) => o.disenoEstado === 'Enviado')
  const idsMios = misPedidos.map((o) => o.id)
  const casosAbiertos = data.cases.filter((c) => idsMios.includes(c.ordenId) && c.estado !== 'Resuelto').length
  const proxima = [...activos].sort((a, b) => a.fechaEntrega.split('/').reverse().join().localeCompare(b.fechaEntrega.split('/').reverse().join()))[0]

  return (
    <div>
      <PageHeader
        titulo={`Hola, ${usuario.nombre.split(' ')[0]}`}
        subtitulo={`Portal de seguimiento de pedidos · ${usuario.cargo}`}
        icono="clipboard"
      />

      <div className="kpis">
        <StatCard titulo="Pedidos en curso" valor={activos.length} icono="clipboard" />
        <StatCard titulo="Diseños por aprobar" valor={porAprobar.length} icono="pen" color={porAprobar.length ? 'amarillo' : 'azul'} />
        <StatCard titulo="Pedidos entregados" valor={misPedidos.length - activos.length} icono="package" color="verde" />
        <StatCard titulo="Casos de postventa abiertos" valor={casosAbiertos} icono="life-buoy" onClick={() => irA('postventa')} />
      </div>

      {porAprobar.map((o) => (
        <Alert
          key={o.id}
          tipo="aviso"
          titulo={`Tu diseño de ${o.id} espera tu aprobación`}
          accion={<button className="btn btn-primary btn-sm" onClick={() => irA('aprobacion', o.id)}>Revisar diseño</button>}
        >
          Mientras no lo apruebes, no podemos pasar el pedido a impresión.
        </Alert>
      ))}

      <div className="grid-main">
        <Panel titulo="Seguimiento de mis pedidos" icono="activity">
          <div className="stack">
            {misPedidos.map((o) => (
              <OrderCard key={o.id} order={o} interno={false} onAbrir={() => irA('detalle', o.id)}>
                <p className="order-design">
                  <Icon nombre="pen" tamano={14} /> Diseño: <StatusBadge estado={etiquetaDiseno(o.disenoEstado)} />
                  {o.disenoEstado === 'Enviado' && (
                    <button className="link-inline" onClick={() => irA('aprobacion', o.id)}>Revisar ahora</button>
                  )}
                </p>
              </OrderCard>
            ))}
          </div>
        </Panel>

        <div className="stack">
          {proxima && (
            <Panel titulo="Próxima entrega" icono="truck">
              <strong className="big-text">{proxima.producto}</strong>
              <p className="muted">{proxima.id} · {proxima.entrega.metodo}</p>
              <p className="delivery-date"><Icon nombre="calendar" tamano={16} /> {proxima.fechaEntrega} <span>{textoPlazo(proxima)}</span></p>
              <p className="muted"><Icon nombre="map-pin" tamano={14} /> {proxima.entrega.direccion}</p>
            </Panel>
          )}
          <Panel titulo="Avances recientes" icono="clock">
            <ActivityFeed orders={misPedidos} soloPublicos limite={5} onAbrir={(id) => irA('detalle', id)} />
          </Panel>
        </div>
      </div>
    </div>
  )
}
