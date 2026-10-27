import Icon from './Icon.jsx'

// Tarjeta de indicador con variedad estructural real:
// - Por defecto: superficie tipográfica limpia sin adornos inferiores.
// - variante: 'hero' | 'featured' | 'compacta' | 'trama'
// - progreso (opcional, 0-100): barra lineal fiel a un porcentaje real de los datos existentes.
// - segmentos (opcional, [{ valor, color, label }]): barra segmentada proporcional a datos reales.
export default function StatCard({
  titulo,
  valor,
  icono = 'activity',
  color = 'azul',
  detalle,
  onClick,
  variante = '',
  progreso,
  segmentos,
}) {
  const Etiqueta = onClick ? 'button' : 'div'
  const clases = [
    'kpi',
    `kpi-${color}`,
    variante ? `kpi-${variante}` : '',
    onClick ? 'kpi-click' : '',
  ].filter(Boolean).join(' ')

  const totalSeg = Array.isArray(segmentos)
    ? segmentos.reduce((s, item) => s + (item.valor || 0), 0)
    : 0

  return (
    <Etiqueta className={clases} onClick={onClick}>
      {variante === 'hero' && <span className="kpi-reg-corner" aria-hidden="true" />}

      <span className="kpi-head">
        <span className="kpi-title">{titulo}</span>
        <span className="kpi-icon" aria-hidden="true">
          <Icon nombre={icono} tamano={17} />
        </span>
      </span>

      <span className="kpi-body">
        <span className="kpi-value">{valor}</span>

        {/* Minibarra segmentada basada exclusivamente en datos reales */}
        {totalSeg > 0 && (
          <span className="kpi-microbar" role="presentation" aria-hidden="true">
            {segmentos.filter((s) => s.valor > 0).map((s, idx) => (
              <span
                key={idx}
                className={`kpi-microbar-seg seg-${s.color || 'azul'}`}
                style={{ flexGrow: s.valor }}
                title={s.label ? `${s.label}: ${s.valor}` : undefined}
              />
            ))}
          </span>
        )}

        {/* Indicador lineal de proporción basado en datos reales */}
        {typeof progreso === 'number' && !Number.isNaN(progreso) && (
          <span className="kpi-meter" role="presentation" aria-hidden="true">
            <span
              className="kpi-meter-fill"
              style={{ width: `${Math.min(100, Math.max(0, progreso))}%` }}
            />
          </span>
        )}

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
