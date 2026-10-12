import Icon from './Icon.jsx'

// Encabezado de cada pantalla: título, descripción y botones de acción
export default function PageHeader({ titulo, subtitulo, icono, acciones, volver }) {
  return (
    <div className="page-head">
      <div className="page-head-main">
        {volver && (
          <button className="back-link" onClick={volver.onClick}>
            <Icon nombre="arrow-left" tamano={16} /> {volver.texto}
          </button>
        )}
        <div className="page-title">
          {icono && <span className="page-title-icon"><Icon nombre={icono} tamano={22} /></span>}
          <div>
            <h1>{titulo}</h1>
            {subtitulo && <p className="subtitle">{subtitulo}</p>}
          </div>
        </div>
      </div>
      {acciones && <div className="page-head-actions">{acciones}</div>}
    </div>
  )
}
