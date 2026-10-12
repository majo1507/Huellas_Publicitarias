// Gráfico de dona (SVG). items: [{ label, value, color }]. color: azul | celeste | verde | amarillo | rojo | gris
const COLORES = {
  azul: '#2563eb', celeste: '#7cc0f5', verde: '#2fa36b', amarillo: '#e0a526', rojo: '#d9534f', gris: '#a9b6c9', marino: '#12305f',
}

export default function DonutChart({ items, centro, subtitulo }) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const radio = 52
  const largo = 2 * Math.PI * radio
  let acumulado = 0

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Gráfico de dona">
        <circle cx="70" cy="70" r={radio} fill="none" stroke="#e8eef7" strokeWidth="18" />
        {total > 0 && items.filter((i) => i.value > 0).map((i) => {
          const parte = (i.value / total) * largo
          const circulo = (
            <circle
              key={i.label}
              cx="70" cy="70" r={radio} fill="none"
              stroke={COLORES[i.color] || COLORES.azul} strokeWidth="18"
              strokeDasharray={`${parte} ${largo - parte}`} strokeDashoffset={-acumulado}
              transform="rotate(-90 70 70)"
            />
          )
          acumulado += parte
          return circulo
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-number">{centro ?? total}</text>
        <text x="70" y="86" textAnchor="middle" className="donut-caption">{subtitulo}</text>
      </svg>
      <ul className="legend">
        {items.map((i) => (
          <li key={i.label}>
            <span className="legend-dot" style={{ background: COLORES[i.color] || COLORES.azul }} />
            {i.label}
            <strong>{i.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
