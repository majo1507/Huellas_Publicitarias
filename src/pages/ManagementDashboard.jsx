import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ColumnChart from '../components/ColumnChart.jsx'
import Alert from '../components/Alert.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import Icon from '../components/Icon.jsx'
import { ETAPAS, TIEMPO_PROMEDIO_ETAPA, OPERARIOS } from '../data/mockData.js'
import { estaActiva, estaRetrasada, serieSemanal } from '../utils/format.js'
import { generarInformeGestionPDF, PERIODOS_GESTION } from '../utils/pdfReport.js'

// GERENCIA: indicadores generales con gráficos sencillos e Informe de Gestión de Producción por periodo
export default function ManagementDashboard({ data, actions, irA }) {
  const [periodoReporte, setPeriodoReporte] = useState('todo')

  const activas = data.orders.filter(estaActiva)
  const entregadas = data.orders.length - activas.length
  const retrasadas = activas.filter(estaRetrasada).length
  const aTiempo = Math.round(((activas.length - retrasadas) / Math.max(activas.length, 1)) * 100)

  const porEtapa = ETAPAS.slice(1, 6).map((etapa) => ({ label: etapa, value: activas.filter((o) => o.estado === etapa).length }))
  const tiempos = Object.entries(TIEMPO_PROMEDIO_ETAPA).map(([etapa, dias]) => ({ label: etapa, value: dias }))
  const carga = ['María López', ...OPERARIOS].map((n) => ({ label: n, value: activas.filter((o) => o.responsable === n).length }))

  // Cuello de botella: la etapa con más órdenes acumuladas
  const cuello = [...porEtapa].sort((a, b) => b.value - a.value)[0]
  const casosAbiertos = data.cases.filter((c) => c.estado !== 'Resuelto').length

  return (
    <div>
      <PageHeader
        titulo="Resumen general"
        subtitulo="Indicadores de las órdenes de producción de Huellas Publicidad."
        icono="home"
        acciones={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <select
              className="inline-select"
              value={periodoReporte}
              onChange={(e) => setPeriodoReporte(e.target.value)}
              aria-label="Seleccionar periodo del informe de gestión"
              style={{ height: '36px' }}
            >
              {PERIODOS_GESTION.map((p) => (
                <option key={p.id} value={p.id}>
                  Periodo: {p.label}
                </option>
              ))}
            </select>
            <button
              className="btn btn-soft"
              onClick={() => {
                generarInformeGestionPDF(data, { periodo: periodoReporte })
                actions?.notify?.('Informe de gestión de producción (PDF) descargado.', 'exito')
              }}
            >
              <Icon nombre="download" tamano={15} /> Informe de gestión (PDF)
            </button>
            <button className="btn btn-primary" onClick={() => irA('reportes')}>
              Ver reportes detallados
            </button>
          </div>
        }
      />

      <div className="kpis">
        <StatCard titulo="Total de órdenes" valor={data.orders.length} icono="clipboard" />
        <StatCard titulo="Órdenes activas" valor={activas.length} icono="activity" />
        <StatCard titulo="Órdenes retrasadas" valor={retrasadas} icono="alert-triangle" color={retrasadas ? 'rojo' : 'azul'} />
        <StatCard titulo="Órdenes entregadas" valor={entregadas} icono="package" color="verde" />
        <StatCard titulo="Entregas a tiempo" valor={`${aTiempo}%`} icono="trending-up" detalle="de las órdenes activas" />
        <StatCard titulo="Casos de postventa abiertos" valor={casosAbiertos} icono="life-buoy" detalle={`${data.cases.length} casos en total`} />
      </div>

      <Alert tipo="aviso" titulo="Cuello de botella detectado">
        La etapa de {cuello.label} concentra {cuello.value} órdenes activas. Conviene revisar su capacidad.
      </Alert>

      <div className="grid-main">
        <Panel titulo="Órdenes recibidas y entregadas por semana" icono="trending-up">
          <ColumnChart datos={serieSemanal(data.orders)} />
        </Panel>
        <Panel titulo="Órdenes activas por etapa" icono="layers">
          <DonutChart subtitulo="activas" items={porEtapa.map((e, i) => ({ ...e, color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i] }))} />
        </Panel>
      </div>

      <div className="grid-3">
        <Panel titulo="Tiempo promedio por etapa" icono="clock">
          <BarChart items={tiempos} unidad=" días" />
        </Panel>
        <Panel titulo="Carga por responsable" icono="users">
          <BarChart items={carga} />
        </Panel>
        <Panel titulo="Actividad reciente" icono="activity">
          <ActivityFeed orders={data.orders} limite={5} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
