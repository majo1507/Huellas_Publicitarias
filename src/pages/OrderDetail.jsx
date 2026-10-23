import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ProcessSteps from '../components/ProcessSteps.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import HistoryTimeline from '../components/HistoryTimeline.jsx'
import Modal from '../components/Modal.jsx'
import Alert from '../components/Alert.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import DesignPreview from '../components/DesignPreview.jsx'
import { ETAPAS } from '../data/mockData.js'
import {
  formatoCOP,
  progreso,
  etiquetaDiseno,
  estaRetrasada,
  estaEnRiesgo,
  puedeAvanzar,
  textoPlazo,
  prioridadOrden,
  estaActiva,
  ultimaVersion,
  validarCierreOrden,
} from '../utils/format.js'

const PESTANAS = [
  ['resumen', 'De un vistazo', 'clipboard'],
  ['diseno', 'Diseño y arte', 'pen'],
  ['seguimiento', 'Ruta y etapas', 'activity'],
  ['tareas', 'Tareas de taller', 'list'],
  ['comunicaciones', 'Comunicaciones', 'message'],
  ['archivos', 'Archivos y brief', 'file-text'],
  ['historial', 'Trazabilidad', 'clock'],
]

const STAMPS = {
  Aprobado: { cls: 'stamp-apr', txt: 'APROBADO' },
  Aprobada: { cls: 'stamp-apr', txt: 'APROBADO' },
  Enviado: { cls: 'stamp-pen', txt: 'PENDIENTE' },
  'En proceso': { cls: 'stamp-bor', txt: 'EN PROCESO' },
  'Requiere cambios': { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Rechazada: { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Pendiente: { cls: 'stamp-pen', txt: 'PENDIENTE' },
}

export default function OrderDetail({ order, data, actions, irA, role, tabInicial = 'resumen' }) {
  const [tab, setTab] = useState(tabInicial)
  const [modalIncidenciaTarea, setModalIncidenciaTarea] = useState(null)

  // Estados para Cierre y Reapertura de Órdenes (HU-20)
  const [modalCerrarOrden, setModalCerrarOrden] = useState(false)
  const [modalReabrirOrden, setModalReabrirOrden] = useState(false)
  const [motivoCierre, setMotivoCierre] = useState('Entrega conforme y satisfacción confirmada con el cliente.')
  const [motivoReapertura, setMotivoReapertura] = useState('Reapertura técnica para atención de postventa o garantía.')

  // Filtros del historial cronológico (HU-19)
  const [filtroHistorial, setFiltroHistorial] = useState('')
  const [categoriaHistorial, setCategoriaHistorial] = useState('todos')

  if (!order) {
    return <EmptyState icono="clipboard" titulo="Selecciona un pedido" texto="Elige un pedido desde la lista para ver su detalle." />
  }

  const esCliente = role === 'cliente'
  const veDinero = ['comercial', 'coordinador', 'gerencia'].includes(role)
  const esUltima = order.estado === ETAPAS[ETAPAS.length - 1]
  const casos = data.cases.filter((c) => c.ordenId === order.id)
  const tareasDeOrden = (data.tasks || []).filter((t) => t.ordenId === order.id)
  const commsDeOrden = (data.comms || []).filter((c) => c.ordenId === order.id)
  const regla = puedeAvanzar(order)
  const volverA = ['postventa', 'comercial', 'coordinador'].includes(role) ? 'pedidos' : 'inicio'
  const ultima = ultimaVersion(order)
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  const estaCerrada = order.estado === 'Cerrada'
  const validacionCierre = validarCierreOrden(order, data.tasks, data.cases)

  // Pestañas filtradas por permisos de rol (HU-07)
  const pestanasVisibles = PESTANAS.filter(([k]) => {
    if (esCliente) return ['resumen', 'diseno', 'seguimiento', 'archivos', 'historial'].includes(k)
    if (role === 'operario') return ['resumen', 'tareas', 'seguimiento', 'archivos', 'historial'].includes(k)
    if (role === 'disenador') return ['resumen', 'diseno', 'seguimiento', 'archivos', 'historial'].includes(k)
    if (role === 'comercial') return ['resumen', 'diseno', 'seguimiento', 'comunicaciones', 'archivos', 'historial'].includes(k)
    return true
  })

  // Seguimiento cronológico de tiempos, fechas y responsables por etapa (HU-16)
  const actualIndex = ETAPAS.indexOf(order.estado)
  const etapasSeguimiento = ETAPAS.map((etapa, idx) => {
    const eventosEtapa = (order.historial || []).filter((h) =>
      h.actividad.toLowerCase().includes(etapa.toLowerCase())
    )
    const fechaInicio = idx === 0 ? order.fechaSolicitud : eventosEtapa[0]?.fecha || (idx <= actualIndex ? order.fechaSolicitud : '—')
    let fechaFin = '—'
    let duracion = '—'
    let estadoEtapa = 'Pendiente'

    if (estaCerrada || idx < actualIndex) {
      estadoEtapa = 'Completada'
      const sigEtapa = ETAPAS[idx + 1]
      const evSig = (order.historial || []).find((h) => h.actividad.toLowerCase().includes(sigEtapa?.toLowerCase()))
      fechaFin = evSig?.fecha || fechaInicio
      duracion = (fechaInicio !== '—' && fechaFin !== '—') ? (fechaInicio === fechaFin ? '< 1 día' : 'Registrada') : '—'
    } else if (idx === actualIndex) {
      estadoEtapa = estaRetrasada(order) ? 'Retrasada' : 'En proceso'
      fechaFin = 'En ejecución'
      duracion = 'En curso'
    }

    const responsablesMap = {
      Solicitud: 'Ana Martínez (Comercial)',
      Diseño: `${order.disenador || 'María López'} (Diseño)`,
      Aprobación: `${order.cliente} (Cliente)`,
      Impresión: 'Pedro Morales (Impresor)',
      Acabados: 'Jorge Silva (Acabados)',
      Despacho: 'Luisa Peña (Despacho)',
      Entrega: 'Luisa Peña (Logística)',
      Postventa: 'Sofía Herrera (Postventa)',
    }

    return {
      etapa,
      responsable: esCliente ? (idx === 2 ? order.cliente : 'Huellas Publicidad') : (responsablesMap[etapa] || order.responsable),
      fechaInicio,
      fechaFin,
      duracion,
      estado: estadoEtapa,
    }
  })

  // Archivos generados para esta orden
  const archivos = [
    { nombre: `Brief_${order.cliente.replace(/\s+/g, '_')}.pdf`, tipo: 'Documento técnico', fecha: order.fechaSolicitud },
    { nombre: `Cotizacion_${order.id}.pdf`, tipo: 'Cotización comercial', fecha: order.fechaSolicitud },
    ...(order.versiones || []).map((v) => ({
      nombre: v.archivoNombre || `Arte_Final_${order.id}_v${v.numero}.pdf`,
      tipo: `Diseño versión ${v.numero} (${v.estado})`,
      fecha: v.fecha,
      esArte: true,
      v,
    })),
    ...(order.entrega?.evidencia ? [
      {
        nombre: order.entrega.evidencia.nombre,
        tipo: `Evidencia de entrega (${order.entrega.conformidad || 'Conforme'})`,
        fecha: order.entrega.fechaReal || order.fechaEntrega,
      }
    ] : (['Entrega', 'Postventa', 'Cerrada'].includes(order.estado) ? [
      { nombre: `Acta_entrega_${order.id}.pdf`, tipo: 'Evidencia de entrega y conformidad', fecha: order.fechaEntrega },
    ] : [])),
  ]

  const datosGenerales = [
    ['Número de orden', order.id],
    ['Cliente', order.cliente],
    ['Producto publicitario', order.producto],
    ['Cantidad solicitada', `${order.cantidad} unidades`],
    ['Material de producción', order.material],
    ['Dimensiones técnicas', order.dimensiones],
    ['Fecha de solicitud', order.fechaSolicitud],
    ['Fecha de entrega', order.fechaEntrega],
  ]

  if (!esCliente) {
    datosGenerales.push(
      ['Responsable de etapa', order.responsable],
      ['Diseñadora gráfica', order.disenador],
      ['Paleta de colores', order.colores],
      ['Acabados de taller', order.acabados],
    )
  }

  if (veDinero) datosGenerales.push(['Presupuesto cliente', formatoCOP(order.presupuesto)])
  if (role === 'coordinador' || role === 'gerencia') datosGenerales.push(['Costo interno estimado', formatoCOP(order.costoInterno)])

  // Filtrado de eventos para la trazabilidad (HU-19)
  const eventosBase = esCliente ? order.historial.filter((e) => !e.interno) : order.historial
  const eventosFiltrados = eventosBase.filter((e) => {
    if (filtroHistorial.trim()) {
      const q = filtroHistorial.toLowerCase()
      const match =
        (e.actividad || '').toLowerCase().includes(q) ||
        (e.responsable || '').toLowerCase().includes(q) ||
        (e.motivo || '').toLowerCase().includes(q) ||
        (e.observaciones || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (categoriaHistorial === 'etapas') {
      return (e.actividad || '').toLowerCase().includes('etapa') || Boolean(e.estadoAnterior && e.nuevoEstado)
    }
    if (categoriaHistorial === 'diseno') {
      return (e.actividad || '').toLowerCase().includes('diseño') || (e.actividad || '').toLowerCase().includes('versión')
    }
    if (categoriaHistorial === 'taller') {
      return (
        (e.actividad || '').toLowerCase().includes('actividad') ||
        (e.actividad || '').toLowerCase().includes('tarea') ||
        (e.actividad || '').toLowerCase().includes('incidencia')
      )
    }
    if (categoriaHistorial === 'entrega') {
      return (
        (e.actividad || '').toLowerCase().includes('entrega') ||
        (e.actividad || '').toLowerCase().includes('cerrad') ||
        (e.actividad || '').toLowerCase().includes('postventa')
      )
    }
    return true
  })

  function getSiguientePaso() {
    if (estaCerrada) return 'Expediente archivado (Orden cerrada formalmente)'
    switch (order.estado) {
      case 'Solicitud': return 'Preparar cotización y validar especificaciones'
      case 'Diseño': return ultima?.estado === 'En proceso' ? 'Finalizar propuesta y enviar a aprobación' : 'Asignar requerimientos a diseñador'
      case 'Aprobación': return order.disenoEstado === 'Aprobado' ? 'Avanzar orden a impresión' : 'Esperar decisión formal del cliente'
      case 'Impresión': return 'Ejecutar tiraje de impresión en taller'
      case 'Acabados': return 'Aplicar corte, laminado y ojales'
      case 'Despacho': return 'Despachar orden con mensajería'
      case 'Entrega': return 'Confirmar recepción y conformidad con acta'
      default: return 'Seguimiento de postventa y satisfacción'
    }
  }

  const tareasPendientes = tareasDeOrden.filter((t) => t.estado !== 'Finalizada')
  const puedeVerMesaDiseno = ['disenador', 'coordinador', 'gerencia'].includes(role)
  const puedeGestionarEtapas = ['coordinador', 'gerencia'].includes(role)

  function handleConfirmarCierre(e) {
    e.preventDefault()
    if (!validacionCierre.puedeCerrar) return
    actions.closeOrder(order.id, motivoCierre)
    setModalCerrarOrden(false)
  }

  function handleConfirmarReapertura(e) {
    e.preventDefault()
    actions.reopenOrder(order.id, motivoReapertura)
    setModalReabrirOrden(false)
  }

  const accionesCabecera = (
    <div className="row" style={{ gap: '8px' }}>
      {esCliente && order.disenoEstado === 'Enviado' && (
        <button className="btn btn-success" onClick={() => irA('aprobacion', order.id)}>
          <Icon nombre="check-circle" tamano={16} /> Revisar y aprobar diseño
        </button>
      )}
      {puedeVerMesaDiseno && (
        <button className="btn btn-soft" onClick={() => irA('aprobacion', order.id)}>
          <Icon nombre="pen" tamano={15} /> Mesa de diseño
        </button>
      )}
      {puedeGestionarEtapas && !estaCerrada && (
        <button
          className={regla.bloqueada ? 'btn lock' : 'btn btn-primary'}
          onClick={() => actions.advanceStage(order.id)}
          disabled={esUltima}
          title={regla.bloqueada ? regla.motivo : `Avanzar orden a ${regla.siguiente}`}
        >
          {regla.bloqueada ? <><Icon nombre="lock" tamano={15} /> Producción bloqueada</> : <>Avanzar etapa <Icon nombre="arrow-right" tamano={15} /></>}
        </button>
      )}
      {puedeGestionarEtapas && !estaCerrada && (
        <button
          className="btn btn-soft"
          onClick={() => setModalCerrarOrden(true)}
          title="Verificar requisitos y formalizar cierre de orden (HU-20)"
        >
          <Icon nombre="check" tamano={15} /> Cerrar orden
        </button>
      )}
      {puedeGestionarEtapas && estaCerrada && (
        <button
          className="btn btn-soft"
          onClick={() => setModalReabrirOrden(true)}
          title="Reabrir orden para gestión de postventa"
        >
          <Icon nombre="clock" tamano={15} /> Reabrir orden
        </button>
      )}
      {['coordinador', 'gerencia', 'comercial'].includes(role) && (
        <button
          className="btn btn-soft"
          onClick={() => actions.cloneOrder(order.id)}
          title="Clonar esta orden para reimpresión o reposición de producto"
        >
          <Icon nombre="copy" tamano={15} /> Clonar para reimpresión
        </button>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        titulo={`Orden ${order.id}`}
        subtitulo={`${order.producto} · ${order.cliente}`}
        icono="clipboard"
        volver={{ texto: 'Volver al listado', onClick: () => irA(volverA) }}
        acciones={accionesCabecera}
      />

      {/* BANNER INFORMATIVO SI LA ORDEN ESTÁ CERRADA (HU-20) */}
      {estaCerrada && (
        <div className="ban ban-verde" style={{ marginBottom: '18px' }}>
          <Icon nombre="check-circle" tamano={20} />
          <div>
            <strong>Orden cerrada formalmente el {order.fechaCierre || 'Recientemente'} por {order.cerradoPor || order.responsable}:</strong>
            <div className="sm" style={{ marginTop: '2px' }}>
              {order.motivoCierre ? `Motivo: ${order.motivoCierre}. ` : ''}
              Todas las etapas, actividades de producción y actas de recepción han concluido a satisfacción. El expediente se encuentra archivado.
            </div>
          </div>
        </div>
      )}

      {/* FICHA TÉCNICA CON MARCAS DE CORTE */}
      <section className="card crop" style={{ marginBottom: '22px' }}>
        <div className="cht" style={{ padding: '20px 24px 8px', alignItems: 'flex-start' }}>
          <div>
            <div className="sm mut">ORDEN DE PRODUCCIÓN</div>
            <div className="on-num">{order.id}</div>
          </div>
          <div className="row" style={{ gap: '10px' }}>
            <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
            <StatusBadge estado={order.estado === 'Entrega' ? 'Entregado' : order.estado} />
            {!esCliente && estaActiva(order) && (
              <StatusBadge estado={prioridadOrden(order)} texto={`Prioridad ${prioridadOrden(order).toLowerCase()}`} />
            )}
          </div>
        </div>

        <div style={{ padding: '6px 24px 18px' }}>
          <dl className="spec">
            <div><dt>Cliente</dt><dd>{order.cliente}</dd></div>
            <div><dt>Producto</dt><dd>{order.producto}</dd></div>
            <div><dt>Dimensiones</dt><dd>{order.dimensiones}</dd></div>
            <div><dt>Fecha de entrega</dt><dd>{order.fechaEntrega} <span className="sm mut">({textoPlazo(order)})</span></dd></div>
            {!esCliente && <div><dt>Responsable</dt><dd>{order.responsable}</dd></div>}
          </dl>
        </div>

        {/* Resumen De un vistazo en 4 columnas */}
        <div className="glance">
          <div>
            <small>Qué falta</small>
            <b>{estaCerrada ? '0 tareas' : `${tareasPendientes.length} ${tareasPendientes.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}`}</b>
            <div className="sm mut ell">{estaCerrada ? 'Orden cerrada' : (tareasPendientes[0]?.actividad || 'Actividades al día')}</div>
          </div>
          <div>
            <small>Qué sigue</small>
            <b className="sm" style={{ fontSize: '13px', display: 'block' }}>{getSiguientePaso()}</b>
          </div>
          <div>
            <small>Quién tiene la orden</small>
            <div className="person" style={{ marginTop: '2px' }}>
              <Avatar nombre={order.responsable} tamano="xs" />
              <span>{esCliente ? 'Huellas Publicidad' : order.responsable}</span>
            </div>
            <div className="sm mut">Etapa: {order.estado}</div>
          </div>
          <div>
            <small>Comunicaciones</small>
            <b>{commsDeOrden.length} {commsDeOrden.length === 1 ? 'conversación' : 'conversaciones'}</b>
            <div className="sm mut">
              {commsDeOrden.length > 0 ? (
                <button className="link-inline sm" onClick={() => setTab('comunicaciones')}>Ver mensajes</button>
              ) : 'Sin mensajes'}
            </div>
          </div>
        </div>
      </section>

      {/* Alerta de bloqueo de calidad (HU-13) */}
      {!esCliente && regla.bloqueada && !estaCerrada && (
        <div className="ban am" style={{ marginBottom: '20px' }}>
          <Icon nombre="lock" tamano={18} />
          <div>
            <strong>Regla de control de calidad:</strong> {regla.motivo}
            <div className="sm" style={{ marginTop: '4px' }}>
              El taller no iniciará corte ni impresión hasta recibir la aprobación documentada de la versión gráfica vigente.
            </div>
          </div>
        </div>
      )}

      {/* Pestañas de navegación filtradas por rol */}
      <div className="tabs" role="tablist">
        {pestanasVisibles.map(([k, texto, icono]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'on' : ''}
            onClick={() => setTab(k)}
          >
            <Icon nombre={icono} tamano={15} /> {texto}
          </button>
        ))}
      </div>

      {/* 1. RESUMEN Y DETALLES */}
      {tab === 'resumen' && (
        <div className="stack">
          <div className="grid-2">
            <Panel titulo="Ficha técnica de especificaciones" icono="file-text">
              <dl className="details details-1">
                {datosGenerales.map(([titulo, valor]) => (
                  <div key={titulo}><dt>{titulo}</dt><dd>{valor}</dd></div>
                ))}
              </dl>
            </Panel>

            <div className="stack">
              <Panel titulo="Logística y entrega" icono="truck">
                <dl className="details details-1">
                  <div><dt>Dirección de destino</dt><dd>{order.entrega.direccion}</dd></div>
                  <div><dt>Método de despacho</dt><dd>{order.entrega.metodo}</dd></div>
                  <div><dt>Contacto en sitio</dt><dd>{order.entrega.contacto}</dd></div>
                  {order.entrega.documento && <div><dt>Cédula/NIT receptor</dt><dd>{order.entrega.documento}</dd></div>}
                  {order.entrega.conformidad && <div><dt>Conformidad</dt><dd><StatusBadge estado={order.entrega.conformidad === 'Conforme' ? 'Finalizada' : 'Pausada'} texto={order.entrega.conformidad} /></dd></div>}
                </dl>
              </Panel>

              <Panel titulo="Observaciones y notas del brief" icono="message">
                <p>{order.observaciones || 'Sin observaciones generales.'}</p>
                {!esCliente && order.requerimientos && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                    <small className="mut">Requerimientos técnicos:</small>
                    <p className="sm" style={{ marginTop: '2px' }}>{order.requerimientos}</p>
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {(esCliente || role === 'postventa' || role === 'coordinador') && (
            <Panel titulo="Casos y atención postventa" icono="life-buoy">
              {casos.length === 0 ? (
                <EmptyState icono="shield" titulo="Sin casos de postventa" texto="Este pedido no tiene reclamos, garantías ni ajustes registrados." />
              ) : (
                <div className="table-wrap">
                  <table className="table table-plain">
                    <thead>
                      <tr><th>Caso</th><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Solución</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {casos.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.id}</strong></td>
                          <td><strong>{c.tipo}</strong></td>
                          <td>{c.fecha}</td>
                          <td>{c.descripcion}</td>
                          <td>{c.solucion || 'En trámite de resolución'}</td>
                          <td><StatusBadge estado={c.estado} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* 2. DISEÑO Y ARTE GRÁFICO */}
      {tab === 'diseno' && (
        <div className="grid-main">
          <Panel titulo="Propuesta gráfica de la pieza" icono="image">
            <div className="design-preview-container">
              <DesignPreview order={order} version={ultima} grande />
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: '16px' }}>
              <div>
                <strong>Estado del diseño: </strong>
                <StatusBadge estado={esCliente ? etiquetaDiseno(order.disenoEstado) : order.disenoEstado} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => irA('aprobacion', order.id)}>
                <Icon nombre="check-circle" tamano={14} /> Abrir mesa de aprobación
              </button>
            </div>
          </Panel>

          <Panel titulo="Control de versiones" icono="pen">
            {order.versiones.length === 0 ? (
              <EmptyState icono="image" titulo="Sin versiones aún" texto="La diseñadora asignará el primer arte." />
            ) : (
              <div className="stack" style={{ gap: '10px' }}>
                {order.versiones.map((v) => (
                  <div key={v.numero} className="version-item-card">
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <strong>Versión {v.numero}</strong>
                      <StatusBadge estado={v.estado} />
                    </div>
                    <div className="sm mut">{v.fecha} · {v.disenador}</div>
                    {v.archivoNombre && (
                      <div className="sm" style={{ marginTop: '3px', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Icon nombre="file-text" tamano={13} /> {v.archivoNombre}
                      </div>
                    )}
                    {v.observacionesDisenador && (
                      <p className="sm mut" style={{ margin: '4px 0 0' }}>
                        <strong>Nota técnica:</strong> {v.observacionesDisenador}
                      </p>
                    )}
                    {v.comentario && <p className="comment-text">“{v.comentario}”</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* 3. SEGUIMIENTO, RUTAS, TIEMPOS Y RESPONSABLES (HU-16) */}
      {tab === 'seguimiento' && (
        <Panel titulo="Proceso, ruta y tiempos de la orden" icono="activity">
          <div style={{ marginBottom: '16px' }}>
            <ProgressBar valor={progreso(order)} />
          </div>
          <ProcessSteps estado={order.estado} modoCliente={esCliente} bloqueo={!esCliente && regla.bloqueada} />

          <div style={{ marginTop: '20px', padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
            <strong>Etapa en curso: {order.estado}</strong>
            <p className="sm mut" style={{ marginTop: '4px' }}>
              Avance acumulado del pedido: {progreso(order)}% · Siguiente acción requerida: {getSiguientePaso()}.
            </p>
          </div>

          {/* Alerta explicativa si la etapa está retrasada frente al plazo */}
          {estaRetrasada(order) && (
            <div className="ban rd" style={{ marginTop: '16px' }}>
              <Icon nombre="alert-triangle" tamano={18} />
              <div>
                <strong>Etapa con retraso frente al plazo de entrega:</strong> La fecha pactada de entrega era el {order.fechaEntrega} y la orden aún se encuentra en la etapa de {order.estado}.
                <div className="sm" style={{ marginTop: '2px' }}>
                  Estado de plazo: {textoPlazo(order)}. Se recomienda reasignar recursos de taller.
                </div>
              </div>
            </div>
          )}

          {/* Tabla técnica de tiempos, fechas y responsables por etapa (HU-16) */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon nombre="clock" tamano={16} /> Tiempos, fechas y responsables por etapa
            </h3>
            <div className="table-wrap">
              <table className="table table-plain">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Responsable</th>
                    <th>Fecha de inicio</th>
                    <th>Fecha de finalización</th>
                    <th>Duración observada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {etapasSeguimiento.map((row) => (
                    <tr key={row.etapa}>
                      <td><strong>{row.etapa}</strong></td>
                      <td>{row.responsable}</td>
                      <td>{row.fechaInicio}</td>
                      <td>{row.fechaFin}</td>
                      <td>{row.duracion}</td>
                      <td><StatusBadge estado={row.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>
      )}

      {/* 4. TAREAS Y ACTIVIDADES DE TALLER */}
      {tab === 'tareas' && (
        <Panel titulo="Actividades operativas en taller" icono="list">
          {tareasDeOrden.length === 0 ? (
            <EmptyState icono="list" titulo="Sin actividades asignadas" texto="El coordinador asignará las actividades de taller." />
          ) : (
            <div className="table-wrap">
              <table className="table table-plain">
                <thead>
                  <tr>
                    <th>Actividad</th>
                    <th>Responsable</th>
                    <th>Prioridad</th>
                    <th>Fecha límite</th>
                    <th>Avance</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tareasDeOrden.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.actividad}</strong>
                        {t.incidencias?.length > 0 && (
                          <span className="badge badge-rojo" style={{ fontSize: '10px', marginLeft: '6px' }}>
                            {t.incidencias.length} inc.
                          </span>
                        )}
                      </td>
                      <td><Avatar nombre={t.responsable} tamano="xs" /> {t.responsable}</td>
                      <td><StatusBadge estado={t.prioridad} /></td>
                      <td>{t.fechaLimite}</td>
                      <td style={{ width: '130px' }}>
                        <ProgressBar valor={t.pct !== undefined ? t.pct : (t.estado === 'Finalizada' ? 100 : 50)} />
                      </td>
                      <td><StatusBadge estado={t.estado} /></td>
                      <td>
                        {!estaCerrada ? (
                          <button
                            className="btn btn-ghost btn-sm danger-text"
                            onClick={() => setModalIncidenciaTarea(t)}
                            title="Registrar incidencia en esta tarea"
                          >
                            <Icon nombre="alert-triangle" tamano={13} /> Incidencia
                          </button>
                        ) : (
                          <span className="sm mut">Bloqueada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* 5. COMUNICACIONES */}
      {tab === 'comunicaciones' && (
        <Panel titulo="Comunicaciones vinculadas a esta orden" icono="message">
          {commsDeOrden.length === 0 ? (
            <EmptyState icono="message" titulo="Sin mensajes registrados" texto="Las conversaciones asociadas a esta orden aparecerán aquí." />
          ) : (
            <div className="stack" style={{ gap: '14px' }}>
              {commsDeOrden.map((c) => (
                <div key={c.id} className="card p" style={{ background: 'var(--bg-subtle)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{c.asunto || `Canal ${c.canal.toUpperCase()}`}</strong>
                    <StatusBadge estado={c.estado} />
                  </div>
                  <div className="stack" style={{ gap: '6px' }}>
                    {c.mensajes.map((m, i) => (
                      <div key={i} className="sm" style={{ padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                        <span className="mut" style={{ fontWeight: 600 }}>{m.de === 'usuario' ? c.responsable : c.cliente} ({m.hora}): </span>
                        {m.texto}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* 6. ARCHIVOS Y BRIEF */}
      {tab === 'archivos' && (
        <Panel titulo="Expediente digital de archivos" icono="file-text">
          <div className="fgrid">
            {archivos.map((f, i) => (
              <div key={i} className="fi">
                {f.esArte ? (
                  <div style={{ height: '96px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', borderRadius: '4px' }}>
                    <DesignPreview order={order} version={f.v} />
                  </div>
                ) : (
                  <div className="dc">
                    <Icon nombre="file-text" tamano={28} />
                  </div>
                )}
                <div className="sm" style={{ marginTop: '8px', wordBreak: 'break-all' }}>
                  <strong>{f.nombre}</strong>
                </div>
                <div className="sm mut">{f.tipo} · {f.fecha}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* 7. TRAZABILIDAD / HISTORIAL (HU-19) */}
      {tab === 'historial' && (
        <Panel titulo={esCliente ? 'Historial de avances' : 'Trazabilidad cronológica completa (HU-19)'} icono="clock">
          <div className="row" style={{ gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Buscar en el historial por acción, responsable o motivo..."
              value={filtroHistorial}
              onChange={(e) => setFiltroHistorial(e.target.value)}
              style={{ flex: '1', minWidth: '220px' }}
            />
            <div className="row" style={{ gap: '6px' }}>
              <button
                className={`btn btn-sm ${categoriaHistorial === 'todos' ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setCategoriaHistorial('todos')}
              >
                Todos ({eventosBase.length})
              </button>
              <button
                className={`btn btn-sm ${categoriaHistorial === 'etapas' ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setCategoriaHistorial('etapas')}
              >
                Etapas
              </button>
              <button
                className={`btn btn-sm ${categoriaHistorial === 'diseno' ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setCategoriaHistorial('diseno')}
              >
                Diseño
              </button>
              <button
                className={`btn btn-sm ${categoriaHistorial === 'taller' ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setCategoriaHistorial('taller')}
              >
                Taller
              </button>
              <button
                className={`btn btn-sm ${categoriaHistorial === 'entrega' ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setCategoriaHistorial('entrega')}
              >
                Entregas y Cierre
              </button>
            </div>
          </div>
          <HistoryTimeline eventos={eventosFiltrados} mostrarResponsable={!esCliente} />
        </Panel>
      )}

      {/* MODAL HU-15: Registro de incidencia en tarea desde el detalle de la orden */}
      {modalIncidenciaTarea && (
        <Modal
          titulo="Registrar incidencia en actividad"
          subtitulo={`${modalIncidenciaTarea.actividad} · Orden ${order.id}`}
          icono="alert-triangle"
          tipoBoton="danger"
          etiqueta="Describe el problema técnico o contratiempo ocurrido"
          ayuda="Quedará registrado en la trazabilidad interna de la orden."
          minimo={10}
          textoBoton="Guardar incidencia"
          onClose={() => setModalIncidenciaTarea(null)}
          onConfirm={(texto) => {
            actions.addTaskNote(modalIncidenciaTarea.id, 'incidencias', texto)
            setModalIncidenciaTarea(null)
          }}
        />
      )}

      {/* MODAL HU-20: Cierre de Órdenes con Validación Estricta */}
      {modalCerrarOrden && (
        <div className="modal-backdrop" onClick={() => setModalCerrarOrden(false)}>
          <div className="modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cierre formal de orden">
            <div className="modal-head">
              <span className={`modal-icon ${validacionCierre.puedeCerrar ? 'modal-icon-success' : 'modal-icon-warning'}`}>
                <Icon nombre={validacionCierre.puedeCerrar ? 'check-circle' : 'alert-triangle'} tamano={20} />
              </span>
              <div>
                <h2>Cierre formal de orden: {order.id}</h2>
                <p>{order.cliente} · {order.producto}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalCerrarOrden(false)}><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              {!validacionCierre.puedeCerrar ? (
                <div>
                  <div className="ban ban-rojo" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <Icon nombre="lock" tamano={18} />
                      <div>
                        <strong>No es posible cerrar la orden en este momento (HU-20):</strong>
                        <div className="sm" style={{ marginTop: '2px' }}>
                          Para autorizar el cierre definitivo, el sistema exige que todos los prerrequisitos de calidad, producción y entrega estén concluidos.
                        </div>
                      </div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '13px', margin: '0 0 8px' }}>Condiciones pendientes por cumplir:</h4>
                  <ul style={{ margin: '0 0 16px 20px', padding: 0, fontSize: '13px' }}>
                    {validacionCierre.impedimentos.map((imp, i) => (
                      <li key={i} style={{ marginBottom: '6px', color: '#b91c1c' }}>
                        {imp}
                      </li>
                    ))}
                  </ul>

                  <div className="ban ban-azul" style={{ fontSize: '12px' }}>
                    <Icon nombre="info" tamano={14} /> Una vez finalizadas las tareas pendientes o registrada el acta de entrega formal, este botón permitirá archivar la orden.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmarCierre}>
                  <div className="ban ban-verde" style={{ marginBottom: '16px' }}>
                    <Icon nombre="check" tamano={18} />
                    <div>
                      <strong>Todos los requisitos de cierre verificados con éxito:</strong>
                      <div className="sm" style={{ marginTop: '2px' }}>
                        Diseño aprobado, 100% de actividades de taller terminadas, entrega formal registrada y sin casos pendientes.
                      </div>
                    </div>
                  </div>

                  <div className="field full">
                    <label className="field-label" htmlFor="motivoCierreInput">
                      Observaciones de cierre y conformidad formal *
                    </label>
                    <textarea
                      id="motivoCierreInput"
                      rows={3}
                      value={motivoCierre}
                      onChange={(e) => setMotivoCierre(e.target.value)}
                      placeholder="Registra el motivo u observaciones finales..."
                      required
                    />
                  </div>

                  <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                    <button type="button" className="btn" onClick={() => setModalCerrarOrden(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-success">
                      <Icon nombre="check" tamano={15} /> Confirmar cierre definitivo
                    </button>
                  </div>
                </form>
              )}
            </div>

            {!validacionCierre.puedeCerrar && (
              <div className="modal-foot">
                <button className="btn" onClick={() => setModalCerrarOrden(false)}>Entendido / Volver</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL HU-20: Reapertura de Orden Cerrada */}
      {modalReabrirOrden && (
        <div className="modal-backdrop" onClick={() => setModalReabrirOrden(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reapertura de orden">
            <div className="modal-head">
              <span className="modal-icon modal-icon-warning"><Icon nombre="clock" tamano={20} /></span>
              <div>
                <h2>Reapertura autorizada: {order.id}</h2>
                <p>La orden pasará a etapa Postventa para gestionar garantías</p>
              </div>
              <button className="icon-btn" onClick={() => setModalReabrirOrden(false)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleConfirmarReapertura} className="modal-body">
              <div className="field full">
                <label className="field-label" htmlFor="motivoReaperturaInput">Motivo de la reapertura *</label>
                <textarea
                  id="motivoReaperturaInput"
                  rows={3}
                  value={motivoReapertura}
                  onChange={(e) => setMotivoReapertura(e.target.value)}
                  placeholder="Justifica por qué se reabre la orden..."
                  required
                />
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalReabrirOrden(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  Confirmar reapertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
