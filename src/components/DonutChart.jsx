import { useId } from 'react'

// Gráfico de dona editorial y técnico (SVG). items: [{ label, value, color }]
const DEGRADADOS = {
  celeste: ['#38D4EC', '#19C6E5'],
  azul: ['#4A90FF', '#247BFF'],
  marino: ['#5A78E6', '#2D479E'],
  verde: ['#2DD4BF', '#0D9488'],
  amarillo: ['#F59E0B', '#D97706'],
  rojo: ['#F87171', '#DC2626'],
  gris: ['#8EA2B8', '#52667A'],
}

export default function DonutChart({ items, centro, subtitulo }) {
  const uid = useId().replace(/:/g, '')
  const total = items.reduce((s, i) => s + i.value, 0)
  const radio = 50
  const largo = 2 * Math.PI * radio
  const visibles = items.filter((i) => i.value > 0)
  const hueco = visibles.length > 1 ? 4 : 0
  let acumulado = 0

  const arcos = total > 0 ? visibles.map((i, idx) => {
    const parte = (i.value / total) * largo
    const dibujado = Math.max(parte - hueco, 0.5)
    const arco = { i, idx, dibujado, offset: -acumulado - hueco / 2 }
    acumulado += parte
    return arco
  }) : []

  return (
    <div className="donut-wrap">
      <div className="donut-stage">
        <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Gráfico de dona">
          <defs>
            {Object.entries(DEGRADADOS).map(([clave, [claro, oscuro]]) => (
              <linearGradient key={clave} id={`${uid}-${clave}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={claro} />
                <stop offset="1" stopColor={oscuro} />
              </linearGradient>
            ))}
          </defs>

          {/* Pista del anillo */}
          <circle cx="70" cy="70" r={radio} fill="none" className="donut-track" strokeWidth="14" />

          {/* Segmentos con entrada progresiva */}
          {arcos.map(({ i, idx, dibujado, offset }) => {
            const pct = total > 0 ? Math.round((i.value / total) * 100) : 0
            return (
              <circle
                key={i.label}
                cx="70" cy="70" r={radio} fill="none"
                className="donut-segment"
                style={{ '--seg-idx': idx }}
                stroke={`url(#${uid}-${DEGRADADOS[i.color] ? i.color : 'azul'})`}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${dibujado} ${largo - dibujado}`}
                strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${i.label}: ${i.value} (${pct}%)`}</title>
              </circle>
            )
          })}

          {/* Centro limpio */}
          <circle cx="70" cy="70" r="36" className="donut-core" />
          <circle cx="70" cy="70" r="36" fill="none" className="donut-core-ring" strokeWidth="1" />
          <text x="70" y="68" textAnchor="middle" className="donut-number">{centro ?? total}</text>
          <text
            x="70"
            y="84"
            textAnchor="middle"
            className="donut-caption"
            style={subtitulo && subtitulo.length > 9 ? { fontSize: '7.2px', letterSpacing: '0.03em' } : undefined}
          >
            {subtitulo}
          </text>
        </svg>
      </div>
      <ul className="legend donut-legend">
        {items.map((i) => {
          const pct = total > 0 ? Math.round((i.value / total) * 100) : 0
          const par = DEGRADADOS[i.color] || DEGRADADOS.azul
          return (
            <li key={i.label} title={`${i.label}: ${i.value} (${pct}%)`}>
              <span className="legend-bar-swatch" style={{ background: `linear-gradient(180deg, ${par[0]}, ${par[1]})` }} />
              <span className="legend-label">{i.label}</span>
              <span className="legend-pct">{pct}%</span>
              <strong>{i.value}</strong>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
