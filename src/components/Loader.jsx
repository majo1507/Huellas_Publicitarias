// Indicador de carga a pantalla completa (esqueleto) mientras se consultan los datos
export default function Loader({ texto = 'Cargando información...' }) {
  return (
    <div className="loader-screen" role="status">
      <div className="loader-card">
        <span className="spinner" />
        <strong>ORVEX</strong>
        <p>{texto}</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  )
}
