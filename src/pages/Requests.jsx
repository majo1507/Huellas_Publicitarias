import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { formatoCOP } from '../utils/format.js'
import {
  CATALOGO_PRODUCTOS,
  CATALOGO_MATERIALES,
  CATALOGO_DIMENSIONES,
  CATALOGO_ACABADOS,
  METODOS_ENTREGA,
} from '../data/catalogos.js'

function aFechaInput(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  try {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dia = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dia}`
    }
  } catch (_) {}
  return ''
}

function aFechaTexto(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return val
}

function ModalCorregirSolicitud({ solicitud, onClose, onGuardar }) {
  const [form, setForm] = useState(() => ({
    producto: solicitud.producto || '',
    cantidad: solicitud.cantidad || 1,
    dimensiones: solicitud.dimensiones || '',
    material: solicitud.material || '',
    acabados: solicitud.acabados || 'Corte y empaque estándar',
    metodoEntrega: solicitud.metodoEntrega || 'Domicilio',
    fechaEntrega: aFechaInput(solicitud.fechaEntrega),
    presupuesto: solicitud.presupuesto ?? '',
    requerimientos: solicitud.requerimientos || '',
    observaciones: solicitud.observaciones || '',
  }))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.producto.trim()) {
      setError('El producto es obligatorio.')
      return
    }
    const cant = Number(form.cantidad)
    if (!cant || cant <= 0 || !Number.isInteger(cant)) {
      setError('La cantidad debe ser un número entero mayor a 0.')
      return
    }
    if (!form.dimensiones.trim()) {
      setError('Las dimensiones son obligatorias.')
      return
    }
    if (!form.material.trim()) {
      setError('El material es obligatorio.')
      return
    }
    if (!form.fechaEntrega) {
      setError('La fecha de entrega es obligatoria.')
      return
    }
    const pres = Number(form.presupuesto)
    if (isNaN(pres) || pres < 0) {
      setError('El presupuesto debe ser un número mayor o igual a 0.')
      return
    }

    try {
      setGuardando(true)
      await onGuardar({
        producto: form.producto.trim(),
        cantidad: cant,
        dimensiones: form.dimensiones.trim(),
        material: form.material.trim(),
        acabados: form.acabados.trim(),
        metodoEntrega: form.metodoEntrega,
        fechaEntrega: aFechaTexto(form.fechaEntrega),
        presupuesto: pres,
        requerimientos: form.requerimientos.trim(),
        observaciones: form.observaciones.trim(),
      })
    } catch (err) {
      setError(err.message || 'Error al guardar los cambios.')
      setGuardando(false)
    }
  }

  const listaProductos = [...new Set([form.producto, ...CATALOGO_PRODUCTOS].filter(Boolean))]
  const listaMateriales = [...new Set([form.material, ...CATALOGO_MATERIALES].filter(Boolean))]
  const listaDimensiones = [...new Set([form.dimensiones, ...CATALOGO_DIMENSIONES].filter(Boolean))]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Corregir solicitud ${solicitud.id}`}
        style={{ width: 'min(680px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <span
            className="modal-icon"
            style={{
              background: 'var(--state-amber-bg, #fef3c7)',
              color: 'var(--state-amber-text, #b45309)',
            }}
          >
            <Icon nombre="edit" tamano={20} />
          </span>
          <div style={{ flex: 1 }}>
            <h2>Corregir solicitud {solicitud.id}</h2>
            <p>{solicitud.cliente} · Registrada el {solicitud.fechaSolicitud}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon nombre="x" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
            {/* Banner con motivo de devolución */}
            <div
              className="ban am"
              style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <Icon nombre="alert-triangle" tamano={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', fontSize: '13px', color: '#b45309', marginBottom: '2px' }}>
                  Motivo de devolución de Coordinación:
                </strong>
                <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                  {solicitud.motivoRechazo || 'Realiza las correcciones técnicas solicitadas para continuar con la validación.'}
                </span>
              </div>
            </div>

            {error && (
              <div
                className="ban re"
                style={{
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--state-red, #dc2626)',
                  fontSize: '13px',
                }}
              >
                <Icon nombre="alert-triangle" tamano={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="field-label" htmlFor="corr-producto" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Producto publicitario *
                </label>
                <select
                  id="corr-producto"
                  name="producto"
                  value={form.producto}
                  onChange={handleChange}
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                >
                  {listaProductos.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="corr-cantidad" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Cantidad (unidades) *
                </label>
                <input
                  id="corr-cantidad"
                  type="number"
                  name="cantidad"
                  min="1"
                  step="1"
                  value={form.cantidad}
                  onChange={handleChange}
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="field-label" htmlFor="corr-dimensiones" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Dimensiones *
                </label>
                <input
                  id="corr-dimensiones"
                  type="text"
                  name="dimensiones"
                  list="datalist-dimensiones"
                  value={form.dimensiones}
                  onChange={handleChange}
                  placeholder="Ej: 1.00 x 1.50 m o Medida personalizada"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                />
                <datalist id="datalist-dimensiones">
                  {listaDimensiones.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="field-label" htmlFor="corr-material" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Material *
                </label>
                <select
                  id="corr-material"
                  name="material"
                  value={form.material}
                  onChange={handleChange}
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                >
                  {listaMateriales.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="field-label" htmlFor="corr-acabados" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Acabados y confección
                </label>
                <input
                  id="corr-acabados"
                  type="text"
                  name="acabados"
                  list="datalist-acabados"
                  value={form.acabados}
                  onChange={handleChange}
                  placeholder="Ej: Ojales metálicos, laminado mate..."
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                />
                <datalist id="datalist-acabados">
                  {CATALOGO_ACABADOS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="field-label" htmlFor="corr-metodoEntrega" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Método de entrega
                </label>
                <select
                  id="corr-metodoEntrega"
                  name="metodoEntrega"
                  value={form.metodoEntrega}
                  onChange={handleChange}
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                >
                  {METODOS_ENTREGA.map((me) => (
                    <option key={me} value={me}>{me}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="field-label" htmlFor="corr-fechaEntrega" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Fecha de entrega pactada *
                </label>
                <input
                  id="corr-fechaEntrega"
                  type="date"
                  name="fechaEntrega"
                  value={form.fechaEntrega}
                  onChange={handleChange}
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="corr-presupuesto" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Presupuesto comercial (COP) *
                </label>
                <input
                  id="corr-presupuesto"
                  type="number"
                  name="presupuesto"
                  min="0"
                  value={form.presupuesto}
                  onChange={handleChange}
                  placeholder="Ej: 300000"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label className="field-label" htmlFor="corr-requerimientos" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Requerimientos técnicos y especificaciones de arte
              </label>
              <textarea
                id="corr-requerimientos"
                name="requerimientos"
                rows="2"
                value={form.requerimientos}
                onChange={handleChange}
                placeholder="Detalla fuentes, colores corporativos, resolución requerida o notas para diseño..."
                className="form-control"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="corr-observaciones" style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Observaciones comerciales y de logística
              </label>
              <textarea
                id="corr-observaciones"
                name="observaciones"
                rows="2"
                value={form.observaciones}
                onChange={handleChange}
                placeholder="Condiciones de despacho, horario de entrega, contacto en sitio..."
                className="form-control"
                style={{ width: '100%', padding: '8px 10px', fontSize: '13px', resize: 'vertical' }}
              />
              <small className="cell-sub" style={{ display: 'block', marginTop: '4px' }}>
                Nota: Se registrará automáticamente en la trazabilidad tu usuario, la fecha y el resumen de cambios realizados.
              </small>
            </div>
          </div>

          <div className="modal-foot" style={{ borderTop: '1px solid var(--border-light)', padding: '14px 24px' }}>
            <button type="button" className="btn btn-soft" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={guardando}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon nombre="send" tamano={15} />
              {guardando ? 'Guardando...' : 'Guardar cambios y reenviar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ESTADOS = ['Pendiente', 'En validación', 'Aprobada', 'Devuelta para corrección', 'Rechazada']

// Solicitudes de clientes.
// Comercial: las envía a validación o ajusta devueltas.
// Coordinador: las valida (genera la orden), las devuelve para corrección o las rechaza.
export default function Requests({ data, actions, irA, role }) {
  const [rechazando, setRechazando] = useState(null) // id de solicitud a rechazar
  const [devolviendo, setDevolviendo] = useState(null) // id de solicitud a devolver para corrección
  const [validando, setValidando] = useState(null) // solicitud a validar (objeto completo)
  const [detalle, setDetalle] = useState(null) // solicitud a inspeccionar en modal de detalle
  const [archivoPreview, setArchivoPreview] = useState(null)
  const [corrigiendo, setCorrigiendo] = useState(null) // solicitud devuelta a editar/corregir por Comercial

  const esCoordinador = role === 'coordinador' || role === 'gerencia'
  const porValidar = data.requests.filter((s) => s.estado === 'En validación').length
  const porEnviar = data.requests.filter((s) => s.estado === 'Pendiente').length
  const devueltas = data.requests.filter((s) => s.estado === 'Devuelta para corrección').length

  function descargarAdjunto(a) {
    if (!a) return
    if (a.dataUrl) {
      const link = document.createElement('a')
      link.href = a.dataUrl
      link.download = a.nombre || 'archivo_referencia'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      actions?.notify?.(`Descargando archivo ${a.nombre}...`, 'exito')
      return
    }
    actions?.notify?.(`Archivo de referencia: ${a.nombre}`, 'info')
  }

  const columnas = [
    {
      clave: 'id',
      titulo: 'Solicitud',
      ordenar: true,
      render: (s) => (
        <div>
          <button
            className="link-inline"
            onClick={() => setDetalle(s)}
            title="Ver detalle de la solicitud"
            style={{ fontWeight: 600 }}
          >
            {s.id}
          </button>
          {role === 'comercial' && s.estado === 'Pendiente' && (
            <div>
              <span className="chip-pendiente-envio" title="Esta solicitud está registrada pero todavía no ha sido enviada a Coordinación">
                <Icon nombre="send" tamano={10} /> Pendiente de envío
              </span>
            </div>
          )}
          {s.archivosReferencia?.length > 0 && (
            <small className="cell-sub" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon nombre="paperclip" tamano={12} /> {s.archivosReferencia.length} adjunto(s)
            </small>
          )}
        </div>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    {
      clave: 'producto',
      titulo: 'Producto / Especificaciones',
      render: (s) => (
        <>
          <strong>{s.producto}</strong>
          <small className="cell-sub">
            {s.cantidad} uds · {s.dimensiones} · {s.material || 'Lona'}
          </small>
        </>
      ),
    },
    {
      clave: 'prioridad',
      titulo: 'Prioridad',
      ordenar: true,
      render: (s) => <StatusBadge estado={s.prioridad || 'Media'} texto={s.prioridad || 'Media'} />,
    },
    { clave: 'presupuesto', titulo: 'Presupuesto', ordenar: true, render: (s) => formatoCOP(s.presupuesto) },
    { clave: 'fechaEntrega', titulo: 'Entrega' },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (s) => (
        <div>
          <StatusBadge estado={s.estado} />
          {role === 'comercial' && s.estado === 'Pendiente' && (
            <small
              className="cell-sub text-amber"
              style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600, marginTop: '3px' }}
            >
              <Icon nombre="clock" tamano={11} /> No enviada a Coordinación
            </small>
          )}
          {s.motivoRechazo && (
            <small
              className={`cell-sub ${s.estado === 'Devuelta para corrección' ? 'text-amber' : 'text-rojo'}`}
              style={{ display: 'block', maxWidth: '220px', whiteSpace: 'normal' }}
            >
              {s.motivoRechazo}
            </small>
          )}
        </div>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (s) => (
        <div className="row-actions" style={{ flexWrap: 'wrap', gap: '4px' }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setDetalle(s)}
            title="Ver ficha completa de la solicitud"
          >
            <Icon nombre="eye" tamano={13} /> Detalle
          </button>

          {role === 'comercial' && s.estado === 'Pendiente' && (
            <button
              className="btn btn-primary btn-sm btn-enviar-destacado"
              onClick={() => actions.sendToValidation(s.id)}
              title="Enviar esta solicitud a Coordinación para iniciar validación técnica"
            >
              <Icon nombre="send" tamano={13} /> Enviar a Coordinación
            </button>
          )}

          {role === 'comercial' && s.estado === 'Devuelta para corrección' && (
            <>
              <button
                className="btn btn-warning btn-sm"
                onClick={() => setCorrigiendo(s)}
                title="Editar y corregir datos de la solicitud devuelta"
                style={{
                  background: 'var(--state-amber-bg, #fef3c7)',
                  color: 'var(--state-amber-text, #b45309)',
                  borderColor: 'var(--state-amber-border, #fcd34d)',
                  fontWeight: 600,
                }}
              >
                <Icon nombre="edit" tamano={13} /> Corregir solicitud
              </button>
              <button
                className="btn btn-soft btn-sm"
                onClick={() => actions.sendToValidation(s.id)}
                title="Reenviar solicitud a validación técnica"
              >
                <Icon nombre="send" tamano={13} /> Reenviar
              </button>
            </>
          )}

          {esCoordinador && s.estado === 'En validación' && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => setValidando(s)}
                title="Revisar y generar orden de producción"
              >
                <Icon nombre="check" tamano={13} /> Validar
              </button>
              <button
                className="btn btn-soft btn-sm"
                onClick={() => setDevolviendo(s.id)}
                title="Devolver al comercial para corrección de datos"
                style={{ color: 'var(--state-amber-text)' }}
              >
                Devolver
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setRechazando(s.id)}
                title="Rechazar definitivamente la solicitud"
              >
                Rechazar
              </button>
            </>
          )}

          {s.ordenId && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => irA('detalle', s.ordenId)}
              title={`Ir al detalle de la orden ${s.ordenId}`}
            >
              <Icon nombre="clipboard" tamano={13} /> Ver {s.ordenId}
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo={esCoordinador ? 'Validar solicitudes' : 'Solicitudes de clientes'}
        subtitulo={
          esCoordinador
            ? 'Supervisión técnica, verificación de viabilidad y generación de órdenes de producción.'
            : 'Recepción, especificaciones, archivos de referencia y seguimiento del estado de validación.'
        }
        icono="inbox"
        acciones={
          role === 'comercial' && (
            <button className="btn btn-primary" onClick={() => irA('nuevo')}>
              <Icon nombre="plus" tamano={16} /> Registrar solicitud
            </button>
          )
        }
      />

      {esCoordinador && porValidar > 0 && (
        <Alert tipo="aviso" titulo={`${porValidar} solicitud(es) esperan tu validación técnica`}>
          Revisa las especificaciones antes de decidir: puedes aprobar para generar la orden, devolver para corrección o rechazarla.
        </Alert>
      )}

      {role === 'comercial' && devueltas > 0 && (
        <Alert tipo="aviso" titulo={`${devueltas} solicitud(es) devuelta(s) para corrección`}>
          El coordinador solicitó ajustes técnicos en estas solicitudes. Revisa el motivo y reenvíalas a validación.
        </Alert>
      )}

      {role === 'comercial' && porEnviar > 0 && (
        <Alert tipo="aviso" titulo={`${porEnviar} solicitud(es) pendientes de envío a Coordinación`}>
          Estas solicitudes han sido registradas pero todavía no han sido enviadas. Coordinación no podrá revisarlas hasta que realices el envío.
        </Alert>
      )}

      <DataTable
        columnas={columnas}
        filas={data.requests}
        porPagina={8}
        filaClase={(s) => (role === 'comercial' && s.estado === 'Pendiente' ? 'fila-pendiente-envio' : '')}
        buscar={(s) => `${s.id} ${s.cliente} ${s.producto} ${s.material} ${s.dimensiones}`}
        placeholder="Buscar por solicitud, cliente, producto o material..."
        filtros={[
          { titulo: 'Estado', valor: (s) => s.estado, opciones: ESTADOS },
          { titulo: 'Cliente', valor: (s) => s.cliente, opciones: [...new Set(data.requests.map((s) => s.cliente))] },
        ]}
        vacioTitulo="No hay solicitudes con esos filtros"
      />

      {/* MODAL HU-04: Consulta detallada de la solicitud */}
      {detalle && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de solicitud ${detalle.id}`}>
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="inbox" tamano={20} /></span>
              <div>
                <h2>Solicitud {detalle.id}</h2>
                <p>{detalle.cliente} · Registrada el {detalle.fechaSolicitud}</p>
              </div>
              <button className="icon-btn" onClick={() => setDetalle(null)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span className="sm mut">Estado actual</span>
                <StatusBadge estado={detalle.estado} />
              </div>

              {/* Requisito 4: Indicación breve cuando la solicitud aún no ha sido enviada */}
              {role === 'comercial' && detalle.estado === 'Pendiente' && (
                <div
                  className="ban ban-am"
                  style={{
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Icon nombre="alert-triangle" tamano={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '13px', marginBottom: '3px', color: '#b45309' }}>
                      Pendiente de envío a Coordinación
                    </strong>
                    <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4, display: 'block' }}>
                      Esta solicitud todavía no ha sido enviada. Coordinación no podrá revisarla hasta que realices el envío.
                    </span>
                  </div>
                </div>
              )}

              {detalle.motivoRechazo && (
                <div className={`ban ${detalle.estado === 'Devuelta para corrección' ? 'am' : 're'}`} style={{ marginBottom: '16px' }}>
                  <Icon nombre="alert-triangle" tamano={16} />
                  <div>
                    <strong>{detalle.estado === 'Devuelta para corrección' ? 'Motivo de devolución' : 'Motivo de rechazo'}:</strong>
                    <div style={{ marginTop: '2px' }}>{detalle.motivoRechazo}</div>
                  </div>
                </div>
              )}

              <dl className="details details-1" style={{ margin: 0 }}>
                <div><dt>Cliente</dt><dd>{detalle.cliente}</dd></div>
                <div><dt>Producto</dt><dd>{detalle.producto}</dd></div>
                <div><dt>Cantidad</dt><dd>{detalle.cantidad} unidades</dd></div>
                <div><dt>Prioridad</dt><dd><StatusBadge estado={detalle.prioridad || 'Media'} texto={detalle.prioridad || 'Media'} /></dd></div>
                <div><dt>Dimensiones</dt><dd>{detalle.dimensiones}</dd></div>
                <div><dt>Material</dt><dd>{detalle.material}</dd></div>
                <div><dt>Acabados</dt><dd>{detalle.acabados || 'Corte y empaque estándar'}</dd></div>
                <div><dt>Método de entrega</dt><dd>{detalle.metodoEntrega || 'Domicilio'}</dd></div>
                <div><dt>Fecha de entrega pactada</dt><dd>{detalle.fechaEntrega}</dd></div>
                <div><dt>Presupuesto comercial</dt><dd>{formatoCOP(detalle.presupuesto)}</dd></div>
                <div><dt>Requerimientos técnicos</dt><dd>{detalle.requerimientos || 'Sin requerimientos especiales'}</dd></div>
                <div><dt>Observaciones</dt><dd>{detalle.observaciones || 'Sin observaciones registradas'}</dd></div>
                {detalle.ordenId && (
                  <div>
                    <dt>Orden de producción generada</dt>
                    <dd>
                      <button className="link-inline" onClick={() => { setDetalle(null); irA('detalle', detalle.ordenId) }}>
                        <strong>{detalle.ordenId}</strong> (Ver orden)
                      </button>
                    </dd>
                  </div>
                )}
              </dl>

              {/* Archivos de referencia adjuntos a la solicitud */}
              {detalle.archivosReferencia?.length > 0 && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                  <strong className="sm" style={{ display: 'block', marginBottom: '8px' }}>
                    Archivos de referencia adjuntos ({detalle.archivosReferencia.length}):
                  </strong>
                  <div className="stack" style={{ gap: '6px' }}>
                    {detalle.archivosReferencia.map((ref, idx) => (
                      <div
                        key={ref.id || idx}
                        className="row"
                        style={{
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <div className="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Icon nombre="paperclip" tamano={14} />
                          <strong>{ref.nombre}</strong>
                          {ref.tamano && <span className="mut">({ref.tamano})</span>}
                        </div>
                        <div className="row" style={{ gap: '4px' }}>
                          {ref.dataUrl && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArchivoPreview(ref)}>
                              <Icon nombre="eye" tamano={13} /> Ver
                            </button>
                          )}
                          <button type="button" className="btn btn-soft btn-sm" onClick={() => descargarAdjunto(ref)}>
                            <Icon nombre="download" tamano={13} /> Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setDetalle(null)}>Cerrar</button>

              {/* Requisitos 3 y 6: Botón Enviar a Coordinación fácil de identificar y encontrar; oculto en otros estados */}
              {role === 'comercial' && detalle.estado === 'Pendiente' && (
                <button
                  type="button"
                  className="btn btn-primary btn-enviar-destacado"
                  style={{
                    padding: '8px 20px',
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    const id = detalle.id
                    setDetalle(null)
                    actions.sendToValidation(id)
                  }}
                  title="Enviar solicitud a Coordinación para iniciar validación técnica"
                >
                  <Icon nombre="send" tamano={15} /> Enviar a Coordinación
                </button>
              )}

              {/* Si fue devuelta, Comercial puede corregirla o reenviarla */}
              {role === 'comercial' && detalle.estado === 'Devuelta para corrección' && (
                <>
                  <button
                    type="button"
                    className="btn btn-warning"
                    style={{
                      background: 'var(--state-amber-bg, #fef3c7)',
                      color: 'var(--state-amber-text, #b45309)',
                      borderColor: 'var(--state-amber-border, #fcd34d)',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      const sol = detalle
                      setDetalle(null)
                      setCorrigiendo(sol)
                    }}
                    title="Editar y corregir datos de la solicitud devuelta"
                  >
                    <Icon nombre="edit" tamano={14} /> Corregir solicitud
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const id = detalle.id
                      setDetalle(null)
                      actions.sendToValidation(id)
                    }}
                    title="Reenviar solicitud corregida a validación"
                  >
                    <Icon nombre="send" tamano={14} /> Reenviar a validación
                  </button>
                </>
              )}

              {esCoordinador && detalle.estado === 'En validación' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const sol = detalle
                    setDetalle(null)
                    setValidando(sol)
                  }}
                >
                  <Icon nombre="check" tamano={14} /> Proceder a validación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HU-05 y HU-06: Validación de datos antes de decidir y generación de orden */}
      {validando && (
        <div className="modal-backdrop" onClick={() => setValidando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Validación técnica de solicitud">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="check-circle" tamano={20} /></span>
              <div>
                <h2>Validar solicitud y generar orden</h2>
                <p>Solicitud: {validando.id} · {validando.cliente}</p>
              </div>
              <button className="icon-btn" onClick={() => setValidando(null)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              <p style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>
                Verifica los datos técnicos de la solicitud antes de confirmar la apertura de la orden de producción:
              </p>

              <div className="card p" style={{ background: 'var(--bg-subtle)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Producto:</span>
                  <strong>{validando.producto} ({validando.cantidad} uds)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Dimensiones y material:</span>
                  <span>{validando.dimensiones} · {validando.material}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Fecha de entrega:</span>
                  <strong>{validando.fechaEntrega}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Presupuesto cliente:</span>
                  <span>{formatoCOP(validando.presupuesto)}</span>
                </div>
                {validando.archivosReferencia?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="mut">Archivos de referencia adjuntos:</span>
                    <strong>{validando.archivosReferencia.length} archivo(s)</strong>
                  </div>
                )}
                {validando.requerimientos && (
                  <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
                    <span className="mut" style={{ display: 'block', fontSize: '0.8rem' }}>Requerimientos:</span>
                    <span>{validando.requerimientos}</span>
                  </div>
                )}
              </div>

              <p className="sm mut" style={{ margin: 0 }}>
                Al confirmar, se creará una nueva orden en etapa de <strong>Diseño</strong>, asignada a María López, transfiriendo los archivos de referencia y registrando el evento en la trazabilidad.
              </p>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setValidando(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  actions.validateRequest(validando.id)
                  setValidando(null)
                }}
              >
                <Icon nombre="check" tamano={15} /> Confirmar y generar orden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISTA PREVIA DE ARCHIVO DE REFERENCIA */}
      {archivoPreview && (
        <div className="modal-backdrop" onClick={() => setArchivoPreview(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="paperclip" tamano={20} /></span>
              <div>
                <h2>{archivoPreview.nombre}</h2>
                <p>Archivo de referencia del cliente</p>
              </div>
              <button className="icon-btn" onClick={() => setArchivoPreview(null)}><Icon nombre="x" /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {archivoPreview.dataUrl?.startsWith('data:image') ? (
                <img src={archivoPreview.dataUrl} alt={archivoPreview.nombre} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)' }} />
              ) : archivoPreview.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={archivoPreview.nombre} src={archivoPreview.dataUrl} style={{ width: '100%', height: '400px', border: '1px solid var(--border-light)' }} />
              ) : (
                <p className="sm mut">Archivo adjunto listo para descarga.</p>
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

      {/* MODAL HU-05: Devolver para corrección con motivo documentado */}
      {devolviendo && (
        <Modal
          titulo="Devolver solicitud para corrección"
          subtitulo={`Solicitud ${devolviendo}`}
          icono="alert-triangle"
          tipoBoton="primary"
          etiqueta="Indica qué datos deben ser corregidos o completados por el comercial"
          ayuda="El comercial verá esta observación para corregir y reenviar la solicitud."
          minimo={8}
          textoBoton="Devolver solicitud"
          onClose={() => setDevolviendo(null)}
          onConfirm={(motivo) => {
            if (actions.returnRequest) {
              actions.returnRequest(devolviendo, motivo)
            } else {
              actions.rejectRequest(devolviendo, `[Devuelta para corrección] ${motivo}`)
            }
            setDevolviendo(null)
          }}
        />
      )}

      {/* MODAL HU-05: Rechazo definitivo */}
      {rechazando && (
        <Modal
          titulo="Rechazar solicitud definitivamente"
          subtitulo={`Solicitud ${rechazando}`}
          icono="x-circle"
          tipoBoton="danger"
          etiqueta="Motivo formal del rechazo"
          ayuda="Quedará documentado en el historial de la solicitud."
          minimo={10}
          textoBoton="Rechazar solicitud"
          onClose={() => setRechazando(null)}
          onConfirm={(motivo) => {
            actions.rejectRequest(rechazando, motivo)
            setRechazando(null)
          }}
        />
      )}

      {/* MODAL: Corregir y reenviar solicitud devuelta (Comercial / Recepción) */}
      {corrigiendo && role === 'comercial' && (
        <ModalCorregirSolicitud
          solicitud={corrigiendo}
          onClose={() => setCorrigiendo(null)}
          onGuardar={async (datos) => {
            await actions.correctRequest(corrigiendo.id, datos)
            setCorrigiendo(null)
          }}
        />
      )}
    </div>
  )
}
