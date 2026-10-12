import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { diasParaEntrega, textoPlazo, parseFecha, FECHA_DEMO, estaRetrasada } from '../utils/format.js'

export default function Deliveries({ data, actions, irA, role }) {
  const [pestaña, setPestaña] = useState('proximas') // 'proximas' | 'historial'
  const [modalEntrega, setModalEntrega] = useState(null)
  const [quienRecibe, setQuienRecibe] = useState('')
  const [conformidad, setConformidad] = useState('Conforme')
  const [archivoEvidencia, setArchivoEvidencia] = useState('')

  // Órdenes activas en etapas finales (Despacho, Acabados, Impresión)
  const proximas = data.orders
    .filter((o) => ['Impresión', 'Acabados', 'Despacho'].includes(o.estado))
    .sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  // Órdenes entregadas
  const entregadas = data.orders
    .filter((o) => ['Entrega', 'Postventa'].includes(o.estado))

  // Generación de los 7 días del calendario a partir de FECHA_DEMO (03/10/2026)
  const diasSemana = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(FECHA_DEMO)
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
    setConformidad('Conforme')
    setArchivoEvidencia(`Acta_entrega_${o.id}.pdf`)
  }

  function handleGuardarEntrega(e) {
    e.preventDefault()
    if (!modalEntrega || !quienRecibe.trim()) return

    // Avanza la orden a entrega con los detalles de entrega
    actions.advanceStage(modalEntrega.id)
    actions.notify(`Entrega de ${modalEntrega.id} registrada formalmente a nombre de ${quienRecibe}.`)
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
          {o.estado === 'Despacho' && (
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
    { clave: 'fechaEntrega', titulo: 'Entregado el', render: (o) => o.fechaEntrega },
    {
      clave: 'recibio',
      titulo: 'Recibido por',
      render: (o) => o.entrega?.contacto || 'Recepción cliente',
    },
    {
      clave: 'estado',
      titulo: 'Conformidad',
      render: () => <StatusBadge estado="Finalizada" texto="Conforme" />,
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
        subtitulo="Control de logística, calendario semanal de despachos y actas de recepción de clientes."
        icono="truck"
      />

      <div className="kpis">
        <StatCard titulo="Próximas en 7 días" valor={proximas.length} icono="calendar" />
        <StatCard titulo="En despacho hoy" valor={data.orders.filter((o) => o.estado === 'Despacho').length} icono="truck" color="amarillo" />
        <StatCard titulo="Órdenes entregadas" valor={entregadas.length} icono="package" color="verde" />
        <StatCard titulo="Casos en postventa" valor={data.cases.filter((c) => c.estado !== 'Resuelto').length} icono="life-buoy" color="rojo" />
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
          buscar={(o) => `${o.id} ${o.cliente} ${o.producto}`}
          placeholder="Buscar orden entregada..."
          vacioTitulo="Aún no hay entregas registradas"
        />
      )}

      {/* Modal para registrar entrega */}
      {modalEntrega && (
        <div className="modal-backdrop" onClick={() => setModalEntrega(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Registrar entrega">
            <div className="modal-head">
              <span className="modal-icon modal-icon-success"><Icon nombre="truck" tamano={20} /></span>
              <div>
                <h2>Registrar entrega: {modalEntrega.id}</h2>
                <p>{modalEntrega.cliente} · {modalEntrega.producto}</p>
              </div>
              <button className="icon-btn" onClick={() => setModalEntrega(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarEntrega} className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="recibeNombre">Nombre de quien recibe</label>
                  <input
                    id="recibeNombre"
                    value={quienRecibe}
                    onChange={(e) => setQuienRecibe(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="confEstado">Conformidad del cliente</label>
                  <select
                    id="confEstado"
                    value={conformidad}
                    onChange={(e) => setConformidad(e.target.value)}
                  >
                    <option value="Conforme">Conforme (sin observaciones)</option>
                    <option value="Con observaciones">Con observaciones leves</option>
                  </select>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="evidenciaDoc">Acta de entrega / Evidencia fotográfica</label>
                  <input
                    id="evidenciaDoc"
                    value={archivoEvidencia}
                    onChange={(e) => setArchivoEvidencia(e.target.value)}
                    placeholder="Acta_entrega_OP-0001.pdf o foto"
                  />
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalEntrega(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success">
                  <Icon nombre="check" tamano={15} /> Confirmar entrega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
