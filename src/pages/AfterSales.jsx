import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { ROLES } from '../data/roles.js'
import { estrellas } from '../utils/format.js'

// Postventa vista por el CLIENTE: solo los casos de sus pedidos, sin datos internos
export default function AfterSales({ data, irA }) {
  const misPedidos = data.orders.filter((o) => o.clienteId === ROLES.cliente.clienteId).map((o) => o.id)
  const misCasos = data.cases.filter((c) => misPedidos.includes(c.ordenId))

  const columnas = [
    { clave: 'ordenId', titulo: 'Orden', render: (c) => <button className="link-inline" onClick={() => irA('detalle', c.ordenId)}>{c.ordenId}</button> },
    { clave: 'tipo', titulo: 'Tipo', ordenar: true },
    { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'descripcion', titulo: 'Descripción', render: (c) => <span className="cell-wrap">{c.descripcion}</span> },
    { clave: 'estado', titulo: 'Estado', render: (c) => <StatusBadge estado={c.estado} /> },
    { clave: 'solucion', titulo: 'Solución', render: (c) => <span className="cell-wrap">{c.solucion || 'En seguimiento'}</span> },
    { clave: 'calificacion', titulo: 'Calificación', render: (c) => <span className="stars">{estrellas(c.calificacion)}</span> },
  ]

  return (
    <div>
      <PageHeader titulo="Postventa" subtitulo="Reclamos, ajustes, garantías y comentarios de tus pedidos." icono="life-buoy" />
      <DataTable
        columnas={columnas}
        filas={misCasos}
        buscar={(c) => `${c.ordenId} ${c.tipo} ${c.descripcion}`}
        placeholder="Buscar en mis casos..."
        filtros={[{ titulo: 'Estado', valor: (c) => c.estado, opciones: ['Abierto', 'En trámite', 'Resuelto'] }]}
        vacioTitulo="No tienes casos de postventa"
        vacioTexto="Cuando registres un reclamo, ajuste o garantía aparecerá aquí."
      />
    </div>
  )
}
