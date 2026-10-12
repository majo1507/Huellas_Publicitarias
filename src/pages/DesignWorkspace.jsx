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
import { ROLES } from '../data/roles.js'
import { ultimaVersion } from '../utils/format.js'

const FILTROS = [
  ['Todos', null],
  ['Pendientes', 'Pendiente'],
  ['En proceso', 'En proceso'],
  ['Enviados', 'Enviado'],
  ['Aprobados', 'Aprobado'],
  ['Rechazados', 'Requiere cambios'],
]

// Map de sello de estado
const STAMPS = {
  Aprobado: { cls: 'stamp-apr', txt: 'APROBADO' },
  Aprobada: { cls: 'stamp-apr', txt: 'APROBADO' },
  Enviado: { cls: 'stamp-pen', txt: 'PENDIENTE' },
  'En proceso': { cls: 'stamp-bor', txt: 'EN PROCESO' },
  'Requiere cambios': { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Rechazada: { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Pendiente: { cls: 'stamp-pen', txt: 'PENDIENTE' },
}

export default function DesignWorkspace({ order, data, actions, irA }) {
  const [filtro, setFiltro] = useState(null)
  const [modoVista, setModoVista] = useState('galeria') // 'galeria' | 'tabla'
  const [rechazando, setRechazando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)

  // Sin orden seleccionada: lista y galería de diseños
  if (!order) {
    const nombre = ROLES.disenador.usuario.nombre
    const mios = data.orders.filter((o) => o.disenador === nombre)
    const lista = filtro ? mios.filter((o) => o.disenoEstado === filtro) : mios

    const columnas = [
      { clave: 'id', titulo: 'Orden', ordenar: true, render: (o) => <strong>{o.id}</strong> },
      { clave: 'cliente', titulo: 'Cliente', ordenar: true },
      { clave: 'producto', titulo: 'Producto', ordenar: true },
      { clave: 'versiones', titulo: 'Versiones', render: (o) => o.versiones.length, valor: (o) => o.versiones.length, ordenar: true },
      { clave: 'disenoEstado', titulo: 'Estado del diseño', render: (o) => <StatusBadge estado={o.disenoEstado} /> },
      { clave: 'abrir', titulo: '', render: (o) => <button className="btn btn-sm" onClick={() => irA('disenos', o.id)}><Icon nombre="eye" tamano={14} /> Abrir orden</button> },
    ]

    return (
      <div>
        <PageHeader
          titulo="Diseños y propuestas gráficas"
          subtitulo="Galería visual de piezas publicitarias, artes finales y control de versiones."
          icono="pen"
          acciones={
            <div className="view-toggle">
              <button
                className={modoVista === 'galeria' ? 'active' : ''}
                onClick={() => setModoVista('galeria')}
                aria-label="Vista de galería visual"
              >
                <Icon nombre="grid" tamano={15} /> Galería
              </button>
              <button
                className={modoVista === 'tabla' ? 'active' : ''}
                onClick={() => setModoVista('tabla')}
                aria-label="Vista de tabla"
              >
                <Icon nombre="list2" tamano={15} /> Tabla
              </button>
            </div>
          }
        />

        <div className="chips">
          {FILTROS.map(([texto, valor]) => (
            <button key={texto} className={filtro === valor ? 'chip active' : 'chip'} onClick={() => setFiltro(valor)}>
              {texto} <span className="muted">({valor ? mios.filter((o) => o.disenoEstado === valor).length : mios.length})</span>
            </button>
          ))}
        </div>

        {modoVista === 'galeria' ? (
          lista.length === 0 ? (
            <div className="card p">
              <EmptyState icono="image" titulo="No hay diseños en este estado" texto="Prueba cambiando los filtros." />
            </div>
          ) : (
            <div className="dz">
              {lista.map((o) => {
                const u = ultimaVersion(o)
                const stamp = STAMPS[o.disenoEstado] || STAMPS.Pendiente
                return (
                  <article
                    key={o.id}
                    className="dc2"
                    onClick={() => irA('disenos', o.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="dc2-preview">
                      <DesignPreview order={o} version={u} />
                    </div>
                    <div className="in">
                      <div className="dc2-head">
                        <strong>{o.id}</strong>
                        <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
                      </div>
                      <div className="dc2-title">{o.producto}</div>
                      <div className="sm mut">{o.cliente}</div>
                      <div className="dc2-foot">
                        <span>{u ? `Versión ${u.numero}` : 'Borrador'}</span>
                        <span>Entrega: {o.fechaEntrega}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        ) : (
          <DataTable
            columnas={columnas}
            filas={lista}
            buscar={(o) => `${o.id} ${o.cliente} ${o.producto}`}
            placeholder="Buscar por orden, cliente o producto"
            porPagina={8}
            vacioTitulo="No hay diseños en este estado"
            vacioTexto="Prueba con otro filtro."
          />
        )}
      </div>
    )
  }

  // Con orden seleccionada: Espacio de trabajo del diseño
  const ultima = ultimaVersion(order)
  const versionActual = versionSeleccionada || ultima
  const puedeCrear = !ultima || ultima.estado === 'Rechazada'
  const puedeEnviar = ultima?.estado === 'En proceso'
  const esperando = ultima?.estado === 'Enviada'
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  return (
    <div>
      <PageHeader
        titulo={`${order.id} · ${order.producto}`}
        subtitulo={`Cliente: ${order.cliente} · Diseñadora: ${order.disenador}`}
        icono="pen"
        volver={{ texto: 'Volver a galería de diseños', onClick: () => irA('disenos') }}
        acciones={
          <div className="row" style={{ gap: '10px' }}>
            <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
            <StatusBadge estado={order.disenoEstado} />
          </div>
        }
      />

      {order.disenoEstado === 'Requiere cambios' && (
        <Alert tipo="error" titulo="Observaciones del cliente">
          {ultima?.comentario || 'El cliente solicitó ajustes antes de aprobar el diseño.'}
        </Alert>
      )}
      {order.disenoEstado === 'Aprobado' && (
        <Alert tipo="exito" titulo="Diseño aprobado">
          El cliente aprobó la versión {ultima?.numero}. La orden ya puede programarse para producción.
        </Alert>
      )}
      {esperando && (
        <Alert tipo="aviso" titulo="En espera de aprobación">
          El diseño se encuentra en revisión con el cliente. Puedes simular su respuesta para la presentación.
        </Alert>
      )}

      <div className="grid-main">
        {/* Mesa de diseño / visualizador interactivo */}
        <Panel titulo="Arte gráfico y propuestas" icono="image">
          {/* Selector de versiones */}
          {order.versiones.length > 0 && (
            <div className="ver" role="tablist">
              {order.versiones.map((v) => (
                <button
                  key={v.numero}
                  className={(versionActual?.numero === v.numero) ? 'on' : ''}
                  onClick={() => setVersionSeleccionada(v)}
                >
                  Versión {v.numero} ({v.estado})
                </button>
              ))}
            </div>
          )}

          <div className="design-preview-container">
            <DesignPreview order={order} version={versionActual} grande />
          </div>

          <div className="actions" style={{ marginTop: '20px' }}>
            <button
              className="btn btn-primary"
              disabled={!puedeCrear}
              onClick={() => {
                actions.designNewVersion(order.id)
                setVersionSeleccionada(null)
              }}
            >
              <Icon nombre="plus" tamano={16} />
              {order.versiones.length === 0 ? 'Crear versión 1' : 'Crear nueva versión'}
            </button>

            <button
              className="btn btn-success"
              disabled={!puedeEnviar}
              onClick={() => setEnviando(true)}
            >
              <Icon nombre="send" tamano={16} /> Enviar diseño al cliente
            </button>

            {esperando && (
              <>
                <button className="btn" onClick={() => actions.designApprove(order.id)}>
                  <Icon nombre="check" tamano={15} /> Simular aprobación
                </button>
                <button className="btn btn-danger" onClick={() => setRechazando(true)}>
                  <Icon nombre="edit" tamano={15} /> Simular cambios
                </button>
              </>
            )}
          </div>
        </Panel>

        {/* Especificaciones y fichas técnicas */}
        <div className="stack">
          <Panel titulo="Ficha técnica del pedido" icono="file-text">
            <dl className="details details-1">
              <div><dt>Material</dt><dd>{order.material}</dd></div>
              <div><dt>Dimensiones</dt><dd>{order.dimensiones}</dd></div>
              <div><dt>Cantidad</dt><dd>{order.cantidad} unidades</dd></div>
              <div><dt>Colores</dt><dd>{order.colores}</dd></div>
              <div><dt>Acabados</dt><dd>{order.acabados}</dd></div>
              <div><dt>Fecha de entrega</dt><dd>{order.fechaEntrega}</dd></div>
            </dl>
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
              <strong>Requerimientos del cliente:</strong>
              <p className="sm mut" style={{ marginTop: '4px' }}>
                {order.requerimientos || order.observaciones || 'Sin especificaciones adicionales.'}
              </p>
            </div>
          </Panel>

          <Panel titulo="Historial de versiones" icono="clock">
            {order.versiones.length === 0 ? (
              <p className="sm mut">Aún no hay versiones creadas.</p>
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
      </div>

      {enviando && (
        <Modal
          titulo="Enviar diseño al cliente"
          icono="send"
          mensaje={`Se notificará al cliente ${order.cliente} con la propuesta de diseño para su revisión y aprobación formal.`}
          textoBoton="Confirmar y enviar"
          tipoBoton="success"
          onClose={() => setEnviando(false)}
          onConfirm={() => {
            actions.designSend(order.id)
            setEnviando(false)
          }}
        />
      )}

      {rechazando && (
        <Modal
          titulo="Solicitar cambios al diseño"
          icono="edit"
          etiqueta="Observaciones y ajustes requeridos"
          minimo={5}
          textoBoton="Registrar observaciones"
          tipoBoton="danger"
          onClose={() => setRechazando(false)}
          onConfirm={(texto) => {
            actions.designReject(order.id, texto)
            setRechazando(false)
          }}
        />
      )}
    </div>
  )
}
