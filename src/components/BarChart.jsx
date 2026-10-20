// Gráfico de barras horizontales con relieve 3D sutil
// items: [{ label: 'Diseño', value: 3 }, ...]
export default function BarChart({ items, color = 'azul', unidad = '' }) {
  const maximo = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="barchart">
      {items.map((item) => (
        <div key={item.label} className="bar-row" title={`${item.label}: ${item.value}${unidad}`}>
          <span className="bar-label">{item.label}</span>
          <div className="bar-track">
            <div
              className={`bar-fill bar-${item.color || color}`}
              style={{ width: `${Math.max((item.value / maximo) * 100, item.value > 0 ? 6 : 0)}%` }}
            />
          </div>
          <span className="bar-value">{item.value}{unidad}</span>
        </div>
      ))}
    </div>
  )
}
