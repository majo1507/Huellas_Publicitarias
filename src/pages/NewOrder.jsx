import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import Alert from '../components/Alert.jsx'
import Modal from '../components/Modal.jsx'
import { FECHA_DEMO, formatearFecha } from '../utils/format.js'

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
  archivosReferencia: [],
}

const PRODUCTOS = [
  'Pendón publicitario',
  'Papelería corporativa',
  'Vinilo adhesivo',
  'Volantes',
  'Tarjetas de presentación',
  'Valla publicitaria',
]

const FORMATOS_PERMITIDOS = ['png', 'jpg', 'jpeg', 'pdf', 'svg', 'webp', 'ai', 'psd', 'doc', 'docx']

// Fecha mínima permitida (aaaa-mm-dd) a partir de la fecha de referencia del sistema
function fechaMinima() {
  const d = new Date(FECHA_DEMO)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function formatearTamano(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return 'Archivo adjunto'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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
  const [archivoPreview, setArchivoPreview] = useState(null)

  // Actualiza el campo que el usuario está escribiendo
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    if (errores[e.target.name]) setErrores({ ...errores, [e.target.name]: undefined })
  }

  // Adjuntar archivos de referencia (imágenes, PDF o documentos del cliente)
  function handleArchivosChange(e) {
    const seleccionados = Array.from(e.target.files || [])
    if (seleccionados.length === 0) return

    const erroresArchivo = []
    const promesas = []

    seleccionados.forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!FORMATOS_PERMITIDOS.includes(ext)) {
        erroresArchivo.push(`Formato no compatible: ${file.name}`)
        return
      }
      promesas.push(
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nombre: file.name,
              tipo: file.type || ext.toUpperCase(),
              tamano: formatearTamano(file.size),
              fecha: formatearFecha(),
              dataUrl: typeof reader.result === 'string' ? reader.result : '',
            })
          }
          reader.onerror = () => {
            resolve({
              id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nombre: file.name,
              tipo: file.type || ext.toUpperCase(),
              tamano: formatearTamano(file.size),
              fecha: formatearFecha(),
              dataUrl: '',
            })
          }
          reader.readAsDataURL(file)
        })
      )
    })

    if (erroresArchivo.length > 0) {
      setErrores((prev) => ({ ...prev, archivosReferencia: erroresArchivo.join(', ') }))
    } else {
      setErrores((prev) => ({ ...prev, archivosReferencia: undefined }))
    }

    Promise.all(promesas).then((nuevos) => {
      setForm((prev) => ({
        ...prev,
        archivosReferencia: [...(prev.archivosReferencia || []), ...nuevos],
      }))
    })

    e.target.value = ''
  }

  function quitarArchivo(idArchivo) {
    setForm((prev) => ({
      ...prev,
      archivosReferencia: (prev.archivosReferencia || []).filter((a) => a.id !== idArchivo),
    }))
  }

  function descargarAdjunto(a) {
    if (!a?.dataUrl) return
    const link = document.createElement('a')
    link.href = a.dataUrl
    link.download = a.nombre || 'referencia'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
      cliente: cliente?.nombre || '',
      cantidad: Number(form.cantidad),
      presupuesto: Number(form.presupuesto),
      fechaEntrega: `${dia}/${mes}/${anio}`,
      archivosReferencia: form.archivosReferencia || [],
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
        subtitulo="Registra la solicitud de un cliente con sus especificaciones y archivos de referencia. Quedará pendiente hasta enviarla a validación."
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
          <h2><Icon nombre="paperclip" tamano={18} /> Archivos de referencia del cliente</h2>
          <div className="form-grid">
            {campo(
              'archivosReferencia',
              'Adjuntar imágenes, logotipos, bocetos o manual de marca (PNG, JPG, JPEG, PDF y afines)',
              <input
                id="archivosReferencia"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.pdf,.svg,.webp,.ai,.psd,.doc,.docx"
                onChange={handleArchivosChange}
                style={{ padding: '7px 10px' }}
              />,
              'Los archivos adjuntos quedarán vinculados a la solicitud y pasarán automáticamente a la orden de producción para que el diseñador y el coordinador puedan visualizarlos o descargarlos.',
              true
            )}
          </div>

          {form.archivosReferencia.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div className="sm mut" style={{ marginBottom: '6px', fontWeight: 600 }}>
                Archivos adjuntos ({form.archivosReferencia.length}):
              </div>
              <div className="stack" style={{ gap: '8px' }}>
                {form.archivosReferencia.map((archivo) => (
                  <div
                    key={archivo.id}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="row" style={{ gap: '10px' }}>
                      {archivo.dataUrl && archivo.dataUrl.startsWith('data:image') ? (
                        <img
                          src={archivo.dataUrl}
                          alt={archivo.nombre}
                          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                        />
                      ) : (
                        <Icon nombre="paperclip" tamano={16} />
                      )}
                      <div>
                        <strong className="sm">{archivo.nombre}</strong>
                        <small className="cell-sub">{archivo.tipo} · {archivo.tamano}</small>
                      </div>
                    </div>

                    <div className="row" style={{ gap: '6px' }}>
                      {archivo.dataUrl && (
                        <>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArchivoPreview(archivo)}>
                            <Icon nombre="eye" tamano={13} /> Ver
                          </button>
                          <button type="button" className="btn btn-soft btn-sm" onClick={() => descargarAdjunto(archivo)}>
                            <Icon nombre="download" tamano={13} /> Descargar
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm danger-text"
                        onClick={() => quitarArchivo(archivo.id)}
                        title="Quitar archivo"
                      >
                        <Icon nombre="x" tamano={13} /> Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {archivoPreview && (
        <div className="modal-backdrop" onClick={() => setArchivoPreview(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="paperclip" tamano={20} /></span>
              <div>
                <h2>{archivoPreview.nombre}</h2>
                <p>{archivoPreview.tipo} · {archivoPreview.tamano}</p>
              </div>
              <button className="icon-btn" onClick={() => setArchivoPreview(null)}><Icon nombre="x" /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {archivoPreview.dataUrl?.startsWith('data:image') ? (
                <img src={archivoPreview.dataUrl} alt={archivoPreview.nombre} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)' }} />
              ) : archivoPreview.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={archivoPreview.nombre} src={archivoPreview.dataUrl} style={{ width: '100%', height: '400px', border: '1px solid var(--border-light)' }} />
              ) : (
                <p className="sm mut">Archivo listo para ser adjuntado y descargado por el equipo.</p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setArchivoPreview(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" onClick={() => descargarAdjunto(archivoPreview)}>
                <Icon nombre="download" tamano={14} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmar && (
        <Modal
          titulo="Confirmar solicitud"
          icono="file-plus"
          mensaje={`Se registrará la solicitud de ${form.producto} (${form.cantidad} uds) para el cliente seleccionado${form.archivosReferencia.length > 0 ? ` con ${form.archivosReferencia.length} archivo(s) de referencia adjunto(s)` : ''}. ¿Deseas continuar?`}
          textoBoton="Registrar"
          onClose={() => setConfirmar(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
