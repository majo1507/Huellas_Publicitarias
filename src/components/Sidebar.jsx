import { LISTA_ROLES, ROLES, normalizarRol, obtenerConfigRol } from '../data/roles.js'
import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'

// Pantallas de detalle de una orden: se resaltan bajo "Órdenes" (o "Inicio" si el rol no tiene esa opción)
const pantallasDeOrden = ['detalle', 'aprobacion', 'historial']

// Marca de ORVEX con identidad Futuristic Enterprise (Azul Eléctrico + Cian Luminoso)
function Marca({ colapsado, onToggleColapso }) {
  return (
    <div className="brand">
      <div className="brand-mark-wrap">
        <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true" className="brand-svg">
          <defs>
            <linearGradient id="orvexFuturisticGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#247BFF" />
              <stop offset="0.55" stopColor="#142338" />
              <stop offset="1" stopColor="#0B1424" />
            </linearGradient>
            <linearGradient id="orvexCyanStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#65E4F2" />
              <stop offset="1" stopColor="#19C6E5" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="url(#orvexFuturisticGrad)" stroke="url(#orvexCyanStroke)" strokeWidth="1.4" />
          <circle cx="20" cy="20" r="8.8" fill="none" stroke="#F0F6FF" strokeWidth="3" />
          <path d="M13 29 L27 11" stroke="url(#orvexCyanStroke)" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="27" cy="11" r="2.1" fill="#65E4F2" />
        </svg>
        <div className="brand-copy">
          <strong>ORVEX</strong>
          <small>Huellas Publicidad</small>
        </div>
      </div>
      {onToggleColapso && (
        <button
          type="button"
          className="sidebar-rail-toggle"
          onClick={onToggleColapso}
          aria-label={colapsado ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          title={colapsado ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        >
          <Icon nombre={colapsado ? 'chevron-right' : 'chevron-left'} tamano={15} />
        </button>
      )}
    </div>
  )
}

// Barra lateral: perfil / selector de rol + menú agrupado por módulos (depende del rol)
export default function Sidebar({ role, current, irA, onChangeRole, abierto, colapsado = false, onClose, onLogout, onToggleColapso }) {
  const rolClave = normalizarRol(role)
  const rolConfig = obtenerConfigRol(rolClave)
  const { menu, usuario } = rolConfig
  const tienePedidos = menu.some((m) => m.page === 'pedidos')
  const paginaActiva = pantallasDeOrden.includes(current) ? (tienePedidos ? 'pedidos' : 'inicio') : current
  const grupos = [...new Set(menu.map((m) => m.grupo))]
  const clasesSidebar = ['sidebar', colapsado ? 'collapsed' : '', abierto ? 'open' : ''].filter(Boolean).join(' ')

  return (
    <>
      {abierto && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={clasesSidebar} aria-label="Menú principal">
        <Marca colapsado={colapsado} onToggleColapso={onToggleColapso} />

        <section className="context-card" aria-label="Contexto de trabajo">
          <div className="context-user" title={`${usuario.nombre} · ${usuario.cargo}`}>
            <Avatar nombre={usuario.nombre} />
            <div className="context-user-copy">
              <strong>{usuario.nombre}</strong>
              <small>{usuario.cargo}</small>
            </div>
          </div>
          <label className="role-select" title={`Cambiar rol activo (${rolConfig.nombre})`}>
            <span className="sr-only">Vista actual (rol)</span>
            <div className="role-select-box">
              <Icon nombre="users" tamano={15} />
              <select value={rolClave} onChange={(e) => onChangeRole(e.target.value)} aria-label="Vista actual (rol)">
                {LISTA_ROLES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <Icon nombre="chevron-down" tamano={15} />
            </div>
          </label>
        </section>

        <nav>
          {grupos.map((grupo) => (
            <div key={grupo} className="nav-group">
              <span className="nav-group-title">{grupo}</span>
              {menu.filter((m) => m.grupo === grupo).map((item) => (
                <button
                  key={item.page}
                  className={item.page === paginaActiva ? 'nav-item active' : 'nav-item'}
                  aria-current={item.page === paginaActiva ? 'page' : undefined}
                  data-tooltip={item.label}
                  aria-label={item.label}
                  title={colapsado ? item.label : undefined}
                  onClick={() => { irA(item.page); onClose() }}
                >
                  <span className="nav-icon"><Icon nombre={item.icono} tamano={18} /></span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom-zone">
          {onLogout && (
            <div className="sidebar-logout">
              <button
                type="button"
                className="nav-item nav-logout"
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                data-tooltip="Cerrar sesión"
              >
                <span className="nav-icon"><Icon nombre="log-out" tamano={18} /></span>
                <span className="nav-label">Cerrar sesión</span>
              </button>
            </div>
          )}

          {/* Emblema gráfico vectorial: ondas de tinta e impresión creativa */}
          <div className="sidebar-ink-art" aria-hidden="true">
            <svg viewBox="0 0 220 58" fill="none" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sbWaveA" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#247BFF" stopOpacity="0.42" />
                  <stop offset="100%" stopColor="#19C6E5" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="sbWaveB" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#19C6E5" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#65E4F2" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path d="M0 44 C 52 14, 118 56, 220 12 L 220 58 L 0 58 Z" fill="url(#sbWaveA)" />
              <path d="M0 50 C 68 24, 134 48, 220 22" stroke="url(#sbWaveB)" strokeWidth="1.6" />
              <circle cx="38" cy="36" r="2.2" fill="#65E4F2" fillOpacity="0.8" />
              <circle cx="164" cy="28" r="2" fill="#247BFF" fillOpacity="0.9" />
            </svg>
            <p className="sidebar-footer">ORVEX · Huellas Publicidad</p>
          </div>
        </div>
      </aside>
    </>
  )
}
