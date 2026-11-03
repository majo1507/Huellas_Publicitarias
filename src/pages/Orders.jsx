import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import OrderCard from '../components/OrderCard.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import { ETAPAS } from '../data/mockData.js'
import { estaActiva, estaRetrasada, estaEnRiesgo, prioridadOrden, textoPlazo, formatoCOP } from '../utils/format.js'
import { generarReporteOrdenPDF, generarReporteGeneralPDF } from '../utils/pdfReport.js'

// Listado de órdenes. Comercial, coordinador y postventa la usan con pequeñas diferencias.
export default function Orders({ data, actions, irA, role }) {
  const soloEntregadas = role === 'postventa'
  const base = soloEntregadas ? data.orders.filter((o) => !estaActiva(o)) : data.orders
  const titulo = soloEntregadas ? 'Órdenes entregadas' : role === 'comercial' ? 'Órdenes generadas' : 'Órdenes de producción'
  // Se agrega la prioridad calculada para poder ordenar y filtrar por ella
  const filas = base.map((o) => ({ ...o, prioridad: prioridadOrden(o) }))

  const columnas = [
    { clave: 'id', titulo: 'Orden', ordenar: true, render: (o) => <strong>{o.id}</strong> },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    { clave: 'producto', titulo: 'Producto', ordenar: true, render: (o) => <>{o.producto}<small className="cell-sub">{o.cantidad} uds · {o.material}</small></> },
    { clave: 'estado', titulo: 'Estado', render: (o) => <StatusBadge estado={o.estado === 'Entrega' ? 'Entregado' : o.estado} /> },
    { clave: 'prioridad', titulo: 'Prioridad', render: (o) => (estaActiva(o) ? <StatusBadge estado={o.prioridad} /> : <span className="muted">—</span>) },
    { clave: 'responsable', titulo: 'Responsable', ordenar: true, render: (o) => <span className="person"><Avatar nombre={o.responsable} tamano="sm" />{o.responsable}</span> },
    {
      clave: 'presupuesto',
      titulo: 'Presupuesto',
      ordenar: true,
      render: (o) => (
        <>
          <strong>{formatoCOP(o.presupuesto)}</strong>
          {(role === 'coordinador' || role === 'gerencia') && (
            <small className="cell-sub">Costo: {formatoCOP(o.costoInterno)}</small>
          )}
        </>
      ),
    },
    {
      clave: 'fechaEntrega', titulo: 'Entrega', render: (o) => (
        <>
          {o.fechaEntrega}
          <small className={`cell-sub ${estaRetrasada(o) ? 'text-rojo' : estaEnRiesgo(o) ? 'text-amarillo' : ''}`}>{textoPlazo(o)}</small>
        </>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (o) => (
        <div className="row" style={{ gap: '6px' }}>
          <button className="btn btn-soft btn-sm" onClick={() => irA('detalle', o.id)}>
            <Icon nombre="eye" tamano={14} /> Ver pedido
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              generarReporteOrdenPDF(o, data)
              actions?.notify?.(`Reporte PDF de ${o.id} descargado.`, 'exito')
            }}
            title={`Descargar reporte PDF de ${o.id}`}
          >
            <Icon nombre="download" tamano={14} /> PDF
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo={titulo}
        subtitulo={`${base.length} órdenes. Consulta su prioridad, responsable, presupuesto y plazo de entrega.`}
        icono="clipboard"
        acciones={
          <div className="row" style={{ gap: '8px' }}>
            <button
              className="btn btn-soft"
              onClick={() => {
                generarReporteGeneralPDF(data)
                actions?.notify?.('Reporte general PDF descargado.', 'exito')
              }}
            >
              <Icon nombre="download" tamano={15} /> Reporte PDF general
            </button>
            {role === 'comercial' && (
              <button className="btn btn-primary" onClick={() => irA('nuevo')}>
                <Icon nombre="plus" tamano={16} /> Registrar solicitud
              </button>
            )}
          </div>
        }
      />

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={8}
        buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.responsable}`}
        placeholder="Buscar por orden, cliente, producto..."
        filtros={[
          { titulo: 'Etapa', valor: (o) => o.estado, opciones: ETAPAS.slice(1) },
          { titulo: 'Prioridad', valor: (o) => o.prioridad, opciones: ['Alta', 'Media', 'Baja'] },
          { titulo: 'Responsable', valor: (o) => o.responsable, opciones: [...new Set(base.map((o) => o.responsable))] },
        ]}
        tarjeta={(o) => <OrderCard order={o} onAbrir={() => irA('detalle', o.id)} />}
        vacioTitulo="No se encontraron órdenes"
      />
    </div>
  )
}
