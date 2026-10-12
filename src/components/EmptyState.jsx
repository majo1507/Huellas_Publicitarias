import Icon from './Icon.jsx'

// Estado vacío: se muestra cuando una lista no tiene registros
export default function EmptyState({ icono = 'inbox', titulo, texto, accion }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon nombre={icono} tamano={28} /></span>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  )
}
