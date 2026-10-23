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

const STAMPS = {
  Aprobado: { cls: 'stamp-apr', txt: 'APROBADO' },
  Aprobada: { cls: 'stamp-apr', txt: 'APROBADO' },
  Enviado: { cls: 'stamp-pen', txt: 'PENDIENTE' },
  'En proceso': { cls: 'stamp-bor', txt: 'EN PROCESO' },
  'Requiere cambios': { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Rechazada: { cls: 'stamp-rec', txt: 'RECHAZADO' },
  Pendiente: { cls: 'stamp-pen', txt: 'PENDIENTE' },
}

export default function DesignWorkspace({ order, data, actions, irA, role }) {
  const [filtro, setFiltro] = useState(null)
  const [modoVista, setModoVista] = useState('galeria') // 'galeria' | 'tabla'
  const [rechazando, setRechazando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [observacionesEnvio, setObservacionesEnvio] = useState('')
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)

  // Estado para creación de nueva versión con archivo y notas (HU-11)
  const [modalNuevaVersion, setModalNuevaVersion] = useState(false)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [notasDisenador, setNotasDisenador] = useState('')

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
                  <article key={o.id} className="dc" onClick={() => irA('disenos', o.id)} style={{ cursor: 'pointer' }}>
                    <div className="dc-th">
                      <DesignPreview order={o} version={u} />
                      <span className={`stamp ${stamp.cls}`}>{stamp.txt}</span>
                    </div>
                    <div className="dc-body">
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="sm mut">{o.id}</span>
                        <StatusBadge estado={o.disenoEstado} />
                      </div>
                      <h3 style={{ fontSize: '14px', margin: '0 0 2px' }}>{o.producto}</h3>
                      <p className="sm mut ell" style={{ margin: '0 0 8px' }}>{o.cliente}</p>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: '12px' }}>
                        <span className="mut">{o.versiones.length} {o.versiones.length === 1 ? 'versión' : 'versiones'}</span>
                        <span className="link-inline">Ver mesa →</span>
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
            placeholder="Buscar por orden, cliente o producto..."
            vacioTitulo="No se encontraron diseños"
          />
        )}
      </div>
    )
  }

  // Vista de mesa de diseño para una orden específica
  const ultima = ultimaVersion(order)
  const versionActual = versionSeleccionada || ultima
  const stamp = STAMPS[order.disenoEstado] || STAMPS.Pendiente

  const puedeCrear = order.disenoEstado !== 'Enviado'
  const puedeEnviar = order.versiones.length > 0 && order.disenoEstado === 'En proceso'
  const esperando = order.disenoEstado === 'Enviado'

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
          El cliente aprobó formalmente la versión {ultima?.numero}. La orden se encuentra habilitada para impresión en taller.
        </Alert>
      )}
      {esperando && (
        <Alert tipo="aviso" titulo="En espera de aprobación">
          El diseño se encuentra en revisión formal con el cliente.
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
                  className={versionActual?.numero === v.numero ? 'on' : ''}
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
              <Icon nombre="send" tamano={16} /> Enviar diseño al cliente
            </button>

            {esperando && (
              <>
                <button className="btn btn-soft" onClick={() => actions.designApprove(order.id, 'Aprobación simulada por coordinador')}>
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

          <Panel titulo="Historial de versiones y archivos" icono="clock">
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
                    {v.archivoNombre && (
                      <div className="sm" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--blue-600)' }}>
                        <Icon nombre="file-text" tamano={14} />
                        <span>{v.archivoNombre}</span>
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
      </div>

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

      {/* MODAL HU-11: Enviar diseño para aprobación del cliente */}
      {enviando && (
        <Modal
          titulo="Enviar propuesta de diseño al cliente"
          subtitulo={`Orden ${order.id} · Versión ${ultima?.numero}`}
          icono="send"
          mensaje={`Se notificará al cliente ${order.cliente} con el arte gráfico v${ultima?.numero} para su revisión formal. La orden avanzará a la etapa de Aprobación.`}
          textoBoton="Confirmar y enviar al cliente"
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
    </div>
  )
}
