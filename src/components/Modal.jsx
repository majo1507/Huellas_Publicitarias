import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

// Ventana modal reutilizable.
// - Con "etiqueta": muestra un cuadro de texto obligatorio (motivo, observación, solución...).
// - Con "children": muestra un formulario o contenido personalizado dentro de .modal-body.
// - Sin "etiqueta" ni "children": es un diálogo de confirmación con "mensaje".
// - tipoBoton: 'primary' | 'success' | 'danger'
export default function Modal({
  titulo, subtitulo, icono = 'edit', etiqueta, ayuda, mensaje, minimo = 5,
  textoBoton = 'Guardar', tipoBoton = 'primary', onConfirm, onClose, children,
}) {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')

  // Cerrar con la tecla Escape
  useEffect(() => {
    const alPulsar = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    if (etiqueta && texto.trim().length < minimo) {
      setError(`Escribe al menos ${minimo} caracteres para continuar.`)
      return
    }
    if (children && !etiqueta) {
      onConfirm(e)
    } else {
      onConfirm(texto.trim(), e)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} noValidate>
        <header className="modal-head">
          <span className={`modal-icon modal-icon-${tipoBoton}`}><Icon nombre={icono} tamano={20} /></span>
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon nombre="x" /></button>
        </header>

        <div className="modal-body">
          {mensaje && <p className="modal-message">{mensaje}</p>}
          {etiqueta && (
            <label className={error ? 'field has-error' : 'field'}>
              <span className="field-label">{etiqueta}</span>
              <textarea
                rows="4"
                value={texto}
                autoFocus
                onChange={(e) => { setTexto(e.target.value); setError('') }}
              />
              {error ? <span className="field-error">{error}</span> : ayuda && <span className="field-hint">{ayuda}</span>}
            </label>
          )}
          {children}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className={`btn btn-${tipoBoton}`} autoFocus={!etiqueta && !children}>{textoBoton}</button>
        </footer>
      </form>
    </div>
  )
}
