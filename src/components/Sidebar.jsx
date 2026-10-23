import { LISTA_ROLES, ROLES } from '../data/roles.js'
import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'

// Pantallas de detalle de una orden: se resaltan bajo "Órdenes" (o "Inicio" si el rol no tiene esa opción)
const pantallasDeOrden = ['detalle', 'aprobacion', 'historial']

// Marca de ORVEX
function Marca() {
  return (
    <div className="brand">
      <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
        <defs>
          <linearGradient id="orvexGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#orvexGrad)" />
        <circle cx="20" cy="20" r="9" fill="none" stroke="#fff" strokeWidth="3.4" />
        <path d="M13 29 L27 11" stroke="#bfe0ff" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <div>
        <strong>ORVEX</strong>
        <small>Huellas Publicidad</small>
      </div>
    </div>
  )
}

// Barra lateral: perfil / selector de rol + menú agrupado por módulos (depende del rol)
export default function Sidebar({ role, current, irA, onChangeRole, abierto, colapsado = false, onClose, onLogout }) {
  const { menu, usuario } = ROLES[role]
  const tienePedidos = menu.some((m) => m.page === 'pedidos')
  const paginaActiva = pantallasDeOrden.includes(current) ? (tienePedidos ? 'pedidos' : 'inicio') : current
  const grupos = [...new Set(menu.map((m) => m.grupo))]
  const clasesSidebar = ['sidebar', colapsado ? 'collapsed' : '', abierto ? 'open' : ''].filter(Boolean).join(' ')

  return (
    <>
      {abierto && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={clasesSidebar} aria-label="Menú principal">
        <Marca />

        <section className="context-card" aria-label="Contexto de trabajo">
          <div className="context-user" title={`${usuario.nombre} · ${usuario.cargo}`}>
            <Avatar nombre={usuario.nombre} />
            <div>
              <strong>{usuario.nombre}</strong>
              <small>{usuario.cargo}</small>
            </div>
          </div>
          <label className="role-select" title={`Cambiar rol activo (${ROLES[role].nombre})`}>
            <span className="sr-only">Vista actual (rol)</span>
            <div className="role-select-box">
              <Icon nombre="users" tamano={15} />
              <select value={role} onChange={(e) => onChangeRole(e.target.value)} aria-label="Vista actual (rol)">
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
                  title={colapsado ? item.label : undefined}
                  onClick={() => { irA(item.page); onClose() }}
                >
                  <span className="nav-icon"><Icon nombre={item.icono} tamano={18} /></span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {onLogout && (
          <div style={{ padding: '0 12px 8px' }}>
            <button
              type="button"
              className="nav-item"
              style={{ width: '100%', color: 'var(--text-muted)' }}
              onClick={onLogout}
              title="Cerrar sesión"
            >
              <span className="nav-icon"><Icon nombre="log-out" tamano={18} /></span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
        <p className="sidebar-footer">ORVEX · Huellas Publicidad</p>
      </aside>
    </>
  )
}
