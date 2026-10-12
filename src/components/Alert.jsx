import Icon from './Icon.jsx'

const ICONOS = { info: 'info', exito: 'check-circle', aviso: 'alert-triangle', error: 'alert-circle', bloqueo: 'lock' }

// Mensaje destacado dentro de una pantalla. tipo: info | exito | aviso | error | bloqueo
export default function Alert({ tipo = 'info', titulo, children, accion }) {
  return (
    <div className={`alert alert-${tipo}`} role={tipo === 'error' || tipo === 'bloqueo' ? 'alert' : 'status'}>
      <Icon nombre={ICONOS[tipo]} tamano={20} />
      <div className="alert-text">
        {titulo && <strong>{titulo}</strong>}
        <span>{children}</span>
      </div>
      {accion}
    </div>
  )
}
