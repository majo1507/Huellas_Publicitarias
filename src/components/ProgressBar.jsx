// Barra de progreso (valor de 0 a 100)
export default function ProgressBar({ valor }) {
  return (
    <div className="progress" title={`${valor}%`}>
      <div className="progress-fill" style={{ width: `${valor}%` }} />
      <span className="progress-text">{valor}%</span>
    </div>
  )
}
