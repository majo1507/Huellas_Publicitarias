import Icon from './Icon.jsx'

// Panel editorial (tarjeta) con título, subtítulo/etiqueta opcional, icono y acción en la esquina
export default function Panel({ titulo, subtitulo, etiqueta, icono, accion, children, className = '', sinPadding = false, style }) {
  return (
    <section className={`card panel ${className}`.trim()} style={style}>
      {(titulo || accion) && (
        <header className="card-head">
          <div className="card-head-title">
            {etiqueta && <span className="card-eyebrow">{etiqueta}</span>}
            <h2>
              {icono && <Icon nombre={icono} tamano={17} />}
              <span>{titulo}</span>
            </h2>
            {subtitulo && <p className="card-subtitle">{subtitulo}</p>}
          </div>
          {accion && <div className="card-head-action">{accion}</div>}
        </header>
      )}
      <div className={sinPadding ? '' : 'card-body'}>{children}</div>
    </section>
  )
}
