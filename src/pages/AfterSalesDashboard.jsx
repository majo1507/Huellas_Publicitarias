import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DataTable from '../components/DataTable.jsx'
import DonutChart from '../components/DonutChart.jsx'
import BarChart from '../components/BarChart.jsx'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import { estrellas, formatearFecha } from '../utils/format.js'

// ATENCIÓN Y GESTIÓN DE POSTVENTA (HU-18)
export default function AfterSalesDashboard({ data, actions, irA, usuarioActual }) {
  const [modalNuevoCaso, setModalNuevoCaso] = useState(false)
  const [casoDetalle, setCasoDetalle] = useState(null)
  const [casoReasignar, setCasoReasignar] = useState(null)
  const [resolviendoCaso, setResolviendoCaso] = useState(null)

  // Formulario nuevo caso
  const [ordenSeleccionada, setOrdenSeleccionada] = useState('')
  const [tipoCaso, setTipoCaso] = useState('Reclamo')
  const [prioridadCaso, setPrioridadCaso] = useState('Media')
  const [responsableCaso, setResponsableCaso] = useState('Sofía Herrera')
  const [descripcionCaso, setDescripcionCaso] = useState('')
  const [errorForm, setErrorForm] = useState('')

  // Formulario resolver
  const [solucionTexto, setSolucionTexto] = useState('')
  const [errorResolver, setErrorResolver] = useState('')

  // Formulario reasignar
  const [nuevoResponsable, setNuevoResponsable] = useState('Sofía Herrera')

  const usuario = usuarioActual?.nombre || 'Sofía Herrera'

  const contar = (estado) => data.cases.filter((c) => c.estado === estado).length
  const tipo = (...tipos) => data.cases.filter((c) => tipos.includes(c.tipo)).length
  const conNota = data.cases.filter((c) => c.calificacion)
  const promedio = conNota.length ? (conNota.reduce((s, c) => s + c.calificacion, 0) / conNota.length).toFixed(1) : '—'
  const orden = (id) => data.orders.find((o) => o.id === id)

  // Órdenes disponibles para abrir casos de postventa (entregadas o en curso)
  const ordenesDisponibles = data.orders.filter((o) => ['Entrega', 'Postventa', 'Cerrada', 'Despacho'].includes(o.estado))

  const filas = data.cases.map((c) => ({
    ...c,
    cliente: orden(c.ordenId)?.cliente || c.cliente || 'Cliente registrado',
  }))

  function abrirModalNuevo() {
    setOrdenSeleccionada(ordenesDisponibles[0]?.id || '')
    setTipoCaso('Reclamo')
    setPrioridadCaso('Media')
    setResponsableCaso(usuario)
    setDescripcionCaso('')
    setErrorForm('')
    setModalNuevoCaso(true)
  }

  function handleCrearCaso(e) {
    e.preventDefault()
    if (!ordenSeleccionada) {
      setErrorForm('Debes seleccionar la orden asociada al caso.')
      return
    }
    if (!descripcionCaso.trim() || descripcionCaso.trim().length < 10) {
      setErrorForm('La descripción del problema debe contener al menos 10 caracteres.')
      return
    }

    const ord = orden(ordenSeleccionada)
    actions.createCase({
      ordenId: ordenSeleccionada,
      cliente: ord?.cliente || '',
      tipo: tipoCaso,
      prioridad: prioridadCaso,
      responsable: responsableCaso || null,
      descripcion: descripcionCaso.trim(),
    })

    setModalNuevoCaso(false)
  }

  function handleGuardarResolucion(e) {
    e.preventDefault()
    if (!resolviendoCaso) return
    if (!solucionTexto.trim() || solucionTexto.trim().length < 15) {
      setErrorResolver('La solución registrada debe ser detallada (mínimo 15 caracteres explicativos).')
      return
    }

    actions.updateCase(
      resolviendoCaso.id,
      {
        estado: 'Resuelto',
        solucion: solucionTexto.trim(),
        fechaSolucion: formatearFecha(),
        resueltoPor: usuario,
      },
      `Caso ${resolviendoCaso.id} resuelto formalmente.`
    )
    setResolviendoCaso(null)
    setSolucionTexto('')
    setErrorResolver('')
  }

  function handleGuardarReasignacion(e) {
    e.preventDefault()
    if (!casoReasignar) return
    actions.updateCase(
      casoReasignar.id,
      {
        responsable: nuevoResponsable,
        estado: casoReasignar.estado === 'Abierto' ? 'En trámite' : casoReasignar.estado,
      },
      `Caso ${casoReasignar.id} asignado a ${nuevoResponsable}.`
    )
    setCasoReasignar(null)
  }

  const columnas = [
    {
      clave: 'id',
      titulo: 'Caso',
      ordenar: true,
      render: (c) => (
        <button className="link-inline" onClick={() => setCasoDetalle(c)} title="Ver expediente del caso">
          <strong>{c.id}</strong>
        </button>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    {
      clave: 'ordenId',
      titulo: 'Orden',
      render: (c) => (
        <button className="link-inline" onClick={() => irA('detalle', c.ordenId)}>
          {c.ordenId}
        </button>
      ),
    },
    {
      clave: 'tipo',
      titulo: 'Clasificación',
      ordenar: true,
      render: (c) => (
        <div>
          <span>{c.tipo}</span>
          {c.prioridad && (
            <small className="cell-sub" style={{ display: 'block' }}>
              Prioridad {c.prioridad}
            </small>
          )}
        </div>
      ),
    },
    { clave: 'fecha', titulo: 'Apertura' },
    {
      clave: 'descripcion',
      titulo: 'Descripción del problema',
      render: (c) => <span className="cell-wrap">{c.descripcion}</span>,
    },
    {
      clave: 'responsable',
      titulo: 'Responsable',
      render: (c) =>
        c.responsable ? (
          <span className="person">
            <Avatar nombre={c.responsable} tamano="xs" />
            {c.responsable}
          </span>
        ) : (
          <span className="sm mut">Sin asignar</span>
        ),
    },
    { clave: 'estado', titulo: 'Estado', render: (c) => <StatusBadge estado={c.estado} /> },
    {
      clave: 'solucion',
      titulo: 'Solución registrada',
      render: (c) => <span className="cell-wrap">{c.solucion || '—'}</span>,
    },
    {
      clave: 'calificacion',
      titulo: 'Satisfacción',
      render: (c) => <span className="stars">{estrellas(c.calificacion)}</span>,
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (c) => (
        <div className="row" style={{ gap: '6px' }}>
          <button className="btn btn-sm" onClick={() => setCasoDetalle(c)} title="Consultar expediente completo">
            <Icon nombre="eye" tamano={13} />
          </button>
          {c.estado === 'Abierto' && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => actions.updateCase(c.id, { estado: 'En trámite', responsable: usuario }, `Caso ${c.id} tomado en trámite.`)}
            >
              Tomar
            </button>
          )}
          {c.estado !== 'Resuelto' && (
            <button
              className="btn btn-sm btn-soft"
              onClick={() => {
                setCasoReasignar(c)
                setNuevoResponsable(c.responsable || usuario)
              }}
              title="Asignar o reasignar responsable"
            >
              <Icon nombre="user" tamano={12} />
            </button>
          )}
          {c.estado === 'En trámite' && (
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                setResolviendoCaso(c)
                setSolucionTexto('')
                setErrorResolver('')
              }}
            >
              Resolver
            </button>
          )}
        </div>
      ),
    },
  ]

  const accionesCabecera = (
    <button className="btn btn-primary" onClick={abrirModalNuevo}>
      <Icon nombre="plus" tamano={15} /> Registrar caso de postventa
    </button>
  )

  return (
    <div>
      <PageHeader
        titulo="Casos de postventa y calidad"
        subtitulo="Gestión, clasificación, trazabilidad y resolución de garantías y reclamos de clientes (HU-18)."
        icono="life-buoy"
        acciones={accionesCabecera}
      />

      <div className="kpis">
        <StatCard titulo="Casos abiertos" valor={contar('Abierto')} icono="alert-circle" color={contar('Abierto') ? 'rojo' : 'azul'} />
        <StatCard titulo="En trámite" valor={contar('En trámite')} icono="clock" color="amarillo" />
        <StatCard titulo="Resueltos" valor={contar('Resuelto')} icono="check-circle" color="verde" />
        <StatCard titulo="Calificación promedio" valor={`${promedio} ★`} icono="star" detalle={`${conNota.length} calificaciones`} />
      </div>

      <div className="grid-2">
        <Panel titulo="Casos por estado" icono="bar-chart">
          <DonutChart
            subtitulo="casos"
            items={[
              { label: 'Abiertos', value: contar('Abierto'), color: 'rojo' },
              { label: 'En trámite', value: contar('En trámite'), color: 'amarillo' },
              { label: 'Resueltos', value: contar('Resuelto'), color: 'verde' },
            ]}
          />
        </Panel>
        <Panel titulo="Casos por clasificación (HU-18)" icono="layers">
          <BarChart
            items={[
              { label: 'Reclamos', value: tipo('Reclamo') },
              { label: 'Ajustes / reimpresiones', value: tipo('Ajuste', 'Reimpresión') },
              { label: 'Garantías', value: tipo('Garantía') },
              { label: 'Comentarios', value: tipo('Comentario') },
            ]}
          />
        </Panel>
      </div>

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={6}
        buscar={(c) => `${c.id} ${c.cliente} ${c.ordenId} ${c.tipo} ${c.descripcion}`}
        placeholder="Buscar caso, cliente, orden o descripción..."
        filtros={[
          { titulo: 'Estado', valor: (c) => c.estado, opciones: ['Abierto', 'En trámite', 'Resuelto'] },
          { titulo: 'Tipo', valor: (c) => c.tipo, opciones: ['Reclamo', 'Ajuste', 'Reimpresión', 'Garantía', 'Comentario'] },
        ]}
        vacioTitulo="No hay casos de postventa"
      />

      {/* Modal Registrar Nuevo Caso (HU-18) */}
      {modalNuevoCaso && (
        <div className="modal-backdrop" onClick={() => setModalNuevoCaso(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Registrar caso de postventa">
            <div className="modal-head">
              <span className="modal-icon modal-icon-warning"><Icon nombre="life-buoy" tamano={20} /></span>
              <div>
                <h2>Registrar nuevo caso de postventa</h2>
                <p>Apertura formal de reclamo, ajuste o garantía sobre una orden</p>
              </div>
              <button className="icon-btn" onClick={() => setModalNuevoCaso(false)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleCrearCaso} className="modal-body">
              {errorForm && (
                <div className="ban ban-rojo" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-circle" tamano={15} /> {errorForm}
                </div>
              )}

              <div className="form-grid">
                <div className="field full">
                  <label className="field-label" htmlFor="ordenPostventa">Orden entregada o despachada asociada *</label>
                  <select
                    id="ordenPostventa"
                    value={ordenSeleccionada}
                    onChange={(e) => setOrdenSeleccionada(e.target.value)}
                    required
                  >
                    <option value="">-- Selecciona una orden --</option>
                    {ordenesDisponibles.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {o.cliente} ({o.producto}) [{o.estado}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="tipoPostventa">Clasificación del caso *</label>
                  <select
                    id="tipoPostventa"
                    value={tipoCaso}
                    onChange={(e) => setTipoCaso(e.target.value)}
                  >
                    <option value="Reclamo">Reclamo por no conformidad</option>
                    <option value="Garantía">Aplicación de garantía</option>
                    <option value="Ajuste">Ajuste técnico de producto</option>
                    <option value="Reimpresión">Reimpresión o corrección</option>
                    <option value="Comentario">Comentario / Observación</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="prioridadPostventa">Nivel de prioridad *</label>
                  <select
                    id="prioridadPostventa"
                    value={prioridadCaso}
                    onChange={(e) => setPrioridadCaso(e.target.value)}
                  >
                    <option value="Alta">Alta (afecta entrega o uso comercial)</option>
                    <option value="Media">Media (observación técnica regular)</option>
                    <option value="Baja">Baja (ajuste menor o comentario)</option>
                  </select>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="respPostventa">Responsable inicial de atención</label>
                  <select
                    id="respPostventa"
                    value={responsableCaso}
                    onChange={(e) => setResponsableCaso(e.target.value)}
                  >
                    <option value="Sofía Herrera">Sofía Herrera (Atención y Calidad)</option>
                    <option value="Carlos Ruiz">Carlos Ruiz (Coordinador de Taller)</option>
                    <option value="María López">María López (Diseño)</option>
                    <option value="Pedro Morales">Pedro Morales (Impresión)</option>
                  </select>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="descPostventa">Descripción detallada del problema reportado *</label>
                  <textarea
                    id="descPostventa"
                    rows={3}
                    value={descripcionCaso}
                    onChange={(e) => setDescripcionCaso(e.target.value)}
                    placeholder="Describe con precisión qué ocurrió, las diferencias observadas y la solicitud del cliente..."
                    required
                  />
                  <small className="sm mut">Mínimo 10 caracteres obligatorios.</small>
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalNuevoCaso(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Crear caso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resolver Caso con Validación Estricta (HU-18) */}
      {resolviendoCaso && (
        <div className="modal-backdrop" onClick={() => setResolviendoCaso(null)}>
          <div className="modal" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Resolver caso">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="check-circle" tamano={20} /></span>
              <div>
                <h2>Resolver caso: {resolviendoCaso.id}</h2>
                <p>{resolviendoCaso.tipo} · Orden {resolviendoCaso.ordenId}</p>
              </div>
              <button className="icon-btn" onClick={() => setResolviendoCaso(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarResolucion} className="modal-body">
              {errorResolver && (
                <div className="ban ban-rojo" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-circle" tamano={15} /> {errorResolver}
                </div>
              )}

              <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px' }}>Problema reportado:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{resolviendoCaso.descripcion}</p>
              </div>

              <div className="field full">
                <label className="field-label" htmlFor="solucionInput">
                  Solución correctiva aplicada y acordada con el cliente *
                </label>
                <textarea
                  id="solucionInput"
                  rows={3}
                  value={solucionTexto}
                  onChange={(e) => setSolucionTexto(e.target.value)}
                  placeholder="Explica qué acción se ejecutó (reimpresión parcial, nota de crédito, ajuste de acabado, entrega complementaria)..."
                  required
                />
                <small className="sm mut">Mínimo 15 caracteres obligatorios para autorizar el cierre del caso.</small>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setResolviendoCaso(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success">
                  <Icon nombre="check" tamano={15} /> Confirmar solución y resolver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reasignar Responsable */}
      {casoReasignar && (
        <div className="modal-backdrop" onClick={() => setCasoReasignar(null)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Asignar responsable">
            <div className="modal-head">
              <span className="modal-icon modal-icon-info"><Icon nombre="user" tamano={20} /></span>
              <div>
                <h2>Asignar caso {casoReasignar.id}</h2>
                <p>Responsable actual: {casoReasignar.responsable || 'Sin asignar'}</p>
              </div>
              <button className="icon-btn" onClick={() => setCasoReasignar(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarReasignacion} className="modal-body">
              <div className="field full">
                <label className="field-label" htmlFor="selectResp">Nuevo responsable</label>
                <select
                  id="selectResp"
                  value={nuevoResponsable}
                  onChange={(e) => setNuevoResponsable(e.target.value)}
                >
                  <option value="Sofía Herrera">Sofía Herrera (Atención y Calidad)</option>
                  <option value="Carlos Ruiz">Carlos Ruiz (Coordinador)</option>
                  <option value="María López">María López (Diseño)</option>
                  <option value="Pedro Morales">Pedro Morales (Impresión)</option>
                </select>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setCasoReasignar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Asignar responsable</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Consulta de Expediente Completo de Caso (HU-18) */}
      {casoDetalle && (
        <div className="modal-backdrop" onClick={() => setCasoDetalle(null)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Expediente de caso">
            <div className="modal-head">
              <span className="modal-icon modal-icon-info"><Icon nombre="life-buoy" tamano={20} /></span>
              <div>
                <h2>Expediente del caso {casoDetalle.id}</h2>
                <p>{casoDetalle.cliente} · Orden {casoDetalle.ordenId}</p>
              </div>
              <button className="icon-btn" onClick={() => setCasoDetalle(null)}><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              <dl className="spec" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div><dt>Estado actual</dt><dd><StatusBadge estado={casoDetalle.estado} /></dd></div>
                <div><dt>Clasificación</dt><dd><strong>{casoDetalle.tipo}</strong> ({casoDetalle.prioridad || 'Media'})</dd></div>
                <div><dt>Fecha de apertura</dt><dd>{casoDetalle.fecha}</dd></div>
                <div><dt>Responsable</dt><dd>{casoDetalle.responsable || 'Sin asignar'}</dd></div>
                <div><dt>Orden vinculada</dt><dd><button className="link-inline" onClick={() => irA('detalle', casoDetalle.ordenId)}>{casoDetalle.ordenId}</button></dd></div>
                <div><dt>Calificación del cliente</dt><dd><span className="stars">{estrellas(casoDetalle.calificacion)}</span></dd></div>
              </dl>

              <div style={{ marginBottom: '14px' }}>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Descripción del problema:</strong>
                <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.03)', borderRadius: '6px', fontSize: '13px' }}>
                  {casoDetalle.descripcion}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '13px', display: 'block', marginBottom: '4px' }}>Solución registrada:</strong>
                <div style={{ padding: '10px 14px', background: casoDetalle.solucion ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0,0,0,0.03)', borderRadius: '6px', fontSize: '13px' }}>
                  {casoDetalle.solucion || <span className="mut">Caso aún en seguimiento, no cuenta con solución definitiva registrada.</span>}
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn" onClick={() => setCasoDetalle(null)}>Cerrar expediente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
