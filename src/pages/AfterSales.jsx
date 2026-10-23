import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'
import { estrellas } from '../utils/format.js'

// Postventa vista por el CLIENTE (HU-18): reporte de novedades y seguimiento de reclamos/garantías
export default function AfterSales({ data, actions, irA }) {
  const [modalNuevo, setModalNuevo] = useState(false)
  const [ordenId, setOrdenId] = useState('')
  const [tipo, setTipo] = useState('Reclamo')
  const [descripcion, setDescripcion] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [modalCalificar, setModalCalificar] = useState(null)
  const [calificacion, setCalificacion] = useState(5)

  const misPedidos = data.orders.filter((o) => o.clienteId === ROLES.cliente.clienteId)
  const misPedidosIds = misPedidos.map((o) => o.id)
  const misCasos = data.cases.filter((c) => misPedidosIds.includes(c.ordenId))

  function abrirModalNuevo() {
    setOrdenId(misPedidosIds[0] || '')
    setTipo('Reclamo')
    setDescripcion('')
    setErrorMsg('')
    setModalNuevo(true)
  }

  function handleCrearReporte(e) {
    e.preventDefault()
    if (!ordenId) {
      setErrorMsg('Debes seleccionar el pedido sobre el cual realizas el reporte.')
      return
    }
    if (!descripcion.trim() || descripcion.trim().length < 10) {
      setErrorMsg('Por favor describe el motivo o inconveniente con al menos 10 caracteres.')
      return
    }

    if (actions.createCase) {
      actions.createCase({
        ordenId,
        cliente: ROLES.cliente.nombre,
        tipo,
        prioridad: 'Media',
        responsable: 'Sofía Herrera',
        descripcion: descripcion.trim(),
      })
    }
    setModalNuevo(false)
  }

  function handleGuardarCalificacion(e) {
    e.preventDefault()
    if (!modalCalificar) return
    if (actions.updateCase) {
      actions.updateCase(modalCalificar.id, { calificacion }, `Gracias por calificar la atención del caso ${modalCalificar.id}.`)
    }
    setModalCalificar(null)
  }

  const columnas = [
    {
      clave: 'ordenId',
      titulo: 'Orden',
      render: (c) => (
        <button className="link-inline" onClick={() => irA('detalle', c.ordenId)}>
          {c.ordenId}
        </button>
      ),
    },
    { clave: 'tipo', titulo: 'Tipo', ordenar: true },
    { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'descripcion', titulo: 'Descripción del inconveniente', render: (c) => <span className="cell-wrap">{c.descripcion}</span> },
    { clave: 'estado', titulo: 'Estado', render: (c) => <StatusBadge estado={c.estado} /> },
    { clave: 'solucion', titulo: 'Respuesta / Solución', render: (c) => <span className="cell-wrap">{c.solucion || 'En seguimiento por servicio al cliente'}</span> },
    {
      clave: 'calificacion',
      titulo: 'Tu calificación',
      render: (c) => (
        <div>
          {c.calificacion ? (
            <span className="stars">{estrellas(c.calificacion)}</span>
          ) : c.estado === 'Resuelto' ? (
            <button className="btn btn-sm btn-soft" onClick={() => { setModalCalificar(c); setCalificacion(5) }}>
              <Icon nombre="star" tamano={12} /> Calificar
            </button>
          ) : (
            <span className="sm mut">—</span>
          )}
        </div>
      ),
    },
  ]

  const accionesCabecera = misPedidosIds.length > 0 && (
    <button className="btn btn-primary" onClick={abrirModalNuevo}>
      <Icon nombre="plus" tamano={15} /> Reportar novedad o reclamo
    </button>
  )

  return (
    <div>
      <PageHeader
        titulo="Postventa y soporte"
        subtitulo="Reclamos, ajustes, garantías y comentarios de tus pedidos entregados."
        icono="life-buoy"
        acciones={accionesCabecera}
      />

      <DataTable
        columnas={columnas}
        filas={misCasos}
        buscar={(c) => `${c.ordenId} ${c.tipo} ${c.descripcion}`}
        placeholder="Buscar en mis casos..."
        filtros={[{ titulo: 'Estado', valor: (c) => c.estado, opciones: ['Abierto', 'En trámite', 'Resuelto'] }]}
        vacioTitulo="No tienes casos de postventa"
        vacioTexto="Cuando registres un reclamo, ajuste o garantía aparecerá aquí."
      />

      {/* Modal Registrar Novedad */}
      {modalNuevo && (
        <div className="modal-backdrop" onClick={() => setModalNuevo(false)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reportar novedad">
            <div className="modal-head">
              <span className="modal-icon modal-icon-info"><Icon nombre="life-buoy" tamano={20} /></span>
              <div>
                <h2>Reportar novedad o solicitud postventa</h2>
                <p>Nuestro equipo de soporte revisará tu solicitud de inmediato</p>
              </div>
              <button className="icon-btn" onClick={() => setModalNuevo(false)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleCrearReporte} className="modal-body">
              {errorMsg && (
                <div className="ban ban-rojo" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-circle" tamano={15} /> {errorMsg}
                </div>
              )}

              <div className="field full">
                <label className="field-label" htmlFor="pedidoSelect">Selecciona tu pedido *</label>
                <select
                  id="pedidoSelect"
                  value={ordenId}
                  onChange={(e) => setOrdenId(e.target.value)}
                  required
                >
                  {misPedidos.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.id} — {o.producto} (Entregado el {o.fechaEntrega})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field full">
                <label className="field-label" htmlFor="tipoSelect">Tipo de novedad *</label>
                <select
                  id="tipoSelect"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="Reclamo">Reclamo (no conformidad con lo solicitado)</option>
                  <option value="Garantía">Garantía (desperfecto o fallo del material)</option>
                  <option value="Ajuste">Ajuste técnico adicional</option>
                  <option value="Reimpresión">Solicitud de reimpresión</option>
                  <option value="Comentario">Comentario o sugerencia</option>
                </select>
              </div>

              <div className="field full">
                <label className="field-label" htmlFor="descText">Describe el inconveniente o tu solicitud *</label>
                <textarea
                  id="descText"
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalla qué sucedió con tu pedido..."
                  required
                />
                <small className="sm mut">Mínimo 10 caracteres obligatorios.</small>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Enviar reporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Calificar Atención */}
      {modalCalificar && (
        <div className="modal-backdrop" onClick={() => setModalCalificar(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Calificar atención">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="star" tamano={20} /></span>
              <div>
                <h2>Califica la solución del caso {modalCalificar.id}</h2>
                <p>Orden {modalCalificar.ordenId}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalCalificar(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarCalificacion} className="modal-body">
              <div style={{ marginBottom: '14px', fontSize: '13px' }}>
                <strong>Solución recibida:</strong>
                <p style={{ margin: '4px 0 0' }}>{modalCalificar.solucion}</p>
              </div>

              <div className="field full">
                <label className="field-label" htmlFor="selectEstrellas">Nivel de satisfacción</label>
                <select
                  id="selectEstrellas"
                  value={calificacion}
                  onChange={(e) => setCalificacion(Number(e.target.value))}
                >
                  <option value={5}>★★★★★ Excelente servicio (5 estrellas)</option>
                  <option value={4}>★★★★☆ Bueno / Conforme (4 estrellas)</option>
                  <option value={3}>★★★☆☆ Aceptable (3 estrellas)</option>
                  <option value={2}>★★☆☆☆ Regular (2 estrellas)</option>
                  <option value={1}>★☆☆☆☆ Insatisfecho (1 estrella)</option>
                </select>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalCalificar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success">Guardar calificación</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
