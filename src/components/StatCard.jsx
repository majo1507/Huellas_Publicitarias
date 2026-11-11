import Icon from './Icon.jsx'

// Tarjeta KPI de alta legibilidad y jerarquía equilibrada:
// icono semántico, cifra tabular destacada y detalle contextual.
export default function StatCard({ titulo, valor, icono = 'activity', color = 'azul', detalle, onClick, variante = '', compacta = false }) {
  const Etiqueta = onClick ? 'button' : 'div'
  const clases = [
    'kpi',
    `kpi-${color}`,
    variante ? `kpi-${variante}` : '',
    compacta ? 'kpi-compact' : '',
    onClick ? 'kpi-click' : '',
  ].filter(Boolean).join(' ')

  return (
    <Etiqueta className={clases} onClick={onClick} type={onClick ? 'button' : undefined}>
      {icono && (
        <span className="kpi-icon" aria-hidden="true">
          <Icon nombre={icono} tamano={18} />
        </span>
      )}
      <div className="kpi-body">
        <span className="kpi-title">{titulo}</span>
        <span className="kpi-value">{valor}</span>
        {(detalle || onClick) && (
          <span className="kpi-foot">
            {detalle && <span className="kpi-detail">{detalle}</span>}
            {onClick && (
              <span className="kpi-action-hint" aria-hidden="true">
                <Icon nombre="arrow-right" tamano={12} />
              </span>
            )}
          </span>
        )}
      </div>
    </Etiqueta>
  )
}
