// Generador visual de piezas publicitarias para ORVEX / Huellas Publicidad.
// Renderiza gráficos SVG vectoriales basados en la pieza real, dimensiones y cliente.

const PALETAS = {
  C1: { pri: '#0f223d', sec: '#2563eb', acento: '#dcfce7', txt: '#ffffff', brand: 'ABC' },
  C2: { pri: '#0284c7', sec: '#e0f2fe', acento: '#16a34a', txt: '#ffffff', brand: 'XYZ' },
  C3: { pri: '#78350f', sec: '#fef3c7', acento: '#d97706', txt: '#ffffff', brand: 'CAFÉ' },
  C4: { pri: '#dc2626', sec: '#fee2e2', acento: '#0f2038', txt: '#ffffff', brand: 'FUERZA' },
  C5: { pri: '#16a34a', sec: '#dcfce7', acento: '#2563eb', txt: '#ffffff', brand: 'SALUD' },
  C6: { pri: '#1e3a8a', sec: '#e0e7ff', acento: '#f59e0b', txt: '#ffffff', brand: 'ANDES' },
  C7: { pri: '#1e293b', sec: '#f1f5f9', acento: '#3b82f6', txt: '#ffffff', brand: 'SAN MARCOS' },
  C8: { pri: '#b91c1c', sec: '#fff1f2', acento: '#fbbf24', txt: '#ffffff', brand: 'EL FOGÓN' },
}

export default function DesignPreview({ order, version, grande = false, className = '' }) {
  if (!order) return null

  const clienteId = order.clienteId || 'C1'
  const pal = PALETAS[clienteId] || PALETAS.C1
  const v = version ? version.numero : (order.versiones?.length || 1)
  const producto = order.producto || 'Pieza publicitaria'
  const cliente = order.cliente || 'Huellas Publicidad'
  const tipo = (order.producto || '').toLowerCase()

  // Sello o indicador de versión en la esquina
  const TagVersion = () => (
    <g className="design-vtag" transform="translate(6, 6)">
      <rect width="32" height="18" rx="4" fill="#0b1a30" opacity="0.82" />
      <text x="16" y="13" fontSize="10" fontWeight="700" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">
        v{v}
      </text>
    </g>
  )

  // 1. PENDÓN PUBLICITARIO (Vertical)
  if (tipo.includes('pendón') || tipo.includes('banner') || tipo.includes('roll-up')) {
    return (
      <svg
        viewBox="0 0 160 260"
        className={`design-svg ${grande ? 'svg-grande' : ''} ${className}`}
        role="img"
        aria-label={`Diseño de ${producto} versión ${v}`}
      >
        <defs>
          <linearGradient id={`pGrad-${order.id}-${v}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.pri} />
            <stop offset="60%" stopColor={pal.sec} />
            <stop offset="100%" stopColor="#0b1a30" />
          </linearGradient>
        </defs>
        {/* Fondo del pendón con refuerzo y ojales */}
        <rect width="160" height="260" rx="4" fill={`url(#pGrad-${order.id}-${v})`} />
        {/* Ojales simulados */}
        <circle cx="10" cy="10" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <circle cx="150" cy="10" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <circle cx="10" cy="250" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <circle cx="150" cy="250" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />

        {/* Emblema central de la marca */}
        <circle cx="80" cy="74" r="34" fill="#ffffff" opacity="0.96" />
        <circle cx="80" cy="74" r="30" fill="none" stroke={pal.sec} strokeWidth="2" strokeDasharray="3 2" />
        <text x="80" y="80" fontSize="16" fontWeight="900" textAnchor="middle" fill={pal.pri} fontFamily="sans-serif">
          {pal.brand}
        </text>

        {/* Textos y títulos publicitarios */}
        <text x="80" y="136" fontSize="13" fontWeight="800" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">
          {cliente.toUpperCase()}
        </text>
        <rect x="36" y="146" width="88" height="3" rx="1.5" fill={pal.acento} />

        <text x="80" y="170" fontSize="10" fontWeight="600" textAnchor="middle" fill="#f1f5f9" fontFamily="sans-serif">
          COMUNICACIÓN GRÁFICA
        </text>
        <text x="80" y="186" fontSize="9" textAnchor="middle" fill="#cbd5e1" fontFamily="sans-serif">
          {order.dimensiones || '2.00m x 1.00m'}
        </text>

        {/* Franja de contacto inferior */}
        <rect x="0" y="215" width="160" height="45" fill="#081326" opacity="0.9" />
        <rect x="0" y="215" width="160" height="2" fill={pal.acento} />
        <text x="80" y="234" fontSize="9" fontWeight="700" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif">
          TEL: 300 111 2233
        </text>
        <text x="80" y="248" fontSize="8" textAnchor="middle" fill="#94a3b8" fontFamily="sans-serif">
          HUELLAS PUBLICIDAD
        </text>

        <TagVersion />
      </svg>
    )
  }

  // 2. CATÁLOGO / EDITORIAL (Horizontal con doble página o portada)
  if (tipo.includes('catálogo') || tipo.includes('agenda') || tipo.includes('libro')) {
    return (
      <svg
        viewBox="0 0 240 160"
        className={`design-svg ${grande ? 'svg-grande' : ''} ${className}`}
        role="img"
        aria-label={`Diseño de ${producto} versión ${v}`}
      >
        <rect width="240" height="160" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        {/* Lomo y encuadernación */}
        <rect x="0" y="0" width="18" height="160" rx="3" fill={pal.pri} />
        <line x1="8" y1="0" x2="8" y2="160" stroke="#ffffff" strokeWidth="1" strokeDasharray="6 4" opacity="0.5" />

        {/* Cabecera y portada */}
        <rect x="30" y="16" width="194" height="46" rx="4" fill={pal.sec} opacity="0.25" />
        <rect x="40" y="24" width="8" height="30" rx="2" fill={pal.pri} />
        <text x="56" y="38" fontSize="13" fontWeight="800" fill={pal.pri} fontFamily="sans-serif">
          {cliente}
        </text>
        <text x="56" y="52" fontSize="9" fontWeight="600" fill="#475569" fontFamily="sans-serif">
          Catálogo Corporativo de Productos
        </text>

        {/* Columnas de contenido */}
        <rect x="30" y="74" width="90" height="70" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
        <circle cx="75" cy="100" r="16" fill={pal.sec} opacity="0.5" />
        <rect x="40" y="126" width="70" height="5" rx="2" fill="#94a3b8" />
        <rect x="40" y="134" width="50" height="4" rx="2" fill="#cbd5e1" />

        <rect x="134" y="74" width="90" height="70" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
        <circle cx="179" cy="100" r="16" fill={pal.acento} opacity="0.6" />
        <rect x="144" y="126" width="70" height="5" rx="2" fill="#94a3b8" />
        <rect x="144" y="134" width="50" height="4" rx="2" fill="#cbd5e1" />

        <TagVersion />
      </svg>
    )
  }

  // 3. TARJETAS / PAPELERÍA CORPORATIVA
  if (tipo.includes('tarjeta') || tipo.includes('papelería')) {
    return (
      <svg
        viewBox="0 0 240 140"
        className={`design-svg ${grande ? 'svg-grande' : ''} ${className}`}
        role="img"
        aria-label={`Diseño de ${producto} versión ${v}`}
      >
        <rect width="240" height="140" rx="6" fill="#0f2038" />
        {/* Curvas modernas de diseño */}
        <path d="M0 0 L140 0 L90 140 L0 140 Z" fill={pal.pri} opacity="0.9" />
        <path d="M120 0 L150 0 L100 140 L70 140 Z" fill={pal.sec} opacity="0.5" />

        {/* Logo de la empresa */}
        <circle cx="48" cy="48" r="22" fill="#ffffff" />
        <text x="48" y="53" fontSize="12" fontWeight="800" textAnchor="middle" fill={pal.pri} fontFamily="sans-serif">
          {pal.brand}
        </text>

        {/* Textos de la tarjeta */}
        <text x="145" y="44" fontSize="12" fontWeight="800" fill="#ffffff" fontFamily="sans-serif">
          {order.entrega?.contacto || 'Laura Gómez'}
        </text>
        <text x="145" y="58" fontSize="8" fontWeight="600" fill={pal.sec} fontFamily="sans-serif">
          Gerencia de Marca
        </text>
        <rect x="145" y="66" width="75" height="1.5" fill="#334155" />

        <text x="145" y="82" fontSize="7.5" fill="#cbd5e1" fontFamily="sans-serif">
          contacto@{cliente.toLowerCase().replace(/\s+/g, '')}.com
        </text>
        <text x="145" y="96" fontSize="7.5" fill="#cbd5e1" fontFamily="sans-serif">
          +57 (601) 745 2210 · Bogotá
        </text>
        <text x="145" y="110" fontSize="7.5" fill="#94a3b8" fontFamily="sans-serif">
          {cliente}
        </text>

        <TagVersion />
      </svg>
    )
  }

  // 4. PIEZA ESTÁNDAR / SEÑALÉTICA / VOLANTES / VINILOS / CAJAS / MENÚS
  return (
    <svg
      viewBox="0 0 240 150"
      className={`design-svg ${grande ? 'svg-grande' : ''} ${className}`}
      role="img"
      aria-label={`Diseño de ${producto} versión ${v}`}
    >
      <defs>
        <linearGradient id={`stdGrad-${order.id}-${v}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" rx="6" fill={`url(#stdGrad-${order.id}-${v})`} stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="0" y="0" width="240" height="34" fill={pal.pri} />

      <circle cx="204" cy="74" r="32" fill={pal.sec} opacity="0.4" />
      <circle cx="204" cy="74" r="16" fill={pal.acento} opacity="0.8" />

      <text x="16" y="22" fontSize="12" fontWeight="800" fill="#ffffff" fontFamily="sans-serif">
        {cliente.toUpperCase()}
      </text>

      <text x="16" y="64" fontSize="14" fontWeight="800" fill="#0f2038" fontFamily="sans-serif">
        {producto}
      </text>

      <rect x="16" y="76" width="110" height="5" rx="2" fill={pal.sec} />
      <rect x="16" y="88" width="85" height="4" rx="2" fill="#94a3b8" opacity="0.6" />
      <rect x="16" y="98" width="95" height="4" rx="2" fill="#cbd5e1" />

      <rect x="0" y="122" width="240" height="28" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
      <text x="16" y="140" fontSize="8.5" fontWeight="600" fill="#64748b" fontFamily="sans-serif">
        Especificaciones: {order.material} · {order.dimensiones}
      </text>

      <TagVersion />
    </svg>
  )
}
