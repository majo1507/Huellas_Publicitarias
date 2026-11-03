import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'

const FORM_INICIAL = {
  nombre: '',
  nit: '',
  contacto: '',
  correo: '',
  telefono: '',
  ciudad: 'Bogotá',
  direccion: '',
}

// Lista de clientes (la usa Comercial / Recepción)
export default function Clients({ data, actions, irA }) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const filas = data.clients.map((c) => ({
    ...c,
    solicitudes: data.requests.filter((s) => s.clienteId === c.id).length,
    ordenes: data.orders.filter((o) => o.clienteId === c.id).length,
  }))

  const columnas = [
    { clave: 'nombre', titulo: 'Cliente', ordenar: true, render: (c) => <span className="person"><Avatar nombre={c.nombre} tamano="sm" /><strong>{c.nombre}</strong></span> },
    { clave: 'contacto', titulo: 'Contacto', render: (c) => <>{c.contacto}<small className="cell-sub">{c.correo}</small></> },
    { clave: 'telefono', titulo: 'Teléfono' },
    { clave: 'ciudad', titulo: 'Ciudad', ordenar: true },
    { clave: 'solicitudes', titulo: 'Solicitudes', ordenar: true },
    { clave: 'ordenes', titulo: 'Órdenes', ordenar: true },
    { clave: 'acciones', titulo: 'Acciones', render: (c) => <button className="btn btn-soft btn-sm" onClick={() => irA('nuevo', c.id)}><Icon nombre="file-plus" tamano={14} /> Nueva solicitud</button> },
  ]

  function abrirModalNuevo() {
    setForm(FORM_INICIAL)
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

    if (form.nit.trim()) {
      const nitExiste = data.clients.some(
        (c) => c.nit && c.nit.trim().toLowerCase() === form.nit.trim().toLowerCase()
      )
      if (nitExiste) {
        err.nit = 'Ya existe un cliente registrado con este NIT.'
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

    if (!form.ciudad.trim()) {
      err.ciudad = 'La ciudad es obligatoria.'
    }

    if (!form.direccion.trim()) {
      err.direccion = 'La dirección es obligatoria.'
    }

    setErrores(err)
    return Object.keys(err).length === 0
  }

  async function handleGuardar(e) {
    e.preventDefault()
    if (!validar() || !actions?.addClient) return

    setGuardando(true)
    try {
      await actions.addClient({
        nombre: form.nombre.trim(),
        empresa: form.nombre.trim(),
        nit: form.nit.trim() || undefined,
        contacto: form.contacto.trim(),
        contacto_principal: form.contacto.trim(),
        correo: form.correo.trim().toLowerCase(),
        telefono: form.telefono.trim(),
        ciudad: form.ciudad.trim(),
        direccion: form.direccion.trim(),
      })
      setModalAbierto(false)
      setForm(FORM_INICIAL)
    } catch {
      // El toast de error ya lo muestra actions.addClient
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        subtitulo={`${data.clients.length} clientes registrados.`}
        icono="users"
        acciones={
          <button className="btn btn-primary" onClick={abrirModalNuevo}>
            <Icon nombre="plus" tamano={15} /> Registrar nuevo cliente
          </button>
        }
      />
      <DataTable
        columnas={columnas}
        filas={filas}
        buscar={(c) => `${c.nombre} ${c.contacto} ${c.correo} ${c.ciudad}`}
        placeholder="Buscar cliente, contacto o ciudad..."
        filtros={[{ titulo: 'Ciudad', valor: (c) => c.ciudad, opciones: [...new Set(data.clients.map((c) => c.ciudad))] }]}
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
                <h2>Registrar nuevo cliente</h2>
                <p>Ingresa los datos comerciales y de contacto para habilitar solicitudes y órdenes.</p>
              </div>
              <button className="icon-btn" onClick={cerrarModal} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>

            <form onSubmit={handleGuardar} className="modal-body" noValidate>
              <div className="form-grid">
                <div className={`field ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteNombre">Empresa o cliente</label>
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

                <div className={`field ${errores.nit ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteNit">NIT (opcional)</label>
                  <input
                    id="clienteNit"
                    name="nit"
                    value={form.nit}
                    onChange={handleChange}
                    placeholder="Ej. 901.456.789-2"
                  />
                  {errores.nit && <span className="field-error">{errores.nit}</span>}
                </div>

                <div className={`field ${errores.contacto ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteContacto">Contacto principal</label>
                  <input
                    id="clienteContacto"
                    name="contacto"
                    value={form.contacto}
                    onChange={handleChange}
                    placeholder="Ej. Valeria Gómez"
                  />
                  {errores.contacto && <span className="field-error">{errores.contacto}</span>}
                </div>

                <div className={`field ${errores.correo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteCorreo">Correo electrónico</label>
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

                <div className={`field ${errores.telefono ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteTelefono">Teléfono</label>
                  <input
                    id="clienteTelefono"
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="Ej. 310 456 7890"
                  />
                  {errores.telefono && <span className="field-error">{errores.telefono}</span>}
                </div>

                <div className={`field ${errores.ciudad ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteCiudad">Ciudad</label>
                  <input
                    id="clienteCiudad"
                    name="ciudad"
                    value={form.ciudad}
                    onChange={handleChange}
                    placeholder="Ej. Bogotá"
                  />
                  {errores.ciudad && <span className="field-error">{errores.ciudad}</span>}
                </div>

                <div className={`field full ${errores.direccion ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="clienteDireccion">Dirección de entrega / sede</label>
                  <input
                    id="clienteDireccion"
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Ej. Cra 15 # 93-40 Of. 302"
                  />
                  {errores.direccion && <span className="field-error">{errores.direccion}</span>}
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={cerrarModal} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  <Icon nombre="check" tamano={15} /> {guardando ? 'Registrando...' : 'Registrar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
