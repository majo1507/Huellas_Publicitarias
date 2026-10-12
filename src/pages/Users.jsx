import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import Icon from '../components/Icon.jsx'
import { estaActiva } from '../utils/format.js'

const ROLES_INFO = [
  { rol: 'Comercial', titulo: 'Ejecutiva de cuentas', desc: 'Gestiona clientes, cotizaciones y órdenes, registra solicitudes y atiende comunicaciones.' },
  { rol: 'Diseñador', titulo: 'Diseñadora gráfica', desc: 'Prepara las propuestas visuales, sube versiones, responde requerimientos y artes finales.' },
  { rol: 'Coordinador', titulo: 'Coordinador de producción', desc: 'Valida solicitudes, supervisa el flujo, programa actividades y controla las aprobaciones.' },
  { rol: 'Operario', titulo: 'Operarios de taller', desc: 'Ejecutan impresión, corte, laminado y empaque; actualizan el avance e incidencias.' },
  { rol: 'Postventa', titulo: 'Atención postventa', desc: 'Atiende reclamos, garantías, ajustes y encuestas de satisfacción con clientes.' },
  { rol: 'Gerencia', titulo: 'Gerencia general', desc: 'Supervisa indicadores globales, rentabilidad, cuellos de botella y desempeño del equipo.' },
]

const MODULOS_MATRIZ = [
  { mod: 'Dashboard operativo', permisos: { Comercial: 'Consulta', Diseñador: 'Consulta', Coordinador: 'Consulta', Operario: 'Consulta', Gerencia: 'Consulta', Postventa: 'Consulta' } },
  { mod: 'Clientes y contactos', permisos: { Comercial: 'Edita', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Consulta' } },
  { mod: 'Bandeja de comunicaciones', permisos: { Comercial: 'Edita', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Órdenes de producción', permisos: { Comercial: 'Edita', Diseñador: 'Consulta', Coordinador: 'Edita', Operario: 'Consulta', Gerencia: 'Consulta', Postventa: 'Consulta' } },
  { mod: 'Diseño y aprobaciones', permisos: { Comercial: 'Consulta', Diseñador: 'Edita', Coordinador: 'Edita', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Tablero de producción', permisos: { Comercial: 'Sin acceso', Diseñador: 'Sin acceso', Coordinador: 'Edita', Operario: 'Edita', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Tareas de taller', permisos: { Comercial: 'Consulta', Diseñador: 'Edita', Coordinador: 'Edita', Operario: 'Edita', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Despachos y entregas', permisos: { Comercial: 'Edita', Diseñador: 'Sin acceso', Coordinador: 'Edita', Operario: 'Consulta', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Casos de postventa', permisos: { Comercial: 'Consulta', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Reportes e indicadores', permisos: { Comercial: 'Consulta', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Edita', Postventa: 'Consulta' } },
  { mod: 'Usuarios y seguridad', permisos: { Comercial: 'Sin acceso', Diseñador: 'Sin acceso', Coordinador: 'Sin acceso', Operario: 'Sin acceso', Gerencia: 'Edita', Postventa: 'Sin acceso' } },
]

export default function Users({ data, actions }) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState('Comercial')

  const filas = data.users.map((u) => ({
    ...u,
    ordenes: data.orders.filter((o) => estaActiva(o) && (o.responsable === u.nombre || o.disenador === u.nombre)).length,
    tareas: data.tasks.filter((t) => t.responsable === u.nombre && t.estado !== 'Finalizada').length,
  }))

  function handleGuardarUsuario(e) {
    e.preventDefault()
    if (!nombre.trim() || !correo.trim()) return

    const nuevo = {
      id: `U${data.users.length + 1}`,
      nombre: nombre.trim(),
      correo: correo.trim(),
      cargo: rol === 'Comercial' ? 'Ejecutiva comercial' : rol === 'Diseñador' ? 'Diseñador gráfico' : rol === 'Operario' ? 'Operario de taller' : rol,
      rol,
      estado: 'Activo',
    }

    if (actions.addUser) {
      actions.addUser(nuevo)
    } else {
      data.users.push(nuevo)
      actions.notify(`Usuario ${nuevo.nombre} agregado al equipo.`)
    }

    setModalNuevo(false)
    setNombre('')
    setCorreo('')
  }

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Usuario',
      ordenar: true,
      render: (u) => (
        <span className="person">
          <Avatar nombre={u.nombre} tamano="sm" />
          <span>
            <strong>{u.nombre}</strong>
            <small className="cell-sub">{u.correo}</small>
          </span>
        </span>
      ),
    },
    { clave: 'cargo', titulo: 'Cargo', ordenar: true },
    { clave: 'rol', titulo: 'Rol en ORVEX', render: (u) => <StatusBadge estado="Solicitud" texto={u.rol} /> },
    { clave: 'ordenes', titulo: 'Órdenes a cargo', ordenar: true },
    { clave: 'tareas', titulo: 'Tareas activas', ordenar: true },
    { clave: 'estado', titulo: 'Estado', render: (u) => <StatusBadge estado={u.estado} /> },
  ]

  return (
    <div>
      <PageHeader
        titulo="Usuarios y control de roles"
        subtitulo="Gestión del equipo interno, responsabilidades y matriz de permisos por perfil."
        icono="shield"
        acciones={
          <button className="btn btn-primary" onClick={() => setModalNuevo(true)}>
            <Icon nombre="plus" tamano={15} /> Invitar nuevo usuario
          </button>
        }
      />

      <div className="kpis">
        <StatCard titulo="Usuarios registrados" valor={data.users.length} icono="users" />
        <StatCard titulo="Usuarios activos" valor={data.users.filter((u) => u.estado === 'Activo').length} icono="check-circle" color="verde" />
        <StatCard titulo="Perfiles del sistema" valor={ROLES_INFO.length} icono="shield" />
      </div>

      {/* Tarjetas descriptivas de roles */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        {ROLES_INFO.map((r) => (
          <div key={r.rol} className="card p">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
              <h3>{r.titulo}</h3>
              <span className="pill">{r.rol}</span>
            </div>
            <p className="sm mut">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Tabla de usuarios */}
      <DataTable
        columnas={columnas}
        filas={filas}
        buscar={(u) => `${u.nombre} ${u.cargo} ${u.correo} ${u.rol}`}
        placeholder="Buscar usuario por nombre, cargo o correo..."
        filtros={[{ titulo: 'Rol', valor: (u) => u.rol, opciones: [...new Set(data.users.map((u) => u.rol))] }]}
        vacioTitulo="No se encontraron usuarios"
      />

      {/* Matriz de permisos inspirada en el HTML */}
      <div className="card p" style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon nombre="shield" tamano={17} /> Matriz de permisos por rol
        </h3>
        <p className="sm mut" style={{ marginBottom: '14px' }}>
          Define qué nivel de acceso tiene cada perfil sobre los módulos operativos del sistema.
        </p>

        <div className="table-wrap">
          <table className="pm">
            <thead>
              <tr>
                <th>Módulo de la plataforma</th>
                <th>Comercial</th>
                <th>Diseñador</th>
                <th>Coordinador</th>
                <th>Operario</th>
                <th>Postventa</th>
                <th>Gerencia</th>
              </tr>
            </thead>
            <tbody>
              {MODULOS_MATRIZ.map((fila) => (
                <tr key={fila.mod}>
                  <td><strong>{fila.mod}</strong></td>
                  {['Comercial', 'Diseñador', 'Coordinador', 'Operario', 'Postventa', 'Gerencia'].map((r) => {
                    const permiso = fila.permisos[r] || 'Sin acceso'
                    const cls = permiso === 'Edita' ? 'E' : permiso === 'Consulta' ? 'V' : 'N'
                    return (
                      <td key={r} className={cls}>
                        {permiso}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para invitar usuario */}
      {modalNuevo && (
        <div className="modal-backdrop" onClick={() => setModalNuevo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nuevo usuario">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="users" tamano={20} /></span>
              <div>
                <h2>Invitar usuario al sistema</h2>
                <p>Asigna un rol y correo institucional para la plataforma.</p>
              </div>
              <button className="icon-btn" onClick={() => setModalNuevo(false)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="modal-body">
              <div className="form-grid">
                <div className="field full">
                  <label className="field-label" htmlFor="userNombre">Nombre completo</label>
                  <input
                    id="userNombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Julián Soto"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="userCorreo">Correo institucional</label>
                  <input
                    id="userCorreo"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="usuario@huellas.co"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="userRol">Rol operativo</label>
                  <select
                    id="userRol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                  >
                    <option value="Comercial">Comercial / Recepción</option>
                    <option value="Diseñador">Diseñador gráfico</option>
                    <option value="Coordinador">Coordinador de producción</option>
                    <option value="Operario">Operario de taller</option>
                    <option value="Postventa">Atención postventa</option>
                    <option value="Gerencia">Gerencia general</option>
                  </select>
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Crear usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
