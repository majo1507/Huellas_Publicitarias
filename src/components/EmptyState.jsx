import Icon from './Icon.jsx'

// Estado vacío con icono vectorial animado y llamada a la acción contextual
export default function EmptyState({ icono = 'inbox', titulo, texto, accion }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <Icon nombre={icono} tamano={26} />
      </span>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {accion && <div className="empty-action">{accion}</div>}
    </div>
  )
}
