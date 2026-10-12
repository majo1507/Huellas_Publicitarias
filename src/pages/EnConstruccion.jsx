// Pantalla temporal para módulos que se construirán en la Etapa 2
export default function EnConstruccion({ titulo }) {
  return (
    <div>
      <h1>{titulo}</h1>
      <div className="card placeholder">
        <span>🚧</span>
        <p>Este módulo se construirá en la siguiente etapa.</p>
      </div>
    </div>
  )
}
