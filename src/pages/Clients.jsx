import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import {
  PAISES,
  TIPOS_DOCUMENTO,
  TIPOS_CLIENTE,
  obtenerDepartamentosPorPais,
  obtenerMunicipiosPorDepartamento,
} from '../data/catalogos.js'

const FORM_INICIAL = {
  nombre: '',
  tipoCliente: TIPOS_CLIENTE[0],
  tipoDocumento: 'NIT',
  nit: '',
  contacto: '',
  correo: '',
  telefono: '',
  pais: 'Colombia',
  departamento: 'Antioquia',
  municipio: 'Medellín',
  ciudad: 'Medellín',
  direccion: '',
}

// Lista de clientes (la administra Comercial / Recepción; Gerencia supervisa)
export default function Clients({ data, actions, irA, role }) {
  const puedeAdministrarClientes = role === 'comercial' || role === 'gerencia'
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteEnEdicion, setClienteEnEdicion] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('activos') // 'activos' | 'archivados' | 'todos'
  const [form, setForm] = useState(FORM_INICIAL)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const clientesFiltrados = data.clients.filter((c) => {
    if (filtroEstado === 'activos') return !c.archivado
    if (filtroEstado === 'archivados') return Boolean(c.archivado)
    return true
  })

  const filas = clientesFiltrados.map((c) => ({
    ...c,
    tipoDocumento: c.tipoDocumento || 'NIT',
    tipoCliente: c.tipoCliente || 'Persona Jurídica (Empresa)',
    pais: c.pais || 'Colombia',
    departamento: c.departamento || (c.ciudad === 'Medellín' ? 'Antioquia' : c.ciudad === 'Cali' ? 'Valle del Cauca' : 'Bogotá D.C.'),
    municipio: c.municipio || c.ciudad || 'Bogotá',
    ciudad: c.ciudad || c.municipio || 'Bogotá',
    solicitudes: data.requests.filter((s) => s.clienteId === c.id).length,
    ordenes: data.orders.filter((o) => o.clienteId === c.id).length,
  }))

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Cliente / Identificación',
      ordenar: true,
      render: (c) => (
        <span className="person">
          <Avatar nombre={c.nombre} tamano="sm" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong>{c.nombre}</strong>
              {c.archivado && (
                <span style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', fontWeight: 600 }}>
                  Archivado
                </span>
              )}
            </div>
            <small className="cell-sub">
              {c.tipoDocumento || 'NIT'}: {c.nit || '—'} · {c.tipoCliente || 'Empresa'}
            </small>
          </div>
        </span>
      ),
    },
    {
      clave: 'contacto',
      titulo: 'Contacto',
      render: (c) => (
        <>
          {c.contacto}
          <small className="cell-sub">{c.correo}</small>
        </>
      ),
    },
    { clave: 'telefono', titulo: 'Teléfono' },
    {
      clave: 'ciudad',
      titulo: 'Ubicación (Depto / Municipio)',
      ordenar: true,
      render: (c) => (
        <>
          <strong>{c.municipio || c.ciudad}</strong>
          <small className="cell-sub">
            {c.departamento} ({c.pais || 'Colombia'})
          </small>
        </>
      ),
    },
    { clave: 'solicitudes', titulo: 'Solicitudes', ordenar: true },
    { clave: 'ordenes', titulo: 'Órdenes', ordenar: true },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (c) => (
        puedeAdministrarClientes ? (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {!c.archivado && (
              <button className="btn btn-soft btn-sm" onClick={() => irA('nuevo', c.id)} title="Crear nueva solicitud comercial">
                <Icon nombre="file-plus" tamano={13} /> Solicitud
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={() => abrirModalEditar(c)}
              title="Editar información del cliente"
            >
              <Icon nombre="edit" tamano={13} /> Editar
            </button>
            {c.archivado ? (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => actions?.restoreClient && actions.restoreClient(c.id)}
                title="Restaurar a la lista activa"
              >
                <Icon nombre="refresh-cw" tamano={13} /> Restaurar
              </button>
            ) : (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => actions?.archiveClient && actions.archiveClient(c.id)}
                title="Archivar cliente"
              >
                <Icon nombre="archive" tamano={13} /> Archivar
              </button>
            )}
            <button
              className="btn btn-outline btn-sm"
              style={{ color: '#ef4444', borderColor: '#fca5a5' }}
              onClick={() => {
                if (window.confirm(`¿Está seguro de eliminar permanentemente a "${c.nombre}"? Si tiene órdenes o cotizaciones registradas, el sistema bloqueará la eliminación para proteger la integridad.`)) {
                  actions?.deleteClient && actions.deleteClient(c.id)
                }
              }}
              title="Eliminar permanentemente"
            >
              <Icon nombre="trash-2" tamano={13} />
            </button>
          </div>
        ) : (
          <span className="sm mut">Supervisión</span>
        )
      ),
    },
  ]

  function abrirModalNuevo() {
    setClienteEnEdicion(null)
    setForm(FORM_INICIAL)
    setErrores({})
    setGuardando(false)
    setModalAbierto(true)
  }

  function abrirModalEditar(c) {
    setClienteEnEdicion(c)
    setForm({
      nombre: c.nombre || c.empresa || '',
      tipoCliente: c.tipoCliente || TIPOS_CLIENTE[0],
      tipoDocumento: c.tipoDocumento || 'NIT',
      nit: c.nit || '',
      contacto: c.contacto || c.contacto_principal || '',
      correo: c.correo || '',
      telefono: c.telefono || '',
      pais: c.pais || 'Colombia',
      departamento: c.departamento || 'Antioquia',
      municipio: c.municipio || c.ciudad || 'Medellín',
      ciudad: c.ciudad || c.municipio || 'Medellín',
      direccion: c.direccion || '',
    })
    setErrores({})
    setGuardando(false)
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (guardando) return
    setModalAbierto(false)
    setErrores({})
  }

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'pais') {
      const deptos = obtenerDepartamentosPorPais(value)
      const primerDepto = deptos[0] || ''
      const muns = obtenerMunicipiosPorDepartamento(value, primerDepto)
      const primerMun = muns[0] || ''
      setForm((prev) => ({
        ...prev,
        pais: value,
        departamento: primerDepto,
        municipio: primerMun,
        ciudad: primerMun,
      }))
      return
    }
    if (name === 'departamento') {
      const muns = obtenerMunicipiosPorDepartamento(form.pais, value)
      const primerMun = muns[0] || ''
      setForm((prev) => ({
        ...prev,
        departamento: value,
        municipio: primerMun,
        ciudad: primerMun,
      }))
      return
    }
    if (name === 'municipio') {
      setForm((prev) => ({ ...prev, municipio: value, ciudad: value }))
      if (errores.ciudad || errores.municipio) {
        setErrores((prev) => ({ ...prev, ciudad: '', municipio: '' }))
      }
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: '' }))
    }
  }

  function validar() {
    const err = {}
    if (!form.nombre.trim()) {
      err.nombre = 'El nombre o razón social del cliente es obligatorio.'
    } else if (form.nombre.trim().length < 2) {
      err.nombre = 'El nombre debe tener al menos 2 caracteres.'
    }

    if (!form.nit.trim()) {
      err.nit = 'El número de documento / NIT es obligatorio.'
    } else {
      const nitExiste = data.clients.some(
        (c) => c.nit && c.nit.trim().toLowerCase() === form.nit.trim().toLowerCase()
      )
      if (nitExiste) {
        err.nit = 'Ya existe un cliente registrado con este documento / NIT.'
      }
    }

    if (!form.contacto.trim()) {
      err.contacto = 'El nombre del contacto principal es obligatorio.'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.correo.trim()) {
      err.correo = 'El correo electrónico es obligatorio.'
    } else if (!emailRegex.test(form.correo.trim())) {
      err.correo = 'Ingresa un correo electrónico válido (ej. contacto@empresa.co).'
    }

    if (!form.telefono.trim()) {
      err.telefono = 'El teléfono de contacto es obligatorio.'
    }

    if (!form.departamento.trim()) {
      err.departamento = 'Selecciona un departamento.'
    }

    if (!form.municipio.trim()) {
      err.municipio = 'Selecciona un municipio.'
    }

    if (!form.direccion.trim()) {
      err.direccion = 'La dirección es obligatoria.'
    }

    setErrores(err)
    return Object.keys(err).length === 0
  }

  async function handleGuardar(e) {
    e.preventDefault()
    if (!validar()) return

    setGuardando(true)
    try {
      const payload = {
        nombre: form.nombre.trim(),
        empresa: form.nombre.trim(),
        tipoCliente: form.tipoCliente,
        tipoDocumento: form.tipoDocumento,
        nit: form.nit.trim(),
        contacto: form.contacto.trim(),
        contacto_principal: form.contacto.trim(),
        correo: form.correo.trim().toLowerCase(),
        telefono: form.telefono.trim(),
        pais: form.pais,
        departamento: form.departamento,
        municipio: form.municipio,
        ciudad: form.municipio,
        direccion: form.direccion.trim(),
      }

      if (clienteEnEdicion && actions?.editClient) {
        await actions.editClient(clienteEnEdicion.id, payload)
      } else if (actions?.addClient) {
        await actions.addClient(payload)
      }
      setModalAbierto(false)
      setClienteEnEdicion(null)
      setForm(FORM_INICIAL)
    } catch {
      // El toast de error ya lo muestra actions
    } finally {
      setGuardando(false)
    }
  }

  const departamentosDisponibles = obtenerDepartamentosPorPais(form.pais)
  const municipiosDisponibles = obtenerMunicipiosPorDepartamento(form.pais, form.departamento)

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        subtitulo={`${data.clients.length} clientes registrados con ubicación geográfica y clasificación comercial.`}
        icono="users"
        acciones={
          puedeAdministrarClientes && (
            <button className="btn btn-primary" onClick={abrirModalNuevo}>
              <Icon nombre="plus" tamano={15} /> Registrar nuevo cliente
            </button>
          )
        }
      />

      {/* Selector de estado (Activos / Archivados / Todos) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-sm ${filtroEstado === 'activos' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('activos')}
        >
          Activos ({data.clients.filter((c) => !c.archivado).length})
        </button>
        <button
          className={`btn btn-sm ${filtroEstado === 'archivados' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('archivados')}
        >
          Archivados ({data.clients.filter((c) => c.archivado).length})
        </button>
        <button
          className={`btn btn-sm ${filtroEstado === 'todos' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('todos')}
        >
          Todos ({data.clients.length})
        </button>
      </div>
      <DataTable
        columnas={columnas}
        filas={filas}
        buscar={(c) => `${c.nombre} ${c.nit || ''} ${c.contacto} ${c.correo} ${c.departamento} ${c.municipio} ${c.ciudad}`}
        placeholder="Buscar por razón social, NIT, contacto, departamento o municipio..."
        filtros={[
          {
            titulo: 'Departamento',
            valor: (c) => c.departamento,
            opciones: [...new Set(filas.map((c) => c.departamento))],
          },
          {
            titulo: 'Municipio',
            valor: (c) => c.municipio,
            opciones: [...new Set(filas.map((c) => c.municipio))],
          },
        ]}
        vacioTitulo="No se encontraron clientes"
      />

      {modalAbierto && (
        <div className="modal-backdrop" onClick={cerrarModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Registrar nuevo cliente"
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="users" tamano={20} />
              </span>
              <div>
                <h2>{clienteEnEdicion ? `Editar cliente: ${clienteEnEdicion.nombre}` : 'Registrar nuevo cliente'}</h2>
                <p>{clienteEnEdicion ? 'Actualiza la identificación, ubicación geográfica y datos de contacto.' : 'Ingresa la identificación, ubicación geográfica y datos de contacto comercial.'}</p>
              </div>
              <button className="icon-btn" onClick={cerrarModal} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="modal-body" noValidate>
              <div className="form-grid">
                <div className={`field ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteNombre">
                    Empresa o razón social *
                  </label>
                  <input
                    id="clienteNombre"
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej. Editorial Aurora S.A.S."
                    autoFocus
                  />
                  {errores.nombre && <span className="field-error">{errores.nombre}</span>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="clienteTipoCliente">
                    Tipo de cliente *
                  </label>
                  <select
                    id="clienteTipoCliente"
                    name="tipoCliente"
                    value={form.tipoCliente}
                    onChange={handleChange}
                  >
                    {TIPOS_CLIENTE.map((tc) => (
                      <option key={tc} value={tc}>
                        {tc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="clienteTipoDocumento">
                    Tipo de documento *
                  </label>
                  <select
                    id="clienteTipoDocumento"
                    name="tipoDocumento"
                    value={form.tipoDocumento}
                    onChange={handleChange}
                  >
                    {TIPOS_DOCUMENTO.map((td) => (
                      <option key={td.codigo} value={td.codigo}>
                        {td.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`field ${errores.nit ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteNit">
                    Número de documento / {form.tipoDocumento} *
                  </label>
                  <input
                    id="clienteNit"
                    name="nit"
                    value={form.nit}
                    onChange={handleChange}
                    placeholder={form.tipoDocumento === 'NIT' ? 'Ej. 901.456.789-2' : 'Ej. 1.020.456.789'}
                  />
                  {errores.nit && <span className="field-error">{errores.nit}</span>}
                </div>

                <div className={`field ${errores.contacto ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteContacto">
                    Contacto principal *
                  </label>
                  <input
                    id="clienteContacto"
                    name="contacto"
                    value={form.contacto}
                    onChange={handleChange}
                    placeholder="Ej. Valeria Gómez"
                  />
                  {errores.contacto && <span className="field-error">{errores.contacto}</span>}
                </div>

                <div className={`field ${errores.telefono ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteTelefono">
                    Teléfono / Celular *
                  </label>
                  <input
                    id="clienteTelefono"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="Ej. 310 456 7890"
                  />
                  {errores.telefono && <span className="field-error">{errores.telefono}</span>}
                </div>

                <div className={`field full ${errores.correo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteCorreo">
                    Correo electrónico corporativo *
                  </label>
                  <input
                    id="clienteCorreo"
                    name="correo"
                    type="email"
                    value={form.correo}
                    onChange={handleChange}
                    placeholder="contacto@empresa.co"
                  />
                  {errores.correo && <span className="field-error">{errores.correo}</span>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="clientePais">
                    País *
                  </label>
                  <select id="clientePais" name="pais" value={form.pais} onChange={handleChange}>
                    {PAISES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`field ${errores.departamento ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteDepartamento">
                    Departamento *
                  </label>
                  <select
                    id="clienteDepartamento"
                    name="departamento"
                    value={form.departamento}
                    onChange={handleChange}
                  >
                    {departamentosDisponibles.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                  {errores.departamento && <span className="field-error">{errores.departamento}</span>}
                </div>

                <div className={`field ${errores.municipio ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteMunicipio">
                    Municipio / Ciudad *
                  </label>
                  <select
                    id="clienteMunicipio"
                    name="municipio"
                    value={form.municipio}
                    onChange={handleChange}
                  >
                    {municipiosDisponibles.map((mun) => (
                      <option key={mun} value={mun}>
                        {mun}
                      </option>
                    ))}
                  </select>
                  {errores.municipio && <span className="field-error">{errores.municipio}</span>}
                </div>

                <div className={`field ${errores.direccion ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteDireccion">
                    Dirección de entrega / sede *
                  </label>
                  <input
                    id="clienteDireccion"
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Ej. Cra 43A # 14-50 Of. 302"
                  />
                  {errores.direccion && <span className="field-error">{errores.direccion}</span>}
                </div>
              </div>

              <div
                className="modal-foot"
                style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}
              >
                <button type="button" className="btn" onClick={cerrarModal} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  <Icon nombre="check" tamano={15} /> {guardando ? 'Guardando...' : (clienteEnEdicion ? 'Guardar cambios' : 'Registrar cliente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
