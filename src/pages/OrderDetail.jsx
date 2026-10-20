import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ProcessSteps from '../components/ProcessSteps.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import HistoryTimeline from '../components/HistoryTimeline.jsx'
import Alert from '../components/Alert.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import Avatar from '../components/Avatar.jsx'
import DesignPreview from '../components/DesignPreview.jsx'
import { ETAPAS } from '../data/mockData.js'
import {
  formatoCOP, progreso, etiquetaDiseno, estaRetrasada, estaEnRiesgo, puedeAvanzar, textoPlazo, prioridadOrden, estaActiva, ultimaVersion,
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

  // Archivos generados para esta orden
  const archivos = [
    { nombre: `Brief_${order.cliente.replace(/\s+/g, '_')}.pdf`, tipo: 'Documento técnico', fecha: order.fechaSolicitud },
    { nombre: `Cotizacion_${order.id}.pdf`, tipo: 'Cotización comercial', fecha: order.fechaSolicitud },
    ...(order.versiones || []).map((v) => ({
      nombre: `Arte_Final_${order.id}_v${v.numero}.pdf`,
      tipo: `Diseño versión ${v.numero} (${v.estado})`,
      fecha: v.fecha,
      esArte: true,
      v,
    })),
    ...(order.estado === 'Entrega' || order.estado === 'Postventa' ? [
      { nombre: `Acta_entrega_${order.id}.pdf`, tipo: 'Evidencia de entrega y conformidad', fecha: order.fechaEntrega },
    ] : []),
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

  const eventos = esCliente ? order.historial.filter((e) => !e.interno) : order.historial

  // Siguiente paso sugerido según etapa
  function getSiguientePaso() {
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

  const accionesCabecera = (
    <div className="row" style={{ gap: '8px' }}>
      {esCliente && order.disenoEstado === 'Enviado' && (
        <button className="btn btn-success" onClick={() => irA('aprobacion', order.id)}>
          <Icon nombre="check-circle" tamano={16} /> Revisar y aprobar diseño
        </button>
      )}
      {!esCliente && (
        <button className="btn btn-soft" onClick={() => irA('aprobacion', order.id)}>
          <Icon nombre="pen" tamano={15} /> Mesa de diseño
        </button>
      )}
      {role === 'coordinador' && (
        <button
          className={regla.bloqueada ? 'btn lock' : 'btn btn-primary'}
          onClick={() => actions.advanceStage(order.id)}
          disabled={esUltima}
          title={regla.bloqueada ? regla.motivo : `Avanzar orden a ${regla.siguiente}`}
        >
          {regla.bloqueada ? <><Icon nombre="lock" tamano={15} /> Producción bloqueada</> : <>Avanzar etapa <Icon nombre="arrow-right" tamano={15} /></>}
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

      {/* FICHA TÉCNICA CON MARCAS DE CORTE (CROP MARKS) INSPIRADA EN EL HTML */}
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
            <div><dt>Responsable</dt><dd>{order.responsable}</dd></div>
          </dl>
        </div>

        {/* Resumen 'De un vistazo' (Glance) en 4 columnas */}
        <div className="glance">
          <div>
            <small>Qué falta</small>
            <b>{tareasPendientes.length} {tareasPendientes.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}</b>
            <div className="sm mut ell">{tareasPendientes[0]?.actividad || 'Actividades al día'}</div>
          </div>
          <div>
            <small>Qué sigue</small>
            <b className="sm" style={{ fontSize: '13px', display: 'block' }}>{getSiguientePaso()}</b>
          </div>
          <div>
            <small>Quién tiene la orden</small>
            <div className="person" style={{ marginTop: '2px' }}>
              <Avatar nombre={order.responsable} tamano="xs" />
              <span>{order.responsable}</span>
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

      {/* Alerta de bloqueo si el diseño no está aprobado */}
      {!esCliente && regla.bloqueada && (
        <div className="ban am" style={{ marginBottom: '20px' }}>
          <Icon nombre="lock" tamano={18} />
          <div>
            <strong>Regla de control de calidad:</strong> {regla.motivo}
            <div className="sm" style={{ marginTop: '4px' }}>
              El taller no iniciará corte ni impresión hasta recibir la aprobación documentada de la versión gráfica.
            </div>
          </div>
        </div>
      )}

      {/* Pestañas de navegación */}
      <div className="tabs" role="tablist">
        {PESTANAS.map(([k, texto, icono]) => (
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

          {(esCliente || role === 'postventa') && (
            <Panel titulo="Casos y atención postventa" icono="life-buoy">
              {casos.length === 0 ? (
                <EmptyState icono="shield" titulo="Sin casos de postventa" texto="Este pedido no tiene reclamos, garantías ni ajustes registrados." />
              ) : (
                <div className="table-wrap">
                  <table className="table table-plain">
                    <thead>
                      <tr><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Solución</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {casos.map((c) => (
                        <tr key={c.id}>
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
                    {v.comentario && <p className="comment-text">“{v.comentario}”</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* 3. SEGUIMIENTO Y ETAPAS */}
      {tab === 'seguimiento' && (
        <Panel titulo="Proceso y ruta de la orden" icono="activity">
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
        </Panel>
      )}

      {/* 4. TAREAS DE TALLER */}
      {tab === 'tareas' && (
        <Panel titulo="Actividades asignadas a esta orden" icono="list">
          {tareasDeOrden.length === 0 ? (
            <EmptyState icono="list" titulo="Sin tareas específicas" texto="Las actividades se programan al ingresar a producción." />
          ) : (
            <div className="table-wrap">
              <table className="table table-plain">
                <thead>
                  <tr><th>Actividad</th><th>Responsable</th><th>Prioridad</th><th>Fecha límite</th><th>Avance</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {tareasDeOrden.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.actividad}</strong></td>
                      <td><Avatar nombre={t.responsable} tamano="xs" /> {t.responsable}</td>
                      <td><StatusBadge estado={t.prioridad} /></td>
                      <td>{t.fechaLimite}</td>
                      <td style={{ width: '130px' }}><ProgressBar valor={t.pct !== undefined ? t.pct : (t.estado === 'Finalizada' ? 100 : 50)} /></td>
                      <td><StatusBadge estado={t.estado} /></td>
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
            <EmptyState icono="message" titulo="Sin mensajes registrados" texto="Las conversaciones de WhatsApp y correo asociadas a esta orden aparecerán aquí." />
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

      {/* 7. TRAZABILIDAD / HISTORIAL */}
      {tab === 'historial' && (
        <Panel titulo={esCliente ? 'Historial de avances' : 'Trazabilidad cronológica completa'} icono="clock">
          <HistoryTimeline eventos={eventos} mostrarResponsable={!esCliente} />
        </Panel>
      )}
    </div>
  )
}
