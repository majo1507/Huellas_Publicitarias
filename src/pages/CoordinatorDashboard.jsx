import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import ColumnChart from '../components/ColumnChart.jsx'
import ActivityFeed from '../components/ActivityFeed.jsx'
import Alert from '../components/Alert.jsx'
import Avatar from '../components/Avatar.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { ETAPAS, OPERARIOS } from '../data/mockData.js'
import {
  diasParaEntrega, estaActiva, estaRetrasada, estaEnRiesgo, puedeAvanzar, serieSemanal, textoPlazo,
} from '../utils/format.js'

// COORDINADOR DE PRODUCCIÓN: control general de las órdenes
export default function CoordinatorDashboard({ data, irA }) {
  const activas = data.orders.filter(estaActiva)
  const retrasadas = activas.filter(estaRetrasada)
  const alertas = activas.filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
  const bloqueadas = activas.filter((o) => puedeAvanzar(o).bloqueada && o.estado === 'Aprobación')
  const porValidar = data.requests.filter((s) => s.estado === 'En validación').length
  const tareasAbiertas = data.tasks.filter((t) => t.estado !== 'Finalizada')
  const enProduccion = activas.filter((o) => ['Impresión', 'Acabados'].includes(o.estado)).length
  const proximas = activas.filter((o) => diasParaEntrega(o) >= 0 && diasParaEntrega(o) <= 7).sort((a, b) => diasParaEntrega(a) - diasParaEntrega(b))

  const porEtapa = ETAPAS.slice(1, 6).map((etapa) => ({ label: etapa, value: activas.filter((o) => o.estado === etapa).length }))
  const responsables = ['María López', ...OPERARIOS].map((nombre) => ({
    nombre,
    ordenes: activas.filter((o) => o.responsable === nombre).length,
    tareas: tareasAbiertas.filter((t) => t.responsable === nombre).length,
  }))

  return (
    <div>
      <PageHeader
        titulo="Panel de producción"
        subtitulo="Control general de las órdenes de producción · datos al 03/10/2026"
        icono="home"
        acciones={
          <>
            <button className="btn" onClick={() => irA('tareas')}><Icon nombre="list" tamano={16} /> Asignar actividades</button>
            <button className="btn btn-primary" onClick={() => irA('produccion')}><Icon nombre="columns" tamano={16} /> Tablero de producción</button>
          </>
        }
      />

      <div className="kpis">
        <StatCard titulo="Órdenes activas" valor={activas.length} icono="clipboard" onClick={() => irA('pedidos')} />
        <StatCard titulo="Órdenes retrasadas" valor={retrasadas.length} icono="alert-triangle" color={retrasadas.length ? 'rojo' : 'azul'} onClick={() => irA('pedidos')} />
        <StatCard titulo="Órdenes en riesgo" valor={activas.filter(estaEnRiesgo).length} icono="clock" color="amarillo" />
        <StatCard titulo="Trabajos en producción" valor={enProduccion} icono="printer" onClick={() => irA('produccion')} />
        <StatCard titulo="Solicitudes por validar" valor={porValidar} icono="inbox" color={porValidar ? 'amarillo' : 'azul'} onClick={() => irA('solicitudes')} />
        <StatCard titulo="Actividades pendientes" valor={tareasAbiertas.length} icono="list" onClick={() => irA('tareas')} />
      </div>

      {bloqueadas.map((o) => (
        <Alert key={o.id} tipo="bloqueo" titulo={`${o.id} no puede pasar a impresión`}
          accion={<button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver orden</button>}>
          El diseño aún no ha sido aprobado por el cliente.
        </Alert>
      ))}

      <div className="grid-main">
        <Panel titulo="Órdenes recibidas y entregadas por semana" icono="trending-up">
          <ColumnChart datos={serieSemanal(data.orders)} />
        </Panel>
        <Panel titulo="Órdenes activas por etapa" icono="layers">
          <DonutChart
            subtitulo="activas"
            items={porEtapa.map((e, i) => ({ ...e, color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i] }))}
          />
        </Panel>
      </div>

      <div className="grid-main">
        <Panel titulo="Alertas de entrega" icono="alert-triangle">
          {alertas.length === 0 ? (
            <EmptyState icono="check-circle" titulo="Sin alertas" texto="Ninguna orden está retrasada ni en riesgo." />
          ) : (
            <ul className="alert-list">
              {alertas.map((o) => (
                <li key={o.id} className={estaRetrasada(o) ? 'alert-row alert-row-rojo' : 'alert-row alert-row-amarillo'}>
                  <div>
                    <strong>{o.id} · {o.producto}</strong>
                    <span className="muted">{o.cliente} · Entrega {o.fechaEntrega} · {textoPlazo(o)}</span>
                  </div>
                  <span className="alert-row-end"><StatusBadge estado={o.estado} /><Avatar nombre={o.responsable} tamano="sm" />
                    <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver</button></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel titulo="Carga por responsable" icono="users">
          <BarChart items={responsables.map((r) => ({ label: r.nombre, value: r.ordenes + r.tareas }))} />
          <table className="table table-plain compact">
            <thead><tr><th>Responsable</th><th>Órdenes</th><th>Tareas</th></tr></thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.nombre}><td><Avatar nombre={r.nombre} tamano="xs" /> {r.nombre}</td><td>{r.ordenes}</td><td>{r.tareas}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid-main">
        <Panel titulo="Entregas próximas (7 días)" icono="truck" accion={<button className="btn btn-ghost btn-sm" onClick={() => irA('entregas')}>Ver entregas</button>}>
          {proximas.length === 0 ? <EmptyState icono="truck" titulo="Sin entregas próximas" /> : (
            <table className="table table-plain">
              <thead><tr><th>Orden</th><th>Cliente</th><th>Etapa</th><th>Entrega</th></tr></thead>
              <tbody>
                {proximas.map((o) => (
                  <tr key={o.id}><td><strong>{o.id}</strong></td><td>{o.cliente}</td><td><StatusBadge estado={o.estado} /></td><td>{o.fechaEntrega}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel titulo="Actividad reciente" icono="activity">
          <ActivityFeed orders={data.orders} limite={6} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
