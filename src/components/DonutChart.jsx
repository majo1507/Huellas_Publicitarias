import { useId } from 'react'

// Gráfico de dona Futuristic Enterprise (SVG). items: [{ label, value, color }]
// Paleta coordinada con ORVEX Futuristic Enterprise: cian luminoso, azul eléctrico, azul secundario y semánticos.
const DEGRADADOS = {
  celeste: ['#65E4F2', '#19C6E5'],
  azul: ['#60A5FA', '#247BFF'],
  marino: ['#818CF8', '#3B5BDB'],
  verde: ['#34D399', '#10B981'],
  amarillo: ['#FBBF24', '#F59E0B'],
  rojo: ['#F87171', '#EF4444'],
  gris: ['#94A3B8', '#475569'],
}

export default function DonutChart({ items, centro, subtitulo }) {
  const uid = useId().replace(/:/g, '')
  const total = items.reduce((s, i) => s + i.value, 0)
  const radio = 50
  const largo = 2 * Math.PI * radio
  const visibles = items.filter((i) => i.value > 0)
  const hueco = visibles.length > 1 ? 4.2 : 0
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

          {/* Anillo de registro técnico exterior */}
          <circle cx="70" cy="70" r="64" fill="none" className="donut-reg-ring" strokeWidth="1" strokeDasharray="3 5" />

          {/* Pista del anillo */}
          <circle cx="70" cy="70" r={radio} fill="none" className="donut-track" strokeWidth="15" />

          {/* Segmentos con degradado luminoso y animación de entrada */}
          {arcos.map(({ i, idx, dibujado, offset }) => {
            const pct = total > 0 ? Math.round((i.value / total) * 100) : 0
            return (
              <circle
                key={i.label}
                cx="70" cy="70" r={radio} fill="none"
                className="donut-segment"
                style={{ '--seg-idx': idx }}
                stroke={`url(#${uid}-${DEGRADADOS[i.color] ? i.color : 'azul'})`}
                strokeWidth="15"
                strokeLinecap="butt"
                strokeDasharray={`${dibujado} ${largo - dibujado}`}
                strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${i.label}: ${i.value} (${pct}%)`}</title>
              </circle>
            )
          })}

          {/* Centro con halo sutil */}
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
              <span className="legend-dot" style={{ background: `linear-gradient(135deg, ${par[0]}, ${par[1]})`, boxShadow: `0 0 8px ${par[0]}55` }} />
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
