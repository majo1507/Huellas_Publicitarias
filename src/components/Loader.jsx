// Indicador de carga a pantalla completa con esqueleto shimmer de alta velocidad (60fps GPU)
export default function Loader({ texto = 'Cargando información...' }) {
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <div className="loader-card">
        <span className="spinner" aria-hidden="true" />
        <strong>ORVEX</strong>
        <p>{texto}</p>
        <div className="skeleton skeleton-line skeleton-shimmer" />
        <div className="skeleton skeleton-line short skeleton-shimmer" />
      </div>
    </div>
  )
}
