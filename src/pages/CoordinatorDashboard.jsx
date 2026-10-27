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
    <div className="prod-dashboard">
      <PageHeader
        etiqueta="CONTROL OPERATIVO · PLANTA GRÁFICA"
        titulo="Panel de producción"
        subtitulo="Control general de las órdenes de producción · datos al 03/10/2026"
        icono="home"
        acciones={
          <>
            <button className="btn" onClick={() => irA('tareas')}>
              <Icon nombre="list" tamano={16} /> Asignar actividades
            </button>
            <button className="btn btn-primary" onClick={() => irA('produccion')}>
              <Icon nombre="columns" tamano={16} /> Tablero de producción
            </button>
          </>
        }
      />

      {bloqueadas.length > 0 && (
        <div className="prod-gate-alerts">
          {bloqueadas.map((o) => (
            <Alert
              key={o.id}
              tipo="bloqueo"
              titulo={`${o.id} no puede pasar a impresión`}
              accion={<button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver orden</button>}
            >
              El diseño aún no ha sido aprobado por el cliente.
            </Alert>
          ))}
        </div>
      )}

      {/* BLOQUE 1: Cabina de mando — Jerarquía de indicadores + Distribución por etapa */}
      <div className="prod-command-deck">
        <div className="prod-kpi-cluster">
          <div className="prod-kpi-primary">
            <StatCard
              variante="hero"
              titulo="Órdenes activas"
              valor={activas.length}
              icono="clipboard"
              detalle="En flujo operativo de planta"
              onClick={() => irA('pedidos')}
            />
            <StatCard
              variante="featured"
              titulo="Trabajos en producción"
              valor={enProduccion}
              icono="printer"
              detalle="En máquinas de impresión y acabados"
              onClick={() => irA('produccion')}
            />
          </div>

          <div className="prod-kpi-secondary kpis">
            <StatCard
              titulo="Órdenes retrasadas"
              valor={retrasadas.length}
              icono="alert-triangle"
              color={retrasadas.length ? 'rojo' : 'azul'}
              detalle="Atención prioritaria"
              onClick={() => irA('pedidos')}
            />
            <StatCard
              titulo="Órdenes en riesgo"
              valor={activas.filter(estaEnRiesgo).length}
              icono="clock"
              color="amarillo"
              detalle="Entrega próxima"
            />
            <StatCard
              variante="compacta"
              titulo="Solicitudes por validar"
              valor={porValidar}
              icono="inbox"
              color={porValidar ? 'amarillo' : 'azul'}
              detalle="Revisión técnica"
              onClick={() => irA('solicitudes')}
            />
            <StatCard
              variante="compacta"
              titulo="Actividades pendientes"
              valor={tareasAbiertas.length}
              icono="list"
              detalle="Tareas abiertas"
              onClick={() => irA('tareas')}
            />
          </div>
        </div>

        <Panel
          etiqueta="FLUJO EN PLANTA"
          titulo="Órdenes activas por etapa"
          subtitulo="Distribución actual entre preprensa, taller y despacho"
          icono="layers"
          className="prod-stage-panel"
        >
          <DonutChart
            subtitulo="activas"
            items={porEtapa.map((e, i) => ({ ...e, color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i] }))}
          />
        </Panel>
      </div>

      {/* BLOQUE 2: Cadencia semanal + Monitor de alertas de entrega */}
      <div className="prod-analytics-deck">
        <Panel
          etiqueta="CADENCIA SEMANAL"
          titulo="Órdenes recibidas y entregadas por semana"
          subtitulo="Comparativa de ingreso comercial frente a despachos completados"
          icono="trending-up"
        >
          <ColumnChart datos={serieSemanal(data.orders)} />
        </Panel>

        <Panel
          etiqueta="SUPERVISIÓN DE PLAZOS"
          titulo="Alertas de entrega"
          subtitulo="Órdenes fuera de fecha o en ventana crítica de vencimiento"
          icono="alert-triangle"
        >
          {alertas.length === 0 ? (
            <EmptyState icono="check-circle" titulo="Sin alertas" texto="Ninguna orden está retrasada ni en riesgo." />
          ) : (
            <ul className="alert-list">
              {alertas.map((o) => (
                <li key={o.id} className={estaRetrasada(o) ? 'alert-row alert-row-rojo' : 'alert-row alert-row-amarillo'}>
                  <div className="alert-row-main">
                    <strong>{o.id} · {o.producto}</strong>
                    <span className="muted">{o.cliente} · Entrega {o.fechaEntrega} · {textoPlazo(o)}</span>
                  </div>
                  <span className="alert-row-end">
                    <StatusBadge estado={o.estado} />
                    <Avatar nombre={o.responsable} tamano="sm" />
                    <button className="btn btn-sm" onClick={() => irA('detalle', o.id)}>Ver</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* BLOQUE 3: Capacidad del equipo, Despachos próximos y Trazabilidad en vivo */}
      <div className="prod-operations-deck">
        <Panel
          etiqueta="CAPACIDAD OPERATIVA"
          titulo="Carga por responsable"
          subtitulo="Órdenes asignadas y tareas activas por integrante"
          icono="users"
        >
          <BarChart items={responsables.map((r) => ({ label: r.nombre, value: r.ordenes + r.tareas }))} />
          <table className="table table-plain compact">
            <thead><tr><th>Responsable</th><th>Órdenes</th><th>Tareas</th></tr></thead>
            <tbody>
              {responsables.map((r) => (
                <tr key={r.nombre}>
                  <td><span className="person"><Avatar nombre={r.nombre} tamano="xs" /> {r.nombre}</span></td>
                  <td>{r.ordenes}</td>
                  <td>{r.tareas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel
          etiqueta="AGENDA DE DESPACHO"
          titulo="Entregas próximas (7 días)"
          subtitulo="Compromisos de entrega en la semana en curso"
          icono="truck"
          accion={<button className="btn btn-ghost btn-sm" onClick={() => irA('entregas')}>Ver entregas</button>}
        >
          {proximas.length === 0 ? <EmptyState icono="truck" titulo="Sin entregas próximas" /> : (
            <table className="table table-plain">
              <thead><tr><th>Orden</th><th>Cliente</th><th>Etapa</th><th>Entrega</th></tr></thead>
              <tbody>
                {proximas.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.id}</strong></td>
                    <td>{o.cliente}</td>
                    <td><StatusBadge estado={o.estado} /></td>
                    <td>{o.fechaEntrega}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          etiqueta="BITÁCORA DE PLANTA"
          titulo="Actividad reciente"
          subtitulo="Últimos eventos registrados en las órdenes"
          icono="activity"
        >
          <ActivityFeed orders={data.orders} limite={6} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
