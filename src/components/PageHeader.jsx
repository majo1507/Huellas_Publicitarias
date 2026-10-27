import Icon from './Icon.jsx'

// Determina la familia visual del módulo para variar la composición del encabezado sin repetir adornos
function resolverDominioVisual(titulo = '', icono = '', etiqueta = '') {
  const t = `${titulo} ${etiqueta}`.toLowerCase()
  if (t.includes('diseño') || t.includes('aprobación') || t.includes('arte') || icono === 'pen' || icono === 'image') {
    return 'diseno'
  }
  if (t.includes('entrega') || t.includes('despacho') || t.includes('postventa') || icono === 'truck' || icono === 'package' || icono === 'life-buoy') {
    return 'logistica'
  }
  if (t.includes('órdenes') || t.includes('orden') || t.includes('solicitud') || t.includes('actividad') || t.includes('tareas') || icono === 'clipboard' || icono === 'inbox') {
    return 'ordenes'
  }
  if (t.includes('producción') || t.includes('planta') || t.includes('tablero') || icono === 'printer' || icono === 'columns') {
    return 'produccion'
  }
  return 'ejecutivo'
}

const ETIQUETA_POR_DOMINIO = {
  produccion: 'CONTROL DE PLANTA · IMPRESIÓN Y ACABADOS',
  diseno: 'ESTUDIO CREATIVO · COMPOSICIÓN Y ARTE FINAL',
  ordenes: 'TRAZABILIDAD OPERATIVA · GESTIÓN DE ÓRDENES',
  logistica: 'DESPACHO Y CONFORMIDAD · RUTA DE ENTREGA',
  ejecutivo: 'SISTEMA DE GESTIÓN · HUELLAS PUBLICIDAD',
}

export default function PageHeader({ titulo, subtitulo, icono, acciones, volver, etiqueta, variante }) {
  const dominio = variante || resolverDominioVisual(titulo, icono, etiqueta)
  const textoEyebrow = etiqueta || ETIQUETA_POR_DOMINIO[dominio]

  return (
    <header className={`page-head page-head-${dominio}`} data-domain={dominio}>
      {/* Detalle gráfico contextual según la naturaleza del módulo (sin ondas ni puntos repetidos) */}
      {dominio === 'produccion' && (
        <div className="ph-motif ph-motif-produccion" aria-hidden="true">
          <span className="ph-crop ph-crop-tl" />
          <span className="ph-crop ph-crop-br" />
          <div className="ph-color-bar" title="Tira de control de color de prensa">
            <span className="cb-c" />
            <span className="cb-m" />
            <span className="cb-y" />
            <span className="cb-k" />
          </div>
        </div>
      )}

      {dominio === 'diseno' && (
        <svg className="ph-motif ph-motif-diseno" viewBox="0 0 260 90" fill="none" aria-hidden="true">
          <rect x="130" y="16" width="108" height="58" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="112" y1="45" x2="250" y2="45" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          <line x1="184" y1="8" x2="184" y2="82" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
          <rect x="127" y="13" width="6" height="6" stroke="#19C6E5" strokeOpacity="0.55" strokeWidth="1.2" />
          <rect x="235" y="71" width="6" height="6" stroke="#247BFF" strokeOpacity="0.55" strokeWidth="1.2" />
        </svg>
      )}

      {dominio === 'ordenes' && (
        <div className="ph-motif ph-motif-ordenes" aria-hidden="true">
          <div className="ph-ruler">
            <span /><span className="tall" /><span /><span /><span className="tall" /><span /><span /><span className="tall" />
          </div>
        </div>
      )}

      {dominio === 'logistica' && (
        <svg className="ph-motif ph-motif-logistica" viewBox="0 0 200 80" fill="none" aria-hidden="true">
          <path d="M90 22 L112 40 L90 58" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1.5" />
          <path d="M122 22 L144 40 L122 58" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.5" />
          <path d="M154 22 L176 40 L154 58" stroke="#19C6E5" strokeOpacity="0.32" strokeWidth="1.5" />
        </svg>
      )}

      <div className="page-head-main">
        {volver && (
          <button className="back-link" onClick={volver.onClick}>
            <Icon nombre="arrow-left" tamano={15} /> {volver.texto}
          </button>
        )}
        <div className="page-title">
          {icono && (
            <span className="page-title-icon" aria-hidden="true">
              <Icon nombre={icono} tamano={19} />
            </span>
          )}
          <div className="page-title-copy">
            <div className="page-eyebrow-row">
              <span className="page-eyebrow">{textoEyebrow}</span>
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
