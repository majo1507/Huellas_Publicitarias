// Gráfico de barras horizontales sencillo hecho solo con CSS
// items: [{ label: 'Diseño', value: 3 }, ...]
export default function BarChart({ items, color = 'azul', unidad = '' }) {
  const maximo = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="barchart">
      {items.map((item) => (
        <div key={item.label} className="bar-row">
          <span className="bar-label">{item.label}</span>
          <div className="bar-track">
            <div className={`bar-fill bar-${item.color || color}`} style={{ width: `${(item.value / maximo) * 100}%` }} />
          </div>
          <span className="bar-value">{item.value}{unidad}</span>
        </div>
      ))}
    </div>
  )
}
