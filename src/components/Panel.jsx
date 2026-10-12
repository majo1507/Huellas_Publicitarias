import Icon from './Icon.jsx'

// Panel (tarjeta) con título, icono y una acción opcional en la esquina
export default function Panel({ titulo, icono, accion, children, className = '', sinPadding = false }) {
  return (
    <section className={`card panel ${className}`}>
      {(titulo || accion) && (
        <header className="card-head">
          <h2>{icono && <Icon nombre={icono} tamano={18} />}{titulo}</h2>
          {accion}
        </header>
      )}
      <div className={sinPadding ? '' : 'card-body'}>{children}</div>
    </section>
  )
}
