import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import Icon from '../components/Icon.jsx'
import { estaActiva } from '../utils/format.js'
import { CARGOS_POR_ROL } from '../data/catalogos.js'

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
  { mod: 'Bandeja de comunicaciones', permisos: { Comercial: 'Edita', Diseñador: 'Sin acceso', Coordinador: 'Sin acceso', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Inventario e insumos', permisos: { Comercial: 'Sin acceso', Diseñador: 'Sin acceso', Coordinador: 'Edita', Operario: 'Consulta', Gerencia: 'Edita', Postventa: 'Sin acceso' } },
  { mod: 'Órdenes de producción', permisos: { Comercial: 'Edita', Diseñador: 'Consulta', Coordinador: 'Edita', Operario: 'Consulta', Gerencia: 'Consulta', Postventa: 'Consulta' } },
  { mod: 'Diseño y aprobaciones', permisos: { Comercial: 'Consulta', Diseñador: 'Edita', Coordinador: 'Edita', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Tablero de producción', permisos: { Comercial: 'Sin acceso', Diseñador: 'Sin acceso', Coordinador: 'Edita', Operario: 'Edita', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Tareas de taller', permisos: { Comercial: 'Consulta', Diseñador: 'Edita', Coordinador: 'Edita', Operario: 'Edita', Gerencia: 'Consulta', Postventa: 'Sin acceso' } },
  { mod: 'Despachos y entregas', permisos: { Comercial: 'Edita', Diseñador: 'Sin acceso', Coordinador: 'Edita', Operario: 'Consulta', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Casos de postventa', permisos: { Comercial: 'Consulta', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Consulta', Postventa: 'Edita' } },
  { mod: 'Reportes e indicadores', permisos: { Comercial: 'Consulta', Diseñador: 'Sin acceso', Coordinador: 'Consulta', Operario: 'Sin acceso', Gerencia: 'Edita', Postventa: 'Consulta' } },
  { mod: 'Usuarios y seguridad', permisos: { Comercial: 'Sin acceso', Diseñador: 'Sin acceso', Coordinador: 'Sin acceso', Operario: 'Sin acceso', Gerencia: 'Edita', Postventa: 'Sin acceso' } },
]

const CARGO_SUGERIDO = {
  Comercial: 'Ejecutiva comercial',
  Diseñador: 'Diseñador gráfico',
  Coordinador: 'Coordinador de producción',
  Operario: 'Operario de taller',
  Postventa: 'Atención postventa',
  Gerencia: 'Gerente general',
}

const CARGOS_DISPONIBLES = {
  Comercial: CARGOS_POR_ROL.recepcion || ['Ejecutiva comercial'],
  Diseñador: CARGOS_POR_ROL.disenador || ['Diseñador gráfico'],
  Coordinador: CARGOS_POR_ROL.coordinador || ['Coordinador de producción'],
  Operario: CARGOS_POR_ROL.operario || ['Operario de taller'],
  Postventa: CARGOS_POR_ROL.postventa || ['Atención postventa'],
  Gerencia: CARGOS_POR_ROL.gerente || ['Gerente general'],
}

export default function Users({ data, actions, usuarioActual }) {
  const [modalFormulario, setModalFormulario] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null) // null = creando, objeto = editando
  const [usuarioADesactivar, setUsuarioADesactivar] = useState(null)

  // Campos del formulario
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [cargo, setCargo] = useState('')
  const [rol, setRol] = useState('Comercial')
  const [errores, setErrores] = useState({})

  const filas = data.users.map((u) => ({
    ...u,
    ordenes: data.orders.filter((o) => estaActiva(o) && (o.responsable === u.nombre || o.disenador === u.nombre)).length,
    tareas: data.tasks.filter((t) => t.responsable === u.nombre && t.estado !== 'Finalizada').length,
  }))

  function abrirNuevo() {
    setUsuarioEditando(null)
    setNombre('')
    setCorreo('')
    setCargo(CARGO_SUGERIDO['Comercial'])
    setRol('Comercial')
    setErrores({})
    setModalFormulario(true)
  }

  function abrirEdicion(u) {
    setUsuarioEditando(u)
    setNombre(u.nombre)
    setCorreo(u.correo)
    setCargo(u.cargo)
    setRol(u.rol)
    setErrores({})
    setModalFormulario(true)
  }

  function handleRolChange(nuevoRol) {
    setRol(nuevoRol)
    if (!usuarioEditando || !cargo.trim()) {
      setCargo(CARGO_SUGERIDO[nuevoRol] || nuevoRol)
    }
  }

  function validar() {
    const err = {}
    if (!nombre.trim()) {
      err.nombre = 'El nombre completo es obligatorio.'
    } else if (nombre.trim().length < 3) {
      err.nombre = 'El nombre debe tener al menos 3 caracteres.'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!correo.trim()) {
      err.correo = 'El correo institucional es obligatorio.'
    } else if (!emailRegex.test(correo.trim())) {
      err.correo = 'El formato del correo es inválido (ej. usuario@huellas.co).'
    } else {
      // Comprobar duplicidad de correo (excluyendo el usuario actual al editar)
      const correoExiste = data.users.some(
        (u) =>
          u.correo.toLowerCase() === correo.trim().toLowerCase() &&
          (!usuarioEditando || u.id !== usuarioEditando.id)
      )
      if (correoExiste) {
        err.correo = 'Este correo ya está registrado por otro usuario.'
      }
    }

    if (!cargo.trim()) {
      err.cargo = 'El cargo es obligatorio.'
    }

    if (!rol) {
      err.rol = 'Selecciona un rol válido.'
    }

    setErrores(err)
    return Object.keys(err).length === 0
  }

  function handleGuardar(e) {
    e.preventDefault()
    if (!validar()) return

    if (usuarioEditando) {
      // Edición de usuario existente
      actions.updateUser(usuarioEditando.id, {
        nombre: nombre.trim(),
        correo: correo.trim(),
        cargo: cargo.trim(),
        rol,
      })
      actions.notify(`Usuario ${nombre.trim()} actualizado correctamente.`, 'exito')
    } else {
      // Creación de nuevo usuario
      const nuevo = {
        id: `U${data.users.length + 1}`,
        nombre: nombre.trim(),
        correo: correo.trim(),
        cargo: cargo.trim(),
        rol,
        estado: 'Activo',
      }
      actions.addUser(nuevo)
      actions.notify(`Usuario ${nuevo.nombre} agregado al equipo.`, 'exito')
    }

    setModalFormulario(false)
  }

  function esUsuarioActual(u) {
    if (!usuarioActual) return false
    return (
      (usuarioActual.correo && u.correo.toLowerCase() === usuarioActual.correo.toLowerCase()) ||
      (usuarioActual.nombre && u.nombre.toLowerCase() === usuarioActual.nombre.toLowerCase())
    )
  }

  function handleToggleEstado(u) {
    if (u.estado === 'Activo') {
      if (esUsuarioActual(u)) {
        actions.notify('No puedes desactivar tu propia cuenta activa en esta sesión.', 'error')
        return
      }
      setUsuarioADesactivar(u)
    } else {
      actions.toggleUserStatus(u.id)
      actions.notify(`Usuario ${u.nombre} reactivado con éxito.`, 'exito')
    }
  }

  function confirmarDesactivacion() {
    if (!usuarioADesactivar) return
    actions.toggleUserStatus(usuarioADesactivar.id)
    actions.notify(`Usuario ${usuarioADesactivar.nombre} desactivado del sistema.`, 'aviso')
    setUsuarioADesactivar(null)
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
    {
      clave: 'rol',
      titulo: 'Rol en ORVEX',
      ordenar: true,
      render: (u) => <StatusBadge estado="Solicitud" texto={u.rol} />,
    },
    { clave: 'ordenes', titulo: 'Órdenes a cargo', ordenar: true },
    { clave: 'tareas', titulo: 'Tareas activas', ordenar: true },
    {
      clave: 'estado',
      titulo: 'Estado',
      ordenar: true,
      render: (u) => (
        <StatusBadge estado={u.estado === 'Activo' ? 'Activo' : 'Pausada'} texto={u.estado} />
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (u) => {
        const esPropio = esUsuarioActual(u)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="btn btn-soft btn-sm"
              onClick={() => abrirEdicion(u)}
              title={`Editar datos de ${u.nombre}`}
            >
              <Icon nombre="edit" tamano={13} /> Editar
            </button>
            {u.estado === 'Activo' ? (
              <button
                className="btn btn-ghost btn-sm danger-text"
                disabled={esPropio}
                onClick={() => handleToggleEstado(u)}
                title={esPropio ? 'No puedes desactivar tu propia cuenta activa' : `Desactivar a ${u.nombre}`}
              >
                <Icon nombre="x-circle" tamano={13} /> Desactivar
              </button>
            ) : (
              <button
                className="btn btn-soft btn-sm"
                onClick={() => handleToggleEstado(u)}
                title={`Reactivar a ${u.nombre}`}
              >
                <Icon nombre="check" tamano={13} /> Activar
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Usuarios y control de roles"
        subtitulo="Gestión del equipo interno, responsabilidades y matriz de permisos por perfil."
        icono="shield"
        acciones={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Icon nombre="plus" tamano={15} /> Registrar usuario
          </button>
        }
      />

      <div className="kpis">
        <StatCard titulo="Usuarios registrados" valor={data.users.length} icono="users" />
        <StatCard
          titulo="Usuarios activos"
          valor={data.users.filter((u) => u.estado === 'Activo').length}
          icono="check-circle"
          color="verde"
        />
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
        buscar={(u) => `${u.nombre} ${u.cargo} ${u.correo} ${u.rol} ${u.estado}`}
        placeholder="Buscar usuario por nombre, cargo o correo..."
        filtros={[
          { titulo: 'Rol', valor: (u) => u.rol, opciones: [...new Set(data.users.map((u) => u.rol))] },
          { titulo: 'Estado', valor: (u) => u.estado, opciones: ['Activo', 'Inactivo'] },
        ]}
        vacioTitulo="No se encontraron usuarios"
      />

      {/* Matriz de permisos */}
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

      {/* Modal para Crear / Editar usuario */}
      {modalFormulario && (
        <div className="modal-backdrop" onClick={() => setModalFormulario(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={usuarioEditando ? 'Editar usuario' : 'Nuevo usuario'}>
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre={usuarioEditando ? 'edit' : 'users'} tamano={20} />
              </span>
              <div>
                <h2>{usuarioEditando ? `Editar usuario: ${usuarioEditando.nombre}` : 'Registrar usuario en el sistema'}</h2>
                <p>{usuarioEditando ? 'Actualiza los datos personales, cargo o rol.' : 'Asigna un rol y correo institucional para la plataforma.'}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalFormulario(false)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="modal-body" noValidate>
              <div className="form-grid">
                <div className={`field full ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="userNombre">Nombre completo</label>
                  <input
                    id="userNombre"
                    value={nombre}
                    onChange={(e) => {
                      setNombre(e.target.value)
                      if (errores.nombre) setErrores((prev) => ({ ...prev, nombre: '' }))
                    }}
                    placeholder="Ej. Julián Soto"
                    autoFocus
                  />
                  {errores.nombre && <span className="field-error">{errores.nombre}</span>}
                </div>

                <div className={`field ${errores.correo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="userCorreo">Correo institucional</label>
                  <input
                    id="userCorreo"
                    type="email"
                    value={correo}
                    onChange={(e) => {
                      setCorreo(e.target.value)
                      if (errores.correo) setErrores((prev) => ({ ...prev, correo: '' }))
                    }}
                    placeholder="usuario@huellas.co"
                  />
                  {errores.correo && <span className="field-error">{errores.correo}</span>}
                </div>

                <div className={`field ${errores.cargo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="userCargo">Cargo institucional ({rol})</label>
                  <select
                    id="userCargo"
                    value={cargo}
                    onChange={(e) => {
                      setCargo(e.target.value)
                      if (errores.cargo) setErrores((prev) => ({ ...prev, cargo: '' }))
                    }}
                  >
                    {(CARGOS_DISPONIBLES[rol] || [cargo || 'Cargo institucional']).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errores.cargo && <span className="field-error">{errores.cargo}</span>}
                </div>

                <div className={`field full ${errores.rol ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="userRol">Rol operativo en ORVEX</label>
                  <select
                    id="userRol"
                    value={rol}
                    onChange={(e) => handleRolChange(e.target.value)}
                  >
                    <option value="Comercial">Comercial / Recepción</option>
                    <option value="Diseñador">Diseñador gráfico</option>
                    <option value="Coordinador">Coordinador de producción</option>
                    <option value="Operario">Operario de taller</option>
                    <option value="Postventa">Atención postventa</option>
                    <option value="Gerencia">Gerencia general</option>
                  </select>
                  {errores.rol && <span className="field-error">{errores.rol}</span>}
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalFormulario(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> {usuarioEditando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para desactivar usuario */}
      {usuarioADesactivar && (
        <Modal
          titulo="Desactivar usuario"
          subtitulo={usuarioADesactivar.nombre}
          icono="alert-triangle"
          tipoBoton="danger"
          mensaje={`¿Estás seguro de desactivar al usuario ${usuarioADesactivar.nombre} (${usuarioADesactivar.correo})? El usuario no podrá acceder al sistema ni se le podrán asignar nuevas órdenes mientras esté inactivo.`}
          textoBoton="Desactivar usuario"
          onClose={() => setUsuarioADesactivar(null)}
          onConfirm={confirmarDesactivacion}
        />
      )}
    </div>
  )
}
