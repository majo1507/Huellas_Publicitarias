import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ColumnChart from '../components/ColumnChart.jsx'
import Alert from '../components/Alert.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import { ETAPAS, TIEMPO_PROMEDIO_ETAPA, OPERARIOS } from '../data/mockData.js'
import { estaActiva, estaRetrasada, serieSemanal } from '../utils/format.js'

// GERENCIA: indicadores generales con gráficos sencillos
export default function ManagementDashboard({ data, irA }) {
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
      <PageHeader titulo="Resumen general" subtitulo="Indicadores de las órdenes de producción de Huellas Publicidad." icono="home"
        acciones={<button className="btn btn-primary" onClick={() => irA('reportes')}>Ver reportes detallados</button>} />

      <div className="kpis">
        <StatCard variante="hero" titulo="Total de órdenes" valor={data.orders.length} icono="clipboard" segmentos={[{ label: 'Activas', valor: activas.length, color: 'celeste' }, { label: 'Entregadas', valor: entregadas, color: 'verde' }]} />
        <StatCard variante="featured" titulo="Órdenes activas" valor={activas.length} icono="activity" progreso={Math.round((activas.length / Math.max(data.orders.length, 1)) * 100)} />
        <StatCard titulo="Órdenes retrasadas" valor={retrasadas} icono="alert-triangle" color={retrasadas ? 'rojo' : 'azul'} />
        <StatCard variante="compacta" titulo="Órdenes entregadas" valor={entregadas} icono="package" color="verde" />
        <StatCard titulo="Entregas a tiempo" valor={`${aTiempo}%`} icono="trending-up" progreso={aTiempo} detalle="de las órdenes activas" />
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
