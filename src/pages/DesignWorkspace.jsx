import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DesignPreview from '../components/DesignPreview.jsx'
import StatCard from '../components/StatCard.jsx'
import { ROLES } from '../data/roles.js'
import { ultimaVersion } from '../utils/format.js'

const FILTROS = [
  ['Todos', null],
  ['En diseño', 'En diseño'],
  ['Pre-prensa (Arte cliente)', 'Revisión técnica de archivo'],
  ['Pendiente Comercial', 'Pendiente de gestión comercial'],
  ['Esperando cliente', 'Esperando respuesta del cliente'],
  ['Aprobados', 'Aprobado por el cliente'],
  ['Cambios solicitados', 'Cambios solicitados'],
]

const STAMPS = {
  'Aprobado por el cliente': { cls: 'stamp-apr', txt: 'APROBADO CLIENTE' },
  'Listo para impresión': { cls: 'stamp-apr', txt: 'LISTO IMPRESIÓN' },
  'Aprobado técnicamente': { cls: 'stamp-apr', txt: 'APROBADO TÉCNICO' },
  'Revisión técnica de archivo': { cls: 'stamp-pen', txt: 'PRE-PRENSA' },
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
  Pendiente: { cls: 'stamp-bor', txt: 'PENDIENTE' },
}

export default function DesignWorkspace({ order, data, actions, irA, role, usuarioActual }) {
  const [filtro, setFiltro] = useState(null)
  const [modoVista, setModoVista] = useState('tabla') // 'tabla' (compacta por defecto) | 'galeria'
  const [rechazando, setRechazando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [observacionesEnvio, setObservacionesEnvio] = useState('')
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)
  const [archivoPreview, setArchivoPreview] = useState(null)
  const [previewFullModal, setPreviewFullModal] = useState(false)
  const [tabMesa, setTabMesa] = useState('arte') // 'arte' | 'ficha' | 'historial'
  const [panelLateralActivo, setPanelLateralActivo] = useState(false)

  // Estado para creación de nueva versión con archivo y notas (HU-11)
  const [modalNuevaVersion, setModalNuevaVersion] = useState(false)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [notasDisenador, setNotasDisenador] = useState('')

  // Sin orden seleccionada: lista y galería de diseños
  if (!order) {
    const nombre = (role === 'disenador' && usuarioActual?.nombre) || ROLES.disenador.usuario.nombre
    const mios = data.orders.filter((o) => o.disenador === nombre)
    const lista = filtro ? mios.filter((o) => o.disenoEstado === filtro) : mios

    const conteoEnDiseno = mios.filter((o) => o.disenoEstado === 'En diseño' || o.disenoEstado === 'Revisión técnica de archivo').length
    const conteoCambios = mios.filter((o) => o.disenoEstado === 'Cambios solicitados' || o.disenoEstado === 'Requiere cambios').length
    const conteoComercial = mios.filter(
      (o) =>
        o.disenoEstado === 'Pendiente de gestión comercial' ||
        o.disenoEstado === 'Esperando respuesta del cliente' ||
        o.disenoEstado === 'Enviado'
    ).length
    const conteoAprobados = mios.filter(
      (o) =>
        o.disenoEstado === 'Aprobado por el cliente' ||
        o.disenoEstado === 'Listo para impresión' ||
        o.disenoEstado === 'Aprobado'
    ).length

    const columnas = [
      {
        clave: 'id',
        titulo: 'Orden / Sustrato',
        ancho: '160px',
        ordenar: true,
        render: (o) => (
          <div>
            <button
              className="link-inline"
              onClick={() => irA('disenos', o.id)}
              title="Abrir mesa de trabajo de esta orden"
              style={{ fontWeight: 700 }}
            >
              {o.id}
            </button>
            <small className="cell-sub cell-truncate" style={{ display: 'block', maxWidth: '150px', fontSize: '11px', marginTop: '1px' }}>
              {o.material}
            </small>
            {o.esArteCliente && (
              <span className="pill" style={{ fontSize: '10px', padding: '1px 5px', color: 'var(--blue-600)' }}>
                Arte cliente
              </span>
            )}
          </div>
        ),
      },
      {
        clave: 'producto',
        titulo: 'Cliente y Producto',
        minAncho: '190px',
        ordenar: true,
        render: (o) => (
          <div>
            <strong style={{ fontSize: '13px' }}>{o.producto}</strong>
            <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '1px' }}>{o.cliente}</div>
            <small className="cell-sub" style={{ fontSize: '11px' }}>
              {o.cantidad} unidades {o.dimensiones ? `· ${o.dimensiones}` : ''}
            </small>
          </div>
        ),
      },
      {
        clave: 'disenoEstado',
        titulo: 'Versión y Estado',
        ancho: '180px',
        ordenar: true,
        render: (o) => {
          const stamp = STAMPS[o.disenoEstado] || STAMPS.Pendiente
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <StatusBadge estado={o.disenoEstado} />
                <span className={`stamp ${stamp.cls}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                  {stamp.txt}
                </span>
              </div>
              <small className="cell-sub" style={{ display: 'block', marginTop: '3px', fontSize: '11px' }}>
                Versión actual: <strong>v{o.versiones.length}</strong> ({o.versiones.length === 1 ? '1 versión' : `${o.versiones.length} versiones`})
              </small>
            </div>
          )
        },
      },
      {
        clave: 'envio',
        titulo: 'Última interacción',
        ancho: '170px',
        render: (o) => {
          const u = ultimaVersion(o)
          const tieneAjustes = o.disenoEstado === 'Cambios solicitados' || o.disenoEstado === 'Requiere cambios'
          const esAprobado =
            o.disenoEstado === 'Aprobado por el cliente' ||
            o.disenoEstado === 'Listo para impresión' ||
            o.disenoEstado === 'Aprobado'

          if (tieneAjustes) {
            return (
              <div>
                <small className="cell-sub text-rojo" style={{ fontWeight: 700, fontSize: '11px' }}>
                  ⚠️ Ajustes solicitados
                </small>
                {u?.comentario && (
                  <small className="cell-sub cell-truncate" style={{ display: 'block', maxWidth: '160px', fontSize: '11px' }} title={u.comentario}>
                    “{u.comentario}”
                  </small>
                )}
              </div>
            )
          }

          if (esAprobado) {
            return (
              <small className="cell-sub text-verde" style={{ fontWeight: 600, fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Icon nombre="check-circle" tamano={12} /> Aprobado cliente
              </small>
            )
          }

          if (u?.fechaEnvioTexto) {
            return (
              <div style={{ fontSize: '11.5px' }}>
                <span style={{ color: 'var(--blue-700)', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                  <Icon nombre="send" tamano={11} /> {u.fechaEnvioTexto}
                </span>
                <small className="cell-sub" style={{ display: 'block', fontSize: '10.5px' }}>
                  {u.horaEnvioTexto || '09:00'} · Comercial
                </small>
              </div>
            )
          }

          return <span className="mut sm">— En diseño inicial</span>
        },
      },
      {
        clave: 'acciones',
        titulo: 'Acciones',
        ancho: '150px',
        render: (o) => (
          <div className="row-actions" style={{ gap: '4px' }}>
            <button
              className="btn btn-primary btn-xs"
              onClick={() => irA('disenos', o.id)}
              title="Abrir mesa de trabajo de diseño"
            >
              <Icon nombre="pen" tamano={12} /> Abrir mesa
            </button>
            <button
              className="btn btn-soft btn-xs"
              onClick={() => {
                setVersionSeleccionada(ultimaVersion(o))
                setPreviewFullModal(o)
              }}
              title="Previsualizar arte gráfico"
            >
              <Icon nombre="eye" tamano={12} />
            </button>
          </div>
        ),
      },
    ]

    return (
      <div>
        <PageHeader
          titulo="Mesa de Diseño y Pre-prensa"
          subtitulo="Gestión de propuestas gráficas, artes finales, control de versiones y pre-prensa técnica."
          icono="pen"
          acciones={
            <div className="view-toggle">
              <button
                className={modoVista === 'tabla' ? 'active' : ''}
                onClick={() => setModoVista('tabla')}
                aria-label="Vista compacta en planilla"
              >
                <Icon nombre="list2" tamano={14} /> Planilla
              </button>
              <button
                className={modoVista === 'galeria' ? 'active' : ''}
                onClick={() => setModoVista('galeria')}
                aria-label="Vista de tarjetas visuales"
              >
                <Icon nombre="grid" tamano={14} /> Galería
              </button>
            </div>
          }
        />

        {/* 4 KPIS RÁPIDOS DEL DISEÑADOR */}
        <div className="kpis" style={{ marginBottom: '18px' }}>
          <StatCard
            titulo="En diseño / Pre-prensa"
            valor={conteoEnDiseno}
            icono="pen"
            color="azul"
            detalle="Trabajos en borrador o revisión técnica"
            onClick={() => setFiltro('En diseño')}
          />
          <StatCard
            titulo="Cambios solicitados"
            valor={conteoCambios}
            icono="alert-triangle"
            color={conteoCambios > 0 ? 'rojo' : 'azul'}
            detalle="Atención prioritaria: ajustes de cliente"
            onClick={() => setFiltro('Cambios solicitados')}
          />
          <StatCard
            titulo="En gestión comercial"
            valor={conteoComercial}
            icono="clock"
            color="amarillo"
            detalle="Esperando visto bueno del cliente"
            onClick={() => setFiltro('Pendiente de gestión comercial')}
          />
          <StatCard
            titulo="Diseños aprobados"
            valor={conteoAprobados}
            icono="check-circle"
            color="verde"
            detalle="Listos para taller e impresión"
            onClick={() => setFiltro('Aprobado por el cliente')}
          />
        </div>

        {/* FILTROS POR ESTADO */}
        <div className="chips" style={{ marginBottom: '16px' }}>
          {FILTROS.map(([texto, valor]) => (
            <button
              key={texto}
              className={filtro === valor ? 'chip active' : 'chip'}
              onClick={() => setFiltro(valor)}
            >
              {texto} <span className="muted">({valor ? mios.filter((o) => o.disenoEstado === valor).length : mios.length})</span>
            </button>
          ))}
        </div>

        {modoVista === 'tabla' ? (
          <DataTable
            columnas={columnas}
            filas={lista}
            buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.material}`}
            placeholder="Buscar por orden, cliente, producto o material..."
            vacioTitulo="No se encontraron diseños para los filtros seleccionados"
          />
        ) : lista.length === 0 ? (
          <div className="card p">
            <EmptyState icono="image" titulo="No hay diseños en este estado" texto="Prueba cambiando los filtros." />
          </div>
        ) : (
          <div className="dz">
            {lista.map((o) => {
              const u = ultimaVersion(o)
              const stamp = STAMPS[o.disenoEstado] || STAMPS.Pendiente
              return (
                <article key={o.id} className="dc" onClick={() => irA('disenos', o.id)} style={{ cursor: 'pointer' }}>
                  <div className="dc-th">
                    <DesignPreview order={o} version={u} />
                    <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
                  </div>
                  <div className="dc-body">
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="sm mut" style={{ fontWeight: 700 }}>{o.id}</span>
                      <StatusBadge estado={o.disenoEstado} />
                    </div>
                    <h3 style={{ fontSize: '13.5px', margin: '0 0 2px' }}>{o.producto}</h3>
                    <p className="sm mut ell" style={{ margin: '0 0 6px', fontWeight: 600 }}>{o.cliente}</p>
                    {u?.fechaEnvioTexto && (
                      <div
                        className="sm"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: o.disenoEstado === 'Enviado' ? 'var(--blue-700, #1d4ed8)' : 'var(--text-muted, #64748b)',
                          marginBottom: '6px',
                          fontSize: '11px',
                          fontWeight: o.disenoEstado === 'Enviado' ? 600 : 400,
                        }}
                        title={`Versión ${u.numero} enviada`}
                      >
                        <Icon nombre="send" tamano={10} />
                        <span>Enviado: {u.fechaEnvioTexto}</span>
                      </div>
                    )}
                    <div className="row" style={{ justifyContent: 'space-between', fontSize: '11.5px', marginTop: 'auto' }}>
                      <span className="mut">{o.versiones.length} {o.versiones.length === 1 ? 'versión' : 'versiones'}</span>
                      <span className="link-inline" style={{ fontWeight: 600 }}>Abrir mesa →</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* MODAL DE ZOOM DE ARTE EN LISTA */}
        {previewFullModal && (
          <div className="modal-backdrop" onClick={() => setPreviewFullModal(false)}>
            <div className="modal" style={{ maxWidth: '820px', width: '92%' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="modal-head">
                <span className="modal-icon modal-icon-primary"><Icon nombre="image" tamano={20} /></span>
                <div>
                  <h2>{previewFullModal.producto} ({previewFullModal.id})</h2>
                  <p>Cliente: {previewFullModal.cliente} · Sustrato: {previewFullModal.material}</p>
                </div>
                <button className="icon-btn" onClick={() => setPreviewFullModal(false)} aria-label="Cerrar"><Icon nombre="x" /></button>
              </div>
              <div className="modal-body" style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-sunken)' }}>
                <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                  <DesignPreview order={previewFullModal} version={versionSeleccionada || ultimaVersion(previewFullModal)} grande />
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setPreviewFullModal(false)}>Cerrar vista previa</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setPreviewFullModal(false)
                    irA('disenos', previewFullModal.id)
                  }}
                >
                  <Icon nombre="pen" tamano={14} /> Abrir mesa de diseño
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Vista de mesa de diseño para una orden específica
  const ultima = ultimaVersion(order)
  const versionActual = versionSeleccionada || ultima
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  const puedeOperarDiseno = role === 'disenador' || role === 'coordinador'
  const esperando =
    order.disenoEstado === 'Pendiente de gestión comercial' ||
    order.disenoEstado === 'Esperando respuesta del cliente' ||
    order.disenoEstado === 'Enviado'
  const estaAprobado =
    order.disenoEstado === 'Aprobado por el cliente' ||
    order.disenoEstado === 'Listo para impresión' ||
    order.disenoEstado === 'Aprobado'
  const tieneCambios =
    order.disenoEstado === 'Cambios solicitados' ||
    order.disenoEstado === 'Requiere cambios'

  const puedeCrear =
    (order.versiones.length === 0 || tieneCambios || order.disenoEstado === 'En diseño' || order.disenoEstado === 'En proceso') &&
    puedeOperarDiseno
  const puedeEnviar =
    order.versiones.length > 0 &&
    (order.disenoEstado === 'En diseño' ||
      order.disenoEstado === 'En proceso' ||
      order.disenoEstado === 'Revisión técnica de archivo' ||
      !order.disenoEstado ||
      order.disenoEstado === 'Pendiente') &&
    puedeOperarDiseno

  const solicitudVinculada = (data.requests || []).find(
    (s) => s.id === order.solicitudId || s.ordenId === order.id
  )
  const archivosReferencia =
    order.archivosReferencia?.length > 0
      ? order.archivosReferencia
      : solicitudVinculada?.archivosReferencia || []

  function descargarAdjunto(a) {
    if (!a) return
    if (a.dataUrl) {
      const link = document.createElement('a')
      link.href = a.dataUrl
      link.download = a.nombre || 'referencia_cliente'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      actions?.notify?.(`Descargando archivo ${a.nombre}...`, 'exito')
      return
    }
    actions?.notify?.(`Archivo de referencia: ${a.nombre}`, 'info')
  }

  function handleCrearVersionSubmit(e) {
    e.preventDefault()
    const archivo = nombreArchivo.trim() || `Arte_Final_${order.id}_v${order.versiones.length + 1}.pdf`
    actions.designNewVersion(order.id, archivo, notasDisenador.trim())
    setModalNuevaVersion(false)
    setNombreArchivo('')
    setNotasDisenador('')
    setVersionSeleccionada(null)
  }

  return (
    <div>
      <PageHeader
        titulo={`${order.id} · ${order.producto}`}
        subtitulo={`Cliente: ${order.cliente} · Diseñadora: ${order.disenador}`}
        icono="pen"
        volver={{ texto: 'Volver a mesa de diseño', onClick: () => irA(role === 'disenador' ? 'inicio' : 'disenos') }}
        acciones={
          <div className="row" style={{ gap: '10px' }}>
            <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
            <StatusBadge estado={order.disenoEstado} />
          </div>
        }
      />

      {tieneCambios && (
        <Alert tipo="error" titulo="Cliente solicitó modificaciones">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><strong>Observaciones:</strong> “{ultima?.comentario || ultima?.contactoClienteObservaciones || 'El cliente solicitó ajustes antes de aprobar el diseño.'}”</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setNombreArchivo('')
                  setNotasDisenador('')
                  setModalNuevaVersion(true)
                }}
              >
                <Icon nombre="plus" tamano={14} /> Crear nueva versión con ajustes
              </button>
            </div>
          </div>
        </Alert>
      )}

      {estaAprobado && (
        <Alert tipo="exito" titulo="Diseño aprobado por el cliente">
          El cliente aprobó formalmente la versión {ultima?.numero}{ultima?.contactoClienteNombre ? ` (${ultima.contactoClienteNombre})` : ''}{ultima?.contactoClienteCanal ? ` vía ${ultima.contactoClienteCanal}` : ''}.
          {ultima?.contactoClienteEvidencia ? ` Evidencia registrada: ${ultima.contactoClienteEvidencia}.` : ''}
          {order.disenoEstado === 'Listo para impresión' ? ' La orden está liberada por Coordinación para taller.' : ' Pendiente de liberación de Coordinación para impresión.'}
        </Alert>
      )}

      {order.disenoEstado === 'Pendiente de gestión comercial' && (
        <Alert tipo="aviso" titulo="Propuesta enviada a Comercial">
          El diseño v{ultima?.numero} fue enviado a Comercial / Recepción{ultima?.fechaEnvioComercialTexto || ultima?.fechaEnvioTexto ? ` el ${ultima?.fechaEnvioComercialTexto || ultima?.fechaEnvioTexto} a las ${ultima?.horaEnvioComercialTexto || ultima?.horaEnvioTexto}` : ''}. Comercial está gestionando la presentación y visto bueno con el cliente.
        </Alert>
      )}

      {order.disenoEstado === 'Revisión técnica de archivo' && (
        <Alert tipo="aviso" titulo="Revisión técnica de pre-prensa (Arte suministrado por el cliente)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p>
              El cliente suministró su propio archivo de diseño terminado. Como diseñador / pre-prensista, debes verificar especificaciones técnicas antes de impresión:
              resolución mínima (300 DPI), espacio de color CMYK, sangrados/márgenes y escala 1:1.
            </p>
            {puedeOperarDiseno && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    actions.designSend(
                      order.id,
                      'Archivo suministrado por el cliente revisado y aprobado técnicamente en pre-prensa. Medidas, resolución y perfil de color conformes para impresión.'
                    )
                  }}
                >
                  <Icon nombre="check" tamano={14} /> Aprobar técnicamente archivo para pre-prensa
                </button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {order.disenoEstado === 'Esperando respuesta del cliente' && (
        <Alert tipo="aviso" titulo="Esperando respuesta del cliente">
          Comercial inició contacto con el cliente{ultima?.contactoClienteCanal ? ` vía ${ultima.contactoClienteCanal}` : ''}. En espera de confirmación formal.
        </Alert>
      )}

      {/* NAVEGACIÓN Y HERRAMIENTAS DE LA MESA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="tabs" role="tablist" style={{ margin: 0 }}>
          <button
            type="button"
            className={tabMesa === 'arte' ? 'on' : ''}
            onClick={() => setTabMesa('arte')}
          >
            <Icon nombre="image" tamano={14} /> Arte y lienzo ({order.versiones.length} {order.versiones.length === 1 ? 'versión' : 'versiones'})
          </button>
          <button
            type="button"
            className={tabMesa === 'ficha' ? 'on' : ''}
            onClick={() => setTabMesa('ficha')}
          >
            <Icon nombre="file-text" tamano={14} /> Ficha técnica y adjuntos {archivosReferencia.length > 0 ? `(${archivosReferencia.length})` : ''}
          </button>
          <button
            type="button"
            className={tabMesa === 'historial' ? 'on' : ''}
            onClick={() => setTabMesa('historial')}
          >
            <Icon nombre="clock" tamano={14} /> Historial y trazabilidad ({order.versiones.length})
          </button>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-soft btn-xs"
            onClick={() => setPreviewFullModal(order)}
            title="Previsualizar arte a pantalla completa con zoom"
            style={{ fontWeight: 600 }}
          >
            <Icon nombre="maximize" tamano={12} /> Zoom / Pantalla completa
          </button>
          {tabMesa === 'arte' && (
            <button
              type="button"
              className={`btn btn-xs ${panelLateralActivo ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => setPanelLateralActivo(!panelLateralActivo)}
              title="Mostrar u ocultar ficha técnica en panel lateral"
              style={{ fontWeight: 600 }}
            >
              <Icon nombre="layout" tamano={12} /> {panelLateralActivo ? 'Ocultar ficha lateral' : 'Ficha lateral'}
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑA 1: ARTE GRÁFICO Y PROPUESTAS */}
      {tabMesa === 'arte' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: panelLateralActivo ? 'minmax(0, 2fr) minmax(300px, 1fr)' : '1fr',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          <Panel titulo="Arte gráfico y propuestas" icono="image">
            {/* Selector de versiones */}
            {order.versiones.length > 0 && (
              <div className="ver" role="tablist" style={{ marginBottom: '12px' }}>
                {order.versiones.map((v) => (
                  <button
                    key={v.numero}
                    className={versionActual?.numero === v.numero ? 'on' : ''}
                    onClick={() => setVersionSeleccionada(v)}
                  >
                    Versión {v.numero} ({v.estado})
                  </button>
                ))}
              </div>
            )}

            <div className="design-preview-container" style={{ minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DesignPreview order={order} version={versionActual} grande />
            </div>

            <div className="actions" style={{ marginTop: '20px', flexWrap: 'wrap', gap: '8px' }}>
              <button
                className="btn btn-primary"
                disabled={!puedeCrear}
                onClick={() => {
                  setNombreArchivo('')
                  setNotasDisenador('')
                  setModalNuevaVersion(true)
                }}
              >
                <Icon nombre="plus" tamano={16} />
                {order.versiones.length === 0 ? 'Crear versión 1 con archivo' : 'Crear nueva versión'}
              </button>

              <button
                className="btn btn-success"
                disabled={!puedeEnviar}
                onClick={() => {
                  setObservacionesEnvio('')
                  setEnviando(true)
                }}
              >
                <Icon nombre="send" tamano={16} /> Enviar a Comercial
              </button>

              {esperando && role === 'coordinador' && (
                <button
                  className="btn btn-soft"
                  onClick={() => irA('aprobacion', order.id)}
                  title="Abrir mesa de gestión comercial y aprobación formal"
                >
                  <Icon nombre="check-circle" tamano={15} /> Ir a mesa de gestión comercial
                </button>
              )}
              {esperando && role === 'disenador' && (
                <span
                  className="chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}
                  title="El diseñador prepara y envía el arte a Comercial. La gestión y aprobación con el cliente corresponde a Comercial y Coordinación."
                >
                  <Icon nombre="clock" tamano={14} /> En gestión con Comercial / Recepción
                </span>
              )}
            </div>
          </Panel>

          {panelLateralActivo && (
            <Panel titulo="Ficha técnica rápida" icono="file-text">
              <dl className="details details-1" style={{ fontSize: '12px' }}>
                <div><dt>Material</dt><dd><strong>{order.material}</strong></dd></div>
                <div><dt>Medidas</dt><dd><strong>{order.dimensiones}</strong></dd></div>
                <div><dt>Cantidad</dt><dd>{order.cantidad} unidades</dd></div>
                <div><dt>Acabados</dt><dd>{order.acabados || 'Estándar'}</dd></div>
                <div><dt>Entrega</dt><dd>{order.fechaEntrega}</dd></div>
              </dl>
              {order.requerimientos && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', fontSize: '12px' }}>
                  <strong>Requerimientos:</strong>
                  <p className="sm mut" style={{ marginTop: '2px' }}>{order.requerimientos}</p>
                </div>
              )}
              {archivosReferencia.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                  <strong className="sm" style={{ display: 'block', marginBottom: '4px' }}>
                    Adjuntos cliente ({archivosReferencia.length}):
                  </strong>
                  <div className="stack" style={{ gap: '4px' }}>
                    {archivosReferencia.map((ref, idx) => (
                      <div key={ref.id || idx} className="row" style={{ justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg-subtle)', borderRadius: '4px' }}>
                        <span className="sm cell-truncate" style={{ maxWidth: '140px', fontSize: '11px' }}>{ref.nombre}</span>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => descargarAdjunto(ref)}>
                          <Icon nombre="download" tamano={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {/* PESTAÑA 2: FICHA TÉCNICA Y REQUERIMIENTOS A ANCHO COMPLETO */}
      {tabMesa === 'ficha' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          <Panel titulo="Ficha técnica del pedido" icono="file-text">
            <dl className="details details-1">
              <div><dt>Material</dt><dd>{order.material}</dd></div>
              <div><dt>Dimensiones</dt><dd>{order.dimensiones}</dd></div>
              <div><dt>Cantidad</dt><dd>{order.cantidad} unidades</dd></div>
              <div><dt>Colores</dt><dd>{order.colores || 'CMYK Full color'}</dd></div>
              <div><dt>Acabados</dt><dd>{order.acabados || 'Estándar'}</dd></div>
              <div><dt>Fecha de entrega</dt><dd>{order.fechaEntrega}</dd></div>
            </dl>
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <strong>Requerimientos del cliente:</strong>
              <p className="sm mut" style={{ marginTop: '4px' }}>
                {order.requerimientos || order.observaciones || 'Sin especificaciones adicionales.'}
              </p>
            </div>
          </Panel>

          <Panel titulo={`Archivos de referencia del cliente (${archivosReferencia.length})`} icono="paperclip">
            {archivosReferencia.length === 0 ? (
              <p className="sm mut">No hay archivos adjuntos para este pedido.</p>
            ) : (
              <div className="stack" style={{ gap: '8px' }}>
                {archivosReferencia.map((ref, idx) => (
                  <div
                    key={ref.id || idx}
                    className="row"
                    style={{
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon nombre="paperclip" tamano={14} />
                      <strong>{ref.nombre}</strong>
                    </div>
                    <div className="row" style={{ gap: '6px' }}>
                      {ref.dataUrl && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArchivoPreview(ref)}>
                          <Icon nombre="eye" tamano={13} /> Ver
                        </button>
                      )}
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => descargarAdjunto(ref)}>
                        <Icon nombre="download" tamano={13} /> Descargar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* PESTAÑA 3: HISTORIAL DE VERSIONES Y ARCHIVOS A ANCHO COMPLETO */}
      {tabMesa === 'historial' && (
        <Panel titulo="Historial completo de versiones y trazabilidad técnica" icono="clock">
          {order.versiones.length === 0 ? (
            <p className="sm mut">Aún no hay versiones creadas.</p>
          ) : (
            <div className="stack" style={{ gap: '12px' }}>
              {order.versiones.map((v) => (
                <div key={v.numero} className="version-item-card" style={{ padding: '12px 16px' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px' }}>Versión {v.numero}</strong>
                      <StatusBadge estado={v.estado} />
                    </div>
                    <span className="sm mut">{v.fecha} · Diseñador: <strong>{v.disenador}</strong></span>
                  </div>
                  {v.fechaEnvioTexto && (
                    <div
                      className="sm"
                      style={{
                        marginTop: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: 'var(--blue-700, #1d4ed8)',
                        fontWeight: 600,
                      }}
                    >
                      <Icon nombre="send" tamano={13} />
                      <span>Enviado al cliente: {v.fechaEnvioTexto} a las {v.horaEnvioTexto}</span>
                    </div>
                  )}
                  {v.archivoNombre && (
                    <div className="sm" style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-600)' }}>
                      <Icon nombre="file-text" tamano={14} />
                      <span>Archivo: <strong>{v.archivoNombre}</strong></span>
                    </div>
                  )}
                  {v.observacionesDisenador && (
                    <p className="sm mut" style={{ margin: '6px 0 0' }}>
                      <strong>Nota técnica del diseñador:</strong> {v.observacionesDisenador}
                    </p>
                  )}
                  {v.comentario && (
                    <p className="comment-text" style={{ marginTop: '8px' }}>
                      “{v.comentario}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* MODAL VISTA PREVIA DE ARCHIVO DE REFERENCIA */}
      {archivoPreview && (
        <div className="modal-backdrop" onClick={() => setArchivoPreview(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="paperclip" tamano={20} /></span>
              <div>
                <h2>{archivoPreview.nombre}</h2>
                <p>Archivo de referencia del cliente</p>
              </div>
              <button className="icon-btn" onClick={() => setArchivoPreview(null)}><Icon nombre="x" /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {archivoPreview.dataUrl?.startsWith('data:image') ? (
                <img src={archivoPreview.dataUrl} alt={archivoPreview.nombre} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)' }} />
              ) : archivoPreview.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={archivoPreview.nombre} src={archivoPreview.dataUrl} style={{ width: '100%', height: '400px', border: '1px solid var(--border-light)' }} />
              ) : (
                <p className="sm mut">Archivo listo para descarga directa.</p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setArchivoPreview(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" onClick={() => descargarAdjunto(archivoPreview)}>
                <Icon nombre="download" tamano={14} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HU-11: Crear nueva versión con selector de archivo y observaciones */}
      {modalNuevaVersion && (
        <div className="modal-backdrop" onClick={() => setModalNuevaVersion(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nueva versión de diseño">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="pen" tamano={20} /></span>
              <div>
                <h2>Crear versión {order.versiones.length + 1} de diseño</h2>
                <p>Orden {order.id} · {order.producto}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalNuevaVersion(false)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleCrearVersionSubmit} className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
                <div className="field full">
                  <label className="field-label" htmlFor="fileInput">
                    Archivo de arte o propuesta (PDF, AI, PSD, PNG, JPG)
                  </label>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".pdf,.ai,.psd,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) setNombreArchivo(file.name)
                    }}
                    style={{ padding: '6px 8px' }}
                  />
                  {nombreArchivo && (
                    <span className="sm" style={{ color: 'var(--state-green)', marginTop: '4px', display: 'block' }}>
                      Archivo cargado: <strong>{nombreArchivo}</strong>
                    </span>
                  )}
                  <span className="field-hint">
                    En este prototipo se asocia el nombre del archivo seleccionado. La carga persistente se integrará con el bucket en Cloud Storage / S3 desde el backend.
                  </span>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="notasDiseno">
                    Observaciones y notas del diseñador
                  </label>
                  <textarea
                    id="notasDiseno"
                    rows="3"
                    value={notasDisenador}
                    onChange={(e) => setNotasDisenador(e.target.value)}
                    placeholder="Describe los cambios realizados, fuentes tipográficas, modo de color CMYK o resolución..."
                  />
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalNuevaVersion(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Crear versión en borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Enviar diseño a Comercial / Recepción */}
      {enviando && (
        <Modal
          titulo="Enviar propuesta gráfica a Comercial / Recepción"
          subtitulo={`Orden ${order.id} · Versión ${ultima?.numero}`}
          icono="send"
          mensaje={`El arte gráfico v${ultima?.numero} será enviado a la bandeja de Comercial / Recepción para que inicien la comunicación y gestión del visto bueno con el cliente ${order.cliente}. Se registrará la fecha y hora de envío.`}
          textoBoton="Confirmar y enviar a Comercial"
          tipoBoton="success"
          onClose={() => setEnviando(false)}
          onConfirm={() => {
            actions.designSend(order.id, observacionesEnvio)
            setEnviando(false)
          }}
        />
      )}

      {/* MODAL HU-12: Solicitar cambios al diseño */}
      {rechazando && (
        <Modal
          titulo="Solicitar cambios al diseño"
          subtitulo={`Orden ${order.id} · Versión ${ultima?.numero}`}
          icono="edit"
          etiqueta="Observaciones y ajustes requeridos por el cliente"
          minimo={5}
          textoBoton="Registrar solicitud de cambios"
          tipoBoton="danger"
          onClose={() => setRechazando(false)}
          onConfirm={(texto) => {
            actions.designReject(order.id, texto)
            setRechazando(false)
          }}
        />
      )}

      {/* MODAL DE ZOOM / PANTALLA COMPLETA DEL ARTE EN MESA DE DISEÑO */}
      {previewFullModal && (
        <div className="modal-backdrop" onClick={() => setPreviewFullModal(false)}>
          <div className="modal" style={{ maxWidth: '840px', width: '92%' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="image" tamano={20} /></span>
              <div>
                <h2>{order.producto} ({order.id})</h2>
                <p>Versión {versionActual?.numero || ultima?.numero} · Sustrato: {order.material} · Medidas: {order.dimensiones}</p>
              </div>
              <button className="icon-btn" onClick={() => setPreviewFullModal(false)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--surface-sunken)' }}>
              <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                <DesignPreview order={order} version={versionActual} grande />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-primary" onClick={() => setPreviewFullModal(false)}>
                Cerrar vista previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
