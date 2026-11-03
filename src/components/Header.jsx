import { useEffect, useRef, useState } from 'react'
import { ROLES, normalizarRol, obtenerConfigRol } from '../data/roles.js'
import Icon from './Icon.jsx'
import StatusBadge from './StatusBadge.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const ICONO_AVISO = { aviso: 'alert-triangle', error: 'alert-circle', info: 'info' }

// Títulos de las pantallas de detalle de una orden (no están en el menú)
const TITULOS_ORDEN = { detalle: 'Detalle de la orden', aprobacion: 'Aprobación de diseño', historial: 'Historial de la orden' }

// Barra superior: botón de menú lateral, título de la pantalla, buscador global, notificaciones y rol activo.
// El selector de rol vive ahora en la barra lateral (Contexto de trabajo).
export default function Header({ role, current, data, irA, colapsado = false, abierto = false, onMenu, onLogout }) {
  const rolClave = normalizarRol(role)
  const actual = obtenerConfigRol(rolClave)
  const [busqueda, setBusqueda] = useState('')
  const [verNotif, setVerNotif] = useState(false)
  const [leidas, setLeidas] = useState({}) // { rol: true } cuando ya se marcaron como leídas
  const caja = useRef(null)

  // Título y módulo de la pantalla actual (las pantallas de orden cuelgan de "Órdenes" o "Inicio")
  const esDeOrden = Object.keys(TITULOS_ORDEN).includes(current)
  const tienePedidos = actual.menu.some((m) => m.page === 'pedidos')
  const itemMenu = actual.menu.find((m) => m.page === (esDeOrden ? (tienePedidos ? 'pedidos' : 'inicio') : current))
  const titulo = esDeOrden ? TITULOS_ORDEN[current] : itemMenu?.label || 'ORVEX'
  const grupo = itemMenu?.grupo

  // Cierra los paneles al hacer clic fuera
  useEffect(() => {
    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) { setVerNotif(false); setBusqueda('') }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  // Resultados del buscador: el cliente solo busca entre sus propios pedidos
  const q = busqueda.trim().toLowerCase()
  const ordenesVisibles = rolClave === 'cliente' ? data.orders.filter((o) => o.clienteId === actual.clienteId) : data.orders
  const resultados = q
    ? ordenesVisibles.filter((o) => `${o.id} ${o.cliente} ${o.producto}`.toLowerCase().includes(q)).slice(0, 6)
    : []

  const sinLeer = leidas[rolClave] ? 0 : actual.notificaciones.length

  function abrirOrden(id) {
    irA(actual.ordenPage, id)
    setBusqueda('')
  }

  function abrirNotificacion(n) {
    irA(n.page, n.orderId || null)
    setVerNotif(false)
  }

  return (
    <header className="topbar" ref={caja}>
      <button
        className={`icon-btn menu-btn${colapsado ? ' is-collapsed' : ''}`}
        onClick={onMenu}
        aria-label={colapsado ? 'Expandir menú lateral' : 'Contraer o abrir menú lateral'}
        aria-expanded={!colapsado || abierto}
        title={colapsado ? 'Expandir menú lateral' : 'Contraer menú lateral'}
      >
        <Icon nombre="menu" />
      </button>

      <div className="topbar-title">
        <span className="topbar-crumb">ORVEX{grupo ? ` · ${grupo}` : ''}</span>
        <div className="topbar-heading">{titulo}</div>
      </div>

      {actual.buscador && (
        <div className="search-global">
          <Icon nombre="search" tamano={17} />
          <input
            type="search"
            placeholder="Buscar orden, cliente o producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Búsqueda global"
          />
          {q && (
            <div className="dropdown search-results">
              {resultados.length === 0 ? (
                <p className="dropdown-empty">Sin resultados para “{busqueda}”</p>
              ) : (
                resultados.map((o) => (
                  <button key={o.id} className="search-item" onClick={() => abrirOrden(o.id)}>
                    <Icon nombre="clipboard" tamano={16} />
                    <span><strong>{o.id}</strong> · {o.producto}<small>{rolClave === 'cliente' ? o.fechaEntrega : o.cliente}</small></span>
                    <StatusBadge estado={o.estado} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <span className="toolbar-spacer" />

      <ThemeToggle />

      <div className="notif">
        <button className="icon-btn" onClick={() => setVerNotif(!verNotif)} aria-label={`Notificaciones (${sinLeer} sin leer)`}>
          <Icon nombre="bell" />
          {sinLeer > 0 && <span className="notif-badge">{sinLeer}</span>}
        </button>
        {verNotif && (
          <div className="dropdown notif-panel">
            <div className="dropdown-head">
              <strong>Notificaciones</strong>
              {sinLeer > 0 && <button className="link-inline" onClick={() => setLeidas({ ...leidas, [rolClave]: true })}>Marcar como leídas</button>}
            </div>
            {actual.notificaciones.map((n) => (
              <button key={n.texto} className={leidas[rolClave] ? 'notif-item' : 'notif-item unread'} onClick={() => abrirNotificacion(n)}>
                <span className={`notif-icon notif-${n.tipo}`}><Icon nombre={ICONO_AVISO[n.tipo]} tamano={16} /></span>
                <span>{n.texto}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="role-tag" title="Vista actual (se cambia desde la barra lateral)">
        <Icon nombre="user" tamano={14} />
        {actual.nombre}
      </span>
      {onLogout && (
        <button
          className="icon-btn"
          onClick={onLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          style={{ marginLeft: '4px' }}
        >
          <Icon nombre="log-out" tamano={17} />
        </button>
      )}

    </header>
  )
}
