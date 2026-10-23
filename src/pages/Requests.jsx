import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { formatoCOP } from '../utils/format.js'

const ESTADOS = ['Pendiente', 'En validación', 'Aprobada', 'Devuelta para corrección', 'Rechazada']

// Solicitudes de clientes.
// Comercial: las envía a validación o ajusta devueltas.
// Coordinador: las valida (genera la orden), las devuelve para corrección o las rechaza.
export default function Requests({ data, actions, irA, role }) {
  const [rechazando, setRechazando] = useState(null) // id de solicitud a rechazar
  const [devolviendo, setDevolviendo] = useState(null) // id de solicitud a devolver para corrección
  const [validando, setValidando] = useState(null) // solicitud a validar (objeto completo)
  const [detalle, setDetalle] = useState(null) // solicitud a inspeccionar en modal de detalle

  const esCoordinador = role === 'coordinador' || role === 'gerencia'
  const porValidar = data.requests.filter((s) => s.estado === 'En validación').length
  const porEnviar = data.requests.filter((s) => s.estado === 'Pendiente').length
  const devueltas = data.requests.filter((s) => s.estado === 'Devuelta para corrección').length

  const columnas = [
    {
      clave: 'id',
      titulo: 'Solicitud',
      ordenar: true,
      render: (s) => (
        <button
          className="link-inline"
          onClick={() => setDetalle(s)}
          title="Ver detalle de la solicitud"
          style={{ fontWeight: 600 }}
        >
          {s.id}
        </button>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    {
      clave: 'producto',
      titulo: 'Producto',
      render: (s) => (
        <>
          <strong>{s.producto}</strong>
          <small className="cell-sub">{s.cantidad} uds · {s.dimensiones}</small>
        </>
      ),
    },
    { clave: 'presupuesto', titulo: 'Presupuesto', ordenar: true, render: (s) => formatoCOP(s.presupuesto) },
    { clave: 'fechaEntrega', titulo: 'Entrega' },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (s) => (
        <div>
          <StatusBadge estado={s.estado} />
          {s.motivoRechazo && (
            <small
              className={`cell-sub ${s.estado === 'Devuelta para corrección' ? 'text-amber' : 'text-rojo'}`}
              style={{ display: 'block', maxWidth: '220px', whiteSpace: 'normal' }}
            >
              {s.motivoRechazo}
            </small>
          )}
        </div>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (s) => (
        <div className="row-actions" style={{ flexWrap: 'wrap', gap: '4px' }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => setDetalle(s)}
            title="Ver ficha completa de la solicitud"
          >
            <Icon nombre="eye" tamano={13} /> Detalle
          </button>

          {role === 'comercial' && (s.estado === 'Pendiente' || s.estado === 'Devuelta para corrección') && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => actions.sendToValidation(s.id)}
              title={s.estado === 'Devuelta para corrección' ? 'Reenviar solicitud corregida a validación' : 'Enviar a validación'}
            >
              <Icon nombre="send" tamano={13} /> {s.estado === 'Devuelta para corrección' ? 'Reenviar' : 'Enviar'}
            </button>
          )}

          {esCoordinador && s.estado === 'En validación' && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={() => setValidando(s)}
                title="Revisar y generar orden de producción"
              >
                <Icon nombre="check" tamano={13} /> Validar
              </button>
              <button
                className="btn btn-soft btn-sm"
                onClick={() => setDevolviendo(s.id)}
                title="Devolver al comercial para corrección de datos"
                style={{ color: 'var(--state-amber-text)' }}
              >
                Devolver
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setRechazando(s.id)}
                title="Rechazar definitivamente la solicitud"
              >
                Rechazar
              </button>
            </>
          )}

          {s.ordenId && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => irA('detalle', s.ordenId)}
              title={`Ir al detalle de la orden ${s.ordenId}`}
            >
              <Icon nombre="clipboard" tamano={13} /> Ver {s.ordenId}
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo={esCoordinador ? 'Validar solicitudes' : 'Solicitudes de clientes'}
        subtitulo={
          esCoordinador
            ? 'Supervisión técnica, verificación de viabilidad y generación de órdenes de producción.'
            : 'Recepción, especificaciones y seguimiento del estado de validación.'
        }
        icono="inbox"
        acciones={
          role === 'comercial' && (
            <button className="btn btn-primary" onClick={() => irA('nuevo')}>
              <Icon nombre="plus" tamano={16} /> Registrar solicitud
            </button>
          )
        }
      />

      {esCoordinador && porValidar > 0 && (
        <Alert tipo="aviso" titulo={`${porValidar} solicitud(es) esperan tu validación técnica`}>
          Revisa las especificaciones antes de decidir: puedes aprobar para generar la orden, devolver para corrección o rechazarla.
        </Alert>
      )}

      {role === 'comercial' && devueltas > 0 && (
        <Alert tipo="aviso" titulo={`${devueltas} solicitud(es) devuelta(s) para corrección`}>
          El coordinador solicitó ajustes técnicos en estas solicitudes. Revisa el motivo y reenvíalas a validación.
        </Alert>
      )}

      {role === 'comercial' && porEnviar > 0 && (
        <Alert tipo="info" titulo={`${porEnviar} solicitud(es) pendientes de envío`}>
          Envíalas a validación cuando hayas verificado los requerimientos del cliente.
        </Alert>
      )}

      <DataTable
        columnas={columnas}
        filas={data.requests}
        porPagina={8}
        buscar={(s) => `${s.id} ${s.cliente} ${s.producto} ${s.material} ${s.dimensiones}`}
        placeholder="Buscar por solicitud, cliente, producto o material..."
        filtros={[
          { titulo: 'Estado', valor: (s) => s.estado, opciones: ESTADOS },
          { titulo: 'Cliente', valor: (s) => s.cliente, opciones: [...new Set(data.requests.map((s) => s.cliente))] },
        ]}
        vacioTitulo="No hay solicitudes con esos filtros"
      />

      {/* MODAL HU-04: Consulta detallada de la solicitud */}
      {detalle && (
        <div className="modal-backdrop" onClick={() => setDetalle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Detalle de solicitud ${detalle.id}`}>
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="inbox" tamano={20} /></span>
              <div>
                <h2>Solicitud {detalle.id}</h2>
                <p>{detalle.cliente} · Registrada el {detalle.fechaSolicitud}</p>
              </div>
              <button className="icon-btn" onClick={() => setDetalle(null)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span className="sm mut">Estado actual</span>
                <StatusBadge estado={detalle.estado} />
              </div>

              {detalle.motivoRechazo && (
                <div className={`ban ${detalle.estado === 'Devuelta para corrección' ? 'am' : 're'}`} style={{ marginBottom: '16px' }}>
                  <Icon nombre="alert-triangle" tamano={16} />
                  <div>
                    <strong>{detalle.estado === 'Devuelta para corrección' ? 'Motivo de devolución' : 'Motivo de rechazo'}:</strong>
                    <div style={{ marginTop: '2px' }}>{detalle.motivoRechazo}</div>
                  </div>
                </div>
              )}

              <dl className="details details-1" style={{ margin: 0 }}>
                <div><dt>Cliente</dt><dd>{detalle.cliente}</dd></div>
                <div><dt>Producto</dt><dd>{detalle.producto}</dd></div>
                <div><dt>Cantidad</dt><dd>{detalle.cantidad} unidades</dd></div>
                <div><dt>Dimensiones</dt><dd>{detalle.dimensiones}</dd></div>
                <div><dt>Material</dt><dd>{detalle.material}</dd></div>
                <div><dt>Fecha de entrega pactada</dt><dd>{detalle.fechaEntrega}</dd></div>
                <div><dt>Presupuesto comercial</dt><dd>{formatoCOP(detalle.presupuesto)}</dd></div>
                <div><dt>Requerimientos técnicos</dt><dd>{detalle.requerimientos || 'Sin requerimientos especiales'}</dd></div>
                <div><dt>Observaciones</dt><dd>{detalle.observaciones || 'Sin observaciones registradas'}</dd></div>
                {detalle.ordenId && (
                  <div>
                    <dt>Orden de producción generada</dt>
                    <dd>
                      <button className="link-inline" onClick={() => { setDetalle(null); irA('detalle', detalle.ordenId) }}>
                        <strong>{detalle.ordenId}</strong> (Ver orden)
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setDetalle(null)}>Cerrar</button>
              {esCoordinador && detalle.estado === 'En validación' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const sol = detalle
                    setDetalle(null)
                    setValidando(sol)
                  }}
                >
                  <Icon nombre="check" tamano={14} /> Proceder a validación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL HU-05 y HU-06: Validación de datos antes de decidir y generación de orden */}
      {validando && (
        <div className="modal-backdrop" onClick={() => setValidando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Validación técnica de solicitud">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="check-circle" tamano={20} /></span>
              <div>
                <h2>Validar solicitud y generar orden</h2>
                <p>Solicitud: {validando.id} · {validando.cliente}</p>
              </div>
              <button className="icon-btn" onClick={() => setValidando(null)} aria-label="Cerrar"><Icon nombre="x" /></button>
            </div>

            <div className="modal-body">
              <p style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>
                Verifica los datos técnicos de la solicitud antes de confirmar la apertura de la orden de producción:
              </p>

              <div className="card p" style={{ background: 'var(--bg-subtle)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Producto:</span>
                  <strong>{validando.producto} ({validando.cantidad} uds)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Dimensiones y material:</span>
                  <span>{validando.dimensiones} · {validando.material}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Fecha de entrega:</span>
                  <strong>{validando.fechaEntrega}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mut">Presupuesto cliente:</span>
                  <span>{formatoCOP(validando.presupuesto)}</span>
                </div>
                {validando.requerimientos && (
                  <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-light)' }}>
                    <span className="mut" style={{ display: 'block', fontSize: '0.8rem' }}>Requerimientos:</span>
                    <span>{validando.requerimientos}</span>
                  </div>
                )}
              </div>

              <p className="sm mut" style={{ margin: 0 }}>
                Al confirmar, se creará una nueva orden en etapa de <strong>Diseño</strong>, asignada a María López, y se registrará el evento en la trazabilidad.
              </p>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setValidando(null)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  actions.validateRequest(validando.id)
                  setValidando(null)
                }}
              >
                <Icon nombre="check" tamano={15} /> Confirmar y generar orden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HU-05: Devolver para corrección con motivo documentado */}
      {devolviendo && (
        <Modal
          titulo="Devolver solicitud para corrección"
          subtitulo={`Solicitud ${devolviendo}`}
          icono="alert-triangle"
          tipoBoton="primary"
          etiqueta="Indica qué datos deben ser corregidos o completados por el comercial"
          ayuda="El comercial verá esta observación para corregir y reenviar la solicitud."
          minimo={8}
          textoBoton="Devolver solicitud"
          onClose={() => setDevolviendo(null)}
          onConfirm={(motivo) => {
            if (actions.returnRequest) {
              actions.returnRequest(devolviendo, motivo)
            } else {
              actions.rejectRequest(devolviendo, `[Devuelta para corrección] ${motivo}`)
            }
            setDevolviendo(null)
          }}
        />
      )}

      {/* MODAL HU-05: Rechazo definitivo */}
      {rechazando && (
        <Modal
          titulo="Rechazar solicitud definitivamente"
          subtitulo={`Solicitud ${rechazando}`}
          icono="x-circle"
          tipoBoton="danger"
          etiqueta="Motivo formal del rechazo"
          ayuda="Quedará documentado en el historial de la solicitud."
          minimo={10}
          textoBoton="Rechazar solicitud"
          onClose={() => setRechazando(null)}
          onConfirm={(motivo) => {
            actions.rejectRequest(rechazando, motivo)
            setRechazando(null)
          }}
        />
      )}
    </div>
  )
}
