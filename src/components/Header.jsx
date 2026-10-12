import { useEffect, useRef, useState } from 'react'
import { LISTA_ROLES, ROLES } from '../data/roles.js'
import Icon from './Icon.jsx'
import Avatar from './Avatar.jsx'
import StatusBadge from './StatusBadge.jsx'

const ICONO_AVISO = { aviso: 'alert-triangle', error: 'alert-circle', info: 'info' }

// Barra superior: menú móvil, buscador global, selector de rol, notificaciones y usuario actual
export default function Header({ role, onChangeRole, data, irA, onMenu }) {
  const actual = ROLES[role]
  const [busqueda, setBusqueda] = useState('')
  const [verNotif, setVerNotif] = useState(false)
  const [leidas, setLeidas] = useState({}) // { rol: true } cuando ya se marcaron como leídas
  const caja = useRef(null)

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
  const ordenesVisibles = role === 'cliente' ? data.orders.filter((o) => o.clienteId === actual.clienteId) : data.orders
  const resultados = q
    ? ordenesVisibles.filter((o) => `${o.id} ${o.cliente} ${o.producto}`.toLowerCase().includes(q)).slice(0, 6)
    : []

  const sinLeer = leidas[role] ? 0 : actual.notificaciones.length

  function abrirOrden(id) {
    irA(actual.ordenPage, id)
    setBusqueda('')
  }

  function abrirNotificacion(n) {
    irA(n.page, n.orderId || null)
    setVerNotif(false)
  }

  return (
    <>
    <header className="topbar" ref={caja}>
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Abrir menú"><Icon nombre="menu" /></button>

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
                    <span><strong>{o.id}</strong> · {o.producto}<small>{role === 'cliente' ? o.fechaEntrega : o.cliente}</small></span>
                    <StatusBadge estado={o.estado} />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <span className="toolbar-spacer" />

      <label className="role-switch">
        <Icon nombre="users" tamano={16} />
        <span>Vista actual:</span>
        <select value={role} onChange={(e) => onChangeRole(e.target.value)} aria-label="Vista actual (rol)">
          {LISTA_ROLES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </label>

      <div className="notif">
        <button className="icon-btn" onClick={() => setVerNotif(!verNotif)} aria-label={`Notificaciones (${sinLeer} sin leer)`}>
          <Icon nombre="bell" />
          {sinLeer > 0 && <span className="notif-badge">{sinLeer}</span>}
        </button>
        {verNotif && (
          <div className="dropdown notif-panel">
            <div className="dropdown-head">
              <strong>Notificaciones</strong>
              {sinLeer > 0 && <button className="link-inline" onClick={() => setLeidas({ ...leidas, [role]: true })}>Marcar como leídas</button>}
            </div>
            {actual.notificaciones.map((n) => (
              <button key={n.texto} className={leidas[role] ? 'notif-item' : 'notif-item unread'} onClick={() => abrirNotificacion(n)}>
                <span className={`notif-icon notif-${n.tipo}`}><Icon nombre={ICONO_AVISO[n.tipo]} tamano={16} /></span>
                <span>{n.texto}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="user-chip">
        <Avatar nombre={actual.usuario.nombre} />
        <div>
          <strong>{actual.usuario.nombre}</strong>
          <small>{actual.usuario.cargo}</small>
        </div>
      </div>
    </header>
    <div className="ruler" aria-hidden="true" />
    </>
  )
}
