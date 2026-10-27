import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// Tema de la aplicación (oscuro prioritario / claro), centralizado.
// - El atributo data-theme del <html> es la única fuente para los estilos (ver src/theme.css).
// - La preferencia se guarda en localStorage; index.html la aplica antes de pintar para evitar parpadeos.
export const CLAVE_TEMA = 'orvex-theme-futuristic'
const TEMAS = ['dark', 'light']

function temaInicial() {
  const aplicado = document.documentElement.getAttribute('data-theme')
  return TEMAS.includes(aplicado) ? aplicado : 'dark'
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(CLAVE_TEMA, theme) } catch { /* almacenamiento no disponible */ }
  }, [theme])

  // Mantiene sincronizadas varias pestañas abiertas
  useEffect(() => {
    const alCambiar = (e) => {
      if (e.key === CLAVE_TEMA && TEMAS.includes(e.newValue)) setThemeState(e.newValue)
    }
    window.addEventListener('storage', alCambiar)
    return () => window.removeEventListener('storage', alCambiar)
  }, [])

  // Transición breve de colores solo mientras se cambia el tema
  const animar = () => {
    const raiz = document.documentElement
    raiz.classList.add('theme-transition')
    window.setTimeout(() => raiz.classList.remove('theme-transition'), 320)
  }

  const setTheme = useCallback((nuevo) => {
    if (!TEMAS.includes(nuevo)) return
    animar()
    setThemeState(nuevo)
  }, [])

  const toggleTheme = useCallback(() => {
    animar()
    setThemeState((actual) => (actual === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
