import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { diasParaEntrega, textoPlazo, parseFecha, obtenerFechaReferencia, estaRetrasada, formatearFecha, formatearHora } from '../utils/format.js'
import { TIPOS_DOCUMENTO } from '../data/catalogos.js'

// Módulo de Despachos y Entregas (HU-17)
export default function Deliveries({ data, actions, irA, role }) {
  const [pestaña, setPestaña] = useState('proximas') // 'proximas' | 'historial'
  const [modalEntrega, setModalEntrega] = useState(null)
  const [modalVerEvidencia, setModalVerEvidencia] = useState(null)

  // Campos de recepción y entrega (HU-17)
  const [quienRecibe, setQuienRecibe] = useState('')
  const [tipoDocumentoRecibe, setTipoDocumentoRecibe] = useState('CC')
  const [documentoRecibe, setDocumentoRecibe] = useState('')
  const [cargoRecibe, setCargoRecibe] = useState('Recepción / Almacén')
  const [telefonoRecibe, setTelefonoRecibe] = useState('')
  const [fechaEntregaReal, setFechaEntregaReal] = useState('')
  const [conformidad, setConformidad] = useState('Conforme')
  const [observaciones, setObservaciones] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState(null)
  const [errorModal, setErrorModal] = useState('')

  // Órdenes activas en etapas finales (Despacho, Acabados, Impresión)
  const proximas = data.orders
    .filter((o) => ['Impresión', 'Acabados', 'Despacho'].includes(o.estado))
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  // Órdenes entregadas o cerradas
  const entregadas = data.orders
    .filter((o) => ['Entrega', 'Postventa', 'Cerrada'].includes(o.estado))

  // Generación de los 7 días del calendario a partir de la fecha actual del sistema
  const diasSemana = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(obtenerFechaReferencia())
    d.setDate(d.getDate() + i)
    const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return {
      nombre: nombres[d.getDay()],
      diaMes: d.getDate(),
      mes: d.getMonth() + 1,
      fechaStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      esHoy: i === 0,
    }
  })

  function abrirRegistrarEntrega(o) {
    setModalEntrega(o)
    setQuienRecibe(o.entrega?.contacto || o.cliente)
    setTipoDocumentoRecibe(o.entrega?.tipoDocumento || 'CC')
    setDocumentoRecibe(o.entrega?.documento ? o.entrega.documento.replace(/^(CC|CE|NIT|RUT|PAS)\s*/i, '') : '')
    setCargoRecibe(o.entrega?.cargo || 'Recepción / Almacén')
    setTelefonoRecibe(o.entrega?.telefono || '')
    setFechaEntregaReal(`${formatearFecha()} ${formatearHora()}`)
    setConformidad('Conforme')
    setObservaciones('')
    setArchivoEvidencia(
      o.entrega?.evidencia || {
        nombre: `Acta_entrega_${o.id}.pdf`,
        tamano: '245 KB',
        tipo: 'application/pdf',
        esGenerada: true,
      }
    )
    setErrorModal('')
  }

  function handleArchivoSeleccionado(e) {
    const file = e.target.files?.[0]
    if (file) {
      setArchivoEvidencia({
        nombre: file.name,
        tamano: `${(file.size / 1024).toFixed(1)} KB`,
        tipo: file.type || 'application/octet-stream',
        esGenerada: false,
        fecha: formatearFecha(),
      })
      setErrorModal('')
    }
  }

  function handleGuardarEntrega(e) {
    e.preventDefault()
    if (!modalEntrega) return

    if (!quienRecibe.trim()) {
      setErrorModal('El nombre de quien recibe es obligatorio.')
      return
    }
    if (!documentoRecibe.trim()) {
      setErrorModal('El documento de identidad o cédula del receptor es obligatorio.')
      return
    }
    if (conformidad === 'Con observaciones' && !observaciones.trim()) {
      setErrorModal('Al registrar con observaciones, debes indicar el detalle o motivo.')
      return
    }
    if (!archivoEvidencia) {
      setErrorModal('Debes adjuntar o generar el acta/evidencia de entrega.')
      return
    }

    const datosEntrega = {
      contacto: quienRecibe.trim(),
      tipoDocumento: tipoDocumentoRecibe,
      documento: `${tipoDocumentoRecibe} ${documentoRecibe.trim()}`,
      cargo: cargoRecibe.trim(),
      telefono: telefonoRecibe.trim(),
      fechaReal: fechaEntregaReal,
      conformidad,
      observaciones: observaciones.trim(),
      evidencia: archivoEvidencia,
    }

    if (actions.registerDelivery) {
      actions.registerDelivery(modalEntrega.id, datosEntrega)
    } else {
      actions.advanceStage(modalEntrega.id)
    }

    setModalEntrega(null)
  }

  const columnasProximas = [
    {
      clave: 'id',
      titulo: 'Orden',
      ordenar: true,
      render: (o) => (
        <div>
          <button className="link-inline" onClick={() => irA('detalle', o.id)}>
            <strong>{o.id}</strong>
          </button>
          <small className="cell-sub">{o.producto}</small>
        </div>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    {
      clave: 'fechaEntrega',
      titulo: 'Fecha de entrega',
      render: (o) => (
        <div>
          <span>{o.fechaEntrega}</span>
          <small className={`cell-sub ${estaRetrasada(o) ? 'text-rojo' : ''}`}>{textoPlazo(o)}</small>
        </div>
      ),
    },
    { clave: 'estado', titulo: 'Etapa actual', render: (o) => <StatusBadge estado={o.estado} /> },
    {
      clave: 'direccion',
      titulo: 'Método y destino',
      render: (o) => (
        <div>
          <span><Icon nombre="truck" tamano={13} /> {o.entrega.metodo}</span>
          <small className="cell-sub">{o.entrega.direccion}</small>
        </div>
      ),
    },
    {
      clave: 'responsable',
      titulo: 'Responsable',
      render: (o) => (
        <span className="person">
          <Avatar nombre={o.responsable} tamano="sm" />
          {o.responsable}
        </span>
      ),
    },
    {
      clave: 'acciones',
      titulo: '',
      render: (o) => (
        <div className="row" style={{ gap: '6px' }}>
          <button className="btn btn-sm btn-soft" onClick={() => irA('detalle', o.id)}>
            Ver detalle
          </button>
          {o.estado === 'Despacho' && ['comercial', 'postventa'].includes(role) && (
            <button className="btn btn-sm btn-primary" onClick={() => abrirRegistrarEntrega(o)}>
              <Icon nombre="check" tamano={13} /> Registrar entrega
            </button>
          )}
        </div>
      ),
    },
  ]

  const columnasEntregadas = [
    {
      clave: 'id',
      titulo: 'Orden',
      ordenar: true,
      render: (o) => (
        <div>
          <button className="link-inline" onClick={() => irA('detalle', o.id)}>
            <strong>{o.id}</strong>
          </button>
          <small className="cell-sub">{o.producto}</small>
        </div>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    {
      clave: 'fechaEntrega',
      titulo: 'Entregado el',
      render: (o) => (
        <div>
          <span>{o.entrega?.fechaReal || o.fechaEntrega}</span>
          <small className="cell-sub">{o.entrega?.metodo || 'Entrega regular'}</small>
        </div>
      ),
    },
    {
      clave: 'recibio',
      titulo: 'Datos del receptor (HU-17)',
      render: (o) => (
        <div>
          <strong>{o.entrega?.contacto || 'Recepción cliente'}</strong>
          <small className="cell-sub" style={{ display: 'block' }}>
            {o.entrega?.documento ? `C.C./NIT: ${o.entrega.documento} · ` : ''}
            {o.entrega?.cargo || 'Recepción'}
          </small>
        </div>
      ),
    },
    {
      clave: 'conformidad',
      titulo: 'Conformidad',
      render: (o) => {
        const conf = o.entrega?.conformidad || 'Conforme'
        return <StatusBadge estado={conf === 'Conforme' ? 'Finalizada' : 'Pausada'} texto={conf} />
      },
    },
    {
      clave: 'evidencia',
      titulo: 'Evidencia adjunta',
      render: (o) => {
        const ev = o.entrega?.evidencia || { nombre: `Acta_entrega_${o.id}.pdf`, tamano: '240 KB' }
        return (
          <div>
            <button
              className="link-inline"
              onClick={() => setModalVerEvidencia({ orden: o, evidencia: ev })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
              title="Ver datos de la evidencia"
            >
              <Icon nombre="paperclip" tamano={13} />
              <span className="ell" style={{ maxWidth: '140px' }}>{ev.nombre}</span>
            </button>
            <small className="cell-sub" style={{ display: 'block' }}>{ev.tamano || 'PDF firmado'}</small>
          </div>
        )
      },
    },
    {
      clave: 'postventa',
      titulo: 'Seguimiento',
      render: (o) => {
        const casos = data.cases.filter((c) => c.ordenId === o.id)
        return casos.length > 0 ? (
          <StatusBadge estado={casos[0].estado} texto={`${casos.length} caso(s)`} />
        ) : (
          <span className="sm mut">Sin novedades</span>
        )
      },
    },
    {
      clave: 'acciones',
      titulo: '',
      render: (o) => (
        <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>
          <Icon nombre="eye" tamano={13} /> Expediente
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Despachos y entregas"
        subtitulo="Control de logística, calendario semanal de despachos y actas de recepción con evidencia y conformidad (HU-17)."
        icono="truck"
      />

      {/* 3 Indicadores clave de Despachos con redirección directa a sus pestañas */}
      <div className="kpis">
        <StatCard
          titulo="Próximas en 7 días"
          valor={proximas.length}
          icono="calendar"
          color={proximas.length > 0 ? 'amarillo' : 'azul'}
          detalle="Compromisos en calendario semanal"
          onClick={() => setPestaña('proximas')}
        />
        <StatCard
          titulo="En despacho activo"
          valor={data.orders.filter((o) => o.estado === 'Despacho').length}
          icono="truck"
          color="azul"
          detalle="Listas para registrar acta de entrega"
          onClick={() => setPestaña('proximas')}
        />
        <StatCard
          titulo="Entregadas y recibidas"
          valor={entregadas.length}
          icono="check-circle"
          color="verde"
          detalle="Historial y actas de conformidad"
          onClick={() => setPestaña('historial')}
        />
      </div>

      {/* Pestañas de entregas */}
      <div className="tabs" role="tablist">
        <button
          className={pestaña === 'proximas' ? 'on' : ''}
          onClick={() => setPestaña('proximas')}
        >
          Próximas entregas y calendario <span className="pill">{proximas.length}</span>
        </button>
        <button
          className={pestaña === 'historial' ? 'on' : ''}
          onClick={() => setPestaña('historial')}
        >
          Entregadas y actas de conformidad <span className="pill">{entregadas.length}</span>
        </button>
      </div>

      {pestaña === 'proximas' ? (
        <>
          {/* Calendario visual semanal de 7 días */}
          <div className="card p" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon nombre="calendar" tamano={17} /> Calendario logístico (semana en curso)
            </h3>
            <div className="cal">
              {diasSemana.map((dia) => {
                const ordenesDelDia = proximas.filter((o) => o.fechaEntrega === dia.fechaStr)
                return (
                  <div key={dia.fechaStr} className={`cd ${dia.esHoy ? 'today' : ''}`}>
                    <b>{dia.nombre} {dia.diaMes}/{dia.mes}</b>
                    {dia.esHoy && <span className="cd-today-tag">Hoy</span>}
                    {ordenesDelDia.length === 0 ? (
                      <span className="sm mut" style={{ display: 'block', marginTop: '6px' }}>Sin entregas</span>
                    ) : (
                      ordenesDelDia.map((o) => (
                        <button
                          key={o.id}
                          className="ev"
                          onClick={() => irA('detalle', o.id)}
                          title={`${o.id} - ${o.cliente}: ${o.producto}`}
                        >
                          <strong>{o.id}</strong> {o.cliente.split(' ')[0]}
                        </button>
                      ))
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <DataTable
            columnas={columnasProximas}
            filas={proximas}
            porPagina={8}
            buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.entrega.direccion}`}
            placeholder="Buscar despacho por orden, cliente o destino..."
            vacioTitulo="No hay entregas pendientes"
          />
        </>
      ) : (
        <DataTable
          columnas={columnasEntregadas}
          filas={entregadas}
          porPagina={8}
          buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.entrega?.contacto || ''} ${o.entrega?.documento || ''}`}
          placeholder="Buscar orden entregada por cliente, código o receptor..."
          vacioTitulo="Aún no hay entregas registradas"
        />
      )}

      {/* Modal para registrar entrega (HU-17) */}
      {modalEntrega && (
        <div className="modal-backdrop" onClick={() => setModalEntrega(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Registrar entrega formal">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="truck" tamano={20} /></span>
              <div>
                <h2>Registrar entrega formal: {modalEntrega.id}</h2>
                <p>{modalEntrega.cliente} · {modalEntrega.producto}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalEntrega(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarEntrega} className="modal-body">
              {errorModal && (
                <div className="ban ban-rojo" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-circle" tamano={15} /> {errorModal}
                </div>
              )}

              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="recibeNombre">Nombre de quien recibe *</label>
                  <input
                    id="recibeNombre"
                    value={quienRecibe}
                    onChange={(e) => setQuienRecibe(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="recibeTipoDoc">Tipo de documento *</label>
                  <select
                    id="recibeTipoDoc"
                    value={tipoDocumentoRecibe}
                    onChange={(e) => setTipoDocumentoRecibe(e.target.value)}
                  >
                    {TIPOS_DOCUMENTO.map((td) => (
                      <option key={td.codigo} value={td.codigo}>
                        {td.codigo} — {td.label.split('—')[1]?.trim() || td.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="recibeDoc">Número de documento ({tipoDocumentoRecibe}) *</label>
                  <input
                    id="recibeDoc"
                    value={documentoRecibe}
                    onChange={(e) => setDocumentoRecibe(e.target.value)}
                    placeholder="Ej. 1.098.765.432"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="recibeCargo">Cargo o relación con el cliente</label>
                  <select
                    id="recibeCargo"
                    value={cargoRecibe}
                    onChange={(e) => setCargoRecibe(e.target.value)}
                  >
                    <option value="Titular / Contratante">Titular / Contratante</option>
                    <option value="Recepción / Almacén">Recepción / Almacén</option>
                    <option value="Administrador / Encargado">Administrador / Encargado</option>
                    <option value="Representante legal">Representante legal</option>
                    <option value="Familiar / Delegado">Familiar / Delegado</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="recibeTel">Teléfono de contacto</label>
                  <input
                    id="recibeTel"
                    value={telefonoRecibe}
                    onChange={(e) => setTelefonoRecibe(e.target.value)}
                    placeholder="Ej. 315 888 9900"
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="recibeFecha">Fecha y hora real de entrega</label>
                  <input
                    id="recibeFecha"
                    value={fechaEntregaReal}
                    onChange={(e) => setFechaEntregaReal(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="confEstado">Conformidad del cliente *</label>
                  <select
                    id="confEstado"
                    value={conformidad}
                    onChange={(e) => setConformidad(e.target.value)}
                  >
                    <option value="Conforme">Conforme (producto verificado y a satisfacción)</option>
                    <option value="Con observaciones">Con observaciones (se recibe con observaciones menores)</option>
                  </select>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="obsEntrega">
                    Observaciones de la entrega {conformidad === 'Con observaciones' && '*'}
                  </label>
                  <textarea
                    id="obsEntrega"
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder={conformidad === 'Con observaciones' ? 'Describe las observaciones del cliente...' : 'Notas adicionales de recepción (opcional)'}
                  />
                </div>

                {/* Evidencia de entrega con selector real de archivo (HU-17) */}
                <div className="field full">
                  <label className="field-label" htmlFor="evidenciaFileInput">
                    Evidencia de entrega (Acta firmada o fotografía de recepción) *
                  </label>
                  <input
                    id="evidenciaFileInput"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleArchivoSeleccionado}
                    style={{ marginBottom: '8px' }}
                  />

                  {archivoEvidencia ? (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon nombre="paperclip" tamano={16} />
                        <div>
                          <strong>{archivoEvidencia.nombre}</strong>
                          <span className="sm mut" style={{ display: 'block' }}>
                            {archivoEvidencia.tamano} · {archivoEvidencia.esGenerada ? 'Acta digital generada automáticamente' : 'Archivo local adjunto'}
                          </span>
                        </div>
                      </div>
                      <span className="badge badge-verde">Adjunto listo</span>
                    </div>
                  ) : (
                    <span className="sm mut">No se ha seleccionado ningún archivo.</span>
                  )}

                  <small className="sm mut" style={{ display: 'block', marginTop: '6px' }}>
                    <Icon nombre="info" tamano={12} /> <em>Simulación de almacenamiento:</em> El archivo se asocia a la orden en memoria del navegador. En integración con backend, se transmitirá mediante multipart/form-data a <code>POST /api/ordenes/:id/entrega</code>.
                  </small>
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalEntrega(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success">
                  <Icon nombre="check" tamano={15} /> Confirmar y registrar entrega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para ver detalles de evidencia asociada */}
      {modalVerEvidencia && (
        <div className="modal-backdrop" onClick={() => setModalVerEvidencia(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Evidencia de entrega">
            <div className="modal-head">
              <span className="modal-icon modal-icon-info"><Icon nombre="paperclip" tamano={20} /></span>
              <div>
                <h2>Evidencia de entrega: {modalVerEvidencia.orden.id}</h2>
                <p>{modalVerEvidencia.orden.cliente}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalVerEvidencia(null)}><Icon nombre="x" /></button>
            </div>
            <div className="modal-body">
              <dl className="spec" style={{ gridTemplateColumns: '1fr', gap: '8px', marginBottom: '16px' }}>
                <div><dt>Nombre del documento</dt><dd><strong>{modalVerEvidencia.evidencia.nombre}</strong></dd></div>
                <div><dt>Tamaño</dt><dd>{modalVerEvidencia.evidencia.tamano || '245 KB'}</dd></div>
                <div><dt>Receptor</dt><dd>{modalVerEvidencia.orden.entrega?.contacto || modalVerEvidencia.orden.cliente}</dd></div>
                <div><dt>Cédula/Documento</dt><dd>{modalVerEvidencia.orden.entrega?.documento || 'Registrado en acta'}</dd></div>
                <div><dt>Conformidad</dt><dd><StatusBadge estado={modalVerEvidencia.orden.entrega?.conformidad === 'Conforme' ? 'Finalizada' : 'Pausada'} texto={modalVerEvidencia.orden.entrega?.conformidad || 'Conforme'} /></dd></div>
                {modalVerEvidencia.orden.entrega?.observaciones && (
                  <div><dt>Observaciones</dt><dd>{modalVerEvidencia.orden.entrega.observaciones}</dd></div>
                )}
              </dl>
              <div className="ban ban-azul" style={{ fontSize: '12px' }}>
                <Icon nombre="info" tamano={14} /> El archivo de evidencia se encuentra vinculado a la orden en el cliente. En la versión con backend persistente, estará disponible para descarga desde el repositorio de documentos de entrega.
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setModalVerEvidencia(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
