import Icon from './Icon.jsx'

// Encabezado ejecutivo de ORVEX: jerarquía clara, iconografía vectorial,
// badge de contexto y acciones alineadas de forma ergonómica y compacta.
export default function PageHeader({ titulo, subtitulo, icono, acciones, volver, etiqueta, compacto = false }) {
  return (
    <header className={`page-head${compacto ? ' page-head-compact' : ''}`}>
      <div className="page-head-main">
        {volver && (
          <button type="button" className="back-link" onClick={volver.onClick}>
            <Icon nombre="arrow-left" tamano={14} />
            <span>{volver.texto}</span>
          </button>
        )}
        <div className="page-title">
          {icono && (
            <span className="page-title-icon" aria-hidden="true">
              <Icon nombre={icono} tamano={18} />
            </span>
          )}
          <div className="page-title-copy">
            <div className="page-heading-line">
              <h1>{titulo}</h1>
              <span className="page-telemetry-pill" title="Sistema de gestión e impresión gráfica ORVEX">
                <span className="cmyk-ticks" aria-hidden="true">
                  <i className="cmyk-c" />
                  <i className="cmyk-m" />
                  <i className="cmyk-y" />
                  <i className="cmyk-k" />
                </span>
                <span className="page-telemetry-label">{etiqueta || 'ORVEX · FLUJO INTEGRADO'}</span>
              </span>
            </div>
            {subtitulo && <p className="subtitle">{subtitulo}</p>}
          </div>
        </div>
      </div>
      {acciones && <div className="page-head-actions">{acciones}</div>}
    </header>
  )
}
