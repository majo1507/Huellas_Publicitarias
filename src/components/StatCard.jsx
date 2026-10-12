import Icon from './Icon.jsx'

// Tarjeta de indicador. color: azul (por defecto) | rojo | amarillo | verde (solo para estados)
export default function StatCard({ titulo, valor, icono = 'activity', color = 'azul', detalle, onClick }) {
  const Etiqueta = onClick ? 'button' : 'div'
  return (
    <Etiqueta className={`kpi kpi-${color}${onClick ? ' kpi-click' : ''}`} onClick={onClick}>
      <span className="kpi-icon"><Icon nombre={icono} tamano={20} /></span>
      <span className="kpi-body">
        <span className="kpi-value">{valor}</span>
        <span className="kpi-title">{titulo}</span>
        {detalle && <span className="kpi-detail">{detalle}</span>}
      </span>
    </Etiqueta>
  )
}
