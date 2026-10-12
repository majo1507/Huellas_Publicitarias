import EmptyState from './EmptyState.jsx'
import { eventosRecientes } from '../utils/format.js'

// Resumen de la actividad más reciente de todas las órdenes (usa los mismos datos compartidos)
export default function ActivityFeed({ orders, soloPublicos = false, limite = 6, onAbrir }) {
  const eventos = eventosRecientes(orders, { soloPublicos, limite })
  if (eventos.length === 0) return <EmptyState icono="activity" titulo="Sin actividad reciente" />

  return (
    <ul className="feed">
      {eventos.map((e, i) => (
        <li key={i} className="feed-item">
          <div>
            <strong>{e.actividad}</strong>
            <div className="timeline-meta">
              {onAbrir
                ? <button className="link-inline" onClick={() => onAbrir(e.ordenId)}>{e.ordenId}</button>
                : <span>{e.ordenId}</span>}
              · {soloPublicos ? e.cliente : e.responsable}
            </div>
          </div>
          <span className="feed-time">{e.fecha.slice(0, 5)} · {e.hora}</span>
        </li>
      ))}
    </ul>
  )
}
