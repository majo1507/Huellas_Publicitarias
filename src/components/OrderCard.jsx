import StatusBadge from './StatusBadge.jsx'
import ProgressBar from './ProgressBar.jsx'
import Avatar from './Avatar.jsx'
import Icon from './Icon.jsx'
import { prioridadOrden, progreso, textoPlazo, estaRetrasada, estaEnRiesgo, estaActiva } from '../utils/format.js'

// Presentación visual de una orden: cliente, producto, prioridad, fechas, responsable y estado.
// "interno" muestra datos que el cliente no debe ver (prioridad y responsable).
export default function OrderCard({ order, interno = true, onAbrir, children }) {
  const plazo = textoPlazo(order)
  const alerta = estaRetrasada(order) ? 'rojo' : estaEnRiesgo(order) ? 'amarillo' : ''

  return (
    <article className={`order-card ${alerta ? `order-card-${alerta}` : ''}`}>
      <header>
        <div>
          <span className="order-id">{order.id}</span>
          <h3>{order.producto}</h3>
          {interno && <p className="muted">{order.cliente}</p>}
        </div>
        <StatusBadge estado={order.estado === 'Entrega' ? 'Entregado' : order.estado} />
      </header>

      <ProgressBar valor={progreso(order)} />

      <dl className="order-meta">
        <div><dt><Icon nombre="calendar" tamano={14} /> Solicitud</dt><dd>{order.fechaSolicitud}</dd></div>
        <div><dt><Icon nombre="flag" tamano={14} /> Entrega</dt><dd>{order.fechaEntrega}</dd></div>
      </dl>

      {children}

      <footer>
        <span className={`plazo ${alerta ? `plazo-${alerta}` : ''}`}>{plazo}</span>
        {interno && estaActiva(order) && <StatusBadge estado={prioridadOrden(order)} texto={`Prioridad ${prioridadOrden(order).toLowerCase()}`} />}
        {interno && <span className="order-owner"><Avatar nombre={order.responsable} tamano="sm" />{order.responsable}</span>}
        {onAbrir && <button className="btn btn-soft btn-sm" onClick={() => onAbrir(order)}>Ver pedido <Icon nombre="arrow-right" tamano={14} /></button>}
      </footer>
    </article>
  )
}
