import Icon from './Icon.jsx'

// Encabezado ejecutivo de ORVEX: jerarquía tipográfica directa (h1 lidera), iconografía vectorial animada,
// telemetría cromática CMYK integrada y acciones contextuales.
export default function PageHeader({ titulo, subtitulo, icono, acciones, volver, etiqueta }) {
  return (
    <header className="page-head">
      {/* Arte vectorial de identidad: curvas técnicas de precisión e impresión gráfica */}
      <svg
        className="page-head-inkwave"
        viewBox="0 0 560 140"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="orvexHeaderWave1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#247BFF" stopOpacity="0" />
            <stop offset="45%" stopColor="#247BFF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#19C6E5" stopOpacity="0.32" />
          </linearGradient>
          <linearGradient id="orvexHeaderWave2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#19C6E5" stopOpacity="0" />
            <stop offset="55%" stopColor="#19C6E5" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#65E4F2" stopOpacity="0.42" />
          </linearGradient>
        </defs>
        <path
          className="inkwave-fill"
          d="M40 135 C 160 110, 230 25, 360 55 C 445 75, 495 18, 560 8 L 560 140 L 40 140 Z"
          fill="url(#orvexHeaderWave1)"
        />
        <path
          className="inkwave-stroke-main"
          d="M110 140 C 215 95, 290 45, 405 72 C 475 88, 515 42, 560 28"
          stroke="url(#orvexHeaderWave2)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          className="inkwave-stroke-dash"
          d="M180 140 C 265 112, 340 68, 440 88 C 495 98, 530 64, 560 52"
          stroke="#65E4F2"
          strokeOpacity="0.24"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        <circle className="inkwave-node" cx="405" cy="72" r="3" fill="#65E4F2" fillOpacity="0.85" />
        <circle className="inkwave-node-ring" cx="405" cy="72" r="6.5" stroke="#19C6E5" strokeOpacity="0.32" strokeWidth="1" />
        <circle className="inkwave-node" cx="495" cy="54" r="2.4" fill="#247BFF" fillOpacity="0.9" />
        <g stroke="#65E4F2" strokeOpacity="0.3" strokeWidth="1">
          <path d="M526 22 H538 M532 16 V28" />
          <path d="M310 26 H318 M314 22 V30" />
        </g>
      </svg>

      <div className="page-head-main">
        {volver && (
          <button type="button" className="back-link" onClick={volver.onClick}>
            <Icon nombre="arrow-left" tamano={15} />
            <span>{volver.texto}</span>
          </button>
        )}
        <div className="page-title">
          {icono && (
            <span className="page-title-icon" aria-hidden="true">
              <span className="ink-ripple" />
              <Icon nombre={icono} tamano={21} />
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
