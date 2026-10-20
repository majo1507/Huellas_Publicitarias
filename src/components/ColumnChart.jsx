// Gráfico de columnas agrupadas 3D (dos series). datos: [{ label, recibidas, entregadas }]
export default function ColumnChart({ datos, serieA = 'Recibidas', serieB = 'Entregadas' }) {
  const maximo = Math.max(...datos.flatMap((d) => [d.recibidas, d.entregadas]), 1)
  const alto = (v) => `${Math.max((v / maximo) * 100, v > 0 ? 14 : 3)}%`

  return (
    <div className="column-chart-wrap">
      <div className="columns" role="img" aria-label="Gráfico de columnas por semana">
        {datos.map((d) => (
          <div key={d.label} className="column-group">
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
      <ul className="legend legend-inline">
        <li><span className="legend-dot legend-dot-a" />{serieA}</li>
        <li><span className="legend-dot legend-dot-b" />{serieB}</li>
      </ul>
    </div>
  )
}
