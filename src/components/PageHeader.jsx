import Icon from './Icon.jsx'

// Encabezado Futuristic Enterprise: título, contexto creativo/impresión, ondas de tinta en movimiento y acciones
export default function PageHeader({ titulo, subtitulo, icono, acciones, volver, etiqueta }) {
  return (
    <header className="page-head">
      {/* Arte vectorial de identidad: onda de tinta en movimiento + marcas de registro gráfico */}
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
            <stop offset="45%" stopColor="#247BFF" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#19C6E5" stopOpacity="0.38" />
          </linearGradient>
          <linearGradient id="orvexHeaderWave2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#19C6E5" stopOpacity="0" />
            <stop offset="55%" stopColor="#19C6E5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#65E4F2" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          d="M40 135 C 160 110, 230 25, 360 55 C 445 75, 495 18, 560 8 L 560 140 L 40 140 Z"
          fill="url(#orvexHeaderWave1)"
        />
        <path
          d="M110 140 C 215 95, 290 45, 405 72 C 475 88, 515 42, 560 28"
          stroke="url(#orvexHeaderWave2)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M180 140 C 265 112, 340 68, 440 88 C 495 98, 530 64, 560 52"
          stroke="#65E4F2"
          strokeOpacity="0.26"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        {/* Puntos luminosos de flujo de datos y registro gráfico */}
        <circle cx="405" cy="72" r="3.2" fill="#65E4F2" fillOpacity="0.85" />
        <circle cx="405" cy="72" r="7" stroke="#19C6E5" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="495" cy="54" r="2.5" fill="#247BFF" fillOpacity="0.9" />
        <g stroke="#65E4F2" strokeOpacity="0.32" strokeWidth="1">
          <path d="M526 22 H538 M532 16 V28" />
          <path d="M310 26 H318 M314 22 V30" />
        </g>
      </svg>

      <div className="page-head-main">
        {volver && (
          <button className="back-link" onClick={volver.onClick}>
            <Icon nombre="arrow-left" tamano={15} /> {volver.texto}
          </button>
        )}
        <div className="page-title">
          {icono && (
            <span className="page-title-icon" aria-hidden="true">
              <span className="ink-ripple" />
              <Icon nombre={icono} tamano={20} />
            </span>
          )}
          <div className="page-title-copy">
            <div className="page-eyebrow-row">
              <span className="page-eyebrow">{etiqueta || 'ORVEX · CENTRO CREATIVO Y PRODUCCIÓN GRÁFICA'}</span>
              <span className="cmyk-ticks" aria-hidden="true" title="Registro cromático CMYK">
                <i className="cmyk-c" />
                <i className="cmyk-m" />
                <i className="cmyk-y" />
                <i className="cmyk-k" />
              </span>
            </div>
            <h1>{titulo}</h1>
            {subtitulo && <p className="subtitle">{subtitulo}</p>}
          </div>
        </div>
      </div>
      {acciones && <div className="page-head-actions">{acciones}</div>}
    </header>
  )
}
