// Gráfico de columnas comparativas Futuristic Enterprise (dos series). datos: [{ label, recibidas, entregadas }]
export default function ColumnChart({ datos, serieA = 'Recibidas', serieB = 'Entregadas' }) {
  const maximo = Math.max(...datos.flatMap((d) => [d.recibidas, d.entregadas]), 1)
  const alto = (v) => `${Math.max((v / maximo) * 100, v > 0 ? 15 : 5)}%`
  const totalA = datos.reduce((s, d) => s + (d.recibidas || 0), 0)
  const totalB = datos.reduce((s, d) => s + (d.entregadas || 0), 0)

  // Escala vertical fiel a los datos originales
  const marcasEje = [
    maximo,
    Math.round(maximo * 0.66),
    Math.round(maximo * 0.33),
    0,
  ]

  // Curva vectorial suave que acompaña la serie principal sin alterar valores
  const anchoSvg = 480
  const altoSvg = 170
  const puntosA = datos.map((d, i) => {
    const x = datos.length > 1 ? (i / (datos.length - 1)) * (anchoSvg - 56) + 28 : anchoSvg / 2
    const y = altoSvg - 16 - ((d.recibidas || 0) / maximo) * (altoSvg - 38)
    return { x, y }
  })

  const pathLinea = puntosA.length > 1
    ? puntosA.reduce((acc, p, i, arr) => {
        if (i === 0) return `M ${p.x} ${p.y}`
        const prev = arr[i - 1]
        const cx = (prev.x + p.x) / 2
        return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`
      }, '')
    : ''

  return (
    <div className="column-chart-wrap">
      <div className="column-chart-head">
        <ul className="legend legend-inline">
          <li>
            <span className="legend-dot legend-dot-a" />
            <span className="legend-series-name">{serieA}</span>
            <strong className="legend-series-total">{totalA}</strong>
          </li>
          <li>
            <span className="legend-dot legend-dot-b" />
            <span className="legend-series-name">{serieB}</span>
            <strong className="legend-series-total">{totalB}</strong>
          </li>
        </ul>
      </div>

      <div className="columns-stage">
        <div className="columns-yaxis" aria-hidden="true">
          {marcasEje.map((m, idx) => (
            <span key={idx}>{m}</span>
          ))}
        </div>

        <div className="columns" role="img" aria-label="Gráfico de columnas por semana">
          {pathLinea && (
            <svg className="columns-trend-svg" viewBox={`0 0 ${anchoSvg} ${altoSvg}`} preserveAspectRatio="none" aria-hidden="true">
              <path d={pathLinea} fill="none" stroke="#65E4F2" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="4 4" />
              {puntosA.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#19C6E5" fillOpacity="0.55" />
              ))}
            </svg>
          )}

          {datos.map((d, idx) => (
            <div key={d.label} className="column-group" style={{ '--col-idx': idx }}>
              <div className="column-bars">
                <div
                  className="column column-a"
                  style={{ height: alto(d.recibidas) }}
                  title={`${d.label} · ${serieA}: ${d.recibidas}`}
                  data-tip={`${serieA}: ${d.recibidas}`}
                >
                  {d.recibidas > 0 && <span>{d.recibidas}</span>}
                </div>
                <div
                  className="column column-b"
                  style={{ height: alto(d.entregadas) }}
                  title={`${d.label} · ${serieB}: ${d.entregadas}`}
                  data-tip={`${serieB}: ${d.entregadas}`}
                >
                  {d.entregadas > 0 && <span>{d.entregadas}</span>}
                </div>
              </div>
              <small>{d.label}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
