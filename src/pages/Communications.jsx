import { useState, useEffect, useRef } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { formatearFecha, formatearHora, progreso, textoPlazo } from '../utils/format.js'
import { api } from '../services/api.js'

const CANALES = {
  wa: { nombre: 'WhatsApp', corto: 'WhatsApp', icono: 'message-circle' },
  mail: { nombre: 'Correo electrónico', corto: 'Correo', icono: 'mail' },
  call: { nombre: 'Llamada telefónica', corto: 'Llamadas', icono: 'phone' },
}

const FILTROS_CANAL = [
  ['', 'Todos', null],
  ['wa', 'WhatsApp', 'message-circle'],
  ['mail', 'Correo', 'mail'],
  ['call', 'Llamadas', 'phone'],
]

export default function Communications({ data, actions, irA, role }) {
  const [canalFiltro, setCanalFiltro] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionadaId, setSeleccionadaId] = useState('COM-001')
  const [textoRespuesta, setTextoRespuesta] = useState('')
  const [esAcuerdo, setEsAcuerdo] = useState(false)
  const [estadoGmail, setEstadoGmail] = useState({ conectado: false, email: null, diasRestantes: 0, requiereReautorizacion: false })
  const [estadoWhatsApp, setEstadoWhatsApp] = useState({ conectado: false, numeroOficial: '+57 311 608 8542' })
  const [enviandoMensaje, setEnviandoMensaje] = useState(false)
  const [reintentandoId, setReintentandoId] = useState(null)
  const [modalNuevoCorreo, setModalNuevoCorreo] = useState(false)
  const [formNuevoCorreo, setFormNuevoCorreo] = useState({ destinatario: '', asunto: '', texto: '', esAcuerdo: false })
  const [enviandoNuevoCorreo, setEnviandoNuevoCorreo] = useState(false)
  const [modalNuevoWhatsApp, setModalNuevoWhatsApp] = useState(false)
  const [formNuevoWhatsApp, setFormNuevoWhatsApp] = useState({ destinatario: '', asunto: '', texto: '', esAcuerdo: false })
  const [enviandoNuevoWhatsApp, setEnviandoNuevoWhatsApp] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  // Comercial administra conversaciones y acuerdos comerciales; Postventa gestiona respuestas de atención post-entrega.
  // Coordinación y Gerencia consultan el historial unificado de comunicaciones y acuerdos en modo supervisión.
  const puedeAdministrarConversacion = role === 'comercial' || role === 'postventa'

  const comms = data.comms || []
  const q = busqueda.trim().toLowerCase()

  // Enriquecer cada hilo con su contexto único (Cliente -> Solicitud -> Orden) sin duplicar conversaciones
  const commsEnriquecidas = comms.map((c) => {
    const ordenVinculada = c.ordenId ? data.orders.find((o) => o.id === c.ordenId) : null
    const solicitudVinculada =
      (c.solicitudId && (data.requests || []).find((r) => r.id === c.solicitudId)) ||
      (ordenVinculada?.solicitudId && (data.requests || []).find((r) => r.id === ordenVinculada.solicitudId)) ||
      (c.ordenId && (data.requests || []).find((r) => r.ordenId === c.ordenId)) ||
      (data.requests || []).find((r) => r.clienteId === c.clienteId || r.cliente === c.cliente) ||
      null

    return {
      ...c,
      solicitudId: c.solicitudId || solicitudVinculada?.id || ordenVinculada?.solicitudId || '',
      ordenAsociada: ordenVinculada,
      solicitudAsociada: solicitudVinculada,
    }
  })

  const filtradas = commsEnriquecidas.filter((c) => {
    if (canalFiltro && c.canal !== canalFiltro) return false
    if (clienteFiltro && c.clienteId !== clienteFiltro) return false
    if (q) {
      const ultimoTexto = c.mensajes[c.mensajes.length - 1]?.texto || ''
      const textoBuscable = `${c.id} ${c.cliente} ${c.solicitudId || ''} ${c.ordenId || ''} ${c.responsable} ${ultimoTexto}`.toLowerCase()
      if (!textoBuscable.includes(q)) return false
    }
    return true
  })

  // REGLA: Ordenar estrictamente de mayor a menor según la fecha y hora del último mensaje recibido o enviado
  const ordenadas = [...filtradas].sort((a, b) => {
    const obtenerTimestamp = (hilo) => {
      if (hilo.ultimaActividadTs) return hilo.ultimaActividadTs
      const ultMsg = hilo.mensajes?.[hilo.mensajes.length - 1]
      if (ultMsg?.marca_tiempo) return new Date(ultMsg.marca_tiempo).getTime()
      return hilo.created_at ? new Date(hilo.created_at).getTime() : 0
    }
    return obtenerTimestamp(b) - obtenerTimestamp(a)
  })

  const actual =
    ordenadas.find((c) => c.id === seleccionadaId) ||
    commsEnriquecidas.find((c) => c.id === seleccionadaId) ||
    ordenadas[0] ||
    null
  const clienteInfo = actual ? data.clients.find((cl) => cl.id === actual.clienteId || cl.nombre === actual.cliente) : null
  const ordenAsociada = actual?.ordenAsociada || null
  const ordenesCliente = actual
    ? data.orders.filter((o) => o.clienteId === actual.clienteId || o.cliente === actual.cliente)
    : []
  const solicitudesCliente = actual
    ? (data.requests || []).filter((r) => r.clienteId === actual.clienteId || r.cliente === actual.cliente)
    : []

  useEffect(() => {
    cargarEstadoGmail()
    cargarEstadoWhatsApp()

    // Detectar retorno de Google OAuth desde la URL (proceso administrativo completado)
    try {
      const urlParams = new URLSearchParams(window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''))
      const paramGmail = urlParams.get('gmail')
      if (paramGmail === 'conectado') {
        const email = urlParams.get('email') || 'huellaspublicidad23@gmail.com'
        actions.notify?.(`✅ Integración de Gmail corporativo (${email}) verificada y activa.`)
        limpiarParametrosUrl()
        cargarEstadoGmail()
      } else if (paramGmail === 'error') {
        const motivo = urlParams.get('motivo') || 'Error en la autorización de Google.'
        actions.notify?.(`❌ Error al vincular Gmail: ${motivo}`, 'error')
        limpiarParametrosUrl()
      } else if (paramGmail === 'cancelado') {
        limpiarParametrosUrl()
      }
    } catch (_) {}
  }, [])

  function limpiarParametrosUrl() {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('gmail')
      url.searchParams.delete('email')
      url.searchParams.delete('motivo')
      const nuevoHash = url.hash.includes('?') ? url.hash.split('?')[0] : url.hash
      window.history.replaceState({}, document.title, url.pathname + nuevoHash)
    } catch (_) {}
  }

  function cargarEstadoGmail() {
    api.obtenerEstadoGmail()
      .then((res) => {
        if (res) setEstadoGmail(res)
      })
      .catch((err) => {
        console.warn('[Communications] No se pudo consultar estado de Gmail:', err.message)
      })
  }

  function cargarEstadoWhatsApp() {
    api.obtenerEstadoWhatsApp?.()
      .then((res) => {
        if (res?.data) setEstadoWhatsApp(res.data)
      })
      .catch(() => {})
  }

  // Control de scroll y posición de lectura en el hilo de mensajes
  const thrRef = useRef(null)
  const scrolledUpRef = useRef(false)
  const prevMensajesLengthRef = useRef(0)
  const ultimaVersionRef = useRef('')

  function handleScroll(e) {
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    // Si la distancia al fondo es mayor a 75px, el usuario subió intencionalmente a leer historial
    scrolledUpRef.current = distanceFromBottom > 75
  }

  // Auto-scroll al final SOLO si el usuario no ha scrolleado hacia arriba
  useEffect(() => {
    const el = thrRef.current
    if (!el) return

    const mensajesActuales = actual?.mensajes || []
    const countActual = mensajesActuales.length
    const hayNuevoMensaje = countActual > prevMensajesLengthRef.current
    prevMensajesLengthRef.current = countActual

    // Si cambió de conversación o hay nuevos mensajes sin estar leyendo arriba, desplazar al fondo
    if (!scrolledUpRef.current || !hayNuevoMensaje) {
      el.scrollTop = el.scrollHeight
    }
  }, [actual?.id, actual?.mensajes?.length])

  // Actualización automática en tiempo real: SSE con reconexión activa y verificación periódica (3.5s)
  useEffect(() => {
    let evtSource = null
    let reconnectTimer = null
    let fallbackTimer = null
    let activo = true

    function verificarNovedades() {
      if (!activo) return
      api.obtenerRevisionComunicaciones()
        .then((rev) => {
          if (!rev?.version) return
          if (ultimaVersionRef.current && rev.version !== ultimaVersionRef.current) {
            actions.syncCommsSilently?.()
          }
          ultimaVersionRef.current = rev.version
        })
        .catch(() => {})
    }

    // Primer chequeo inmediato de novedades
    verificarNovedades()

    // Conexión Server-Sent Events (SSE) resiliente con reconexión automática
    function conectarSSE() {
      if (!activo) return
      if (evtSource) {
        try { evtSource.close() } catch (_) {}
        evtSource = null
      }

      try {
        const token = api.getAuthToken?.() || ''
        const baseUrl = api.API_URL || '/api'
        const sseUrl = `${baseUrl}/comunicaciones/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`

        evtSource = new EventSource(sseUrl, { withCredentials: true })

        evtSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (data.tipo !== 'conectado') {
              actions.syncCommsSilently?.()
            }
          } catch (_) {
            actions.syncCommsSilently?.()
          }
        }

        evtSource.onerror = () => {
          try { evtSource.close() } catch (_) {}
          evtSource = null
          if (!reconnectTimer && activo) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null
              conectarSSE()
            }, 3000)
          }
        }
      } catch (_) {
        if (!reconnectTimer && activo) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            conectarSSE()
          }, 4000)
        }
      }
    }

    conectarSSE()

    // Sondeo de respaldo cada 3.5 segundos (consulta ultraligera)
    fallbackTimer = setInterval(verificarNovedades, 3500)

    return () => {
      activo = false
      if (evtSource) {
        try { evtSource.close() } catch (_) {}
      }
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (fallbackTimer) clearInterval(fallbackTimer)
    }
  }, [])

  // Al abrir una conversación que tenga mensajes no leídos, marcarlos como leídos automáticamente
  useEffect(() => {
    if (actual?.id && actual.tieneNoLeidos) {
      actions.markCommAsRead?.(actual.id)
    }
  }, [actual?.id, actual?.tieneNoLeidos])

  function handleSeleccionarConversacion(id) {
    if (id === seleccionadaId) return
    setSeleccionadaId(id)
    scrolledUpRef.current = false
    prevMensajesLengthRef.current = 0
    actions.markCommAsRead?.(id)
  }

  function handleSincronizarManual() {
    if (sincronizando) return
    setSincronizando(true)
    actions.syncComms?.()
      .then((res) => {
        setSincronizando(false)
        if (res?.nuevos > 0) {
          actions.notify?.(`Sincronización completada: ${res.nuevos} nuevo(s) correo(s) recibido(s).`, 'exito')
        } else {
          actions.notify?.('Bandeja de correo actualizada.')
        }
      })
      .catch(() => {
        setSincronizando(false)
      })
  }

  function handleEnviarNuevoCorreo(e) {
    e.preventDefault()
    if (
      enviandoNuevoCorreo ||
      !formNuevoCorreo.destinatario.trim() ||
      !formNuevoCorreo.asunto.trim() ||
      !formNuevoCorreo.texto.trim()
    ) {
      return
    }

    setEnviandoNuevoCorreo(true)
    actions
      .sendNewEmail({
        destinatario: formNuevoCorreo.destinatario.trim(),
        asunto: formNuevoCorreo.asunto.trim(),
        texto: formNuevoCorreo.texto.trim(),
        esAcuerdo: formNuevoCorreo.esAcuerdo,
      })
      .then((res) => {
        setEnviandoNuevoCorreo(false)
        setModalNuevoCorreo(false)
        setFormNuevoCorreo({ destinatario: '', asunto: '', texto: '', esAcuerdo: false })
        if (res?.data?.id) {
          setSeleccionadaId(res.data.id)
        }
      })
      .catch(() => {
        setEnviandoNuevoCorreo(false)
      })
  }

  function handleEnviarNuevoWhatsApp(e) {
    e.preventDefault()
    if (
      enviandoNuevoWhatsApp ||
      !formNuevoWhatsApp.destinatario.trim() ||
      !formNuevoWhatsApp.texto.trim()
    ) {
      return
    }

    setEnviandoNuevoWhatsApp(true)
    actions
      .sendNewWhatsApp({
        destinatario: formNuevoWhatsApp.destinatario.trim(),
        asunto: formNuevoWhatsApp.asunto.trim(),
        texto: formNuevoWhatsApp.texto.trim(),
        esAcuerdo: formNuevoWhatsApp.esAcuerdo,
      })
      .then((res) => {
        setEnviandoNuevoWhatsApp(false)
        setModalNuevoWhatsApp(false)
        setFormNuevoWhatsApp({ destinatario: '', asunto: '', texto: '', esAcuerdo: false })
        if (res?.data?.id) {
          setSeleccionadaId(res.data.id)
        }
      })
      .catch(() => {
        setEnviandoNuevoWhatsApp(false)
      })
  }

  function handleReintentarEnvio(mensajeId) {
    if (!actual?.id || !mensajeId) return
    setReintentandoId(mensajeId)
    actions.retryCommMessage(actual.id, mensajeId)
      .then(() => {
        setReintentandoId(null)
      })
      .catch(() => {
        setReintentandoId(null)
      })
  }

  function handleEnviar(e) {
    e.preventDefault()
    if (!puedeAdministrarConversacion || !textoRespuesta.trim() || !actual || enviandoMensaje) return

    const textoLimpio = textoRespuesta.trim()
    const textoFinal = esAcuerdo && !/^\[acuerdo\]/i.test(textoLimpio) ? `[Acuerdo] ${textoLimpio}` : textoLimpio

    const nuevoMensaje = {
      de: 'usuario',
      texto: textoFinal,
      esAcuerdo,
      fecha: formatearFecha(),
      hora: formatearHora(),
    }

    setEnviandoMensaje(true)
    actions.sendCommMessage(actual.id, nuevoMensaje)
      .then(() => {
        setTextoRespuesta('')
        setEsAcuerdo(false)
        setEnviandoMensaje(false)
      })
      .catch(() => {
        setEnviandoMensaje(false)
      })
  }

  return (
    <div>
      <PageHeader
        titulo="Centro de Comunicaciones"
        subtitulo="Historial único por contexto vinculado a Cliente, Solicitud Comercial y Orden de Producción."
        icono="message"
        acciones={
          <div className="comm-status-bar" aria-label="Canales de atención" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <span className="comm-status-pill">
              <span className="chp-dot" />
              WhatsApp · Correo · Llamadas
            </span>

            {/* Canal de correo corporativo centralizado (Sin controles de usuario; gestionado centralmente) */}
            {estadoGmail.conectado && !estadoGmail.requiereReautorizacion ? (
              <span
                className="badge badge-verde"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}
                title={`Canal de correo corporativo activo y centralizado: ${estadoGmail.email}`}
              >
                <span className="chp-dot" style={{ background: 'var(--state-green)' }} />
                <span>Correo: <strong>{estadoGmail.email}</strong></span>
              </span>
            ) : (
              <span
                className="badge badge-gris"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}
                title="Canal de correo corporativo no disponible. Consulte con el Administrador de Sistemas."
              >
                <span className="chp-dot" style={{ background: 'var(--state-amber)' }} />
                <span>Correo: <em>No disponible</em></span>
              </span>
            )}

            {/* Canal oficial de WhatsApp Cloud API */}
            {estadoWhatsApp.conectado ? (
              <span
                className="badge badge-verde"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}
                title={`WhatsApp Cloud API conectado con número oficial: ${estadoWhatsApp.numeroOficial}`}
              >
                <span className="chp-dot" style={{ background: 'var(--state-green)' }} />
                <span>WhatsApp: <strong>{estadoWhatsApp.numeroOficial}</strong></span>
              </span>
            ) : (
              <span
                className="badge badge-gris"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px' }}
                title={`WhatsApp Cloud API: Número oficial registrado ${estadoWhatsApp.numeroOficial}. Pendiente de credenciales activas en variables de entorno.`}
              >
                <span className="chp-dot" style={{ background: 'var(--state-amber)' }} />
                <span>WhatsApp: <strong>{estadoWhatsApp.numeroOficial}</strong> <em>(Pendiente credenciales)</em></span>
              </span>
            )}

            <span className="comm-count-tag">{comms.length} hilos</span>
          </div>
        }
      />

      {/* Espacio de mensajería en 3 paneles equilibrados: Lista · Conversación · Contexto unificado */}
      <div className="cm">
        {/* 1. Panel izquierdo: búsqueda, filtros rápidos y lista de conversaciones */}
        <aside className="comm-sidebar" aria-label="Lista de conversaciones">
          <div className="comm-filters">
            {puedeAdministrarConversacion && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, minWidth: '115px', justifyContent: 'center' }}
                  onClick={() => setModalNuevoCorreo(true)}
                  disabled={!estadoGmail.conectado || estadoGmail.requiereReautorizacion}
                  title={
                    !estadoGmail.conectado
                      ? 'Gmail corporativo no está conectado'
                      : estadoGmail.requiereReautorizacion
                      ? 'Gmail corporativo requiere re-autorización'
                      : 'Redactar y enviar nuevo correo electrónico corporativo'
                  }
                >
                  <Icon nombre="mail" tamano={14} />
                  <span>Nuevo correo</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    minWidth: '115px',
                    justifyContent: 'center',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                  }}
                  onClick={() => setModalNuevoWhatsApp(true)}
                  title="Enviar nuevo mensaje de WhatsApp a un cliente"
                >
                  <Icon nombre="message-circle" tamano={14} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Sincronizar correos recibidos ahora"
                  onClick={handleSincronizarManual}
                  disabled={sincronizando}
                >
                  <Icon nombre="rotate-cw" tamano={14} className={sincronizando ? 'spin' : ''} />
                </button>
              </div>
            )}

            <label className="search-box comm-search">
              <Icon nombre="search" tamano={15} />
              <input
                type="search"
                placeholder="Buscar cliente, solicitud, orden o mensaje..."
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
            {ordenadas.length === 0 ? (
              <EmptyState icono="message" titulo="Sin conversaciones" texto="Prueba ajustando la búsqueda o los filtros." />
            ) : (
              ordenadas.map((c) => {
                const ultimo = c.mensajes[c.mensajes.length - 1]
                const esActiva = actual?.id === c.id
                const infoCanal = CANALES[c.canal] || CANALES.wa
                const pendiente = c.estado === 'Pendiente de respuesta' || c.estado === 'Abierto'
                const tieneNoLeidos = Boolean(c.tieneNoLeidos || (c.noLeidos && c.noLeidos > 0))

                return (
                  <div
                    key={c.id}
                    className={`cv ${esActiva ? 'on' : ''} ${tieneNoLeidos ? 'is-unread' : ''}`}
                    style={
                      tieneNoLeidos
                        ? {
                            borderLeft: esActiva ? '3px solid var(--accent-blue)' : '3px solid var(--state-amber)',
                          }
                        : {}
                    }
                    onClick={() => handleSeleccionarConversacion(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSeleccionarConversacion(c.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-current={esActiva ? 'true' : undefined}
                  >
                    <div className="cv-top">
                      <span className={`chic ${c.canal}`} title={infoCanal.nombre}>
                        <Icon nombre={infoCanal.icono} tamano={14} />
                      </span>
                      <div className="ell" style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong className="ell" style={tieneNoLeidos ? { fontWeight: 700, color: 'var(--text-primary)' } : {}}>
                          {c.cliente}
                        </strong>
                        {c.canal === 'wa' && c.telefono && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                            {c.telefono}
                          </span>
                        )}
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="cv-time">{ultimo?.hora}</span>
                        {tieneNoLeidos && (
                          <span
                            className="badge badge-primary xs"
                            style={{
                              borderRadius: '10px',
                              padding: '1px 6px',
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              background: 'var(--state-amber)',
                              color: '#1a1a1a',
                            }}
                            title={`${c.noLeidos || 1} mensaje(s) nuevo(s) sin leer`}
                          >
                            {c.noLeidos || '•'}
                          </span>
                        )}
                      </div>
                    </div>
                    <p
                      className="cv-snippet"
                      style={tieneNoLeidos ? { fontWeight: 600, color: 'var(--text-primary)' } : {}}
                    >
                      {ultimo?.texto}
                    </p>
                    <div className="cv-badges">
                      {c.solicitudId && <span className="comm-order-tag" title="Solicitud comercial vinculada">{c.solicitudId}</span>}
                      {c.ordenId && <span className="comm-order-tag" title="Orden de producción vinculada">{c.ordenId}</span>}
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

        {/* 2. Panel central: conversación activa y registro/consulta según rol */}
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
                  <div className="cht-sub" style={{ flexWrap: 'wrap', gap: '4px 8px' }}>
                    <span>Canal: {(CANALES[actual.canal] || CANALES.wa).nombre}</span>
                    <span className="cht-sep">·</span>
                    {actual.canal === 'wa' && (actual.telefono || clienteInfo?.telefono) && (
                      <>
                        <span>Teléfono: <strong>{actual.telefono || clienteInfo?.telefono}</strong></span>
                        <span className="cht-sep">·</span>
                      </>
                    )}
                    <span>Responsable comercial: <strong>{actual.responsable}</strong></span>
                  </div>
                </div>
              </div>
              <div className="cht-actions">
                <StatusBadge estado={actual.estado} />
              </div>
            </header>

            {/* Barra de contexto unificado: Cliente -> Solicitud -> Orden de Producción */}
            <div className="comm-order-banner">
              <div className="comm-order-banner-info" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <Icon nombre="layers" tamano={14} />
                <span>Contexto del hilo:</span>
                <strong>{actual.cliente}</strong>
                {actual.solicitudId && (
                  <>
                    <span className="mut">→</span>
                    <button className="link-inline" onClick={() => irA('solicitudes')}>
                      Solicitud {actual.solicitudId}
                    </button>
                  </>
                )}
                {ordenAsociada && (
                  <>
                    <span className="mut">→</span>
                    <button className="link-inline" onClick={() => irA('detalle', ordenAsociada.id)}>
                      Orden {ordenAsociada.id} ({ordenAsociada.producto})
                    </button>
                    <span className="comm-banner-stage">{ordenAsociada.estado}</span>
                  </>
                )}
              </div>
              {ordenAsociada && (
                <button className="btn btn-ghost btn-sm" onClick={() => irA('detalle', ordenAsociada.id)}>
                  Ver orden <Icon nombre="arrow-right" tamano={13} />
                </button>
              )}
            </div>

            {/* Aviso de ventana de atención de 24h de WhatsApp */}
            {actual.canal === 'wa' && actual.ventana24hExpirada && (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderLeft: '4px solid var(--state-amber)',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  margin: '6px 16px 0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Icon nombre="clock" tamano={14} style={{ color: 'var(--state-amber)', flexShrink: 0 }} />
                <span>
                  <strong>Ventana de 24 horas:</strong> Han pasado más de 24h desde el último mensaje del cliente. Si Meta rechaza el mensaje libre, se deberá utilizar una plantilla pre-aprobada para reactivar la conversación.
                </span>
              </div>
            )}

            {/* Hilo de mensajes */}
            <div className="thr" id="thr" ref={thrRef} onScroll={handleScroll}>
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
                const esNotaAcuerdo = m.esAcuerdo || /^\[acuerdo\]/i.test(m.texto || '')
                const esNoLeido = !esMio && m.leido === false
                return (
                  <div key={idx} className={`bub ${esMio ? 'me' : ''} ${esNoLeido ? 'bub-unread' : ''}`}>
                    <div className="bub-head">
                      <strong>{esMio ? (m.remitente || actual.responsable) : actual.cliente}</strong>
                      <div className="row" style={{ gap: '6px', alignItems: 'center' }}>
                        <span>{m.fecha} · {m.hora}</span>
                        {esNoLeido && (
                          <span
                            className="badge badge-amber xs"
                            style={{ fontSize: '0.68rem', padding: '1px 5px', fontWeight: 600 }}
                            title="Mensaje recibido sin leer"
                          >
                            Nuevo
                          </span>
                        )}
                        {/* Indicadores de estado de entrega de WhatsApp */}
                        {actual.canal === 'wa' && esMio && (
                          <>
                            {m.estadoEnvio === 'enviando' && (
                              <span className="badge badge-amber xs" title="Enviando a Meta WhatsApp Cloud API...">
                                <Icon nombre="clock" tamano={11} /> Enviando...
                              </span>
                            )}
                            {(m.estadoEnvio === 'enviado' || m.estadoEnvio === 'enviado_local') && (
                              <span className="badge badge-verde xs" title={`Enviado por WhatsApp (${m.whatsappMessageId || 'OK'})`}>
                                <Icon nombre="check" tamano={11} /> Enviado
                              </span>
                            )}
                            {m.estadoEnvio === 'delivered' && (
                              <span className="badge badge-verde xs" title="Entregado al dispositivo del cliente">
                                <Icon nombre="check-circle" tamano={11} /> Entregado
                              </span>
                            )}
                            {m.estadoEnvio === 'read' && (
                              <span className="badge badge-primary xs" style={{ background: '#0284c7', color: '#fff' }} title="Leído por el cliente en WhatsApp">
                                <Icon nombre="check-circle" tamano={11} /> Leído
                              </span>
                            )}
                            {m.estadoEnvio === 'fallido' && (
                              <span className="badge badge-rojo xs" title={`Rechazado por Meta WhatsApp: ${m.errorEnvio || 'Error'}`}>
                                <Icon nombre="alert-triangle" tamano={11} /> Fallo en WhatsApp
                              </span>
                            )}
                          </>
                        )}

                        {/* Indicadores de estado de entrega de Gmail */}
                        {actual.canal === 'mail' && (
                          <>
                            {m.estadoEnvio === 'enviando' && (
                              <span className="badge badge-amber xs" title="Transmitiendo correo a Gmail API...">
                                <Icon nombre="clock" tamano={11} /> Enviando...
                              </span>
                            )}
                            {m.estadoEnvio === 'enviado' && (
                              <span className="badge badge-verde xs" title={`Entregado por Gmail API (ID: ${m.gmailMessageId || 'OK'})`}>
                                <Icon nombre="check" tamano={11} /> Entregado por Gmail
                              </span>
                            )}
                            {m.estadoEnvio === 'fallido' && (
                              <span className="badge badge-rojo xs" title={`Rechazado por Gmail: ${m.errorEnvio || 'Error'}`}>
                                <Icon nombre="alert-triangle" tamano={11} /> Fallo en Gmail
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {esNotaAcuerdo && (
                      <div className="sm" style={{ fontWeight: 600, marginBottom: '2px', color: 'var(--state-green)' }}>
                        <Icon nombre="check-circle" tamano={12} /> Acuerdo comercial registrado
                      </div>
                    )}
                    <div className="bub-text">{m.texto}</div>

                    {/* Botón de reintento en caso de fallo confirmado */}
                    {m.estadoEnvio === 'fallido' && puedeAdministrarConversacion && (
                      <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px dashed var(--border-light)' }}>
                        <div className="xs" style={{ color: 'var(--state-red)', marginBottom: '4px' }}>
                          <strong>Detalle del fallo:</strong> {m.errorEnvio || 'Error de red o rechazo de Google.'}
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleReintentarEnvio(m.id)}
                          disabled={reintentandoId === m.id}
                        >
                          <Icon nombre="rotate-cw" tamano={12} /> {reintentandoId === m.id ? 'Reintentando...' : 'Reintentar envío'}
                        </button>
                      </div>
                    )}

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

            {/* Compositor activo para Comercial y Postventa; modo consulta para Coordinación y Gerencia */}
            {puedeAdministrarConversacion ? (
              <form onSubmit={handleEnviar} className="comm-reply-box">
                <div className="comm-composer">
                  <textarea
                    placeholder={
                      role === 'comercial'
                        ? actual.canal === 'mail'
                          ? `Redactar correo para ${clienteInfo?.correo || actual.cliente}...`
                          : `Registrar comunicación o acuerdo con ${actual.cliente} (${(CANALES[actual.canal] || CANALES.wa).corto})...`
                        : `Registrar respuesta de postventa para ${actual.cliente}...`
                    }
                    value={textoRespuesta}
                    onChange={(e) => setTextoRespuesta(e.target.value)}
                    rows={2}
                  />
                  <div className="comm-reply-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <div className="row" style={{ gap: '12px', flexWrap: 'wrap' }}>
                      <span className="comm-trace-note">
                        <Icon nombre={(CANALES[actual.canal] || CANALES.wa).icono} tamano={13} />
                        <span>
                          {(CANALES[actual.canal] || CANALES.wa).nombre}
                          {actual.canal === 'mail' && estadoGmail.conectado && !estadoGmail.requiereReautorizacion
                            ? ` (Envío corporativo vía ${estadoGmail.email || 'huellaspublicidad23@gmail.com'} → ${clienteInfo?.correo || 'cliente'})`
                            : ' · Queda en trazabilidad de la orden'}
                        </span>
                      </span>

                      {actual.canal === 'mail' && (!estadoGmail.conectado || estadoGmail.requiereReautorizacion) && (
                        <span className="sm" style={{ color: 'var(--state-amber-text)' }}>
                          ⚠️ Canal de correo corporativo no disponible. Consulte con el Administrador de Sistemas.
                        </span>
                      )}

                      {role === 'comercial' && (
                        <label className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={esAcuerdo}
                            onChange={(e) => setEsAcuerdo(e.target.checked)}
                          />
                          <span>Marcar como acuerdo formal con el cliente</span>
                        </label>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={!textoRespuesta.trim() || enviandoMensaje || (actual.canal === 'mail' && (!estadoGmail.conectado || estadoGmail.requiereReautorizacion))}
                    >
                      <Icon nombre={enviandoMensaje ? 'clock' : 'send'} tamano={14} />
                      {enviandoMensaje
                        ? 'Enviando correo...'
                        : esAcuerdo
                        ? 'Registrar acuerdo'
                        : actual.canal === 'mail'
                        ? 'Enviar correo real'
                        : 'Registrar mensaje'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="comm-reply-box" style={{ padding: '12px 16px', background: 'var(--bg-subtle)' }}>
                <div className="row" style={{ gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Icon nombre="eye" tamano={15} />
                  <span>
                    <strong>Modo consulta ({role === 'coordinador' ? 'Coordinación de Producción' : 'Supervisión Gerencial'}):</strong>{' '}
                    Puedes consultar todo el historial de mensajes y acuerdos del cliente. La administración de conversaciones corresponde a Comercial y Postventa.
                  </span>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="comm-main comm-empty">
            <EmptyState icono="message" titulo="Selecciona una conversación" texto="Elige un hilo de la izquierda para consultar los mensajes y acuerdos." />
          </section>
        )}

        {/* 3. Panel contextual derecho: Ficha limpia de cliente, solicitud y orden */}
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
                    {ordenAsociada.solicitudId && (
                      <div><dt>Solicitud origen</dt><dd>{ordenAsociada.solicitudId}</dd></div>
                    )}
                    <div><dt>Entrega</dt><dd>{ordenAsociada.fechaEntrega}</dd></div>
                    <div><dt>Plazo</dt><dd>{textoPlazo(ordenAsociada)}</dd></div>
                    <div><dt>Estado de arte</dt><dd>{ordenAsociada.disenoEstado}</dd></div>
                  </dl>

                  <div className="comm-order-actions">
                    <button className="btn btn-soft btn-sm" onClick={() => irA('detalle', ordenAsociada.id)}>
                      <Icon nombre="clipboard" tamano={14} /> Abrir expediente
                    </button>
                    {['comercial', 'coordinador'].includes(role) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => irA('aprobacion', ordenAsociada.id)}>
                        <Icon nombre="pen" tamano={14} /> Mesa de diseño
                      </button>
                    )}
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
      {/* Modal Redactar Nuevo Correo Corporativo */}
      {modalNuevoCorreo && (
        <div className="modal-backdrop" onClick={() => !enviandoNuevoCorreo && setModalNuevoCorreo(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '600px', width: '100%', margin: '20px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-nuevo-correo-title"
          >
            <div className="modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="chic mail">
                  <Icon nombre="mail" tamano={16} />
                </span>
                <h3 id="modal-nuevo-correo-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                  Redactar nuevo correo corporativo
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => !enviandoNuevoCorreo && setModalNuevoCorreo(false)}
                aria-label="Cerrar modal"
              >
                <Icon nombre="x" tamano={16} />
              </button>
            </div>

            <form onSubmit={handleEnviarNuevoCorreo}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--surface-sunken)', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid var(--border-light)' }}>
                  <Icon nombre="shield" tamano={15} />
                  <span>
                    Remitente corporativo centralizado: <strong>{estadoGmail.email || 'huellaspublicidad23@gmail.com'}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-destinatario" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Para (correo destinatario) <span style={{ color: 'var(--state-red)' }}>*</span>
                  </label>
                  <input
                    id="nuevo-destinatario"
                    type="email"
                    required
                    className="form-input"
                    placeholder="ej. cliente@empresa.com o contacto@dominio.com"
                    value={formNuevoCorreo.destinatario}
                    onChange={(e) => setFormNuevoCorreo((prev) => ({ ...prev, destinatario: e.target.value }))}
                    disabled={enviandoNuevoCorreo}
                    autoFocus
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Puedes escribir cualquier dirección de correo externa; no se requiere registro previo.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-asunto" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Asunto <span style={{ color: 'var(--state-red)' }}>*</span>
                  </label>
                  <input
                    id="nuevo-asunto"
                    type="text"
                    required
                    className="form-input"
                    placeholder="Asunto del correo..."
                    value={formNuevoCorreo.asunto}
                    onChange={(e) => setFormNuevoCorreo((prev) => ({ ...prev, asunto: e.target.value }))}
                    disabled={enviandoNuevoCorreo}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-texto" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Mensaje <span style={{ color: 'var(--state-red)' }}>*</span>
                  </label>
                  <textarea
                    id="nuevo-texto"
                    required
                    rows={6}
                    className="form-textarea"
                    placeholder="Escribe el contenido del correo aquí..."
                    value={formNuevoCorreo.texto}
                    onChange={(e) => setFormNuevoCorreo((prev) => ({ ...prev, texto: e.target.value }))}
                    disabled={enviandoNuevoCorreo}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formNuevoCorreo.esAcuerdo}
                    onChange={(e) => setFormNuevoCorreo((prev) => ({ ...prev, esAcuerdo: e.target.checked }))}
                    disabled={enviandoNuevoCorreo}
                  />
                  <span>Registrar como acuerdo comercial formal</span>
                </label>
              </div>

              <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModalNuevoCorreo(false)}
                  disabled={enviandoNuevoCorreo}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={
                    enviandoNuevoCorreo ||
                    !formNuevoCorreo.destinatario.trim() ||
                    !formNuevoCorreo.asunto.trim() ||
                    !formNuevoCorreo.texto.trim()
                  }
                >
                  {enviandoNuevoCorreo ? (
                    <>
                      <Icon nombre="rotate-cw" tamano={14} className="spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Icon nombre="send" tamano={14} /> Enviar correo
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para enviar nuevo mensaje de WhatsApp a un cliente */}
      {modalNuevoWhatsApp && (
        <div className="modal-backdrop" onClick={() => !enviandoNuevoWhatsApp && setModalNuevoWhatsApp(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: '520px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="chic wa" style={{ background: '#16a34a', color: '#fff', borderRadius: '50%', padding: '6px' }}>
                  <Icon nombre="message-circle" tamano={16} />
                </span>
                <strong style={{ fontSize: '1.1rem' }}>Nuevo mensaje de WhatsApp</strong>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setModalNuevoWhatsApp(false)}
                disabled={enviandoNuevoWhatsApp}
                aria-label="Cerrar modal"
              >
                <Icon nombre="x" tamano={16} />
              </button>
            </div>

            <form onSubmit={handleEnviarNuevoWhatsApp}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-wa-dest" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Número de teléfono <span style={{ color: 'var(--state-red)' }}>*</span>
                  </label>
                  <input
                    id="nuevo-wa-dest"
                    type="tel"
                    required
                    className="form-input"
                    placeholder="Ej. +57 311 608 8542 o 300 123 4567"
                    value={formNuevoWhatsApp.destinatario}
                    onChange={(e) => setFormNuevoWhatsApp((prev) => ({ ...prev, destinatario: e.target.value }))}
                    disabled={enviandoNuevoWhatsApp}
                    autoFocus
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Ingresa el número con o sin prefijo de país. Se normalizará a formato internacional.
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-wa-asunto" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Asunto o contexto comercial
                  </label>
                  <input
                    id="nuevo-wa-asunto"
                    type="text"
                    className="form-input"
                    placeholder="Ej. Cotización aviso luminoso, Consulta estado..."
                    value={formNuevoWhatsApp.asunto}
                    onChange={(e) => setFormNuevoWhatsApp((prev) => ({ ...prev, asunto: e.target.value }))}
                    disabled={enviandoNuevoWhatsApp}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="nuevo-wa-texto" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Mensaje <span style={{ color: 'var(--state-red)' }}>*</span>
                  </label>
                  <textarea
                    id="nuevo-wa-texto"
                    required
                    rows={5}
                    className="form-textarea"
                    placeholder="Escribe el mensaje de WhatsApp aquí..."
                    value={formNuevoWhatsApp.texto}
                    onChange={(e) => setFormNuevoWhatsApp((prev) => ({ ...prev, texto: e.target.value }))}
                    disabled={enviandoNuevoWhatsApp}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={formNuevoWhatsApp.esAcuerdo}
                    onChange={(e) => setFormNuevoWhatsApp((prev) => ({ ...prev, esAcuerdo: e.target.checked }))}
                    disabled={enviandoNuevoWhatsApp}
                  />
                  <span>Registrar como acuerdo comercial formal</span>
                </label>
              </div>

              <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModalNuevoWhatsApp(false)}
                  disabled={enviandoNuevoWhatsApp}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-sm"
                  style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600 }}
                  disabled={
                    enviandoNuevoWhatsApp ||
                    !formNuevoWhatsApp.destinatario.trim() ||
                    !formNuevoWhatsApp.texto.trim()
                  }
                >
                  {enviandoNuevoWhatsApp ? (
                    <>
                      <Icon nombre="rotate-cw" tamano={14} className="spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Icon nombre="send" tamano={14} /> Enviar WhatsApp
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
