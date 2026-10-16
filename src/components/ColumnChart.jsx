// Gráfico de columnas agrupadas (dos series). datos: [{ label, recibidas, entregadas }]
export default function ColumnChart({ datos, serieA = 'Recibidas', serieB = 'Entregadas' }) {
  const maximo = Math.max(...datos.flatMap((d) => [d.recibidas, d.entregadas]), 1)
  const alto = (v) => `${Math.max((v / maximo) * 100, v > 0 ? 6 : 2)}%`

  return (
    <div>
      <div className="columns" role="img" aria-label="Gráfico de columnas por semana">
        {datos.map((d) => (
          <div key={d.label} className="column-group">
            <div className="column-bars">
              <div className="column column-a" style={{ height: alto(d.recibidas) }} title={`${serieA}: ${d.recibidas}`}><span>{d.recibidas}</span></div>
              <div className="column column-b" style={{ height: alto(d.entregadas) }} title={`${serieB}: ${d.entregadas}`}><span>{d.entregadas}</span></div>
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
