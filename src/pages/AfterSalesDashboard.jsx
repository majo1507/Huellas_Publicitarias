import { useState } from 'react'
import StatusBadge from '../components/StatusBadge.jsx'
import StatCard from '../components/StatCard.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { validarCierreOrden } from '../utils/format.js'
import {
  SECCIONES_POSTVENTA,
  TIPOS_PQRSF,
  MOTIVOS_PQRSF_POR_TIPO,
  MOTIVOS_GARANTIA,
  DICTAMENES_GARANTIA,
  ACCIONES_GARANTIA,
  ESTADOS_CASO_POSTVENTA,
  ASPECTOS_SATISFACCION,
  PRIORIDADES,
  RESPONSABLES_POSTVENTA,
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

function colorDictamen(dictamen = '') {
  if (dictamen.startsWith('Procedente (')) return 'Completado'
  if (dictamen.startsWith('Procedente parcial')) return 'En proceso'
  if (dictamen.startsWith('No procedente')) return 'Rechazado'
  return 'Pendiente'
}

export default function AfterSalesDashboard({ data, actions, irA, role }) {
  const { orders, cases, tasks = [], users = [] } = data
  const puedeGestionarPostventa = ['postventa', 'coordinador', 'comercial'].includes(role)

  // Pestaña principal: 'Satisfacción' | 'PQRSF' | 'Garantía' | 'Cierre'
  const [seccionActiva, setSeccionActiva] = useState('PQRSF')

  // Filtros de búsqueda y estado
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroSubtipoPqrsf, setFiltroSubtipoPqrsf] = useState('Todos')
  const [filtroDictamen, setFiltroDictamen] = useState('Todos')

  // Paginación por sección para aligerar la interfaz
  const [paginaSat, setPaginaSat] = useState(1)
  const [paginaPqrsf, setPaginaPqrsf] = useState(1)
  const [paginaGar, setPaginaGar] = useState(1)
  const [paginaCierre, setPaginaCierre] = useState(1)
  const [filtroSoloPendientesCierre, setFiltroSoloPendientesCierre] = useState(true)
  const POR_PAGINA_POSTVENTA = 6

  // Modales de registro y gestión detallada
  const [modalRegistro, setModalRegistro] = useState(null) // 'Satisfacción' | 'PQRSF' | 'Garantía' | null
  const [casoDetalleId, setCasoDetalleId] = useState(null)

  const ordenesEntregadas = orders.filter(
    (o) => o.estado === 'Postventa' || o.estado === 'Entrega' || o.estado === 'Cerrada'
  )
  const listaOrdenesSelect = ordenesEntregadas.length > 0 ? ordenesEntregadas : orders

  // Clasificación estricta en las 3 secciones independientes
  const calificacionesSatisfaccion = cases.filter(
    (c) => c.categoria === 'Satisfacción' || c.tipo === 'Satisfacción'
  )
  const casosPqrsf = cases.filter(
    (c) =>
      c.categoria === 'PQRSF' ||
      (!c.categoria && c.tipo !== 'Garantía' && c.tipo !== 'Satisfacción')
  )
  const casosGarantia = cases.filter(
    (c) => c.categoria === 'Garantía' || (!c.categoria && c.tipo === 'Garantía')
  )

  // Indicadores globales
  const pqrsfPendientes = casosPqrsf.filter((c) => c.estado !== 'Resuelto' && c.estado !== 'Cerrado')
  const garantiasEnEvaluacion = casosGarantia.filter(
    (c) => c.estado !== 'Resuelto' && c.estado !== 'Cerrado'
  )
  const garantiasProcedentes = casosGarantia.filter((c) =>
    String(c.dictamenGarantia || '').startsWith('Procedente')
  )
  const garantiasNoProcedentes = casosGarantia.filter((c) =>
    String(c.dictamenGarantia || '').startsWith('No procedente')
  )

  const conCalificacion = calificacionesSatisfaccion.filter((c) => typeof c.calificacion === 'number')
  const promedioSatisfaccion = conCalificacion.length
    ? (conCalificacion.reduce((s, c) => s + c.calificacion, 0) / conCalificacion.length).toFixed(1)
    : '—'

  // Responsables disponibles combinando catálogo y usuarios activos
  const responsablesDisponibles = Array.from(
    new Set([
      ...RESPONSABLES_POSTVENTA,
      ...users.filter((u) => u.estado !== 'Inactivo').map((u) => `${u.nombre} (${u.rol})`),
    ])
  )

  // Estado del formulario de nuevo registro (adaptado según sección)
  const [formNuevo, setFormNuevo] = useState({
    ordenId: listaOrdenesSelect[0]?.id || '',
    subtipo: 'Reclamo',
    motivo: MOTIVOS_PQRSF_POR_TIPO.Reclamo[0],
    motivoGarantia: MOTIVOS_GARANTIA[0],
    prioridad: 'Media',
    responsable: RESPONSABLES_POSTVENTA[0],
    descripcion: '',
    calificacion: 5,
    aspectosEvaluados: [
      'Fidelidad de color y nitidez de impresión',
      'Cumplimiento de la fecha de entrega acordada',
    ],
    dictamenGarantia: 'Pendiente de evaluación',
    justificacionDictamen: '',
    accionCorrectiva: 'En espera de dictamen técnico',
    evidencias: [],
  })

  // Estado del modal de gestión/evaluación/seguimiento
  const casoSeleccionado = cases.find((c) => c.id === casoDetalleId) || null
  const [formGestion, setFormGestion] = useState({
    estado: 'En revisión',
    prioridad: 'Media',
    responsable: '',
    dictamenGarantia: 'Pendiente de evaluación',
    justificacionDictamen: '',
    accionCorrectiva: '',
    seguimiento: '',
    respuestaCliente: '',
    solucion: '',
    notaHistorial: '',
    evidencias: [],
  })

  function abrirModalNuevo(categoria) {
    const ordDefault = listaOrdenesSelect[0]?.id || ''
    setFormNuevo({
      ordenId: ordDefault,
      subtipo: categoria === 'Garantía' ? 'Garantía' : categoria === 'Satisfacción' ? 'Satisfacción' : 'Reclamo',
      motivo:
        categoria === 'Garantía'
          ? MOTIVOS_GARANTIA[0]
          : categoria === 'Satisfacción'
          ? 'Evaluación de satisfacción post-entrega'
          : MOTIVOS_PQRSF_POR_TIPO.Reclamo[0],
      motivoGarantia: MOTIVOS_GARANTIA[0],
      prioridad: categoria === 'Satisfacción' ? 'Baja' : 'Media',
      responsable: RESPONSABLES_POSTVENTA[0],
      descripcion: '',
      calificacion: 5,
      aspectosEvaluados: [
        'Fidelidad de color y nitidez de impresión',
        'Cumplimiento de la fecha de entrega acordada',
      ],
      dictamenGarantia: 'Pendiente de evaluación',
      justificacionDictamen: '',
      accionCorrectiva: 'En espera de dictamen técnico',
      evidencias: [],
    })
    setModalRegistro(categoria)
  }

  function abrirGestionCaso(caso) {
    setCasoDetalleId(caso.id)
    setFormGestion({
      estado: caso.estado || 'Abierto',
      prioridad: caso.prioridad || 'Media',
      responsable: caso.responsable || RESPONSABLES_POSTVENTA[0],
      dictamenGarantia: caso.dictamenGarantia || 'Pendiente de evaluación',
      justificacionDictamen: caso.justificacionDictamen || '',
      accionCorrectiva: caso.accionCorrectiva || ACCIONES_GARANTIA[0],
      seguimiento: caso.seguimiento || '',
      respuestaCliente: caso.respuestaCliente || '',
      solucion: caso.solucion || '',
      notaHistorial: '',
      evidencias: Array.isArray(caso.evidencias) ? caso.evidencias : [],
    })
  }

  function adjuntarArchivos(e, esGestion = false) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const nuevoAdjunto = {
          id: `EV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nombre: file.name,
          tipo: file.type || 'application/octet-stream',
          tamano: `${Math.max(1, Math.round(file.size / 1024))} KB`,
          fecha: new Date().toLocaleDateString('es-CO'),
          dataUrl: typeof reader.result === 'string' ? reader.result : null,
        }
        if (esGestion) {
          setFormGestion((prev) => ({
            ...prev,
            evidencias: [...(prev.evidencias || []), nuevoAdjunto],
          }))
        } else {
          setFormNuevo((prev) => ({
            ...prev,
            evidencias: [...(prev.evidencias || []), nuevoAdjunto],
          }))
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function toggleAspectoSatisfaccion(aspecto) {
    setFormNuevo((prev) => {
      const existe = prev.aspectosEvaluados.includes(aspecto)
      return {
        ...prev,
        aspectosEvaluados: existe
          ? prev.aspectosEvaluados.filter((a) => a !== aspecto)
          : [...prev.aspectosEvaluados, aspecto],
      }
    })
  }

  function guardarNuevoRegistro(e) {
    e.preventDefault()
    if (!formNuevo.ordenId || !formNuevo.descripcion.trim()) return
    const ordenObj = orders.find((o) => o.id === formNuevo.ordenId)
    const categoria = modalRegistro

    actions.createCase({
      ordenId: formNuevo.ordenId,
      cliente: ordenObj?.cliente || 'Cliente',
      producto: ordenObj?.producto || '',
      categoria,
      subtipo: categoria === 'PQRSF' ? formNuevo.subtipo : categoria,
      tipo: categoria === 'PQRSF' ? formNuevo.subtipo : categoria,
      motivo:
        categoria === 'Garantía'
          ? formNuevo.motivoGarantia
          : categoria === 'Satisfacción'
          ? 'Evaluación de satisfacción post-entrega'
          : formNuevo.motivo,
      prioridad: formNuevo.prioridad,
      responsable: formNuevo.responsable,
      descripcion: formNuevo.descripcion.trim(),
      calificacion: categoria === 'Satisfacción' ? Number(formNuevo.calificacion) : null,
      aspectosEvaluados: categoria === 'Satisfacción' ? formNuevo.aspectosEvaluados : [],
      dictamenGarantia: categoria === 'Garantía' ? formNuevo.dictamenGarantia : '',
      justificacionDictamen: categoria === 'Garantía' ? formNuevo.justificacionDictamen.trim() : '',
      accionCorrectiva: categoria === 'Garantía' ? formNuevo.accionCorrectiva : '',
      evidencias: formNuevo.evidencias,
    })

    setModalRegistro(null)
    setSeccionActiva(categoria)
  }

  function guardarGestionCaso(e) {
    e.preventDefault()
    if (!casoSeleccionado) return

    actions.updateCase(
      casoSeleccionado.id,
      {
        estado: formGestion.estado,
        prioridad: formGestion.prioridad,
        responsable: formGestion.responsable,
        dictamenGarantia:
          casoSeleccionado.categoria === 'Garantía' ? formGestion.dictamenGarantia : casoSeleccionado.dictamenGarantia,
        justificacionDictamen:
          casoSeleccionado.categoria === 'Garantía'
            ? formGestion.justificacionDictamen.trim()
            : casoSeleccionado.justificacionDictamen,
        accionCorrectiva:
          casoSeleccionado.categoria === 'Garantía' ? formGestion.accionCorrectiva : casoSeleccionado.accionCorrectiva,
        seguimiento: formGestion.seguimiento.trim(),
        respuestaCliente: formGestion.respuestaCliente.trim(),
        solucion: formGestion.solucion.trim(),
        notaHistorial: formGestion.notaHistorial.trim() || undefined,
        evidencias: formGestion.evidencias,
      },
      `Caso ${casoSeleccionado.id} actualizado (${formGestion.estado}).`
    )
    setCasoDetalleId(null)
  }

  // Filtrado por texto y selectores
  const coincideTexto = (c) => {
    if (!busqueda.trim()) return true
    const q = busqueda.toLowerCase()
    return (
      String(c.id || '').toLowerCase().includes(q) ||
      String(c.ordenId || '').toLowerCase().includes(q) ||
      String(c.cliente || '').toLowerCase().includes(q) ||
      String(c.motivo || '').toLowerCase().includes(q) ||
      String(c.descripcion || '').toLowerCase().includes(q)
    )
  }

  const satisfaccionFiltrada = calificacionesSatisfaccion.filter(coincideTexto)

  const pqrsfFiltrados = casosPqrsf.filter((c) => {
    if (!coincideTexto(c)) return false
    if (filtroEstado !== 'Todos' && c.estado !== filtroEstado) return false
    if (filtroSubtipoPqrsf !== 'Todos' && (c.subtipo || c.tipo) !== filtroSubtipoPqrsf) return false
    return true
  })

  const garantiasFiltradas = casosGarantia.filter((c) => {
    if (!coincideTexto(c)) return false
    if (filtroEstado !== 'Todos' && c.estado !== filtroEstado) return false
    if (filtroDictamen !== 'Todos' && c.dictamenGarantia !== filtroDictamen) return false
    return true
  })

  // Cálculos de paginación para las tablas de Postventa
  const totalPaginasSat = Math.max(1, Math.ceil(satisfaccionFiltrada.length / POR_PAGINA_POSTVENTA))
  const pagActualSat = Math.min(paginaSat, totalPaginasSat)
  const satisfaccionVisibles = satisfaccionFiltrada.slice(
    (pagActualSat - 1) * POR_PAGINA_POSTVENTA,
    pagActualSat * POR_PAGINA_POSTVENTA
  )

  const totalPaginasPqrsf = Math.max(1, Math.ceil(pqrsfFiltrados.length / POR_PAGINA_POSTVENTA))
  const pagActualPqrsf = Math.min(paginaPqrsf, totalPaginasPqrsf)
  const pqrsfVisibles = pqrsfFiltrados.slice(
    (pagActualPqrsf - 1) * POR_PAGINA_POSTVENTA,
    pagActualPqrsf * POR_PAGINA_POSTVENTA
  )

  const totalPaginasGar = Math.max(1, Math.ceil(garantiasFiltradas.length / POR_PAGINA_POSTVENTA))
  const pagActualGar = Math.min(paginaGar, totalPaginasGar)
  const garantiasVisibles = garantiasFiltradas.slice(
    (pagActualGar - 1) * POR_PAGINA_POSTVENTA,
    pagActualGar * POR_PAGINA_POSTVENTA
  )

  // Cierre de órdenes: cola priorizada
  const ordenesCierreFiltradas = ordenesEntregadas.filter((o) => {
    if (filtroSoloPendientesCierre) return o.estado !== 'Cerrada'
    return true
  })
  const totalPaginasCierre = Math.max(1, Math.ceil(ordenesCierreFiltradas.length / POR_PAGINA_POSTVENTA))
  const pagActualCierre = Math.min(paginaCierre, totalPaginasCierre)
  const ordenesCierreVisibles = ordenesCierreFiltradas.slice(
    (pagActualCierre - 1) * POR_PAGINA_POSTVENTA,
    pagActualCierre * POR_PAGINA_POSTVENTA
  )

  return (
    <div>
      <PageHeader
        titulo="Postventa, PQRSF y garantías"
        subtitulo="Calificaciones post-entrega, casos PQRSF y evaluación técnica de garantías, con trazabilidad hasta el cierre."
        icono="life-buoy"
        acciones={
          puedeGestionarPostventa && (
            <>
              <button className="btn" onClick={() => abrirModalNuevo('Satisfacción')}>
                <Icon nombre="star" tamano={15} /> Registrar calificación
              </button>
              <button className="btn" onClick={() => abrirModalNuevo('PQRSF')}>
                <Icon nombre="plus" tamano={15} /> Radicar PQRSF
              </button>
              <button className="btn btn-primary" onClick={() => abrirModalNuevo('Garantía')}>
                <Icon nombre="shield" tamano={15} /> Solicitud de garantía
              </button>
            </>
          )
        }
      />

      {/* 4 Indicadores clave de Postventa (uno por pilar, con redirección directa) */}
      <div className="kpis" style={{ marginBottom: '16px' }}>
        <StatCard
          icono="star"
          titulo="Satisfacción post-entrega"
          valor={promedioSatisfaccion === '—' ? '—' : `${promedioSatisfaccion} / 5`}
          detalle={`${calificacionesSatisfaccion.length} evaluaciones registradas`}
          color="azul"
          onClick={() => setSeccionActiva('Satisfacción')}
        />
        <StatCard
          icono="alert-triangle"
          titulo="PQRSF pendientes"
          valor={pqrsfPendientes.length}
          detalle={`${casosPqrsf.length} casos PQRSF en total`}
          color={pqrsfPendientes.length > 0 ? 'amarillo' : 'verde'}
          onClick={() => setSeccionActiva('PQRSF')}
        />
        <StatCard
          icono="shield"
          titulo="Garantías en evaluación"
          valor={garantiasEnEvaluacion.length}
          detalle={`${garantiasProcedentes.length} procedentes · ${garantiasNoProcedentes.length} no proc.`}
          color={garantiasEnEvaluacion.length > 0 ? 'rojo' : 'azul'}
          onClick={() => setSeccionActiva('Garantía')}
        />
        <StatCard
          icono="check-circle"
          titulo="Órdenes por cerrar"
          valor={ordenesEntregadas.filter((o) => o.estado !== 'Cerrada').length}
          detalle={`${ordenesEntregadas.filter((o) => o.estado === 'Cerrada').length} órdenes ya cerradas`}
          color="verde"
          onClick={() => setSeccionActiva('Cierre')}
        />
      </div>

      {/* Navegación por las 3 secciones independientes + Cierre de órdenes */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="tabs" role="tablist" aria-label="Secciones de postventa" style={{ margin: 0 }}>
            {SECCIONES_POSTVENTA.map((sec) => {
              const conteo =
                sec.id === 'Satisfacción'
                  ? calificacionesSatisfaccion.length
                  : sec.id === 'PQRSF'
                  ? casosPqrsf.length
                  : casosGarantia.length
              return (
                <button
                  key={sec.id}
                  type="button"
                  role="tab"
                  aria-selected={seccionActiva === sec.id}
                  className={seccionActiva === sec.id ? 'on' : ''}
                  onClick={() => {
                    setSeccionActiva(sec.id)
                    setFiltroEstado('Todos')
                  }}
                >
                  {sec.titulo} <span className="pill">{conteo}</span>
                </button>
              )
            })}
            <button
              type="button"
              role="tab"
              aria-selected={seccionActiva === 'Cierre'}
              className={seccionActiva === 'Cierre' ? 'on' : ''}
              onClick={() => setSeccionActiva('Cierre')}
            >
              Cierre y reapertura de órdenes <span className="pill">{ordenesEntregadas.length}</span>
            </button>
          </div>

          {seccionActiva !== 'Cierre' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="search"
                placeholder="Buscar por caso, orden, cliente o motivo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: 250, padding: '6px 10px', fontSize: 13 }}
              />
              {seccionActiva !== 'Satisfacción' && (
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: 13 }}
                >
                  <option value="Todos">Todos los estados</option>
                  {ESTADOS_CASO_POSTVENTA.map((est) => (
                    <option key={est} value={est}>
                      Estado: {est}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECCIÓN 1: CALIFICACIÓN DE SATISFACCIÓN DEL CLIENTE DESPUÉS DE ENTREGA */}
      {/* ===================================================================== */}
      {seccionActiva === 'Satisfacción' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Calificación de satisfacción del cliente después de la entrega</h2>
              <span className="muted">
                Evaluaciones post-entrega independientes de reclamos o garantías · Promedio global: {promedioSatisfaccion} / 5.0
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {satisfaccionFiltrada.length > POR_PAGINA_POSTVENTA && (
                <div className="row" style={{ gap: '4px', alignItems: 'center', marginRight: '6px' }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualSat <= 1}
                    onClick={() => setPaginaSat((p) => Math.max(1, p - 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página anterior"
                    aria-label="Página anterior"
                  >
                    <Icon nombre="chevron-left" tamano={14} />
                  </button>
                  <span className="sm mut" style={{ fontSize: '11.5px' }}>
                    {pagActualSat} / {totalPaginasSat}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualSat >= totalPaginasSat}
                    onClick={() => setPaginaSat((p) => Math.min(totalPaginasSat, p + 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página siguiente"
                    aria-label="Página siguiente"
                  >
                    <Icon nombre="chevron-right" tamano={14} />
                  </button>
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => abrirModalNuevo('Satisfacción')}>
                <Icon nombre="star" tamano={14} /> Registrar nueva calificación
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Orden / Producto</th>
                  <th>Cliente</th>
                  <th>Fecha evaluación</th>
                  <th>Calificación</th>
                  <th>Aspectos destacados</th>
                  <th>Comentario del cliente</th>
                  <th>Historial</th>
                </tr>
              </thead>
              <tbody>
                {satisfaccionVisibles.map((c) => {
                  const ord = orders.find((o) => o.id === c.ordenId)
                  return (
                    <tr key={c.id}>
                      <td className="mono">{c.id}</td>
                      <td>
                        <a className="link" onClick={() => irA('detalle', c.ordenId)}>
                          {c.ordenId}
                        </a>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {c.producto || ord?.producto || '—'}
                        </div>
                      </td>
                      <td><strong>{c.cliente || ord?.cliente || '—'}</strong></td>
                      <td className="muted">{c.fecha}</td>
                      <td>
                        <Estrellas valor={c.calificacion || 5} />
                        <div className="muted" style={{ fontSize: 11 }}>{c.calificacion || 5} de 5 estrellas</div>
                      </td>
                      <td>
                        {Array.isArray(c.aspectosEvaluados) && c.aspectosEvaluados.length > 0 ? (
                          <div
                            title={c.aspectosEvaluados.join(' · ')}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              background: 'var(--bg-soft, #f1f5f9)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              cursor: 'help',
                            }}
                          >
                            <span>{c.aspectosEvaluados.length} aspecto(s) destacado(s)</span>
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: '11.5px' }}>Evaluación integral</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 280 }}>{c.descripcion}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirGestionCaso(c)}>
                          Ver ficha ({c.historial?.length || 1})
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {satisfaccionFiltrada.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      No hay calificaciones de satisfacción que coincidan con el filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECCIÓN 2: GESTIÓN DE PQRSF (Peticiones, Quejas, Reclamos, Sug., Fel.) */}
      {/* ===================================================================== */}
      {seccionActiva === 'PQRSF' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Gestión de PQRSF (Peticiones, Quejas, Reclamos, Sugerencias y Felicitaciones)</h2>
              <span className="muted">
                Control de atención al cliente, asignación de responsables, evidencias adjuntas, respuesta formal y seguimiento hasta el cierre
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {pqrsfFiltrados.length > POR_PAGINA_POSTVENTA && (
                <div className="row" style={{ gap: '4px', alignItems: 'center', marginRight: '6px' }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualPqrsf <= 1}
                    onClick={() => setPaginaPqrsf((p) => Math.max(1, p - 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página anterior"
                    aria-label="Página anterior"
                  >
                    <Icon nombre="chevron-left" tamano={14} />
                  </button>
                  <span className="sm mut" style={{ fontSize: '11.5px' }}>
                    {pagActualPqrsf} / {totalPaginasPqrsf}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualPqrsf >= totalPaginasPqrsf}
                    onClick={() => setPaginaPqrsf((p) => Math.min(totalPaginasPqrsf, p + 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página siguiente"
                    aria-label="Página siguiente"
                  >
                    <Icon nombre="chevron-right" tamano={14} />
                  </button>
                </div>
              )}
              <select
                value={filtroSubtipoPqrsf}
                onChange={(e) => { setFiltroSubtipoPqrsf(e.target.value); setPaginaPqrsf(1); }}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                <option value="Todos">Todos los tipos PQRSF</option>
                {TIPOS_PQRSF.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => abrirModalNuevo('PQRSF')}>
                + Radicar PQRSF
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Caso / Prioridad</th>
                  <th style={{ width: '165px' }}>Tipo y Orden</th>
                  <th>Motivo y Resumen</th>
                  <th style={{ width: '145px' }}>Fecha y Responsable</th>
                  <th style={{ width: '145px' }}>Estado y Avance</th>
                  <th style={{ width: '130px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pqrsfVisibles.map((c) => {
                  const ord = orders.find((o) => o.id === c.ordenId)
                  const tipoPqrsf = c.subtipo || c.tipo || 'Reclamo'
                  const numEvidencias = Array.isArray(c.evidencias) ? c.evidencias.length : 0
                  return (
                    <tr key={c.id}>
                      <td className="mono">
                        <button
                          className="link-inline"
                          onClick={() => abrirGestionCaso(c)}
                          title="Abrir ficha completa y gestión"
                          style={{ fontWeight: 700 }}
                        >
                          {c.id}
                        </button>
                        <div style={{ marginTop: 2 }}>
                          <StatusBadge estado={c.prioridad || 'Media'} />
                        </div>
                        {numEvidencias > 0 && (
                          <small className="cell-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', marginTop: '2px' }}>
                            <Icon nombre="paperclip" tamano={10} /> {numEvidencias} adjunto(s)
                          </small>
                        )}
                      </td>
                      <td>
                        <StatusBadge estado={tipoPqrsf} />
                        <div style={{ marginTop: '3px' }}>
                          <a className="link" onClick={() => irA('detalle', c.ordenId)} title={`Ir a orden ${c.ordenId}`}>
                            {c.ordenId}
                          </a>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{c.cliente || ord?.cliente || '—'}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{c.producto || ord?.producto || ''}</div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                          {c.motivo || tipoPqrsf}
                        </div>
                        <div
                          className="muted cell-truncate"
                          style={{ fontSize: 12, maxWidth: 280 }}
                          title={c.descripcion}
                        >
                          {c.descripcion}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{c.fecha}</div>
                        <small className="cell-sub" style={{ display: 'block', marginTop: 2 }}>
                          Resp: <strong>{c.responsable || 'Sin asignar'}</strong>
                        </small>
                      </td>
                      <td>
                        <StatusBadge estado={c.estado} />
                        {c.solucion || c.respuestaCliente ? (
                          <small
                            className="cell-sub cell-truncate text-verde"
                            style={{ display: 'block', maxWidth: 140, marginTop: 2, fontWeight: 600 }}
                            title={c.solucion || c.respuestaCliente}
                          >
                            ✓ Respuesta emitida
                          </small>
                        ) : c.seguimiento ? (
                          <small
                            className="cell-sub cell-truncate"
                            style={{ display: 'block', maxWidth: 140, marginTop: 2 }}
                            title={c.seguimiento}
                          >
                            {c.seguimiento}
                          </small>
                        ) : (
                          <small className="cell-sub muted" style={{ display: 'block', marginTop: 2 }}>
                            Pendiente respuesta
                          </small>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-xs"
                          onClick={() => abrirGestionCaso(c)}
                          title="Gestionar caso, ver historial completo y evidencias"
                        >
                          <Icon nombre="edit" tamano={12} /> Gestionar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pqrsfFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No hay registros PQRSF para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECCIÓN 3: GESTIÓN DE GARANTÍAS (CON EVALUACIÓN DE PROCEDENCIA)       */}
      {/* ===================================================================== */}
      {seccionActiva === 'Garantía' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Gestión de garantías (Daños, Defectos de Material, Impresión o Especificaciones)</h2>
              <span className="muted">
                Cada solicitud de garantía requiere revisión de evidencias y dictamen técnico antes de definir si es procedente o no procedente
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {garantiasFiltradas.length > POR_PAGINA_POSTVENTA && (
                <div className="row" style={{ gap: '4px', alignItems: 'center', marginRight: '6px' }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualGar <= 1}
                    onClick={() => setPaginaGar((p) => Math.max(1, p - 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página anterior"
                    aria-label="Página anterior"
                  >
                    <Icon nombre="chevron-left" tamano={14} />
                  </button>
                  <span className="sm mut" style={{ fontSize: '11.5px' }}>
                    {pagActualGar} / {totalPaginasGar}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualGar >= totalPaginasGar}
                    onClick={() => setPaginaGar((p) => Math.min(totalPaginasGar, p + 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página siguiente"
                    aria-label="Página siguiente"
                  >
                    <Icon nombre="chevron-right" tamano={14} />
                  </button>
                </div>
              )}
              <select
                value={filtroDictamen}
                onChange={(e) => { setFiltroDictamen(e.target.value); setPaginaGar(1); }}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                <option value="Todos">Todos los dictámenes</option>
                {DICTAMENES_GARANTIA.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => abrirModalNuevo('Garantía')}>
                + Nueva solicitud de garantía
              </button>
            </div>
          </div>

          <Alert tipo="info" titulo="Protocolo de evaluación de garantías">
            Las reclamaciones de garantía no se aprueban automáticamente: el responsable debe verificar el acta de entrega, las especificaciones técnicas y las evidencias fotográficas para emitir el dictamen (<strong>Procedente total</strong>, <strong>Procedente parcial</strong> o <strong>No procedente</strong>).
          </Alert>

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Código / Prioridad</th>
                  <th style={{ width: '165px' }}>Orden / Cliente</th>
                  <th>Causal y Dictamen</th>
                  <th style={{ width: '145px' }}>Fecha y Responsable</th>
                  <th style={{ width: '140px' }}>Estado y Decisión</th>
                  <th style={{ width: '155px' }}>Gestión</th>
                </tr>
              </thead>
              <tbody>
                {garantiasVisibles.map((c) => {
                  const ord = orders.find((o) => o.id === c.ordenId)
                  const dictamen = c.dictamenGarantia || 'Pendiente de evaluación'
                  const numEvidencias = Array.isArray(c.evidencias) ? c.evidencias.length : 0
                  return (
                    <tr key={c.id}>
                      <td className="mono">
                        <button
                          className="link-inline"
                          onClick={() => abrirGestionCaso(c)}
                          title="Abrir ficha completa de garantía"
                          style={{ fontWeight: 700 }}
                        >
                          {c.id}
                        </button>
                        <div style={{ marginTop: 2 }}>
                          <StatusBadge estado={c.prioridad || 'Alta'} />
                        </div>
                        {numEvidencias > 0 && (
                          <small className="cell-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', marginTop: '2px' }}>
                            📷 {numEvidencias} archivo(s)
                          </small>
                        )}
                      </td>
                      <td>
                        <a className="link" onClick={() => irA('detalle', c.ordenId)} title={`Ir a orden ${c.ordenId}`}>
                          {c.ordenId}
                        </a>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{c.cliente || ord?.cliente || '—'}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{c.producto || ord?.producto || ''}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 2 }}>
                          {c.motivo || 'Revisión de calidad'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <StatusBadge estado={dictamen} />
                          <span
                            className="cell-truncate muted"
                            style={{ fontSize: 11, maxWidth: 220 }}
                            title={c.justificacionDictamen || c.descripcion}
                          >
                            {c.justificacionDictamen || c.descripcion}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>{c.fecha}</div>
                        <small className="cell-sub" style={{ display: 'block', marginTop: 2 }}>
                          Resp: <strong>{c.responsable || 'Sin asignar'}</strong>
                        </small>
                      </td>
                      <td>
                        <StatusBadge estado={c.estado} />
                        {c.accionCorrectiva && (
                          <small
                            className="cell-sub cell-truncate"
                            style={{ display: 'block', maxWidth: 135, marginTop: 2 }}
                            title={c.accionCorrectiva}
                          >
                            {c.accionCorrectiva}
                          </small>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{ gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => abrirGestionCaso(c)}
                            title="Evaluar dictamen, evidencias y seguimiento"
                          >
                            <Icon nombre="edit" tamano={12} /> Evaluar
                          </button>
                          {dictamen.startsWith('Procedente') && (
                            <button
                              className="btn btn-secondary btn-xs"
                              title="Generar orden de reimpresión por garantía aprobada"
                              onClick={() =>
                                actions.cloneOrder(
                                  c.ordenId,
                                  `Reposición por garantía procedente (${c.id}: ${c.motivo})`
                                )
                              }
                            >
                              <Icon nombre="copy" tamano={12} /> Reimprimir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {garantiasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No hay solicitudes de garantía registradas para el filtro actual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECCIÓN 4: CIERRE FORMAL Y REAPERTURA DE ÓRDENES                      */}
      {/* ===================================================================== */}
      {seccionActiva === 'Cierre' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Control de cierre formal y reapertura de órdenes</h2>
              <span className="muted">
                Verifica que no existan PQRSF ni garantías pendientes antes de cerrar definitivamente una orden
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="chips" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className={filtroSoloPendientesCierre ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSoloPendientesCierre(true); setPaginaCierre(1); }}
                  style={{ fontSize: '12px', padding: '3px 8px' }}
                >
                  Pendientes de cierre
                </button>
                <button
                  type="button"
                  className={!filtroSoloPendientesCierre ? 'chip active' : 'chip'}
                  onClick={() => { setFiltroSoloPendientesCierre(false); setPaginaCierre(1); }}
                  style={{ fontSize: '12px', padding: '3px 8px' }}
                >
                  Todas ({ordenesEntregadas.length})
                </button>
              </div>

              {ordenesCierreFiltradas.length > POR_PAGINA_POSTVENTA && (
                <div className="row" style={{ gap: '4px', alignItems: 'center', marginLeft: '6px' }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualCierre <= 1}
                    onClick={() => setPaginaCierre((p) => Math.max(1, p - 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página anterior"
                    aria-label="Página anterior"
                  >
                    <Icon nombre="chevron-left" tamano={14} />
                  </button>
                  <span className="sm mut" style={{ fontSize: '11.5px' }}>
                    {pagActualCierre} / {totalPaginasCierre}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={pagActualCierre >= totalPaginasCierre}
                    onClick={() => setPaginaCierre((p) => Math.min(totalPaginasCierre, p + 1))}
                    style={{ padding: '3px 8px' }}
                    title="Página siguiente"
                    aria-label="Página siguiente"
                  >
                    <Icon nombre="chevron-right" tamano={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Estado actual</th>
                  <th>Validación de requisitos (Cierre)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesCierreVisibles.map((o) => {
                  const val = validarCierreOrden(o, tasks, cases)
                  const estaCerrada = o.estado === 'Cerrada'
                  return (
                    <tr key={o.id}>
                      <td className="mono">
                        <a className="link" onClick={() => irA('detalle', o.id)}>
                          {o.id}
                        </a>
                      </td>
                      <td>{o.cliente}</td>
                      <td>{o.producto}</td>
                      <td>
                        <StatusBadge estado={o.estado} />
                      </td>
                      <td>
                        {estaCerrada ? (
                          <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
                            ✓ Cerrada el {o.fechaCierre || o.fechaEntrega} por {o.cerradoPor || 'Coordinación'}
                          </span>
                        ) : val.puedeCerrar ? (
                          <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 500 }}>
                            ✓ Cumple todos los requisitos para cierre formal
                          </span>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--warning)' }}>
                            <strong>Pendiente ({val.impedimentos.length}):</strong> {val.impedimentos[0]}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="btn-row">
                          {estaCerrada ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                actions.reopenOrder(o.id, 'Reapertura desde módulo de postventa para seguimiento')
                              }
                            >
                              Reabrir orden
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!val.puedeCerrar}
                              title={!val.puedeCerrar ? val.impedimentos.join(' ') : 'Cerrar formalmente la orden'}
                              onClick={() =>
                                actions.closeOrder(o.id, 'Cierre formal tras verificación de postventa y calidad')
                              }
                            >
                              Cerrar orden
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => irA('detalle', o.id)}>
                            Ver ficha
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL PARA RADICAR NUEVO REGISTRO (SATISFACCIÓN / PQRSF / GARANTÍA)   */}
      {/* ===================================================================== */}
      {modalRegistro && (
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
          <div className="card" style={{ maxWidth: 680, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <h2>
                  {modalRegistro === 'Satisfacción'
                    ? 'Registrar Calificación de Satisfacción Post-Entrega'
                    : modalRegistro === 'Garantía'
                    ? 'Radicar Solicitud de Garantía'
                    : 'Radicar Solicitud PQRSF'}
                </h2>
                <span className="muted">
                  {modalRegistro === 'Satisfacción'
                    ? 'Registra la evaluación del cliente tras recibir su pedido'
                    : modalRegistro === 'Garantía'
                    ? 'Registra reclamos por daños, defectos de material, problemas de impresión o incumplimiento de especificaciones'
                    : 'Peticiones, quejas, reclamos, sugerencias o felicitaciones asociadas a una orden'}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalRegistro(null)} aria-label="Cerrar">
                <Icon nombre="x" tamano={16} />
              </button>
            </div>

            <form onSubmit={guardarNuevoRegistro} className="form">
              <div className="form-grid">
                <label className="span-2">
                  <span>Orden de producción relacionada *</span>
                  <select
                    value={formNuevo.ordenId}
                    onChange={(e) => setFormNuevo({ ...formNuevo, ordenId: e.target.value })}
                    required
                  >
                    {listaOrdenesSelect.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {o.cliente} · {o.producto} ({o.estado})
                      </option>
                    ))}
                  </select>
                </label>

                {modalRegistro === 'Satisfacción' && (
                  <>
                    <label>
                      <span>Calificación general (1 a 5 estrellas) *</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <Estrellas
                          valor={formNuevo.calificacion}
                          onSelect={(val) => setFormNuevo({ ...formNuevo, calificacion: val })}
                        />
                        <select
                          value={formNuevo.calificacion}
                          onChange={(e) => setFormNuevo({ ...formNuevo, calificacion: Number(e.target.value) })}
                          style={{ width: 170 }}
                        >
                          <option value={5}>5 — Excelente</option>
                          <option value={4}>4 — Muy bueno</option>
                          <option value={3}>3 — Aceptable</option>
                          <option value={2}>2 — Regular</option>
                          <option value={1}>1 — Insatisfecho</option>
                        </select>
                      </div>
                    </label>

                    <label>
                      <span>Registrado por</span>
                      <select
                        value={formNuevo.responsable}
                        onChange={(e) => setFormNuevo({ ...formNuevo, responsable: e.target.value })}
                      >
                        {responsablesDisponibles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="span-2">
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                        Aspectos evaluados positivamente por el cliente
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                        {ASPECTOS_SATISFACCION.map((asp) => (
                          <label
                            key={asp}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={formNuevo.aspectosEvaluados.includes(asp)}
                              onChange={() => toggleAspectoSatisfaccion(asp)}
                            />
                            <span>{asp}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {modalRegistro === 'PQRSF' && (
                  <>
                    <label>
                      <span>Tipo de solicitud PQRSF *</span>
                      <select
                        value={formNuevo.subtipo}
                        onChange={(e) => {
                          const nuevoSub = e.target.value
                          const listaMotivos = MOTIVOS_PQRSF_POR_TIPO[nuevoSub] || []
                          setFormNuevo({
                            ...formNuevo,
                            subtipo: nuevoSub,
                            motivo: listaMotivos[0] || nuevoSub,
                          })
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
                      <span>Prioridad del caso *</span>
                      <select
                        value={formNuevo.prioridad}
                        onChange={(e) => setFormNuevo({ ...formNuevo, prioridad: e.target.value })}
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="span-2">
                      <span>Motivo principal ({formNuevo.subtipo}) *</span>
                      <select
                        value={formNuevo.motivo}
                        onChange={(e) => setFormNuevo({ ...formNuevo, motivo: e.target.value })}
                      >
                        {(MOTIVOS_PQRSF_POR_TIPO[formNuevo.subtipo] || []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="span-2">
                      <span>Responsable asignado *</span>
                      <select
                        value={formNuevo.responsable}
                        onChange={(e) => setFormNuevo({ ...formNuevo, responsable: e.target.value })}
                      >
                        {responsablesDisponibles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {modalRegistro === 'Garantía' && (
                  <>
                    <label className="span-2">
                      <span>Causal de reclamación de garantía *</span>
                      <select
                        value={formNuevo.motivoGarantia}
                        onChange={(e) => setFormNuevo({ ...formNuevo, motivoGarantia: e.target.value })}
                      >
                        {MOTIVOS_GARANTIA.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Prioridad de revisión *</span>
                      <select
                        value={formNuevo.prioridad}
                        onChange={(e) => setFormNuevo({ ...formNuevo, prioridad: e.target.value })}
                      >
                        {PRIORIDADES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Responsable de evaluación técnica *</span>
                      <select
                        value={formNuevo.responsable}
                        onChange={(e) => setFormNuevo({ ...formNuevo, responsable: e.target.value })}
                      >
                        {responsablesDisponibles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Estado inicial de evaluación</span>
                      <select
                        value={formNuevo.dictamenGarantia}
                        onChange={(e) => setFormNuevo({ ...formNuevo, dictamenGarantia: e.target.value })}
                      >
                        {DICTAMENES_GARANTIA.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Acción preliminar</span>
                      <select
                        value={formNuevo.accionCorrectiva}
                        onChange={(e) => setFormNuevo({ ...formNuevo, accionCorrectiva: e.target.value })}
                      >
                        {ACCIONES_GARANTIA.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <label className="span-2">
                  <span>
                    {modalRegistro === 'Satisfacción'
                      ? 'Comentarios y percepción del cliente *'
                      : 'Descripción detallada del caso *'}
                  </span>
                  <textarea
                    rows={3}
                    value={formNuevo.descripcion}
                    onChange={(e) => setFormNuevo({ ...formNuevo, descripcion: e.target.value })}
                    placeholder={
                      modalRegistro === 'Satisfacción'
                        ? 'Describe los comentarios del cliente sobre el producto entregado...'
                        : 'Detalla las unidades afectadas, especificaciones reportadas o solicitud del cliente...'
                    }
                    required
                  />
                </label>

                {modalRegistro !== 'Satisfacción' && (
                  <label className="span-2">
                    <span>Evidencias fotográficas y documentos adjuntos (Fotos, PDF, Acta)</span>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                      onChange={(e) => adjuntarArchivos(e, false)}
                    />
                    {formNuevo.evidencias.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {formNuevo.evidencias.map((ev) => (
                          <span
                            key={ev.id}
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: 'var(--bg-soft, #f1f5f9)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            📎 {ev.nombre} ({ev.tamano || 'Adjunto'})
                          </span>
                        ))}
                      </div>
                    )}
                  </label>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalRegistro(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE GESTIÓN, EVALUACIÓN DE GARANTÍA E HISTORIAL DEL CASO         */}
      {/* ===================================================================== */}
      {casoSeleccionado && (
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
          <div className="card" style={{ maxWidth: 820, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="card-header">
              <div>
                <h2>
                  Expediente {casoSeleccionado.id} — {casoSeleccionado.categoria || 'Postventa'} (
                  {casoSeleccionado.subtipo || casoSeleccionado.tipo})
                </h2>
                <span className="muted">
                  Orden {casoSeleccionado.ordenId} · Cliente: {casoSeleccionado.cliente} · Fecha radicación:{' '}
                  {casoSeleccionado.fecha}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCasoDetalleId(null)} aria-label="Cerrar">
                <Icon nombre="x" tamano={16} />
              </button>
            </div>

            {/* Resumen del registro original */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--bg-soft, rgba(148,163,184,0.08))',
                border: '1px solid var(--border)',
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <div>
                  <strong>Motivo:</strong> {casoSeleccionado.motivo || casoSeleccionado.tipo}
                </div>
                <div>
                  <StatusBadge estado={casoSeleccionado.estado} />
                </div>
              </div>
              <div>
                <strong>Descripción:</strong> {casoSeleccionado.descripcion}
              </div>

              {Array.isArray(formGestion.evidencias) && formGestion.evidencias.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong style={{ fontSize: 12 }}>Evidencias fotográficas y documentos soporte:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {formGestion.evidencias.map((ev) => (
                      <div
                        key={ev.id || ev.nombre}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-card, #fff)',
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>{String(ev.tipo || '').startsWith('image') ? '🖼️' : '📄'}</span>
                        <span>{ev.nombre}</span>
                        {ev.dataUrl && (
                          <a href={ev.dataUrl} download={ev.nombre} className="link" style={{ fontSize: 11 }}>
                            Descargar
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {casoSeleccionado.categoria !== 'Satisfacción' && (
              <form onSubmit={guardarGestionCaso} className="form" style={{ marginBottom: 18 }}>
                <div className="form-grid">
                  <label>
                    <span>Estado del caso *</span>
                    <select
                      value={formGestion.estado}
                      onChange={(e) => setFormGestion({ ...formGestion, estado: e.target.value })}
                    >
                      {ESTADOS_CASO_POSTVENTA.map((est) => (
                        <option key={est} value={est}>
                          {est}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Prioridad</span>
                    <select
                      value={formGestion.prioridad}
                      onChange={(e) => setFormGestion({ ...formGestion, prioridad: e.target.value })}
                    >
                      {PRIORIDADES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="span-2">
                    <span>Responsable asignado *</span>
                    <select
                      value={formGestion.responsable}
                      onChange={(e) => setFormGestion({ ...formGestion, responsable: e.target.value })}
                    >
                      {responsablesDisponibles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Bloque exclusivo para evaluación técnica de Garantías */}
                  {(casoSeleccionado.categoria === 'Garantía' || casoSeleccionado.tipo === 'Garantía') && (
                    <>
                      <label>
                        <span>Dictamen de evaluación de garantía *</span>
                        <select
                          value={formGestion.dictamenGarantia}
                          onChange={(e) => setFormGestion({ ...formGestion, dictamenGarantia: e.target.value })}
                        >
                          {DICTAMENES_GARANTIA.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Decisión / Acción aplicable *</span>
                        <select
                          value={formGestion.accionCorrectiva}
                          onChange={(e) => setFormGestion({ ...formGestion, accionCorrectiva: e.target.value })}
                        >
                          {ACCIONES_GARANTIA.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="span-2">
                        <span>Concepto / Justificación técnica del dictamen *</span>
                        <textarea
                          rows={2}
                          value={formGestion.justificacionDictamen}
                          onChange={(e) =>
                            setFormGestion({ ...formGestion, justificacionDictamen: e.target.value })
                          }
                          placeholder="Fundamenta por qué la garantía es Procedente, Parcial o No procedente según inspección de muestras y acta de entrega..."
                        />
                      </label>

                      {(String(formGestion.dictamenGarantia || '').startsWith('Procedente') ||
                        String(casoSeleccionado.dictamenGarantia || '').startsWith('Procedente')) &&
                        casoSeleccionado.ordenId && (
                          <div
                            className="span-2"
                            style={{
                              background: 'var(--surface-sunken)',
                              border: '1px solid var(--accent, #3b82f6)',
                              borderRadius: 8,
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              margin: '8px 0',
                            }}
                          >
                            <div>
                              <strong style={{ display: 'block', fontSize: 13, color: 'var(--text-primary)' }}>
                                <Icon nombre="check" tamano={14} /> Garantía Técnica Favorable · Reimpresión autorizada
                              </strong>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Orden original vinculada: <strong>{casoSeleccionado.ordenId}</strong>. Genera automáticamente una nueva OP con especificaciones y arte aprobados.
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ whiteSpace: 'nowrap' }}
                              onClick={() => {
                                const motivoClon = `Garantía técnica ${casoSeleccionado.id}: ${formGestion.dictamenGarantia || casoSeleccionado.dictamenGarantia}. Justificación: ${formGestion.justificacionDictamen || 'Reimpresión autorizada por garantía técnica'}`;
                                actions.cloneOrder(casoSeleccionado.ordenId, motivoClon);
                                setCasoDetalleId(null);
                              }}
                            >
                              <Icon nombre="copy" tamano={14} /> Clonar orden para reimpresión
                            </button>
                          </div>
                        )}
                    </>
                  )}

                  <label className="span-2">
                    <span>Seguimiento interno y acciones adelantadas</span>
                    <textarea
                      rows={2}
                      value={formGestion.seguimiento}
                      onChange={(e) => setFormGestion({ ...formGestion, seguimiento: e.target.value })}
                      placeholder="Registra avances internos, validaciones con producción, logística o diseño..."
                    />
                  </label>

                  <label className="span-2">
                    <span>Respuesta formal al cliente</span>
                    <textarea
                      rows={2}
                      value={formGestion.respuestaCliente}
                      onChange={(e) => setFormGestion({ ...formGestion, respuestaCliente: e.target.value })}
                      placeholder="Comunicación oficial brindada al cliente sobre su solicitud..."
                    />
                  </label>

                  <label className="span-2">
                    <span>Solución definitiva / Cierre del caso</span>
                    <textarea
                      rows={2}
                      value={formGestion.solucion}
                      onChange={(e) => setFormGestion({ ...formGestion, solucion: e.target.value })}
                      placeholder="Describe la solución final aplicada para resolver o cerrar el caso..."
                    />
                  </label>

                  <label className="span-2">
                    <span>Anexar nuevas evidencias fotográficas o soporte documental</span>
                    <input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                      onChange={(e) => adjuntarArchivos(e, true)}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setCasoDetalleId(null)}>
                    Cerrar
                  </button>
                  {puedeGestionarPostventa && (
                    <button type="submit" className="btn btn-primary">
                      Guardar cambios y registrar en historial
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Línea de tiempo del historial de la solicitud hasta su cierre */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>
                Historial trazable de la solicitud ({casoSeleccionado.historial?.length || 1} eventos)
              </h3>
              <ul className="timeline">
                {(casoSeleccionado.historial || []).map((h, idx) => (
                  <li key={idx} className="tl-done">
                    <div className="tl-dot" />
                    <div className="tl-body">
                      <div className="tl-title">
                        {h.accion} <StatusBadge estado={h.estado || casoSeleccionado.estado} />
                      </div>
                      {h.detalle && (
                        <div style={{ fontSize: 12, marginTop: 2 }}>{h.detalle}</div>
                      )}
                      <div className="tl-meta">
                        {h.fecha} · {h.hora || '09:00'} — Responsable/Autor: <strong>{h.autor}</strong>
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
