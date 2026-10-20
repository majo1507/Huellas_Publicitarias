import Icon from './Icon.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'

// Selector de tema con sol y luna (modo claro / oscuro)
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const oscuro = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      role="switch"
      aria-checked={oscuro}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo oscuro activo · cambiar a claro' : 'Modo claro activo · cambiar a oscuro'}
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
      <Icon nombre="sun" tamano={16} className="ico-sun" />
      <Icon nombre="moon" tamano={16} className="ico-moon" />
    </button>
  )
}
