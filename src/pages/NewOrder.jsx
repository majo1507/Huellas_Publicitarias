import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import Alert from '../components/Alert.jsx'
import Modal from '../components/Modal.jsx'
import { FECHA_DEMO } from '../utils/format.js'

const formVacio = {
  clienteId: '',
  producto: '',
  cantidad: '',
  dimensiones: '',
  material: '',
  fechaEntrega: '',
  presupuesto: '',
  requerimientos: '',
  observaciones: '',
}

const PRODUCTOS = ['Pendón publicitario', 'Papelería corporativa', 'Vinilo adhesivo', 'Volantes', 'Tarjetas de presentación', 'Valla publicitaria']

// Fecha mínima permitida (aaaa-mm-dd) a partir de la fecha de referencia del sistema
function fechaMinima() {
  const d = new Date(FECHA_DEMO)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function validar(f) {
  const e = {}
  if (!f.clienteId) e.clienteId = 'Selecciona un cliente.'
  if (!f.producto) e.producto = 'Selecciona el tipo de producto.'
  if (!f.cantidad || Number(f.cantidad) <= 0 || !Number.isInteger(Number(f.cantidad))) e.cantidad = 'La cantidad debe ser un número entero mayor que cero.'
  if (!f.dimensiones.trim()) e.dimensiones = 'Indica las dimensiones.'
  if (!f.material.trim()) e.material = 'Indica el material.'
  if (!f.fechaEntrega) e.fechaEntrega = 'Selecciona la fecha de entrega.'
  else if (f.fechaEntrega < fechaMinima()) e.fechaEntrega = 'La fecha no puede ser anterior a hoy.'
  if (f.presupuesto === '' || Number(f.presupuesto) < 0) e.presupuesto = 'Ingresa un presupuesto válido (0 o más).'
  return e
}

// Formulario para registrar una solicitud de cliente (la usa Comercial / Recepción)
export default function NewOrder({ clients, onSubmit, irA, clienteInicialId }) {
  const [form, setForm] = useState(() => ({
    ...formVacio,
    clienteId: clienteInicialId && clients.some((c) => c.id === clienteInicialId) ? clienteInicialId : '',
  }))
  const [errores, setErrores] = useState({})
  const [confirmar, setConfirmar] = useState(false)

  // Actualiza el campo que el usuario está escribiendo
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (errores[e.target.name]) setErrores({ ...errores, [e.target.name]: undefined })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validar(form)
    setErrores(errs)
    if (Object.keys(errs).length === 0) setConfirmar(true)
  }

  function enviar() {
    // El input de fecha entrega aaaa-mm-dd; lo pasamos a dd/mm/aaaa
    const [anio, mes, dia] = form.fechaEntrega.split('-')
    const cliente = clients.find((c) => c.id === form.clienteId)
    onSubmit({
      ...form,
      cliente: cliente.nombre,
      cantidad: Number(form.cantidad),
      presupuesto: Number(form.presupuesto),
      fechaEntrega: `${dia}/${mes}/${anio}`,
    })
  }

  // Campo con etiqueta y mensaje de error
  const campo = (nombre, etiqueta, control, ayuda, completo = false) => (
    <div className={`field${errores[nombre] ? ' has-error' : ''}${completo ? ' full' : ''}`}>
      <label className="field-label" htmlFor={nombre}>{etiqueta}</label>
      {control}
      {ayuda && !errores[nombre] && <span className="field-hint">{ayuda}</span>}
      {errores[nombre] && <span className="field-error">{errores[nombre]}</span>}
    </div>
  )
  const input = (nombre, extra = {}) => <input id={nombre} name={nombre} value={form[nombre]} onChange={handleChange} {...extra} />

  const hayErrores = Object.values(errores).some(Boolean)

  return (
    <div>
      <PageHeader
        titulo="Registrar solicitud"
        subtitulo="Registra la solicitud de un cliente. Quedará pendiente hasta enviarla a validación."
        icono="file-plus"
        volver={{ texto: 'Volver a solicitudes', onClick: () => irA('solicitudes') }}
      />
      {hayErrores && <Alert tipo="error" titulo="Revisa el formulario">Hay campos con errores. Corrígelos para continuar.</Alert>}

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <section className="form-section">
          <h2><Icon nombre="users" tamano={18} /> Cliente y producto</h2>
          <div className="form-grid">
            {campo('clienteId', 'Cliente',
              <select id="clienteId" name="clienteId" value={form.clienteId} onChange={handleChange}>
                <option value="">Seleccionar...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>)}
            {campo('producto', 'Tipo de producto',
              <select id="producto" name="producto" value={form.producto} onChange={handleChange}>
                <option value="">Seleccionar...</option>
                {PRODUCTOS.map((p) => <option key={p}>{p}</option>)}
              </select>)}
            {campo('cantidad', 'Cantidad', input('cantidad', { type: 'number', min: 1 }))}
          </div>
        </section>

        <section className="form-section">
          <h2><Icon nombre="layers" tamano={18} /> Especificaciones</h2>
          <div className="form-grid">
            {campo('dimensiones', 'Dimensiones', input('dimensiones', { placeholder: 'Ej: 2m x 1m' }))}
            {campo('material', 'Material', input('material', { placeholder: 'Ej: Lona' }))}
          </div>
        </section>

        <section className="form-section">
          <h2><Icon nombre="calendar" tamano={18} /> Entrega y presupuesto</h2>
          <div className="form-grid">
            {campo('fechaEntrega', 'Fecha de entrega', input('fechaEntrega', { type: 'date', min: fechaMinima() }))}
            {campo('presupuesto', 'Presupuesto (COP)', input('presupuesto', { type: 'number', min: 0 }))}
          </div>
        </section>

        <section className="form-section">
          <h2><Icon nombre="message" tamano={18} /> Notas</h2>
          <div className="form-grid">
            {campo('requerimientos', 'Requerimientos',
              <textarea id="requerimientos" name="requerimientos" rows="3" value={form.requerimientos} onChange={handleChange} />, 'Opcional', true)}
            {campo('observaciones', 'Observaciones',
              <textarea id="observaciones" name="observaciones" rows="3" value={form.observaciones} onChange={handleChange} />, 'Opcional', true)}
          </div>
        </section>

        <div className="form-actions">
          <button type="button" className="btn" onClick={() => irA('solicitudes')}>Cancelar</button>
          <button type="submit" className="btn btn-primary"><Icon nombre="check" tamano={16} /> Registrar solicitud</button>
        </div>
      </form>

      {confirmar && (
        <Modal
          titulo="Confirmar solicitud"
          icono="file-plus"
          mensaje={`Se registrará la solicitud de ${form.producto} (${form.cantidad} uds) para el cliente seleccionado. ¿Deseas continuar?`}
          textoBoton="Registrar"
          onClose={() => setConfirmar(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
