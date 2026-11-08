import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import Alert from '../components/Alert.jsx'
import Modal from '../components/Modal.jsx'
import { FECHA_DEMO, formatearFecha } from '../utils/format.js'
import {
  CATALOGO_PRODUCTOS,
  CATALOGO_MATERIALES,
  CATALOGO_DIMENSIONES,
  CATALOGO_ACABADOS,
  PRIORIDADES,
  METODOS_ENTREGA,
} from '../data/catalogos.js'

const formVacio = {
  clienteId: '',
  producto: CATALOGO_PRODUCTOS[0],
  cantidad: '1',
  dimensionesPreset: CATALOGO_DIMENSIONES[0],
  dimensionesPersonalizada: '',
  material: CATALOGO_MATERIALES[0],
  prioridad: 'Media',
  metodoEntrega: METODOS_ENTREGA[0],
  acabadosSeleccionados: ['Corte y empaque estándar'],
  acabadosDetalle: '',
  fechaEntrega: '',
  presupuesto: '',
  requerimientos: '',
  observaciones: '',
  archivosReferencia: [],
}

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
  if (!f.cantidad || Number(f.cantidad) <= 0 || !Number.isInteger(Number(f.cantidad))) {
    e.cantidad = 'La cantidad debe ser un número entero mayor que cero.'
  }
  const dim = f.dimensionesPreset === 'Medida personalizada' ? f.dimensionesPersonalizada : f.dimensionesPreset
  if (!dim || !dim.trim()) e.dimensiones = 'Indica las dimensiones del producto.'
  if (!f.material || !f.material.trim()) e.material = 'Selecciona o indica el material.'
  if (!f.prioridad) e.prioridad = 'Selecciona la prioridad comercial.'
  if (!f.metodoEntrega) e.metodoEntrega = 'Selecciona el método de entrega.'
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

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: undefined }))
  }

  function handleToggleAcabado(acabado) {
    setForm((prev) => {
      const existe = prev.acabadosSeleccionados.includes(acabado)
      const nuevos = existe
        ? prev.acabadosSeleccionados.filter((a) => a !== acabado)
        : [...prev.acabadosSeleccionados, acabado]
      return { ...prev, acabadosSeleccionados: nuevos }
    })
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
    const [anio, mes, dia] = form.fechaEntrega.split('-')
    const cliente = clients.find((c) => c.id === form.clienteId)
    const dimensionesFinal =
      form.dimensionesPreset === 'Medida personalizada'
        ? form.dimensionesPersonalizada.trim()
        : form.dimensionesPreset

    const todosAcabados = [
      ...form.acabadosSeleccionados,
      form.acabadosDetalle.trim(),
    ].filter(Boolean)

    const acabadosFinal = todosAcabados.length > 0 ? todosAcabados.join(', ') : 'Corte y empaque estándar'

    onSubmit({
      clienteId: form.clienteId,
      cliente: cliente?.nombre || '',
      producto: form.producto,
      cantidad: Number(form.cantidad),
      dimensiones: dimensionesFinal,
      material: form.material,
      prioridad: form.prioridad,
      metodoEntrega: form.metodoEntrega,
      acabados: acabadosFinal,
      fechaEntrega: `${dia}/${mes}/${anio}`,
      presupuesto: Number(form.presupuesto),
      requerimientos: form.requerimientos,
      observaciones: form.observaciones,
      archivosReferencia: form.archivosReferencia || [],
    })
  }

  const campo = (nombre, etiqueta, control, ayuda, completo = false) => (
    <div className={`field${errores[nombre] ? ' has-error' : ''}${completo ? ' full' : ''}`}>
      <label className="field-label" htmlFor={nombre}>{etiqueta}</label>
      {control}
      {ayuda && !errores[nombre] && <span className="field-hint">{ayuda}</span>}
      {errores[nombre] && <span className="field-error">{errores[nombre]}</span>}
    </div>
  )
  const input = (nombre, extra = {}) => (
    <input id={nombre} name={nombre} value={form[nombre]} onChange={handleChange} {...extra} />
  )

  const hayErrores = Object.values(errores).some(Boolean)

  return (
    <div>
      <PageHeader
        titulo="Registrar solicitud comercial"
        subtitulo="Registra la solicitud del cliente con catálogos estructurados de productos, materiales, acabados y archivos de referencia."
        icono="file-plus"
        volver={{ texto: 'Volver a solicitudes', onClick: () => irA('solicitudes') }}
      />
      <div className="ban ban-azul" style={{ marginBottom: '18px' }}>
        <Icon nombre="info" tamano={18} />
        <div>
          <strong>Flujo de aprobación comercial:</strong> Toda solicitud registrada se crea con identificador único (ej. <code>SOL-2026-XXXX</code>) en estado <em>Pendiente</em>. Debe enviarse a validación técnica para que el Coordinador de Producción verifique su viabilidad y genere formalmente la Orden de Producción (<code>OP-2026-XXXX</code>).
        </div>
      </div>
      {hayErrores && <Alert tipo="error" titulo="Revisa el formulario">Hay campos con errores. Corrígelos para continuar.</Alert>}

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        {/* SECCIÓN 1: CLIENTE Y PRODUCTO */}
        <section className="form-section">
          <h2><Icon nombre="users" tamano={18} /> Cliente y Producto</h2>
          <div className="form-grid">
            {campo('clienteId', 'Cliente registrado *',
              <select id="clienteId" name="clienteId" value={form.clienteId} onChange={handleChange}>
                <option value="">Selecciona un cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.nit ? `(${c.nit})` : ''} — {c.municipio || c.ciudad || 'Colombia'}
                  </option>
                ))}
              </select>,
              'Si es un cliente nuevo, regístralo previamente en el módulo Clientes'
            )}

            {campo('producto', 'Tipo de producto publicitario *',
              <select id="producto" name="producto" value={form.producto} onChange={handleChange}>
                {CATALOGO_PRODUCTOS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            {campo('cantidad', 'Cantidad de unidades *',
              input('cantidad', { type: 'number', min: 1, step: 1 })
            )}

            {campo('prioridad', 'Prioridad comercial *',
              <select id="prioridad" name="prioridad" value={form.prioridad} onChange={handleChange}>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* SECCIÓN 2: ESPECIFICACIONES TÉCNICAS */}
        <section className="form-section">
          <h2><Icon nombre="layers" tamano={18} /> Sustrato, Dimensiones y Acabados</h2>
          <div className="form-grid">
            {campo('material', 'Sustrato / Material principal *',
              <select id="material" name="material" value={form.material} onChange={handleChange}>
                {CATALOGO_MATERIALES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}

            {campo('dimensionesPreset', 'Formato / Dimensiones *',
              <select id="dimensionesPreset" name="dimensionesPreset" value={form.dimensionesPreset} onChange={handleChange}>
                {CATALOGO_DIMENSIONES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {form.dimensionesPreset === 'Medida personalizada' &&
              campo('dimensionesPersonalizada', 'Especifica las medidas (ancho x alto) *',
                input('dimensionesPersonalizada', { placeholder: 'Ej: 1.85 x 2.40 m' })
              )}

            {campo('metodoEntrega', 'Método de entrega acordado *',
              <select id="metodoEntrega" name="metodoEntrega" value={form.metodoEntrega} onChange={handleChange}>
                {METODOS_ENTREGA.map((me) => (
                  <option key={me} value={me}>{me}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginTop: '16px' }}>
            <span className="field-label" style={{ display: 'block', marginBottom: '8px' }}>
              Acabados y confección gráfica requeridos
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
              {CATALOGO_ACABADOS.map((acabado) => (
                <label
                  key={acabado}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    padding: '6px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.acabadosSeleccionados.includes(acabado)}
                    onChange={() => handleToggleAcabado(acabado)}
                  />
                  <span>{acabado}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: '10px' }}>
              <input
                id="acabadosDetalle"
                name="acabadosDetalle"
                value={form.acabadosDetalle}
                onChange={handleChange}
                placeholder="Otro acabado específico (opcional, ej. Barniz sectorizado en logo)..."
                style={{ fontSize: '13px' }}
              />
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: FECHA Y PRESUPUESTO */}
        <section className="form-section">
          <h2><Icon nombre="calendar" tamano={18} /> Cronograma y Presupuesto</h2>
          <div className="form-grid">
            {campo('fechaEntrega', 'Fecha límite de entrega pactada *',
              input('fechaEntrega', { type: 'date', min: fechaMinima() })
            )}
            {campo('presupuesto', 'Presupuesto total cotizado (COP) *',
              input('presupuesto', { type: 'number', min: 0, placeholder: 'Ej. 350000' })
            )}
          </div>
        </section>

        {/* SECCIÓN 4: ARCHIVOS DE REFERENCIA */}
        <section className="form-section">
          <h2><Icon nombre="paperclip" tamano={18} /> Archivos de Referencia del Cliente</h2>
          <div className="form-grid">
            {campo(
              'archivosReferencia',
              'Adjuntar logotipos, bocetos, artes o manual de marca (PNG, JPG, PDF, SVG, AI, PSD)',
              <input
                id="archivosReferencia"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.pdf,.svg,.webp,.ai,.psd,.doc,.docx"
                onChange={handleArchivosChange}
                style={{ padding: '7px 10px' }}
              />,
              'Los archivos adjuntos se vincularán automáticamente a la orden de producción para que diseño y coordinación puedan consultarlos.',
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

        {/* SECCIÓN 5: REQUERIMIENTOS Y OBSERVACIONES */}
        <section className="form-section">
          <h2><Icon nombre="message" tamano={18} /> Instrucciones y Observaciones</h2>
          <div className="form-grid">
            {campo('requerimientos', 'Requerimientos técnicos de preprensa y diseño',
              <textarea id="requerimientos" name="requerimientos" rows="3" value={form.requerimientos} onChange={handleChange} placeholder="Ej: Logo en vector, incluir número de teléfono y QR..." />, 'Opcional', true)}
            {campo('observaciones', 'Observaciones comerciales y de logística',
              <textarea id="observaciones" name="observaciones" rows="3" value={form.observaciones} onChange={handleChange} placeholder="Ej: Entregar en horario matutino en recepción..." />, 'Opcional', true)}
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
          titulo="Confirmar registro de solicitud"
          icono="file-plus"
          mensaje={`Se registrará la solicitud de "${form.producto}" (${form.cantidad} unidades, ${form.material}) con prioridad ${form.prioridad} para el cliente seleccionado${form.archivosReferencia.length > 0 ? ` y ${form.archivosReferencia.length} archivo(s) de referencia` : ''}. ¿Deseas continuar?`}
          textoBoton="Registrar solicitud"
          onClose={() => setConfirmar(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
