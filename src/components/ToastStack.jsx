import Icon from './Icon.jsx'

const ICONOS = { exito: 'check-circle', error: 'x-circle', aviso: 'alert-triangle', info: 'info' }

// Mensajes emergentes de éxito / error / aviso (esquina superior derecha)
export default function ToastStack({ toasts, onClose }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
          <Icon nombre={ICONOS[t.tipo]} tamano={20} />
          <span>{t.texto}</span>
          <button className="toast-close" onClick={() => onClose(t.id)} aria-label="Cerrar mensaje">
            <Icon nombre="x" tamano={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
