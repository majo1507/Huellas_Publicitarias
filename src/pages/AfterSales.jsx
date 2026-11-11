import { useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import Alert from '../components/Alert.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import AfterSalesDashboard from './AfterSalesDashboard.jsx'
import { CLIENTE_ACTUAL } from '../data/roles.js'
import {
  SECCIONES_POSTVENTA,
  TIPOS_PQRSF,
  MOTIVOS_PQRSF_POR_TIPO,
  MOTIVOS_GARANTIA,
  ASPECTOS_SATISFACCION,
} from '../data/catalogos.js'

function Estrellas({ valor = 0, onSelect = null }) {
  return (
    <span className="stars" title={valor ? `${valor} de 5` : 'Sin calificar'}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= valor ? 'star on' : 'star'}
          style={onSelect ? { cursor: 'pointer', fontSize: 18 } : undefined}
          onClick={onSelect ? () => onSelect(i) : undefined}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export default function AfterSales(props) {
  const { data, actions, role, irA } = props

  // Para los roles internos (Postventa, Coordinador, Gerencia, Comercial), mostrar el panel completo
  if (role !== 'cliente') {
    return <AfterSalesDashboard {...props} />
  }

  const { orders, cases } = data
  const misOrdenes = orders.filter((o) => o.clienteId === CLIENTE_ACTUAL.id)
  const entregadas = misOrdenes.filter(
    (o) => o.estado === 'Postventa' || o.estado === 'Entrega' || o.estado === 'Cerrada'
  )
  const ordenesDisponibles = entregadas.length ? entregadas : misOrdenes
  const idsMisOrdenes = new Set(misOrdenes.map((o) => o.id))
  const misCasos = cases.filter((c) => idsMisOrdenes.has(c.ordenId) || c.cliente === CLIENTE_ACTUAL.empresa)

  // Tres secciones separadas para el cliente
  const [seccionActiva, setSeccionActiva] = useState('Satisfacción')
  const [casoHistorial, setCasoHistorial] = useState(null)

  const misSatisfacciones = misCasos.filter(
    (c) => c.categoria === 'Satisfacción' || c.tipo === 'Satisfacción'
  )
  const misPqrsf = misCasos.filter(
    (c) => c.categoria === 'PQRSF' || (!c.categoria && c.tipo !== 'Garantía' && c.tipo !== 'Satisfacción')
  )
  const misGarantias = misCasos.filter(
    (c) => c.categoria === 'Garantía' || (!c.categoria && c.tipo === 'Garantía')
  )

  // Formulario de Satisfacción
  const [formSat, setFormSat] = useState({
    ordenId: ordenesDisponibles[0]?.id || '',
    calificacion: 5,
    aspectosEvaluados: [
      'Fidelidad de color y nitidez de impresión',
      'Cumplimiento de la fecha de entrega acordada',
    ],
    descripcion: '',
  })

  // Formulario de PQRSF
  const [formPqrsf, setFormPqrsf] = useState({
    ordenId: ordenesDisponibles[0]?.id || '',
    subtipo: 'Petición',
    motivo: MOTIVOS_PQRSF_POR_TIPO.Petición[0],
    descripcion: '',
    evidencias: [],
  })

  // Formulario de Garantía
  const [formGar, setFormGar] = useState({
    ordenId: ordenesDisponibles[0]?.id || '',
    motivo: MOTIVOS_GARANTIA[0],
    descripcion: '',
    evidencias: [],
  })

  function adjuntarEvidencias(e, setter) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const item = {
          id: `EV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nombre: file.name,
          tipo: file.type || 'application/octet-stream',
          tamano: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          fecha: new Date().toLocaleDateString('es-CO'),
          dataUrl: typeof reader.result === 'string' ? reader.result : null,
        }
        setter((prev) => ({ ...prev, evidencias: [...prev.evidencias, item] }))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function toggleAspecto(asp) {
    setFormSat((prev) => {
      const existe = prev.aspectosEvaluados.includes(asp)
      return {
        ...prev,
        aspectosEvaluados: existe
          ? prev.aspectosEvaluados.filter((a) => a !== asp)
          : [...prev.aspectosEvaluados, asp],
      }
    })
  }

  function enviarSatisfaccion(e) {
    e.preventDefault()
    if (!formSat.ordenId || !formSat.descripcion.trim()) return
    const ord = orders.find((o) => o.id === formSat.ordenId)
    actions.createCase({
      ordenId: formSat.ordenId,
      cliente: ord?.cliente || CLIENTE_ACTUAL.empresa,
      producto: ord?.producto || '',
      categoria: 'Satisfacción',
      subtipo: 'Satisfacción',
      tipo: 'Satisfacción',
      motivo: 'Evaluación de satisfacción post-entrega',
      calificacion: Number(formSat.calificacion),
      aspectosEvaluados: formSat.aspectosEvaluados,
      descripcion: formSat.descripcion.trim(),
    })
    setFormSat((prev) => ({ ...prev, descripcion: '' }))
  }

  function enviarPqrsf(e) {
    e.preventDefault()
    if (!formPqrsf.ordenId || !formPqrsf.descripcion.trim()) return
    const ord = orders.find((o) => o.id === formPqrsf.ordenId)
    actions.createCase({
      ordenId: formPqrsf.ordenId,
      cliente: ord?.cliente || CLIENTE_ACTUAL.empresa,
      producto: ord?.producto || '',
      categoria: 'PQRSF',
      subtipo: formPqrsf.subtipo,
      tipo: formPqrsf.subtipo,
      motivo: formPqrsf.motivo,
      prioridad: formPqrsf.subtipo === 'Reclamo' || formPqrsf.subtipo === 'Queja' ? 'Alta' : 'Media',
      descripcion: formPqrsf.descripcion.trim(),
      evidencias: formPqrsf.evidencias,
    })
    setFormPqrsf((prev) => ({ ...prev, descripcion: '', evidencias: [] }))
  }

  function enviarGarantia(e) {
    e.preventDefault()
    if (!formGar.ordenId || !formGar.descripcion.trim()) return
    const ord = orders.find((o) => o.id === formGar.ordenId)
    actions.createCase({
      ordenId: formGar.ordenId,
      cliente: ord?.cliente || CLIENTE_ACTUAL.empresa,
      producto: ord?.producto || '',
      categoria: 'Garantía',
      subtipo: 'Garantía',
      tipo: 'Garantía',
      motivo: formGar.motivo,
      prioridad: 'Alta',
      dictamenGarantia: 'Pendiente de evaluación',
      accionCorrectiva: 'En espera de dictamen técnico',
      descripcion: formGar.descripcion.trim(),
      evidencias: formGar.evidencias,
    })
    setFormGar((prev) => ({ ...prev, descripcion: '', evidencias: [] }))
  }

  return (
    <div>
      <PageHeader
        titulo="Atención postventa, PQRSF y garantías"
        subtitulo="Califica pedidos recibidos, radica PQRSF y gestiona garantías técnicas."
        icono="life-buoy"
      />

      {/* Selector de las 3 secciones independientes */}
      <div className="filter-bar" style={{ marginBottom: 18 }}>
        {SECCIONES_POSTVENTA.map((sec) => {
          const conteo =
            sec.id === 'Satisfacción'
              ? misSatisfacciones.length
              : sec.id === 'PQRSF'
              ? misPqrsf.length
              : misGarantias.length
          return (
            <button
              key={sec.id}
              type="button"
              className={`chip ${seccionActiva === sec.id ? 'active' : ''}`}
              onClick={() => setSeccionActiva(sec.id)}
            >
              {sec.titulo} ({conteo})
            </button>
          )
        })}
      </div>

      {/* SECCIÓN 1: CALIFICACIÓN DE SATISFACCIÓN */}
      {seccionActiva === 'Satisfacción' && (
        <div className="split">
          <form className="card form" onSubmit={enviarSatisfaccion}>
            <h2>1. Calificar satisfacción de entrega</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Evalúa la calidad de impresión, acabados y cumplimiento del pedido recibido.
            </p>
            <label>
              <span>Orden entregada *</span>
              <select
                value={formSat.ordenId}
                onChange={(e) => setFormSat({ ...formSat, ordenId: e.target.value })}
                required
              >
                {ordenesDisponibles.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.producto} ({o.estado})
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Nivel de satisfacción general *</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <Estrellas
                  valor={formSat.calificacion}
                  onSelect={(v) => setFormSat({ ...formSat, calificacion: v })}
                />
                <select
                  value={formSat.calificacion}
                  onChange={(e) => setFormSat({ ...formSat, calificacion: Number(e.target.value) })}
                >
                  <option value={5}>5 estrellas — Excelente</option>
                  <option value={4}>4 estrellas — Muy bueno</option>
                  <option value={3}>3 estrellas — Aceptable</option>
                  <option value={2}>2 estrellas — Regular</option>
                  <option value={1}>1 estrella — Insatisfecho</option>
                </select>
              </div>
            </label>

            <div>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Aspectos destacados en tu pedido
              </span>
              <div style={{ display: 'grid', gap: 6 }}>
                {ASPECTOS_SATISFACCION.map((asp) => (
                  <label
                    key={asp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      padding: '5px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formSat.aspectosEvaluados.includes(asp)}
                      onChange={() => toggleAspecto(asp)}
                    />
                    <span>{asp}</span>
                  </label>
                ))}
              </div>
            </div>

            <label>
              <span>Comentario sobre el producto y la entrega *</span>
              <textarea
                rows={3}
                value={formSat.descripcion}
                onChange={(e) => setFormSat({ ...formSat, descripcion: e.target.value })}
                placeholder="Cuéntanos tu experiencia con el producto entregado..."
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Enviar calificación
              </button>
            </div>
          </form>

          <div className="card">
            <div className="card-header">
              <h2>Mis calificaciones enviadas ({misSatisfacciones.length})</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Orden</th>
                    <th>Fecha</th>
                    <th>Calificación</th>
                    <th>Aspectos y Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {misSatisfacciones.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.id}</td>
                      <td>
                        <a className="link" onClick={() => irA('detalle', c.ordenId)}>
                          {c.ordenId}
                        </a>
                      </td>
                      <td className="muted">{c.fecha}</td>
                      <td>
                        <Estrellas valor={c.calificacion || 5} />
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{c.descripcion}</div>
                        {c.aspectosEvaluados?.length > 0 && (
                          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                            ✓ {c.aspectosEvaluados.join(' · ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {misSatisfacciones.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty">
                        Aún no has registrado calificaciones de satisfacción.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: GESTIÓN DE PQRSF */}
      {seccionActiva === 'PQRSF' && (
        <div className="split">
          <form className="card form" onSubmit={enviarPqrsf}>
            <h2>2. Radicar PQRSF</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              Peticiones, quejas, reclamos, sugerencias o felicitaciones sobre la atención o el servicio.
            </p>
            <label>
              <span>Orden relacionada *</span>
              <select
                value={formPqrsf.ordenId}
                onChange={(e) => setFormPqrsf({ ...formPqrsf, ordenId: e.target.value })}
                required
              >
                {ordenesDisponibles.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.producto}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tipo de PQRSF *</span>
              <select
                value={formPqrsf.subtipo}
                onChange={(e) => {
                  const sub = e.target.value
                  const lista = MOTIVOS_PQRSF_POR_TIPO[sub] || []
                  setFormPqrsf({ ...formPqrsf, subtipo: sub, motivo: lista[0] || sub })
                }}
              >
                {TIPOS_PQRSF.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Motivo *</span>
              <select
                value={formPqrsf.motivo}
                onChange={(e) => setFormPqrsf({ ...formPqrsf, motivo: e.target.value })}
              >
                {(MOTIVOS_PQRSF_POR_TIPO[formPqrsf.subtipo] || []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Descripción detallada *</span>
              <textarea
                rows={3}
                value={formPqrsf.descripcion}
                onChange={(e) => setFormPqrsf({ ...formPqrsf, descripcion: e.target.value })}
                placeholder="Describe tu petición, queja, reclamo, sugerencia o felicitación..."
                required
              />
            </label>

            <label>
              <span>Evidencias fotográficas o documentos adjuntos</span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => adjuntarEvidencias(e, setFormPqrsf)}
              />
              {formPqrsf.evidencias.length > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  📎 {formPqrsf.evidencias.map((ev) => ev.nombre).join(', ')}
                </div>
              )}
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Radicar {formPqrsf.subtipo}
              </button>
            </div>
          </form>

          <div className="card">
            <div className="card-header">
              <h2>Mis solicitudes PQRSF ({misPqrsf.length})</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '110px' }}>Caso</th>
                    <th style={{ width: '150px' }}>Tipo y Orden</th>
                    <th>Motivo y Descripción</th>
                    <th style={{ width: '130px' }}>Estado</th>
                    <th style={{ width: '200px' }}>Respuesta / Solución</th>
                    <th style={{ width: '100px' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {misPqrsf.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">
                        <button
                          className="link-inline"
                          onClick={() => setCasoHistorial(c)}
                          title="Ver detalle e historial del caso"
                          style={{ fontWeight: 700 }}
                        >
                          {c.id}
                        </button>
                      </td>
                      <td>
                        <StatusBadge estado={c.subtipo || c.tipo} />
                        <div style={{ marginTop: 2 }}>
                          <a className="link" onClick={() => irA('detalle', c.ordenId)}>
                            {c.ordenId}
                          </a>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{c.motivo}</div>
                        <div className="muted cell-truncate" style={{ fontSize: 12, maxWidth: 260 }} title={c.descripcion}>
                          {c.descripcion}
                        </div>
                      </td>
                      <td>
                        <StatusBadge estado={c.estado} />
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {c.respuestaCliente || c.solucion ? (
                          <div className="cell-truncate text-verde" style={{ maxWidth: 190, fontWeight: 500 }} title={c.respuestaCliente || c.solucion}>
                            {c.respuestaCliente || c.solucion}
                          </div>
                        ) : (
                          <span className="muted">En gestión por {c.responsable || 'Postventa'}</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => setCasoHistorial(c)} title="Ver detalle completo e historial">
                          Ver ({c.historial?.length || 1})
                        </button>
                      </td>
                    </tr>
                  ))}
                  {misPqrsf.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        No tienes solicitudes PQRSF registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: GESTIÓN DE GARANTÍAS */}
      {seccionActiva === 'Garantía' && (
        <div className="split">
          <form className="card form" onSubmit={enviarGarantia}>
            <h2>3. Solicitar revisión de garantía</h2>
            <Alert tipo="info" titulo="Evaluación técnica de garantía">
              Toda solicitud de garantía es evaluada por el equipo de calidad verificando las especificaciones acordadas y las evidencias adjuntas.
            </Alert>
            <label style={{ marginTop: 10 }}>
              <span>Orden entregada *</span>
              <select
                value={formGar.ordenId}
                onChange={(e) => setFormGar({ ...formGar, ordenId: e.target.value })}
                required
              >
                {ordenesDisponibles.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} — {o.producto}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Causal de garantía *</span>
              <select
                value={formGar.motivo}
                onChange={(e) => setFormGar({ ...formGar, motivo: e.target.value })}
              >
                {MOTIVOS_GARANTIA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Descripción del daño, defecto o incumplimiento *</span>
              <textarea
                rows={3}
                value={formGar.descripcion}
                onChange={(e) => setFormGar({ ...formGar, descripcion: e.target.value })}
                placeholder="Indica cantidad de unidades afectadas y detalle técnico del problema..."
                required
              />
            </label>

            <label>
              <span>Evidencias fotográficas y soporte documental *</span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => adjuntarEvidencias(e, setFormGar)}
              />
              {formGar.evidencias.length > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  📷 {formGar.evidencias.map((ev) => ev.nombre).join(', ')}
                </div>
              )}
            </label>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Radicar solicitud de garantía
              </button>
            </div>
          </form>

          <div className="card">
            <div className="card-header">
              <h2>Mis solicitudes de garantía ({misGarantias.length})</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '110px' }}>Código</th>
                    <th style={{ width: '120px' }}>Orden</th>
                    <th>Causal y Descripción</th>
                    <th style={{ width: '160px' }}>Dictamen Técnico</th>
                    <th style={{ width: '150px' }}>Estado / Decisión</th>
                    <th style={{ width: '100px' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {misGarantias.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">
                        <button
                          className="link-inline"
                          onClick={() => setCasoHistorial(c)}
                          title="Ver detalle completo de garantía"
                          style={{ fontWeight: 700 }}
                        >
                          {c.id}
                        </button>
                      </td>
                      <td>
                        <a className="link" onClick={() => irA('detalle', c.ordenId)}>
                          {c.ordenId}
                        </a>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{c.motivo}</div>
                        <div className="muted cell-truncate" style={{ fontSize: 11, maxWidth: 260 }} title={c.descripcion}>
                          {c.descripcion}
                        </div>
                      </td>
                      <td>
                        <StatusBadge estado={c.dictamenGarantia || 'Pendiente de evaluación'} />
                        {c.justificacionDictamen && (
                          <div className="muted cell-truncate" style={{ fontSize: 11, marginTop: 2, maxWidth: 155 }} title={c.justificacionDictamen}>
                            {c.justificacionDictamen}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusBadge estado={c.estado} />
                        {c.accionCorrectiva && (
                          <div className="cell-truncate text-verde" style={{ fontSize: 11, marginTop: 2, maxWidth: 145 }} title={c.accionCorrectiva}>
                            {c.accionCorrectiva}
                          </div>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-xs" onClick={() => setCasoHistorial(c)} title="Ver detalle e historial">
                          Ver ({c.historial?.length || 1})
                        </button>
                      </td>
                    </tr>
                  ))}
                  {misGarantias.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        No tienes reclamaciones de garantía registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de detalle e historial para el cliente */}
      {casoHistorial && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 13, 22, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <h2>Ficha del caso {casoHistorial.id}</h2>
                <span className="muted">
                  Orden {casoHistorial.ordenId} · Tipo: {casoHistorial.categoria || casoHistorial.subtipo || casoHistorial.tipo} · Estado: {casoHistorial.estado}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCasoHistorial(null)} aria-label="Cerrar">
                <Icon nombre="x" tamano={16} />
              </button>
            </div>

            <div style={{ padding: '16px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)', display: 'grid', gap: '8px', fontSize: '13px' }}>
              <div><strong>Motivo / Causal:</strong> {casoHistorial.motivo || 'No especificado'}</div>
              <div><strong>Descripción registrada:</strong> <span className="muted">{casoHistorial.descripcion}</span></div>
              {casoHistorial.dictamenGarantia && (
                <div>
                  <strong>Dictamen técnico:</strong> <StatusBadge estado={casoHistorial.dictamenGarantia} />
                  {casoHistorial.justificacionDictamen && <p style={{ marginTop: '4px', fontSize: '12px' }}>{casoHistorial.justificacionDictamen}</p>}
                </div>
              )}
              {(casoHistorial.solucion || casoHistorial.respuestaCliente || casoHistorial.accionCorrectiva) && (
                <div style={{ background: 'var(--state-green-bg, #f0fdf4)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--state-green-border, #bbf7d0)' }}>
                  <strong style={{ color: 'var(--state-green-text, #166534)' }}>Respuesta / Solución emitida:</strong>
                  <div style={{ marginTop: '3px' }}>{casoHistorial.solucion || casoHistorial.respuestaCliente || casoHistorial.accionCorrectiva}</div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Historial y trazabilidad</h3>
              <ul className="timeline">
                {(casoHistorial.historial || []).map((h, i) => (
                  <li key={i} className="tl-done">
                    <div className="tl-dot" />
                    <div className="tl-body">
                      <div className="tl-title">
                        {h.accion} <StatusBadge estado={h.estado || casoHistorial.estado} />
                      </div>
                      {h.detalle && <div style={{ fontSize: 12 }}>{h.detalle}</div>}
                      <div className="tl-meta">
                        {h.fecha} · {h.hora || '09:00'} — {h.autor}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
