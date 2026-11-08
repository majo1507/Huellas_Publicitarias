import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { formatearFecha, formatearHora, progreso, textoPlazo } from '../utils/format.js'

const CANALES = {
  wa: { nombre: 'WhatsApp Business', corto: 'WhatsApp', icono: 'message-circle' },
  mail: { nombre: 'Correo electrónico', corto: 'Correo', icono: 'mail' },
  call: { nombre: 'Telefonía VoIP', corto: 'Llamadas', icono: 'phone' },
}

const FILTROS_CANAL = [
  ['', 'Todos', null],
  ['wa', 'WhatsApp', 'message-circle'],
  ['mail', 'Correo', 'mail'],
  ['call', 'VoIP', 'phone'],
]

export default function Communications({ data, actions, irA }) {
  const [canalFiltro, setCanalFiltro] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionadaId, setSeleccionadaId] = useState('COM-001')
  const [textoRespuesta, setTextoRespuesta] = useState('')

  const comms = data.comms || []
  const q = busqueda.trim().toLowerCase()

  const filtradas = comms.filter((c) => {
    if (canalFiltro && c.canal !== canalFiltro) return false
    if (clienteFiltro && c.clienteId !== clienteFiltro) return false
    if (q) {
      const ultimoTexto = c.mensajes[c.mensajes.length - 1]?.texto || ''
      const textoBuscable = `${c.id} ${c.cliente} ${c.ordenId || ''} ${c.responsable} ${ultimoTexto}`.toLowerCase()
      if (!textoBuscable.includes(q)) return false
    }
    return true
  })

  const actual = filtradas.find((c) => c.id === seleccionadaId) || comms.find((c) => c.id === seleccionadaId) || filtradas[0] || null
  const clienteInfo = actual ? data.clients.find((cl) => cl.id === actual.clienteId || cl.nombre === actual.cliente) : null
  const ordenAsociada = actual?.ordenId ? data.orders.find((o) => o.id === actual.ordenId) : null
  const ordenesCliente = actual
    ? data.orders.filter((o) => o.clienteId === actual.clienteId || o.cliente === actual.cliente)
    : []
  const solicitudesCliente = actual
    ? (data.requests || []).filter((r) => r.clienteId === actual.clienteId || r.cliente === actual.cliente)
    : []

  function handleEnviar(e) {
    e.preventDefault()
    if (!textoRespuesta.trim() || !actual) return

    const nuevoMensaje = {
      de: 'usuario',
      texto: textoRespuesta.trim(),
      fecha: formatearFecha(),
      hora: formatearHora(),
    }

    actions.sendCommMessage(actual.id, nuevoMensaje)
    setTextoRespuesta('')
  }

  return (
    <div>
      <PageHeader
        titulo="Centro de Comunicaciones"
        subtitulo="Mensajería unificada vinculada a clientes, solicitudes comerciales y órdenes de producción."
        icono="message"
        acciones={
          <div className="comm-status-bar" aria-label="Canales integrados">
            <span className="comm-status-pill">
              <span className="chp-dot" />
              Canales integrados: WhatsApp · Correo · Telefonía
            </span>
            <span className="comm-count-tag">{comms.length} hilos</span>
          </div>
        }
      />

      {/* Espacio de mensajería en 3 paneles equilibrados: Lista · Chat protagonista · Ficha contextual */}
      <div className="cm">
        {/* 1. Panel izquierdo: búsqueda, filtros rápidos y lista de conversaciones */}
        <aside className="comm-sidebar" aria-label="Lista de conversaciones">
          <div className="comm-filters">
            <label className="search-box comm-search">
              <Icon nombre="search" tamano={15} />
              <input
                type="search"
                placeholder="Buscar cliente, orden o mensaje..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar conversación"
              />
            </label>

            <div className="comm-channel-tabs" role="tablist" aria-label="Filtrar por canal">
              {FILTROS_CANAL.map(([valor, etiqueta, icono]) => (
                <button
                  key={etiqueta}
                  type="button"
                  role="tab"
                  aria-selected={canalFiltro === valor}
                  className={canalFiltro === valor ? 'comm-tab active' : 'comm-tab'}
                  onClick={() => setCanalFiltro(valor)}
                >
                  {icono && <Icon nombre={icono} tamano={13} />}
                  <span>{etiqueta}</span>
                </button>
              ))}
            </div>

            <select
              className="comm-client-select"
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
              aria-label="Filtrar por cliente"
            >
              <option value="">Todos los clientes ({data.clients.length})</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="cl">
            {filtradas.length === 0 ? (
              <EmptyState icono="message" titulo="Sin conversaciones" texto="Prueba ajustando la búsqueda o los filtros." />
            ) : (
              filtradas.map((c) => {
                const ultimo = c.mensajes[c.mensajes.length - 1]
                const esActiva = actual?.id === c.id
                const infoCanal = CANALES[c.canal] || CANALES.wa
                const pendiente = c.estado === 'Pendiente de respuesta' || c.estado === 'Abierto'
                return (
                  <div
                    key={c.id}
                    className={`cv ${esActiva ? 'on' : ''}`}
                    onClick={() => setSeleccionadaId(c.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSeleccionadaId(c.id) } }}
                    role="button"
                    tabIndex={0}
                    aria-current={esActiva ? 'true' : undefined}
                  >
                    <div className="cv-top">
                      <span className={`chic ${c.canal}`} title={infoCanal.nombre}>
                        <Icon nombre={infoCanal.icono} tamano={14} />
                      </span>
                      <strong className="ell">{c.cliente}</strong>
                      <span className="cv-time">{ultimo?.hora}</span>
                    </div>
                    <p className="cv-snippet">{ultimo?.texto}</p>
                    <div className="cv-badges">
                      {c.ordenId && <span className="comm-order-tag">{c.ordenId}</span>}
                      <span className={`comm-state-dot ${pendiente ? 'is-pending' : 'is-closed'}`}>
                        {c.estado}
                      </span>
                      <span className="cv-user" title={`Responsable: ${c.responsable}`}>
                        {c.responsable.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* 2. Panel central protagonista: conversación activa y compositor integrado */}
        {actual ? (
          <section className="comm-main" aria-label={`Conversación con ${actual.cliente}`}>
            <header className="cht cht-border">
              <div className="cht-meta">
                <span className={`chic chic-lg ${actual.canal}`}>
                  <Icon nombre={(CANALES[actual.canal] || CANALES.wa).icono} tamano={18} />
                </span>
                <div>
                  <div className="cht-title-row">
                    <h3>{actual.cliente}</h3>
                    <span className="comm-id-tag">{actual.id}</span>
                  </div>
                  <div className="cht-sub">
                    <span>{(CANALES[actual.canal] || CANALES.wa).nombre}</span>
                    <span className="cht-sep">·</span>
                    <span>Atendido por <strong>{actual.responsable}</strong></span>
                  </div>
                </div>
              </div>
              <div className="cht-actions">
                <StatusBadge estado={actual.estado} />
              </div>
            </header>

            {ordenAsociada && (
              <div className="comm-order-banner">
                <div className="comm-order-banner-info">
                  <Icon nombre="clipboard" tamano={14} />
                  <span>Orden vinculada:</span>
                  <button className="link-inline" onClick={() => irA('detalle', ordenAsociada.id)}>
                    {ordenAsociada.id} · {ordenAsociada.producto}
                  </button>
                  <span className="comm-banner-stage">{ordenAsociada.estado}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => irA('detalle', ordenAsociada.id)}>
                  Ver orden <Icon nombre="arrow-right" tamano={13} />
                </button>
              </div>
            )}

            {/* Hilo de mensajes */}
            <div className="thr" id="thr">
              {actual.mensajes.map((m, idx) => {
                if (m.llamadaMinutos) {
                  return (
                    <div key={idx} className="callc">
                      <div className="callc-head">
                        <span className="chic call"><Icon nombre="phone" tamano={14} /></span>
                        <strong>Llamada registrada</strong>
                        <span className="pill">{m.llamadaMinutos}</span>
                        <span className="callc-time">{m.fecha} · {m.hora}</span>
                      </div>
                      <p className="callc-body">{m.texto}</p>
                    </div>
                  )
                }

                const esMio = m.de === 'usuario'
                return (
                  <div key={idx} className={`bub ${esMio ? 'me' : ''}`}>
                    <div className="bub-head">
                      <strong>{esMio ? actual.responsable : actual.cliente}</strong>
                      <span>{m.fecha} · {m.hora}</span>
                    </div>
                    <div className="bub-text">{m.texto}</div>
                    {m.adjuntos && m.adjuntos.length > 0 && (
                      <div className="bub-att">
                        {m.adjuntos.map((a, i) => (
                          <span key={i} className="bub-file">
                            <Icon nombre="file-text" tamano={13} /> {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Compositor de respuesta unificado */}
            <form onSubmit={handleEnviar} className="comm-reply-box">
              <div className="comm-composer">
                <textarea
                  placeholder={`Responder a ${actual.cliente} por ${(CANALES[actual.canal] || CANALES.wa).corto}...`}
                  value={textoRespuesta}
                  onChange={(e) => setTextoRespuesta(e.target.value)}
                  rows={2}
                />
                <div className="comm-reply-actions">
                  <span className="comm-trace-note">
                    <Icon nombre={(CANALES[actual.canal] || CANALES.wa).icono} tamano={13} />
                    <span>{(CANALES[actual.canal] || CANALES.wa).nombre} · Trazabilidad unificada</span>
                  </span>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!textoRespuesta.trim()}>
                    <Icon nombre="send" tamano={14} /> Enviar
                  </button>
                </div>
              </div>
            </form>
          </section>
        ) : (
          <section className="comm-main comm-empty">
            <EmptyState icono="message" titulo="Selecciona una conversación" texto="Elige un hilo de la izquierda para consultar los mensajes y responder." />
          </section>
        )}

        {/* 3. Panel contextual derecho: Ficha limpia de cliente y orden */}
        {actual && (
          <aside className="comm-context" aria-label="Contexto del cliente y la orden">
            <div className="comm-context-section">
              <span className="comm-context-label">Cliente</span>
              <div className="comm-client-head">
                <Avatar nombre={actual.cliente} tamano="md" />
                <div>
                  <strong>{actual.cliente}</strong>
                  <small>{clienteInfo?.ciudad || 'Cliente corporativo'}</small>
                </div>
              </div>
              {clienteInfo && (
                <dl className="comm-meta-list">
                  <div><dt>Contacto</dt><dd>{clienteInfo.contacto}</dd></div>
                  <div><dt>Correo</dt><dd>{clienteInfo.correo}</dd></div>
                  <div><dt>Teléfono</dt><dd>{clienteInfo.telefono}</dd></div>
                </dl>
              )}
            </div>

            {solicitudesCliente.length > 0 && (
              <div className="comm-context-section">
                <span className="comm-context-label">Solicitudes comerciales ({solicitudesCliente.length})</span>
                <div className="comm-mini-list">
                  {solicitudesCliente.slice(0, 3).map((r) => (
                    <button key={r.id} className="comm-mini-order" onClick={() => irA('solicitudes')}>
                      <div>
                        <strong>{r.id}</strong>
                        <small>{r.producto || r.tipo}</small>
                      </div>
                      <StatusBadge estado={r.estado} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ordenAsociada ? (
              <div className="comm-context-section">
                <div className="comm-section-head">
                  <span className="comm-context-label">Orden vinculada</span>
                  <StatusBadge estado={ordenAsociada.estado} />
                </div>

                <div className="comm-order-summary">
                  <span className="order-id">{ordenAsociada.id}</span>
                  <strong className="comm-order-title">{ordenAsociada.producto}</strong>
                  <span className="sm mut">{ordenAsociada.cantidad} uds · {ordenAsociada.dimensiones}</span>

                  <div className="comm-progress-wrap">
                    <ProgressBar valor={progreso(ordenAsociada)} />
                  </div>

                  <dl className="comm-meta-list">
                    <div><dt>Entrega</dt><dd>{ordenAsociada.fechaEntrega}</dd></div>
                    <div><dt>Plazo</dt><dd>{textoPlazo(ordenAsociada)}</dd></div>
                    <div><dt>Estado de arte</dt><dd>{ordenAsociada.disenoEstado}</dd></div>
                  </dl>

                  <div className="comm-order-actions">
                    <button className="btn btn-soft btn-sm" onClick={() => irA('detalle', ordenAsociada.id)}>
                      <Icon nombre="clipboard" tamano={14} /> Abrir expediente
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => irA('aprobacion', ordenAsociada.id)}>
                      <Icon nombre="pen" tamano={14} /> Mesa de diseño
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="comm-context-section">
                <span className="comm-context-label">Pedidos del cliente ({ordenesCliente.length})</span>
                {ordenesCliente.length === 0 ? (
                  <p className="sm mut">Sin órdenes activas registradas.</p>
                ) : (
                  <div className="comm-mini-list">
                    {ordenesCliente.slice(0, 3).map((o) => (
                      <button key={o.id} className="comm-mini-order" onClick={() => irA('detalle', o.id)}>
                        <div>
                          <strong>{o.id}</strong>
                          <small>{o.producto}</small>
                        </div>
                        <StatusBadge estado={o.estado} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
