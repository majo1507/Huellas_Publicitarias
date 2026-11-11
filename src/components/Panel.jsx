import Icon from './Icon.jsx'

// Panel contenedor con encabezado estructurado, icono vectorial animado y ranura de acciones.
// Optimizado para evitar duplicidad de bordes y márgenes cuando contiene tablas u otros contenedores.
export default function Panel({
  titulo,
  subtitulo,
  etiqueta,
  icono,
  accion,
  children,
  className = '',
  sinPadding = false,
  compacto = false,
  style,
}) {
  const clases = [
    'card',
    'panel',
    compacto ? 'panel-compact' : '',
    sinPadding ? 'panel-flush' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <section className={clases} style={style}>
      {(titulo || accion) && (
        <header className="card-head">
          <div className="card-head-title">
            <div className="card-title-row">
              <h2>
                {icono && (
                  <span className="card-head-icon" aria-hidden="true">
                    <Icon nombre={icono} tamano={16} />
                  </span>
                )}
                <span>{titulo}</span>
              </h2>
              {etiqueta && <span className="card-tag-pill">{etiqueta}</span>}
            </div>
            {subtitulo && <p className="card-subtitle">{subtitulo}</p>}
          </div>
          {accion && <div className="card-head-action">{accion}</div>}
        </header>
      )}
      <div className={sinPadding ? 'card-body-flush' : 'card-body'}>{children}</div>
    </section>
  )
}
