import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'
import EmptyState from './EmptyState.jsx'

// Icono según el tipo de evento (se deduce del texto de la actividad)
function iconoEvento(actividad = '') {
  const t = actividad.toLowerCase()
  if (t.includes('bloquead')) return ['lock', 'rojo']
  if (t.includes('cerrad')) return ['check', 'verde']
  if (t.includes('reabiert')) return ['clock', 'amarillo']
  if (t.includes('rechazad') || t.includes('incidencia')) return ['x-circle', 'rojo']
  if (t.includes('aprobado') || t.includes('finalizad') || t.includes('entregad')) return ['check-circle', 'verde']
  if (t.includes('solicitud')) return ['inbox', 'azul']
  if (t.includes('diseño') || t.includes('versión')) return ['pen', 'azul']
  if (t.includes('impresi')) return ['printer', 'azul']
  if (t.includes('despacho') || t.includes('entrega')) return ['truck', 'azul']
  if (t.includes('postventa')) return ['life-buoy', 'azul']
  if (t.includes('asignad')) return ['user', 'azul']
  return ['activity', 'azul']
}

// Línea de tiempo vertical del historial cronológico de una orden (más reciente primero) (HU-19)
export default function HistoryTimeline({ eventos, mostrarResponsable = true }) {
  if (!eventos || eventos.length === 0) {
    return <EmptyState icono="clock" titulo="Sin movimientos todavía" texto="Los avances de la orden aparecerán aquí." />
  }

  return (
    <ol className="timeline">
      {[...eventos].reverse().map((e, i) => {
        const [icono, tono] = iconoEvento(e.actividad)
        const tieneTransicion = Boolean(e.estadoAnterior && e.nuevoEstado)
        const tieneMotivo = Boolean(e.motivo || e.observaciones)

        return (
          <li key={i} className="timeline-item">
            <span className={`timeline-dot dot-${tono}`}>
              <Icon nombre={icono} tamano={16} />
            </span>
            <div className="timeline-body">
              <strong>{e.actividad}</strong>

              {tieneTransicion && (
                <div className="row" style={{ gap: '6px', marginTop: '4px', fontSize: '12px' }}>
                  <span className="sm mut">Estado:</span>
                  <span className="badge badge-gris" style={{ fontSize: '11px', padding: '2px 7px' }}>{e.estadoAnterior}</span>
                  <span className="sm mut">→</span>
                  <span className="badge badge-azul" style={{ fontSize: '11px', padding: '2px 7px' }}>{e.nuevoEstado}</span>
                </div>
              )}

              {tieneMotivo && (
                <div className="timeline-note-box">
                  <span className="timeline-note-label">Observación / Motivo: </span>
                  <span>{e.motivo || e.observaciones}</span>
                </div>
              )}

              <div className="timeline-meta" style={{ marginTop: '5px' }}>
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
