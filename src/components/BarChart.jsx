// Gráfico de barras horizontales de precisión
// items: [{ label: 'Diseño', value: 3 }, ...]
export default function BarChart({ items, color = 'azul', unidad = '' }) {
  const maximo = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="barchart">
      {items.map((item, idx) => {
        const pct = Math.max((item.value / maximo) * 100, item.value > 0 ? 7 : 0)
        return (
          <div key={item.label} className="bar-row" title={`${item.label}: ${item.value}${unidad}`} style={{ '--bar-idx': idx }}>
            <span className="bar-label">{item.label}</span>
            <div className="bar-track">
              <div
                className={`bar-fill bar-${item.color || color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="bar-value">{item.value}{unidad}</span>
          </div>
        )
      })}
    </div>
  )
}
