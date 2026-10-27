// Gráfico de columnas comparativas de precisión (dos series). datos: [{ label, recibidas, entregadas }]
export default function ColumnChart({ datos, serieA = 'Recibidas', serieB = 'Entregadas' }) {
  const maximo = Math.max(...datos.flatMap((d) => [d.recibidas, d.entregadas]), 1)
  const alto = (v) => `${Math.max((v / maximo) * 100, v > 0 ? 15 : 5)}%`
  const totalA = datos.reduce((s, d) => s + (d.recibidas || 0), 0)
  const totalB = datos.reduce((s, d) => s + (d.entregadas || 0), 0)

  const marcasEje = [
    maximo,
    Math.round(maximo * 0.66),
    Math.round(maximo * 0.33),
    0,
  ]

  return (
    <div className="column-chart-wrap">
      <div className="column-chart-head">
        <ul className="legend legend-inline">
          <li>
            <span className="legend-swatch legend-swatch-a" />
            <span className="legend-series-name">{serieA}</span>
            <strong className="legend-series-total">{totalA}</strong>
          </li>
          <li>
            <span className="legend-swatch legend-swatch-b" />
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
