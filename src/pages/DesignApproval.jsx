import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import DesignPreview from '../components/DesignPreview.jsx'
import { etiquetaDiseno, ultimaVersion } from '../utils/format.js'

const STAMPS = {
  Aprobado: { cls: 'stamp-apr', txt: 'APROBADO' },
  Aprobada: { cls: 'stamp-apr', txt: 'APROBADO' },
  Enviado: { cls: 'stamp-pen', txt: 'PENDIENTE' },
  'En proceso': { cls: 'stamp-bor', txt: 'EN PROCESO' },
  'Requiere cambios': { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Rechazada: { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Pendiente: { cls: 'stamp-pen', txt: 'PENDIENTE' },
}

export default function DesignApproval({ order, actions, irA, role }) {
  const [pidiendoCambios, setPidiendoCambios] = useState(false)
  const [confirmandoAprobacion, setConfirmandoAprobacion] = useState(false)
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)
  const [nombreDecisor] = useState('')

  if (!order) {
    return <EmptyState icono="check-circle" titulo="Selecciona un pedido" texto="Elige un pedido para revisar la aprobación de su diseño." />
  }

  const esCliente = role === 'cliente'
  const esCoordinador = role === 'coordinador' || role === 'gerencia'
  const ultima = ultimaVersion(order)
  const versionActual = versionSeleccionada || ultima
  const puedeResponder = order.disenoEstado === 'Enviado' && (esCliente || role === 'coordinador')
  const estaAprobado = order.disenoEstado === 'Aprobado' || ultima?.estado === 'Aprobada'
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  const decisorFinal = nombreDecisor || (order.entrega?.contacto || order.cliente)

  return (
    <div>
      <PageHeader
        titulo="Mesa de aprobación de diseño"
        subtitulo={`${order.id} · ${order.cliente} · ${order.producto}`}
        icono="check-circle"
        volver={{ texto: 'Volver al pedido', onClick: () => irA('detalle', order.id) }}
        acciones={
          <div className="row" style={{ gap: '10px' }}>
            <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
            <StatusBadge estado={esCliente ? etiquetaDiseno(order.disenoEstado) : order.disenoEstado} />
          </div>
        }
      />

      {/* Regla de negocio destacada con candado */}
      <div className={`ban ${estaAprobado ? 'gr' : 'am'}`} style={{ marginBottom: '20px' }}>
        <Icon nombre={estaAprobado ? 'check-circle' : 'lock'} tamano={18} />
        <div>
          <strong>Regla de producción:</strong> Ninguna orden puede pasar a impresión sin la aprobación documentada del cliente.
          {estaAprobado ? (
            <span className="ban-sub ok">
              Regla cumplida: diseño aprobado por el cliente. Autorizado para taller.
            </span>
          ) : (
            <span className="ban-sub warn">
              Pendiente de aprobación: el paso a impresión se encuentra bloqueado.
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
                  className={(versionActual?.numero === v.numero) ? 'on' : ''}
                  onClick={() => setVersionSeleccionada(v)}
                >
                  <Icon nombre="layers" tamano={14} /> Versión {v.numero}
                </button>
              ))}
            </div>
          )}

          <div className="design-preview-container">
            <DesignPreview order={order} version={versionActual} grande />
          </div>

          {/* Flujo de etapas de aprobación (sin flechas de texto decorativas) */}
          <div className="flowst-wrap">
            <span className="sm mut">Estado en el ciclo de aprobación</span>
            <div className="flowst" role="list">
              <span role="listitem" className={`o ${order.disenoEstado === 'En proceso' || order.disenoEstado === 'Pendiente' ? 'on' : ''}`}>
                <Icon nombre="pen" tamano={13} /> Borrador
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Enviado' ? 'on' : ''}`}>
                <Icon nombre="send" tamano={13} /> En revisión
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Aprobado' ? 'on ok' : ''}`}>
                <Icon nombre="check-circle" tamano={13} /> Aprobado
              </span>
              <span role="listitem" className={`o ${order.disenoEstado === 'Requiere cambios' ? 'on err' : ''}`}>
                <Icon nombre="alert-circle" tamano={13} /> Con cambios
              </span>
            </div>
          </div>

          {/* Acciones de aprobación */}
          <div className="actions" style={{ marginTop: '20px' }}>
            <button
              className="btn btn-success"
              disabled={!puedeResponder}
              onClick={() => setConfirmandoAprobacion(true)}
            >
              <Icon nombre="check" tamano={16} /> Aprobar diseño
            </button>

            <button
              className="btn btn-danger"
              disabled={!puedeResponder}
              onClick={() => setPidiendoCambios(true)}
            >
              <Icon nombre="edit" tamano={16} /> Solicitar cambios
            </button>

            {esCoordinador && order.estado === 'Aprobación' && (
              <button
                className={estaAprobado ? 'btn btn-primary' : 'btn btn-locked'}
                disabled={!estaAprobado}
                onClick={() => actions.advanceStage(order.id)}
                title={estaAprobado ? 'Enviar orden a taller de producción' : 'Bloqueado hasta que el diseño esté aprobado'}
              >
                <Icon nombre={estaAprobado ? 'printer' : 'lock'} tamano={16} />
                {estaAprobado ? 'Enviar a producción' : 'Producción bloqueada'}
              </button>
            )}
          </div>
        </Panel>

        {/* Panel derecho con datos de registro y trazabilidad */}
        <div className="stack">
          <Panel titulo="Registro de la decisión" icono="file-text">
            <dl className="details details-1">
              <div><dt>Cliente</dt><dd>{order.cliente}</dd></div>
              <div><dt>Contacto decisor</dt><dd>{decisorFinal}</dd></div>
              <div><dt>Producto</dt><dd>{order.producto}</dd></div>
              <div><dt>Diseñadora</dt><dd>{order.disenador}</dd></div>
              <div><dt>Dimensiones</dt><dd>{order.dimensiones}</dd></div>
              <div><dt>Material</dt><dd>{order.material}</dd></div>
            </dl>

            {versionActual?.comentario && (
              <div className="comment-box" style={{ marginTop: '14px' }}>
                <strong>Observaciones del cliente</strong>
                <p>“{versionActual.comentario}”</p>
              </div>
            )}
          </Panel>

          <Panel titulo="Trazabilidad de versiones" icono="clock">
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
                  {v.aprobadoPor && (
                    <div className="sm" style={{ color: 'var(--state-green)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon nombre="check" tamano={13} /> Aprobado por {v.aprobadoPor} ({v.fechaAprobacion || v.fecha})
                    </div>
                  )}
                  {v.comentario && <p className="comment-text">“{v.comentario}”</p>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Modal de confirmación de aprobación */}
      {confirmandoAprobacion && (
        <Modal
          titulo="Registrar aprobación de diseño"
          icono="check-circle"
          tipoBoton="success"
          textoBoton="Confirmar aprobación"
          subtitulo={`Orden ${order.id} · Versión vigente: v${ultima?.numero}`}
          mensaje={`¿Confirmas que la versión vigente (${ultima?.numero}) fue aprobada por ${decisorFinal}? Quedará registrado en el historial de producción y se habilitará el paso a impresión.`}
          onClose={() => setConfirmandoAprobacion(false)}
          onConfirm={() => {
            actions.designApprove(order.id, `Aprobado por ${decisorFinal}`)
            setConfirmandoAprobacion(false)
          }}
        />
      )}

      {/* Modal de solicitud de cambios */}
      {pidiendoCambios && (
        <Modal
          titulo="Solicitar cambios al diseño"
          icono="edit"
          etiqueta="¿Qué ajustes o cambios necesita la propuesta gráfica?"
          minimo={5}
          tipoBoton="danger"
          textoBoton="Registrar solicitud de cambios"
          onClose={() => setPidiendoCambios(false)}
          onConfirm={(texto) => {
            actions.designReject(order.id, texto)
            setPidiendoCambios(false)
          }}
        />
      )}
    </div>
  )
}
