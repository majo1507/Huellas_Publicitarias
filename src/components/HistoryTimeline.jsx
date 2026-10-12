import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'
import EmptyState from './EmptyState.jsx'

// Icono según el tipo de evento (se deduce del texto de la actividad)
function iconoEvento(actividad) {
  const t = actividad.toLowerCase()
  if (t.includes('bloquead')) return ['lock', 'rojo']
  if (t.includes('rechazad') || t.includes('incidencia')) return ['x-circle', 'rojo']
  if (t.includes('aprobado') || t.includes('finalizad') || t.includes('entregado')) return ['check-circle', 'verde']
  if (t.includes('solicitud')) return ['inbox', 'azul']
  if (t.includes('diseño') || t.includes('versión')) return ['pen', 'azul']
  if (t.includes('impresi')) return ['printer', 'azul']
  if (t.includes('despacho') || t.includes('entrega')) return ['truck', 'azul']
  if (t.includes('postventa')) return ['life-buoy', 'azul']
  if (t.includes('asignad')) return ['user', 'azul']
  return ['activity', 'azul']
}

// Línea de tiempo vertical del historial de una orden (más reciente primero)
export default function HistoryTimeline({ eventos, mostrarResponsable = true }) {
  if (eventos.length === 0) {
    return <EmptyState icono="clock" titulo="Sin movimientos todavía" texto="Los avances de la orden aparecerán aquí." />
  }
  return (
    <ol className="timeline">
      {[...eventos].reverse().map((e, i) => {
        const [icono, tono] = iconoEvento(e.actividad)
        return (
          <li key={i} className="timeline-item">
            <span className={`timeline-dot dot-${tono}`}><Icon nombre={icono} tamano={16} /></span>
            <div className="timeline-body">
              <strong>{e.actividad}</strong>
              <div className="timeline-meta">
                {mostrarResponsable && <><Avatar nombre={e.responsable} tamano="xs" /> {e.responsable} ·</>}
                <span>{e.fecha}</span>
                <span>{e.hora}</span>
                {e.interno && mostrarResponsable && <span className="tag-interno">Interno</span>}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
