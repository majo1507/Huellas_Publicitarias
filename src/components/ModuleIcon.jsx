import Icon from './Icon.jsx'

// Mapa semántico de módulos de ORVEX a iconos vectoriales limpios y animados
const ICONO_POR_MODULO = {
  clientes: 'users',
  solicitudes: 'inbox',
  ordenes: 'clipboard',
  diseno: 'pen',
  produccion: 'printer',
  inventario: 'package',
  entregas: 'truck',
  comunicaciones: 'message',
  postventa: 'life-buoy',
  reportes: 'bar-chart',
}

/**
 * Componente ModuleIcon:
 * Renderiza iconografía vectorial moderna, limpia y con micro-animaciones semánticas
 * al pasar el cursor, manteniendo coherencia gráfica en todos los módulos de ORVEX.
 */
export default function ModuleIcon({ modulo, nombre, tamano = 20, className = '' }) {
  const claveModulo = modulo ? String(modulo).toLowerCase() : ''
  const iconoResuelto = nombre || ICONO_POR_MODULO[claveModulo] || 'layers'

  return (
    <span className={`module-vector-badge ${claveModulo ? `module-${claveModulo}` : ''} ${className}`.trim()}>
      <Icon nombre={iconoResuelto} tamano={tamano} />
    </span>
  )
}
