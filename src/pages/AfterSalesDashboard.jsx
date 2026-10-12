import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DataTable from '../components/DataTable.jsx'
import DonutChart from '../components/DonutChart.jsx'
import BarChart from '../components/BarChart.jsx'
import Modal from '../components/Modal.jsx'
import { estrellas } from '../utils/format.js'

// ATENCIÓN POSTVENTA: casos posteriores a la entrega
export default function AfterSalesDashboard({ data, actions, irA }) {
  const [resolviendo, setResolviendo] = useState(null) // id del caso que se está resolviendo
  const usuario = 'Sofía Herrera'

  const contar = (estado) => data.cases.filter((c) => c.estado === estado).length
  const tipo = (...tipos) => data.cases.filter((c) => tipos.includes(c.tipo)).length
  const conNota = data.cases.filter((c) => c.calificacion)
  const promedio = conNota.length ? (conNota.reduce((s, c) => s + c.calificacion, 0) / conNota.length).toFixed(1) : '—'
  const orden = (id) => data.orders.find((o) => o.id === id)

  const filas = data.cases.map((c) => ({ ...c, cliente: orden(c.ordenId)?.cliente || '' }))

  const columnas = [
    { clave: 'id', titulo: 'Caso', ordenar: true, render: (c) => <strong>{c.id}</strong> },
    { clave: 'cliente', titulo: 'Cliente', ordenar: true },
    { clave: 'ordenId', titulo: 'Orden', render: (c) => <button className="link-inline" onClick={() => irA('detalle', c.ordenId)}>{c.ordenId}</button> },
    { clave: 'tipo', titulo: 'Tipo', ordenar: true },
    { clave: 'fecha', titulo: 'Fecha' },
    { clave: 'descripcion', titulo: 'Descripción', render: (c) => <span className="cell-wrap">{c.descripcion}</span> },
    { clave: 'responsable', titulo: 'Responsable', render: (c) => c.responsable || <span className="muted">Sin asignar</span> },
    { clave: 'estado', titulo: 'Estado', render: (c) => <StatusBadge estado={c.estado} /> },
    { clave: 'solucion', titulo: 'Solución', render: (c) => <span className="cell-wrap">{c.solucion || '—'}</span> },
    { clave: 'calificacion', titulo: 'Calificación', render: (c) => <span className="stars">{estrellas(c.calificacion)}</span> },
    {
      clave: 'acciones', titulo: 'Acciones',
      render: (c) => (
        <>
          {c.estado === 'Abierto' && <button className="btn btn-soft btn-sm" onClick={() => actions.updateCase(c.id, { estado: 'En trámite', responsable: usuario }, `Caso ${c.id} en trámite.`)}>Tomar caso</button>}
          {c.estado === 'En trámite' && <button className="btn btn-success btn-sm" onClick={() => setResolviendo(c.id)}>Resolver</button>}
          {c.estado === 'Resuelto' && <span className="muted">Cerrado</span>}
        </>
      ),
    },
  ]

  return (
    <div>
      <PageHeader titulo="Casos de postventa" subtitulo="Todos los casos están relacionados con una orden ya entregada." icono="life-buoy" />

      <div className="kpis">
        <StatCard titulo="Casos abiertos" valor={contar('Abierto')} icono="alert-circle" color={contar('Abierto') ? 'rojo' : 'azul'} />
        <StatCard titulo="En trámite" valor={contar('En trámite')} icono="clock" color="amarillo" />
        <StatCard titulo="Resueltos" valor={contar('Resuelto')} icono="check-circle" color="verde" />
        <StatCard titulo="Calificación promedio" valor={`${promedio} ★`} icono="star" detalle={`${conNota.length} calificaciones`} />
      </div>

      <div className="grid-2">
        <Panel titulo="Casos por estado" icono="bar-chart">
          <DonutChart subtitulo="casos" items={[
            { label: 'Abiertos', value: contar('Abierto'), color: 'rojo' },
            { label: 'En trámite', value: contar('En trámite'), color: 'amarillo' },
            { label: 'Resueltos', value: contar('Resuelto'), color: 'verde' },
          ]} />
        </Panel>
        <Panel titulo="Casos por tipo" icono="layers">
          <BarChart items={[
            { label: 'Reclamos', value: tipo('Reclamo') },
            { label: 'Ajustes / reimpresiones', value: tipo('Ajuste', 'Reimpresión') },
            { label: 'Garantías', value: tipo('Garantía') },
            { label: 'Comentarios', value: tipo('Comentario') },
          ]} />
        </Panel>
      </div>

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={6}
        buscar={(c) => `${c.id} ${c.cliente} ${c.ordenId} ${c.descripcion}`}
        placeholder="Buscar caso, cliente u orden..."
        filtros={[
          { titulo: 'Estado', valor: (c) => c.estado, opciones: ['Abierto', 'En trámite', 'Resuelto'] },
          { titulo: 'Tipo', valor: (c) => c.tipo, opciones: ['Reclamo', 'Ajuste', 'Reimpresión', 'Garantía', 'Comentario'] },
        ]}
        vacioTitulo="No hay casos de postventa"
      />

      {resolviendo && (
        <Modal
          titulo="Resolver caso" subtitulo={`Caso ${resolviendo}`} icono="check-circle" tipoBoton="success"
          etiqueta="Describe la solución entregada al cliente" minimo={10}
          textoBoton="Marcar como resuelto"
          onClose={() => setResolviendo(null)}
          onConfirm={(solucion) => {
            actions.updateCase(resolviendo, { estado: 'Resuelto', solucion }, `Caso ${resolviendo} resuelto.`)
            setResolviendo(null)
          }}
        />
      )}
    </div>
  )
}
