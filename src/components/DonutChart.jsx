import { useId } from 'react'

// Gráfico de dona volumétrico (SVG). items: [{ label, value, color }]. color: azul | celeste | verde | amarillo | rojo | gris | marino
// Cada color tiene un degradado (claro → oscuro) para dar volumen; los datos y la leyenda no cambian.
const COLORES = {
  azul: '#2563eb', celeste: '#7cc0f5', verde: '#2fa36b', amarillo: '#e0a526', rojo: '#d9534f', gris: '#a9b6c9', marino: '#12305f',
}
const DEGRADADOS = {
  azul: ['#60a5fa', '#1d4ed8'],
  celeste: ['#bae6fd', '#38a3e8'],
  verde: ['#6ee7a8', '#15803d'],
  amarillo: ['#fcd34d', '#d97706'],
  rojo: ['#fca5a5', '#dc2626'],
  gris: ['#dbe4f0', '#8da0b9'],
  marino: ['#3b5fa0', '#0b1a30'],
}

export default function DonutChart({ items, centro, subtitulo }) {
  const uid = useId().replace(/:/g, '')
  const total = items.reduce((s, i) => s + i.value, 0)
  const radio = 50
  const largo = 2 * Math.PI * radio
  const visibles = items.filter((i) => i.value > 0)
  // Pequeña separación entre segmentos para que se vean como piezas redondeadas
  const hueco = visibles.length > 1 ? 5 : 0
  let acumulado = 0

  const arcos = total > 0 ? visibles.map((i) => {
    const parte = (i.value / total) * largo
    const dibujado = Math.max(parte - hueco, 0.5)
    const arco = { i, dibujado, offset: -acumulado - hueco / 2 }
    acumulado += parte
    return arco
  }) : []

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 150" className="donut" role="img" aria-label="Gráfico de dona">
        <defs>
          {Object.entries(DEGRADADOS).map(([clave, [claro, oscuro]]) => (
            <linearGradient key={clave} id={`${uid}-${clave}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={claro} />
              <stop offset="1" stopColor={oscuro} />
            </linearGradient>
          ))}
          <filter id={`${uid}-sombra`} x="-20%" y="-20%" width="140%" height="150%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>

        {/* Pista del anillo con efecto hundido */}
        <circle cx="70" cy="70" r={radio} fill="none" stroke="#e3ecf8" strokeWidth="19" />
        <circle cx="70" cy="70" r={radio + 9} fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.9" />

        {/* Capa de profundidad: sombra desplazada y difuminada */}
        <g transform="translate(0 6)" filter={`url(#${uid}-sombra)`} opacity="0.38">
          {arcos.map(({ i, dibujado, offset }) => (
            <circle
              key={`s-${i.label}`}
              cx="70" cy="70" r={radio} fill="none"
              stroke="#1e3a8a" strokeWidth="17" strokeLinecap="round"
              strokeDasharray={`${dibujado} ${largo - dibujado}`} strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
            />
          ))}
        </g>

        {/* Segmentos con degradado */}
        {arcos.map(({ i, dibujado, offset }) => (
          <circle
            key={i.label}
            cx="70" cy="70" r={radio} fill="none"
            stroke={`url(#${uid}-${DEGRADADOS[i.color] ? i.color : 'azul'})`} strokeWidth="18" strokeLinecap="round"
            strokeDasharray={`${dibujado} ${largo - dibujado}`} strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
          />
        ))}

        {/* Reflejo superior de cada segmento */}
        {arcos.map(({ i, dibujado, offset }) => (
          <circle
            key={`h-${i.label}`}
            cx="70" cy="70" r={radio + 4.5} fill="none"
            stroke="#ffffff" strokeOpacity="0.38" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${Math.max(dibujado - 6, 0.5)} ${largo - Math.max(dibujado - 6, 0.5)}`} strokeDashoffset={offset - 3}
            transform="rotate(-90 70 70)"
          />
        ))}

        {/* Centro elevado */}
        <circle cx="70" cy="70" r="33" className="donut-core" />
        <text x="70" y="68" textAnchor="middle" className="donut-number">{centro ?? total}</text>
        <text x="70" y="85" textAnchor="middle" className="donut-caption" style={subtitulo && subtitulo.length > 9 ? { fontSize: '7.4px', letterSpacing: 0 } : undefined}>{subtitulo}</text>
      </svg>
      <ul className="legend">
        {items.map((i) => (
          <li key={i.label}>
            <span className="legend-dot" style={{ background: `linear-gradient(145deg, ${(DEGRADADOS[i.color] || DEGRADADOS.azul)[0]}, ${(DEGRADADOS[i.color] || DEGRADADOS.azul)[1]})` }} />
            {i.label}
            <strong>{i.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Se exporta para quien necesite el color plano de una serie
export { COLORES }
