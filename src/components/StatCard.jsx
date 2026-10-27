import Icon from './Icon.jsx'

// Tarjeta de indicador Futuristic Enterprise. color: azul (por defecto) | rojo | amarillo | verde
// variante opcional: 'hero' | 'featured' | 'compacta' | '' (conserva 100% compatibilidad con todos los módulos)
export default function StatCard({ titulo, valor, icono = 'activity', color = 'azul', detalle, onClick, variante = '' }) {
  const Etiqueta = onClick ? 'button' : 'div'
  const clases = [
    'kpi',
    `kpi-${color}`,
    variante ? `kpi-${variante}` : '',
    onClick ? 'kpi-click' : '',
  ].filter(Boolean).join(' ')

  return (
    <Etiqueta className={clases} onClick={onClick}>
      {/* Onda abstracta sutil de tinta y telemetría en segundo plano */}
      <svg className="kpi-ink-wave" viewBox="0 0 220 72" fill="none" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M0 64 C 55 58, 85 28, 138 42 C 175 52, 198 18, 220 12 L 220 72 L 0 72 Z"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path
          d="M12 66 C 62 52, 92 26, 142 38 C 178 46, 200 18, 220 10"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <span className="kpi-head">
        <span className="kpi-title">{titulo}</span>
        <span className="kpi-icon" aria-hidden="true">
          <Icon nombre={icono} tamano={18} />
        </span>
      </span>
      <span className="kpi-body">
        <span className="kpi-value">{valor}</span>
        {(detalle || onClick) && (
          <span className="kpi-foot">
            {detalle && <span className="kpi-detail">{detalle}</span>}
            {onClick && (
              <span className="kpi-action-hint" aria-hidden="true">
                <Icon nombre="arrow-right" tamano={13} />
              </span>
            )}
          </span>
        )}
      </span>
    </Etiqueta>
  )
}
