import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import DataTable from '../components/DataTable.jsx'
import Icon from '../components/Icon.jsx'
import DesignPreview from '../components/DesignPreview.jsx'
import { ultimaVersion } from '../utils/format.js'

const CANALES_COMERCIAL = [
  'WhatsApp',
  'Correo electrónico',
  'Llamada telefónica',
  'Presencial / Punto de atención',
  'Otro',
]

const STAMPS = {
  'Aprobado por el cliente': { cls: 'stamp-apr', txt: 'APROBADO CLIENTE' },
  'Listo para impresión': { cls: 'stamp-apr', txt: 'LISTO IMPRESIÓN' },
  Aprobado: { cls: 'stamp-apr', txt: 'APROBADO' },
  Aprobada: { cls: 'stamp-apr', txt: 'APROBADO' },
  'Pendiente de gestión comercial': { cls: 'stamp-pen', txt: 'EN COMERCIAL' },
  'Esperando respuesta del cliente': { cls: 'stamp-pen', txt: 'ESPERANDO CLIENTE' },
  Enviado: { cls: 'stamp-pen', txt: 'EN REVISIÓN' },
  'En diseño': { cls: 'stamp-bor', txt: 'EN DISEÑO' },
  'En proceso': { cls: 'stamp-bor', txt: 'EN DISEÑO' },
  'Cambios solicitados': { cls: 'stamp-rec', txt: 'CAMBIOS PEDIDOS' },
  'Requiere cambios': { cls: 'stamp-rec', txt: 'CAMBIOS PEDIDOS' },
  Rechazada: { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Pendiente: { cls: 'stamp-pen', txt: 'PENDIENTE' },
}

function obtenerFechaHoyISO() {
  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    if (/^\d{4}-\d{2}-\d{2}$/.test(partes)) return partes
  } catch {}
  return new Date().toISOString().slice(0, 10)
}

function formatearFechaISOaLatam(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return String(iso)
}

export default function DesignApproval({ order, data, actions, irA, role }) {
  const [procesoAprobacionHabilitado, setProcesoAprobacionHabilitado] = useState(false)
  const [modalAprobacion, setModalAprobacion] = useState(false)
  const [modalCambios, setModalCambios] = useState(false)
  const [modalEsperando, setModalEsperando] = useState(false)
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)

  // Campos de formulario para gestión comercial y aprobación formal
  const [versionAprobadaNum, setVersionAprobadaNum] = useState('')
  const [fechaAprobacion, setFechaAprobacion] = useState(obtenerFechaHoyISO)
  const [contactoNombre, setContactoNombre] = useState('')
  const [canalSeleccionado, setCanalSeleccionado] = useState('WhatsApp')
  const [evidenciaTexto, setEvidenciaTexto] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState(null)
  const [observacionesTexto, setObservacionesTexto] = useState('')
  const [erroresModal, setErroresModal] = useState({})
  const [guardando, setGuardando] = useState(false)

  // Si no se pasó orden por props o se navega a la bandeja general de aprobación
  if (!order) {
    const todasLasOrdenes = data?.orders || []
    const ordenesDiseno = todasLasOrdenes.filter(
      (o) =>
        o.versiones?.length > 0 ||
        o.estado === 'Diseño' ||
        o.estado === 'Aprobación' ||
        o.disenoEstado === 'Pendiente de gestión comercial' ||
        o.disenoEstado === 'Esperando respuesta del cliente' ||
        o.disenoEstado === 'Cambios solicitados'
    )

    const columnas = [
      { clave: 'id', titulo: 'Orden', ordenar: true, render: (o) => <strong>{o.id}</strong> },
      { clave: 'cliente', titulo: 'Cliente', ordenar: true },
      { clave: 'producto', titulo: 'Producto', ordenar: true },
      {
        clave: 'versiones',
        titulo: 'Versión vigente',
        render: (o) => {
          const u = ultimaVersion(o)
          return u ? `Versión ${u.numero}` : 'Borrador'
        },
      },
      {
        clave: 'disenoEstado',
        titulo: 'Estado de gestión',
        render: (o) => <StatusBadge estado={o.disenoEstado} />,
      },
      {
        clave: 'envio',
        titulo: 'Envío de diseño',
        render: (o) => {
          const u = ultimaVersion(o)
          const f = u?.fechaEnvioComercialTexto || u?.fechaEnvioTexto
          const h = u?.horaEnvioComercialTexto || u?.horaEnvioTexto
          if (!f) return <span className="mut sm">Sin envío registrado</span>
          return (
            <span className="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--blue-700, #1d4ed8)' }}>
              <Icon nombre="send" tamano={12} /> {f} {h}
            </span>
          )
        },
      },
      {
        clave: 'accion',
        titulo: 'Gestión',
        render: (o) => (
          <button className="btn btn-primary btn-sm" onClick={() => irA('aprobacion', o.id)}>
            <Icon nombre="check-circle" tamano={14} /> Gestionar
          </button>
        ),
      },
    ]

    return (
      <div>
        <PageHeader
          titulo="Bandeja de gestión comercial y aprobación de diseños"
          subtitulo="Recepción de propuestas gráficas, atención y verificación de visto bueno con el cliente."
          icono="check-circle"
        />

        <DataTable
          columnas={columnas}
          filas={ordenesDiseno}
          porPagina={8}
          buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.disenoEstado}`}
          placeholder="Buscar por orden, cliente o producto..."
          filtros={[
            {
              titulo: 'Estado de diseño',
              valor: (o) => o.disenoEstado,
              opciones: [
                'Pendiente de gestión comercial',
                'Esperando respuesta del cliente',
                'Cambios solicitados',
                'Aprobado por el cliente',
                'Listo para impresión',
              ],
            },
          ]}
          vacioTitulo="No hay propuestas de diseño en la bandeja"
          vacioTexto="Las propuestas enviadas por el equipo de diseño aparecerán aquí para contactar al cliente."
        />
      </div>
    )
  }

  const esCoordinador = role === 'coordinador'
  const esComercial = role === 'comercial'
  const ultima = ultimaVersion(order)
  const versionActual = versionSeleccionada || ultima
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  const estaAprobado =
    order.disenoEstado === 'Aprobado por el cliente' ||
    order.disenoEstado === 'Listo para impresión' ||
    order.disenoEstado === 'Aprobado' ||
    ultima?.estado === 'Aprobado por el cliente' ||
    ultima?.estado === 'Aprobada'

  const estaListoImpresion = order.disenoEstado === 'Listo para impresión'

  // Puede gestionar con el cliente si es Comercial o Coordinador y la orden tiene arte
  const puedeGestionarComercial =
    (esComercial || esCoordinador) &&
    order.versiones?.length > 0 &&
    (order.disenoEstado === 'Pendiente de gestión comercial' ||
      order.disenoEstado === 'Esperando respuesta del cliente' ||
      order.disenoEstado === 'Enviado' ||
      order.disenoEstado === 'Cambios solicitados' ||
      !estaAprobado)

  // Descargar archivo de diseño
  function descargarArchivoDiseno(v) {
    if (!v) return
    if (v.ruta_archivo) {
      const link = document.createElement('a')
      link.href = v.ruta_archivo
      link.download = v.archivoNombre || `Diseno_${order.id}_v${v.numero}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Paso 1: Habilitar proceso de aprobación cuando se selecciona «Cliente aprueba el diseño»
  function handleSeleccionarClienteAprueba() {
    setProcesoAprobacionHabilitado(true)
    setVersionAprobadaNum(String(versionActual?.numero || ultima?.numero || 1))
    setFechaAprobacion(obtenerFechaHoyISO())
    if (!contactoNombre) {
      setContactoNombre(order.entrega?.contacto || order.cliente || '')
    }
    setErroresModal({})
  }

  // Paso 2: Abrir formulario de «Registrar aprobación formal»
  function handleAbrirFormularioAprobacion() {
    setProcesoAprobacionHabilitado(true)
    setVersionAprobadaNum(String(versionActual?.numero || ultima?.numero || 1))
    setFechaAprobacion((prev) => prev || obtenerFechaHoyISO())
    setContactoNombre((prev) => prev || order.entrega?.contacto || order.cliente || '')
    setErroresModal({})
    setModalAprobacion(true)
  }

  // Enviar formulario de aprobación formal
  async function handleAprobarSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const errs = {}
    const versionElegida = Number(versionAprobadaNum || versionActual?.numero || ultima?.numero || 1)
    if (!versionElegida) {
      errs.version = 'Selecciona la versión del diseño que fue aprobada por el cliente.'
    }
    if (!fechaAprobacion) {
      errs.fecha = 'Registra la fecha en que el cliente aprobó el diseño.'
    }
    if (!contactoNombre.trim()) {
      errs.contacto = 'Indica el nombre de la persona del cliente que autorizó el diseño.'
    }
    const evidenciaResuelta = evidenciaTexto.trim() || (archivoEvidencia ? `Archivo adjunto: ${archivoEvidencia.name}` : '')
    if (!evidenciaResuelta) {
      errs.evidencia = 'Adjunta un archivo de soporte o describe la evidencia verificable (ej. captura WhatsApp, correo).'
    }

    if (Object.keys(errs).length > 0) {
      setErroresModal(errs)
      return
    }

    setGuardando(true)
    try {
      const fechaFormateada = formatearFechaISOaLatam(fechaAprobacion)
      await actions.designCommercialManage(order.id, {
        accion: 'aprobar',
        numero_version: versionElegida,
        fechaAprobacion: fechaFormateada,
        nombreAutoriza: contactoNombre.trim(),
        canal: canalSeleccionado,
        evidencia: evidenciaResuelta,
        archivo: archivoEvidencia || undefined,
        archivoEvidenciaNombre: archivoEvidencia?.name || undefined,
        observaciones: observacionesTexto.trim(),
      })
      setModalAprobacion(false)
      setProcesoAprobacionHabilitado(false)
      setContactoNombre('')
      setEvidenciaTexto('')
      setArchivoEvidencia(null)
      setObservacionesTexto('')
      setErroresModal({})
    } catch {
      // Manejado en el action
    } finally {
      setGuardando(false)
    }
  }

  // Enviar formulario de cambios solicitados por el cliente
  async function handleCambiosSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const errs = {}
    if (!observacionesTexto.trim() || observacionesTexto.trim().length < 5) {
      errs.observaciones = 'Describe detalladamente las modificaciones solicitadas por el cliente (mínimo 5 caracteres).'
    }

    if (Object.keys(errs).length > 0) {
      setErroresModal(errs)
      return
    }

    setGuardando(true)
    try {
      await actions.designCommercialManage(order.id, {
        accion: 'cambios',
        numero_version: Number(versionActual?.numero || ultima?.numero || 1),
        nombreAutoriza: contactoNombre.trim() || order.entrega?.contacto || order.cliente,
        canal: canalSeleccionado,
        observaciones: observacionesTexto.trim(),
      })
      setModalCambios(false)
      setProcesoAprobacionHabilitado(false)
      setObservacionesTexto('')
      setContactoNombre('')
      setErroresModal({})
    } catch {
      // Manejado en el action
    } finally {
      setGuardando(false)
    }
  }

  // Enviar formulario de esperando respuesta
  async function handleEsperandoSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    setGuardando(true)
    try {
      await actions.designCommercialManage(order.id, {
        accion: 'esperando',
        nombreAutoriza: contactoNombre.trim(),
        canal: canalSeleccionado,
        observaciones: observacionesTexto.trim(),
      })
      setModalEsperando(false)
      setContactoNombre('')
      setObservacionesTexto('')
    } catch {
      // Manejado en el action
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Mesa de gestión comercial y aprobación de diseño"
        subtitulo={`${order.id} · ${order.cliente} · ${order.producto}`}
        icono="check-circle"
        volver={{ texto: 'Volver al pedido', onClick: () => irA('detalle', order.id) }}
        acciones={
          <div className="row" style={{ gap: '10px' }}>
            <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
            <StatusBadge estado={order.disenoEstado} />
          </div>
        }
      />

      {/* Regla de negocio destacada con candado */}
      <div className={`ban ${estaAprobado ? 'gr' : 'am'}`} style={{ marginBottom: '20px' }}>
        <Icon nombre={estaAprobado ? 'check-circle' : 'lock'} tamano={18} />
        <div>
          <strong>Regla de producción:</strong> Ninguna orden puede pasar a impresión sin la aprobación documentada del cliente con soporte verificable.
          {estaListoImpresion ? (
            <span className="ban-sub ok">
              Orden verificada y liberada por Coordinación. Lista para impresión en taller.
            </span>
          ) : estaAprobado ? (
            <span className="ban-sub ok">
              Regla cumplida: diseño aprobado por el cliente con evidencia registrada. Pendiente de verificación y liberación de Coordinación para taller.
            </span>
          ) : order.disenoEstado === 'Esperando respuesta del cliente' ? (
            <span className="ban-sub warn">
              Esperando respuesta del cliente: el paso a impresión permanece bloqueado.
            </span>
          ) : order.disenoEstado === 'Cambios solicitados' ? (
            <span className="ban-sub warn" style={{ color: 'var(--state-red)' }}>
              Cambios solicitados: el trabajo fue devuelto a Diseño para generar una nueva versión.
            </span>
          ) : (
            <span className="ban-sub warn">
              Pendiente de gestión comercial: Comercial debe contactar al cliente para obtener el visto bueno formal.
            </span>
          )}
        </div>
      </div>

      <div className="grid-main">
        {/* Panel izquierdo con la pieza publicitaria */}
        <Panel titulo={`Propuesta gráfica · ${versionActual ? `Versión ${versionActual.numero}` : 'Borrador'}`} icono="image">
          {/* Selector de versiones tipo pestañas */}
          {order.versiones.length > 0 && (
            <div className="ver" role="tablist">
              {order.versiones.map((v) => (
                <button
                  key={v.numero}
                  type="button"
                  className={versionActual?.numero === v.numero ? 'on' : ''}
                  onClick={() => {
                    setVersionSeleccionada(v)
                    setVersionAprobadaNum(String(v.numero))
                  }}
                >
                  <Icon nombre="layers" tamano={14} /> Versión {v.numero} ({v.estado})
                </button>
              ))}
            </div>
          )}

          <div className="design-preview-container">
            <DesignPreview order={order} version={versionActual} grande />
          </div>

          {/* Botón de descarga del archivo de arte */}
          {versionActual && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => descargarArchivoDiseno(versionActual)}
                title="Descargar o consultar archivo gráfico del arte"
              >
                <Icon nombre="download" tamano={14} /> Descargar archivo de diseño ({versionActual.archivoNombre || `v${versionActual.numero}.pdf`})
              </button>
            </div>
          )}

          {/* Flujo de estados del diseño en ORVEX */}
          <div className="flowst-wrap">
            <span className="sm mut">Estado en el flujo de aprobación comercial</span>
            <div className="flowst" role="list">
              <span role="listitem" className={`o ${order.disenoEstado === 'En diseño' || order.disenoEstado === 'En proceso' ? 'on' : ''}`}>
                <Icon nombre="pen" tamano={13} /> En diseño
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Pendiente de gestión comercial' ? 'on' : ''}`}>
                <Icon nombre="send" tamano={13} /> En Comercial
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Esperando respuesta del cliente' ? 'on' : ''}`}>
                <Icon nombre="clock" tamano={13} /> Esperando cliente
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Cambios solicitados' ? 'on err' : ''}`}>
                <Icon nombre="alert-circle" tamano={13} /> Cambios pedidos
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Aprobado por el cliente' || order.disenoEstado === 'Aprobado' ? 'on ok' : ''}`}>
                <Icon nombre="check-circle" tamano={13} /> Aprobado cliente
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Listo para impresión' ? 'on ok' : ''}`}>
                <Icon nombre="printer" tamano={13} /> Listo impresión
              </span>
            </div>
          </div>

          {/* Acciones de gestión comercial y aprobación */}
          <div className="actions" style={{ marginTop: '20px', flexWrap: 'wrap', gap: '8px' }}>
            {puedeGestionarComercial && (
              <>
                <button
                  type="button"
                  className={procesoAprobacionHabilitado ? 'btn btn-success' : 'btn btn-soft'}
                  style={
                    procesoAprobacionHabilitado
                      ? { boxShadow: '0 0 0 2px var(--state-green, #16a34a)' }
                      : undefined
                  }
                  onClick={handleSeleccionarClienteAprueba}
                >
                  <Icon nombre="check" tamano={16} /> Cliente aprueba el diseño
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setProcesoAprobacionHabilitado(false)
                    setObservacionesTexto('')
                    setContactoNombre(order.entrega?.contacto || order.cliente || '')
                    setErroresModal({})
                    setModalCambios(true)
                  }}
                >
                  <Icon nombre="edit" tamano={16} /> Cliente solicita modificaciones
                </button>

                <button
                  type="button"
                  className={procesoAprobacionHabilitado ? 'btn btn-primary' : 'btn lock'}
                  disabled={!procesoAprobacionHabilitado}
                  onClick={handleAbrirFormularioAprobacion}
                  title={
                    procesoAprobacionHabilitado
                      ? 'Abrir formulario para registrar versión aprobada, fecha y evidencia'
                      : 'Selecciona primero «Cliente aprueba el diseño» para habilitar el registro de aprobación formal'
                  }
                >
                  <Icon nombre={procesoAprobacionHabilitado ? 'check-circle' : 'lock'} tamano={16} /> Registrar aprobación formal
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setContactoNombre(order.entrega?.contacto || order.cliente || '')
                    setObservacionesTexto('')
                    setModalEsperando(true)
                  }}
                >
                  <Icon nombre="clock" tamano={16} /> Cliente todavía no responde
                </button>
              </>
            )}

            {/* Acciones de Coordinación de Producción */}
            {esCoordinador && estaAprobado && !estaListoImpresion && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => actions.designReleasePrint(order.id)}
                title="Verificar aprobación y liberar orden para pasar a taller de impresión"
              >
                <Icon nombre="printer" tamano={16} /> Liberar para impresión
              </button>
            )}

            {esCoordinador && (estaListoImpresion || estaAprobado) && order.estado === 'Aprobación' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => actions.advanceStage(order.id)}
                title="Enviar orden al taller de impresión"
              >
                <Icon nombre="arrow-right" tamano={16} /> Avanzar orden a Impresión
              </button>
            )}
          </div>

          {/* Aviso interactivo cuando se selecciona «Cliente aprueba el diseño» */}
          {puedeGestionarComercial && procesoAprobacionHabilitado && (
            <div
              className="ban gr"
              style={{
                marginTop: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon nombre="check-circle" tamano={18} />
                <div>
                  <strong>Proceso de aprobación formal habilitado:</strong>
                  <div className="sm">
                    Haz clic en <strong>«Registrar aprobación formal»</strong> para seleccionar la versión aprobada (v{versionActual?.numero || ultima?.numero}), indicar la fecha y adjuntar la evidencia del cliente.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={handleAbrirFormularioAprobacion}
              >
                <Icon nombre="file-text" tamano={14} /> Abrir formulario de aprobación
              </button>
            </div>
          )}
        </Panel>

        {/* Panel derecho con datos de registro y trazabilidad */}
        <div className="stack">
          <Panel titulo="Ficha de atención al cliente" icono="file-text">
            <dl className="details details-1">
              <div><dt>Cliente</dt><dd>{order.cliente}</dd></div>
              <div><dt>Contacto principal</dt><dd>{order.entrega?.contacto || order.cliente}</dd></div>
              <div><dt>Producto</dt><dd>{order.producto}</dd></div>
              <div><dt>Diseñadora</dt><dd>{order.disenador}</dd></div>
              <div><dt>Dimensiones</dt><dd>{order.dimensiones}</dd></div>
              <div><dt>Material</dt><dd>{order.material}</dd></div>
              <div><dt>Acabados</dt><dd>{order.acabados}</dd></div>
              <div><dt>Fecha de entrega</dt><dd>{order.fechaEntrega}</dd></div>
            </dl>

            {/* Datos de aprobación formal si existe */}
            {versionActual?.contactoClienteNombre && (
              <div className="comment-box" style={{ marginTop: '14px', background: 'var(--green-50, #f0fdf4)', borderColor: 'var(--green-200, #bbf7d0)' }}>
                <strong style={{ color: 'var(--green-900, #14532d)' }}>Registro de aprobación formal del cliente:</strong>
                <p className="sm" style={{ marginTop: '4px', color: 'var(--green-800, #166534)' }}>
                  <strong>Versión aprobada:</strong> Versión {versionActual.numero}<br />
                  <strong>Autorizó:</strong> {versionActual.contactoClienteNombre}<br />
                  <strong>Canal:</strong> {versionActual.contactoClienteCanal || 'WhatsApp'}<br />
                  <strong>Fecha de aprobación:</strong> {versionActual.contactoClienteFechaTexto || versionActual.fecha} {versionActual.contactoClienteHoraTexto || ''}<br />
                  {versionActual.contactoClienteEvidencia && (
                    <><strong>Evidencia:</strong> {versionActual.contactoClienteEvidencia}</>
                  )}
                </p>
              </div>
            )}

            {/* Observaciones registradas */}
            {versionActual?.comentario && (
              <div className="comment-box" style={{ marginTop: '14px' }}>
                <strong>Observaciones registradas para esta versión:</strong>
                <p>“{versionActual.comentario}”</p>
              </div>
            )}
          </Panel>

          <Panel titulo="Historial y trazabilidad de versiones" icono="clock">
            <div className="stack" style={{ gap: '10px' }}>
              {order.versiones.map((v) => (
                <div key={v.numero} className="version-item-card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>Versión {v.numero}</strong>
                    <StatusBadge estado={v.estado} />
                  </div>
                  <div className="sm mut">{v.fecha} · Diseñadora: {v.disenador}</div>

                  {(v.fechaEnvioComercialTexto || v.fechaEnvioTexto) && (
                    <div className="sm" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--blue-700, #1d4ed8)' }}>
                      <Icon nombre="send" tamano={13} />
                      <span>Enviado a Comercial: {v.fechaEnvioComercialTexto || v.fechaEnvioTexto} {v.horaEnvioComercialTexto || v.horaEnvioTexto}</span>
                    </div>
                  )}

                  {v.contactoClienteNombre && (
                    <div className="sm" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--state-green)' }}>
                      <Icon nombre="check" tamano={13} />
                      <span>Aprobado por: {v.contactoClienteNombre} vía {v.contactoClienteCanal || 'WhatsApp'} ({v.contactoClienteFechaTexto || v.fecha})</span>
                    </div>
                  )}

                  {v.contactoClienteEvidencia && (
                    <div className="sm" style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                      <Icon nombre="paperclip" tamano={13} />
                      <span>Evidencia: {v.contactoClienteEvidencia}</span>
                    </div>
                  )}

                  {v.archivoNombre && (
                    <div className="sm" style={{ marginTop: '3px', color: 'var(--blue-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon nombre="file-text" tamano={13} /> {v.archivoNombre}
                    </div>
                  )}

                  {v.comentario && <p className="comment-text">“{v.comentario}”</p>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* MODAL 1: Registrar aprobación formal */}
      {modalAprobacion && (
        <Modal
          titulo="Registrar aprobación formal del diseño"
          icono="check-circle"
          tipoBoton="success"
          textoBoton={guardando ? 'Guardando aprobación...' : 'Guardar aprobación formal'}
          subtitulo={`Orden ${order.id} · ${order.cliente}`}
          onClose={() => setModalAprobacion(false)}
          onConfirm={handleAprobarSubmit}
        >
          <div className="stack" style={{ gap: '14px', marginTop: '6px' }}>
            <p className="sm mut" style={{ margin: 0 }}>
              Selecciona la versión aprobada, registra la fecha y adjunta la evidencia del visto bueno del cliente. Al guardar, la orden pasará a Coordinación para su verificación y posterior liberación a impresión.
            </p>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className={erroresModal.version ? 'field has-error' : 'field'}>
                <label className="field-label" htmlFor="aprobVersionSelect">
                  Versión aprobada <span style={{ color: 'var(--state-red)' }}>*</span>
                </label>
                <select
                  id="aprobVersionSelect"
                  value={versionAprobadaNum || String(versionActual?.numero || ultima?.numero || 1)}
                  onChange={(e) => {
                    setVersionAprobadaNum(e.target.value)
                    const vObj = order.versiones.find((v) => String(v.numero) === String(e.target.value))
                    if (vObj) setVersionSeleccionada(vObj)
                    if (erroresModal.version) setErroresModal((prev) => ({ ...prev, version: null }))
                  }}
                >
                  {order.versiones.map((v) => (
                    <option key={v.numero} value={String(v.numero)}>
                      Versión {v.numero} ({v.archivoNombre || `v${v.numero}.pdf`})
                    </option>
                  ))}
                </select>
                {erroresModal.version && <span className="field-error">{erroresModal.version}</span>}
              </div>

              <div className={erroresModal.fecha ? 'field has-error' : 'field'}>
                <label className="field-label" htmlFor="aprobFechaInput">
                  Fecha de aprobación <span style={{ color: 'var(--state-red)' }}>*</span>
                </label>
                <input
                  id="aprobFechaInput"
                  type="date"
                  value={fechaAprobacion}
                  onChange={(e) => {
                    setFechaAprobacion(e.target.value)
                    if (erroresModal.fecha) setErroresModal((prev) => ({ ...prev, fecha: null }))
                  }}
                />
                {erroresModal.fecha && <span className="field-error">{erroresModal.fecha}</span>}
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className={erroresModal.contacto ? 'field has-error' : 'field'}>
                <label className="field-label" htmlFor="aprobContactoInput">
                  Persona del cliente que autorizó <span style={{ color: 'var(--state-red)' }}>*</span>
                </label>
                <input
                  id="aprobContactoInput"
                  type="text"
                  placeholder="Ej: Laura Gómez (Gerente de Mercadeo)"
                  value={contactoNombre}
                  onChange={(e) => {
                    setContactoNombre(e.target.value)
                    if (erroresModal.contacto) setErroresModal((prev) => ({ ...prev, contacto: null }))
                  }}
                />
                {erroresModal.contacto && <span className="field-error">{erroresModal.contacto}</span>}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="aprobCanalSelect">Canal de comunicación</label>
                <select
                  id="aprobCanalSelect"
                  value={canalSeleccionado}
                  onChange={(e) => setCanalSeleccionado(e.target.value)}
                >
                  {CANALES_COMERCIAL.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="aprobArchivoInput">
                Adjuntar archivo de evidencia (captura WhatsApp, correo PDF o acta firmada)
              </label>
              <input
                id="aprobArchivoInput"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setArchivoEvidencia(file)
                  if (file && !evidenciaTexto.trim()) {
                    setEvidenciaTexto(`Soporte adjunto: ${file.name}`)
                  }
                  if (erroresModal.evidencia) setErroresModal((prev) => ({ ...prev, evidencia: null }))
                }}
              />
              {archivoEvidencia && (
                <span className="sm" style={{ color: 'var(--state-green)', marginTop: '4px', display: 'block' }}>
                  Archivo seleccionado: <strong>{archivoEvidencia.name}</strong>
                </span>
              )}
            </div>

            <div className={erroresModal.evidencia ? 'field has-error' : 'field'}>
              <label className="field-label" htmlFor="aprobEvidenciaTexto">
                Referencia o descripción de la evidencia <span style={{ color: 'var(--state-red)' }}>*</span>
              </label>
              <input
                id="aprobEvidenciaTexto"
                type="text"
                placeholder="Ej: Captura de confirmación por WhatsApp del 08/11 16:30 o correo aprobado"
                value={evidenciaTexto}
                onChange={(e) => {
                  setEvidenciaTexto(e.target.value)
                  if (erroresModal.evidencia) setErroresModal((prev) => ({ ...prev, evidencia: null }))
                }}
              />
              {erroresModal.evidencia && <span className="field-error">{erroresModal.evidencia}</span>}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="aprobObsTextarea">Observaciones adicionales (opcional)</label>
              <textarea
                id="aprobObsTextarea"
                rows={2}
                placeholder="Notas sobre confirmación de medidas, acabados o colores..."
                value={observacionesTexto}
                onChange={(e) => setObservacionesTexto(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Cliente solicita modificaciones */}
      {modalCambios && (
        <Modal
          titulo="Cliente solicita modificaciones"
          icono="edit"
          tipoBoton="danger"
          textoBoton={guardando ? 'Guardando cambios...' : 'Guardar cambios y devolver a Diseño'}
          subtitulo={`Orden ${order.id} · Propuesta v${versionActual?.numero || ultima?.numero}`}
          onClose={() => setModalCambios(false)}
          onConfirm={handleCambiosSubmit}
        >
          <div className="stack" style={{ gap: '14px', marginTop: '6px' }}>
            <p className="sm mut" style={{ margin: 0 }}>
              Describe los ajustes o cambios solicitados por el cliente. Al guardar, el trabajo regresará al módulo de Diseño para que la diseñadora genere la versión {Number(ultima?.numero || 1) + 1}.
            </p>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="field">
                <label className="field-label" htmlFor="cambiosCanalSelect">Canal de comunicación</label>
                <select
                  id="cambiosCanalSelect"
                  value={canalSeleccionado}
                  onChange={(e) => setCanalSeleccionado(e.target.value)}
                >
                  {CANALES_COMERCIAL.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="cambiosContactoInput">Contacto del cliente</label>
                <input
                  id="cambiosContactoInput"
                  type="text"
                  placeholder="Nombre del cliente o interlocutor"
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                />
              </div>
            </div>

            <div className={erroresModal.observaciones ? 'field has-error' : 'field'}>
              <label className="field-label" htmlFor="cambiosObsTextarea">
                Descripción de los cambios solicitados <span style={{ color: 'var(--state-red)' }}>*</span>
              </label>
              <textarea
                id="cambiosObsTextarea"
                rows={4}
                placeholder="Describe claramente los cambios requeridos (ej: ajustar color de fondo a pantone corporativo, corregir número telefónico, ampliar logotipo)..."
                value={observacionesTexto}
                onChange={(e) => {
                  setObservacionesTexto(e.target.value)
                  if (erroresModal.observaciones) setErroresModal((prev) => ({ ...prev, observaciones: null }))
                }}
              />
              {erroresModal.observaciones && <span className="field-error">{erroresModal.observaciones}</span>}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Cliente todavía no responde */}
      {modalEsperando && (
        <Modal
          titulo="Registrar espera de respuesta del cliente"
          icono="clock"
          tipoBoton="primary"
          textoBoton={guardando ? 'Guardando...' : 'Registrar espera de respuesta'}
          subtitulo={`Orden ${order.id} · Propuesta v${ultima?.numero}`}
          onClose={() => setModalEsperando(false)}
          onConfirm={handleEsperandoSubmit}
        >
          <div className="stack" style={{ gap: '14px', marginTop: '6px' }}>
            <p className="sm mut" style={{ margin: 0 }}>
              El diseño permanecerá en estado «Esperando respuesta del cliente» y no podrá pasar a impresión hasta obtener su aprobación formal.
            </p>

            <div className="field">
              <label className="field-label" htmlFor="espCanalSelect">Canal por el que se contactó</label>
              <select
                id="espCanalSelect"
                value={canalSeleccionado}
                onChange={(e) => setCanalSeleccionado(e.target.value)}
              >
                {CANALES_COMERCIAL.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="espContactoInput">Contacto con quien se inició la comunicación</label>
              <input
                id="espContactoInput"
                type="text"
                placeholder="Ej: Mario Díaz"
                value={contactoNombre}
                onChange={(e) => setContactoNombre(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="espObsTextarea">Notas de seguimiento (opcional)</label>
              <textarea
                id="espObsTextarea"
                rows={2}
                placeholder="Ej: Propuesta enviada por WhatsApp a las 11:30 am. Pendiente confirmación de gerencia..."
                value={observacionesTexto}
                onChange={(e) => setObservacionesTexto(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
