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
import EmptyState from '../components/EmptyState.jsx'
import { ETAPAS } from '../data/mockData.js'
import { estaActiva, estaRetrasada, serieSemanal } from '../utils/format.js'
import { generarInformeGestionPDF, PERIODOS_GESTION } from '../utils/pdfReport.js'

// GERENCIA: indicadores generales basados en datos reales de PostgreSQL (Fase 3.2 Complementaria)
export default function ManagementDashboard({ data, actions, irA }) {
  const [periodoReporte, setPeriodoReporte] = useState('todo')

  const dash = data?.dashboard || null
  const resumen = dash?.resumen || null
  const tieneErrorServidor = Boolean(dash?.error)

  // Cálculo de órdenes activas y finalizadas a partir de datos reales sincronizados
  const activasCount = resumen ? resumen.activas : data.orders.filter(estaActiva).length
  const totalOrdenes = resumen ? resumen.total_ordenes : data.orders.length
  const entregadasCount = resumen ? resumen.finalizadas : (totalOrdenes - activasCount)
  const retrasadasCount = resumen ? resumen.retrasadas : data.orders.filter(estaRetrasada).length

  // Cumplimiento global de entregas sobre el total de órdenes del sistema
  const enPlazoGlobal = Math.max(0, totalOrdenes - retrasadasCount)
  // Sin órdenes no existe porcentaje de cumplimiento (null → "Sin datos")
  const aTiempoPct = totalOrdenes > 0 ? Math.round((enPlazoGlobal / totalOrdenes) * 100) : null

  // Cantidades reales de solicitudes, actividades y postventa
  const totalSolicitudes = resumen?.solicitudes ? resumen.solicitudes.total : (data.requests?.length ?? 0)
  const solicitudesAprobadas = resumen?.solicitudes ? resumen.solicitudes.aprobadas : (data.requests?.filter((s) => s.estado === 'aprobada' || s.estado === 'Aprobada').length ?? 0)
  const totalActividades = resumen?.actividades ? resumen.actividades.total : (data.tasks?.length ?? 0)
  const promedioAvance = resumen?.actividades
    ? resumen.actividades.promedio_avance
    : data.tasks?.length
    ? Math.round(data.tasks.reduce((s, t) => s + (t.porcentaje ?? t.pct ?? 0), 0) / data.tasks.length)
    : 0
  const casosAbiertos = resumen?.postventa
    ? resumen.postventa.abiertos + resumen.postventa.en_tramite + resumen.postventa.en_reposicion
    : data.cases.filter((c) => c.estado !== 'Resuelto' && c.estado !== 'Cerrado').length
  const totalCasos = resumen?.postventa ? resumen.postventa.total : data.cases.length

  // Distribución real por etapas activas
  const porEtapa = dash?.ordenes_activas_por_etapa?.length
    ? dash.ordenes_activas_por_etapa
    : ETAPAS.slice(1, 6).map((etapa) => ({
        label: etapa,
        value: data.orders.filter(estaActiva).filter((o) => (o.estado || o.estado_nombre) === etapa).length,
      }))

  // Carga de trabajo real por responsable (colaboradores operativos)
  const carga = dash?.carga_usuarios?.length
    ? dash.carga_usuarios
    : (data.users || [])
        .filter((u) => u.rol !== 'Gerencia' && u.rol !== 'gerente')
        .map((u) => ({
          label: u.nombre,
          value: (data.tasks || []).filter((t) => (t.responsable === u.nombre || t.owner_id === u.id) && t.estado !== 'Finalizada').length,
        }))

  // Cuello de botella detectado según la etapa con mayor volumen
  const cuello = dash?.cuello_de_botella || ([...porEtapa].sort((a, b) => b.value - a.value)[0] || { label: 'Diseño', value: 0 })

  // Tiempos promedio por etapa: telemetría histórica no disponible en la base de datos
  const tieneTiemposPorEtapa = Boolean(dash?.tiempos_promedio_etapa?.disponible && dash?.tiempos_promedio_etapa?.items?.length)

  return (
    <div>
      <PageHeader
        etiqueta="GERENCIA · TELEMETRÍA Y CUMPLIMIENTO OPERATIVO"
        titulo="Resumen general"
        subtitulo="Indicadores consolidados de producción en tiempo real desde PostgreSQL."
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
              Ver reportes detallados <Icon nombre="arrow-right" tamano={14} />
            </button>
          </div>
        }
      />

      {tieneErrorServidor && (
        <Alert tipo="error" titulo="Métricas consolidadas de PostgreSQL no disponibles">
          No fue posible consultar los agregados analíticos del servidor ({dash.error}). Se presentan los indicadores calculados con las colecciones sincronizadas.
        </Alert>
      )}

      {/* 4 Indicadores ejecutivos consolidados con redirección directa */}
      <div className="kpis">
        <StatCard
          titulo="Cumplimiento en plazo"
          valor={aTiempoPct === null ? 'Sin datos' : `${aTiempoPct}%`}
          icono="trending-up"
          color={aTiempoPct === null ? 'azul' : aTiempoPct >= 80 ? 'verde' : 'amarillo'}
          detalle={totalOrdenes === 0 ? 'Sin órdenes registradas' : `${enPlazoGlobal} de ${totalOrdenes} en plazo · ${entregadasCount} entregadas`}
          onClick={() => irA('reportes')}
        />
        <StatCard
          titulo="Órdenes activas en planta"
          valor={activasCount}
          icono="activity"
          color="azul"
          detalle={`${totalSolicitudes} solicitudes (${solicitudesAprobadas} aprobadas)`}
          onClick={() => irA('pedidos')}
        />
        <StatCard
          titulo="Órdenes retrasadas"
          valor={retrasadasCount}
          icono="alert-triangle"
          color={retrasadasCount ? 'rojo' : 'azul'}
          detalle={`${totalActividades} actividades (${promedioAvance}% avance)`}
          onClick={() => irA('pedidos')}
        />
        <StatCard
          titulo="Casos postventa abiertos"
          valor={casosAbiertos}
          icono="life-buoy"
          color={casosAbiertos > 0 ? 'amarillo' : 'verde'}
          detalle={`${totalCasos} casos PQRSF y garantías registrados`}
          onClick={() => irA('postventa')}
        />
      </div>

      {totalOrdenes === 0 ? (
        <Alert tipo="info" titulo="Sin datos">
          Aún no hay órdenes registradas para evaluar el flujo de producción.
        </Alert>
      ) : cuello.value > 0 ? (
        <Alert
          tipo="aviso"
          titulo="Cuello de botella detectado"
          accion={
            <button className="btn btn-sm" onClick={() => irA('produccion')}>
              Ver tablero de planta
            </button>
          }
        >
          La etapa de <strong>{cuello.label}</strong> concentra {cuello.value} órdenes activas. Conviene revisar su capacidad operativa.
        </Alert>
      ) : (
        <Alert tipo="exito" titulo="Flujo de producción equilibrado">
          No se detectan acumulaciones críticas en las etapas activas de taller.
        </Alert>
      )}

      <div className="grid-main" style={{ marginTop: '18px' }}>
        <Panel
          titulo="Órdenes recibidas y entregadas por semana"
          subtitulo="Cadencia semanal de entrada vs. finalización."
          icono="trending-up"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('reportes')}>
              Analítica <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          {data.orders.length === 0 ? (
            <EmptyState icono="trending-up" titulo="Sin datos" texto="Aún no hay órdenes recibidas ni entregadas para graficar." />
          ) : (
            <ColumnChart datos={serieSemanal(data.orders)} />
          )}
        </Panel>
        <Panel
          titulo="Órdenes activas por etapa"
          subtitulo="Distribución circular en tiempo real."
          icono="layers"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('produccion')}>
              Tablero <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          <DonutChart
            subtitulo="activas"
            items={porEtapa.map((e, i) => ({
              ...e,
              color: ['celeste', 'azul', 'marino', 'gris', 'verde'][i % 5],
            }))}
          />
        </Panel>
      </div>

      <div className="grid-3">
        <Panel titulo="Tiempo promedio por etapa" icono="clock">
          {tieneTiemposPorEtapa ? (
            <BarChart items={dash.tiempos_promedio_etapa.items} unidad=" días" />
          ) : (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-subtle, #6b7280)' }}>
              <Icon nombre="clock" tamano={22} style={{ opacity: 0.6, marginBottom: '8px' }} />
              <p style={{ fontWeight: 600, margin: '4px 0', color: 'inherit' }}>Sin datos disponibles</p>
              <p className="sm mut" style={{ margin: 0 }}>
                No se cuenta con registro histórico de transiciones de etapa en la base de datos.
              </p>
            </div>
          )}
        </Panel>
        <Panel
          titulo="Carga por responsable"
          icono="users"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('tareas')}>
              Actividades <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          {carga.length > 0 ? (
            <BarChart items={carga} unidad=" tareas" />
          ) : (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-subtle, #6b7280)' }}>
              <p className="sm mut">Sin tareas activas asignadas a colaboradores.</p>
            </div>
          )}
        </Panel>
        <Panel
          titulo="Actividad reciente"
          icono="activity"
          accion={
            <button className="btn btn-ghost btn-sm" onClick={() => irA('pedidos')}>
              Ver órdenes <Icon nombre="arrow-right" tamano={13} />
            </button>
          }
        >
          <ActivityFeed orders={data.orders} limite={5} onAbrir={(id) => irA('detalle', id)} />
        </Panel>
      </div>
    </div>
  )
}
