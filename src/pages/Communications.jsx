import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { formatearFecha, formatearHora } from '../utils/format.js'

const CANALES = {
  wa: { nombre: 'WhatsApp', icono: 'message' },
  mail: { nombre: 'Correo electrónico', icono: 'send' },
  call: { nombre: 'Telefonía', icono: 'activity' },
}

export default function Communications({ data, actions, irA, role }) {
  const [canalFiltro, setCanalFiltro] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [seleccionadaId, setSeleccionadaId] = useState('COM-001')
  const [textoRespuesta, setTextoRespuesta] = useState('')

  const comms = data.comms || []
  const filtradas = comms.filter((c) => {
    if (canalFiltro && c.canal !== canalFiltro) return false
    if (clienteFiltro && c.clienteId !== clienteFiltro) return false
    return true
  })

  const actual = comms.find((c) => c.id === seleccionadaId) || filtradas[0] || null
  const ordenAsociada = actual?.ordenId ? data.orders.find((o) => o.id === actual.ordenId) : null

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
        titulo="Bandeja de comunicaciones"
        subtitulo="WhatsApp, correo y telefonía centralizados y vinculados a cada cliente y orden."
        icono="message"
      />

      {/* Tira gráfica de integraciones y webhooks inspirada en el sistema de preprensa */}
      <div className="intstrip">
        <span className="intstrip-title">Canales sincronizados:</span>
        <div className="intstrip-chips">
          <span className="chp"><span className="chp-dot" /> WhatsApp Business API</span>
          <span className="chp"><span className="chp-dot" /> Servidor de correo IMAP/SMTP</span>
          <span className="chp"><span className="chp-dot" /> Central telefónica VoIP</span>
        </div>
        <span className="arr">→</span>
        <span className="hub">Webhooks & Cola de eventos</span>
        <span className="arr">→</span>
        <span className="hub mn">Bandeja ORVEX</span>
      </div>

      {/* Filtros */}
      <div className="filters">
        <select
          value={canalFiltro}
          onChange={(e) => setCanalFiltro(e.target.value)}
          aria-label="Filtrar por canal"
        >
          <option value="">Todos los canales</option>
          <option value="wa">WhatsApp</option>
          <option value="mail">Correo electrónico</option>
          <option value="call">Telefonía</option>
        </select>

        <select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          aria-label="Filtrar por cliente"
        >
          <option value="">Todos los clientes</option>
          {data.clients.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <div className="cm">
        {/* Columna de conversaciones */}
        <div className="card fl cl">
          {filtradas.length === 0 ? (
            <EmptyState icono="message" titulo="No hay conversaciones" texto="Prueba ajustando los filtros." />
          ) : (
            filtradas.map((c) => {
              const ultimo = c.mensajes[c.mensajes.length - 1]
              const esActiva = actual?.id === c.id
              return (
                <div
                  key={c.id}
                  className={`cv ${esActiva ? 'on' : ''}`}
                  onClick={() => setSeleccionadaId(c.id)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cv-top">
                    <span className={`chic ${c.canal}`}>
                      <Icon nombre={CANALES[c.canal].icono} tamano={15} />
                    </span>
                    <strong className="ell">{c.cliente}</strong>
                    <span className="sm mut nw">{ultimo?.hora}</span>
                  </div>
                  <p className="sm ell cv-snippet">{ultimo?.texto}</p>
                  <div className="cv-badges">
                    {c.ordenId && <span className="pill">{c.ordenId}</span>}
                    <StatusBadge estado={c.estado} />
                    <span className="cv-user"><Avatar nombre={c.responsable} tamano="xs" /></span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Panel derecho del hilo de conversación */}
        {actual ? (
          <div className="card fl">
            <div className="cht cht-border">
              <div className="cht-meta">
                <span className={`chic ${actual.canal}`}>
                  <Icon nombre={CANALES[actual.canal].icono} tamano={18} />
                </span>
                <div>
                  <h3>{actual.cliente}</h3>
                  <div className="sm mut">
                    Canal: {CANALES[actual.canal].nombre} · Responsable: {actual.responsable}
                  </div>
                </div>
              </div>
              <StatusBadge estado={actual.estado} />
            </div>

            {ordenAsociada && (
              <div className="comm-order-banner">
                <div>
                  <strong>Orden vinculada: </strong>
                  <button className="link-inline" onClick={() => irA('detalle', ordenAsociada.id)}>
                    {ordenAsociada.id} · {ordenAsociada.producto}
                  </button>
                  <span className="sm mut"> (Etapa: {ordenAsociada.estado})</span>
                </div>
                <button className="btn btn-sm" onClick={() => irA('detalle', ordenAsociada.id)}>
                  Ver orden <Icon nombre="arrow-right" tamano={12} />
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
                        <Icon nombre="activity" tamano={16} />
                        <strong>Registro de llamada ({m.llamadaMinutos})</strong>
                        <span className="sm mut">{m.fecha} {m.hora}</span>
                      </div>
                      <div className="sm">{m.texto}</div>
                    </div>
                  )
                }

                const esMio = m.de === 'usuario'
                return (
                  <div key={idx} className={`bub ${esMio ? 'me' : ''}`}>
                    <div className="bub-text">{m.texto}</div>
                    {m.adjuntos && (
                      <div className="bub-att">
                        {m.adjuntos.map((a, i) => (
                          <span key={i} className="pill">
                            <Icon nombre="file-text" tamano={12} /> {a}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="bt">
                      {esMio ? actual.responsable : actual.cliente} · {m.fecha} {m.hora}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Cuadro de respuesta */}
            <form onSubmit={handleEnviar} className="comm-reply-box">
              <textarea
                placeholder={`Responder a ${actual.cliente} por ${CANALES[actual.canal].nombre}...`}
                value={textoRespuesta}
                onChange={(e) => setTextoRespuesta(e.target.value)}
                rows={3}
              />
              <div className="comm-reply-actions">
                <span className="sm mut">La respuesta quedará registrada en el historial del cliente y la orden.</span>
                <button type="submit" className="btn btn-primary" disabled={!textoRespuesta.trim()}>
                  <Icon nombre="send" tamano={15} /> Enviar mensaje
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card p">
            <EmptyState icono="message" titulo="Selecciona una conversación" texto="Elige un canal para ver el historial de mensajes." />
          </div>
        )}
      </div>
    </div>
  )
}
