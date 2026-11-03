import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import DataTable from '../components/DataTable.jsx'
import Icon from '../components/Icon.jsx'
import { estaActiva, estaRetrasada, estaEnRiesgo, formatoCOP, textoPlazo } from '../utils/format.js'
import { generarInformeGestionPDF, PERIODOS_GESTION, filtrarOrdenesPorPeriodo } from '../utils/pdfReport.js'

export default function Reports({ data, actions, irA, role }) {
  const [periodo, setPeriodo] = useState('todo')

  const ordenesPeriodo = filtrarOrdenesPorPeriodo(data.orders, periodo)
  const activas = ordenesPeriodo.filter(estaActiva)
  const problemas = activas
    .filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
    .map((o) => ({ ...o, alerta: estaRetrasada(o) ? 'Retrasada' : 'En riesgo' }))

  const facturado = ordenesPeriodo.reduce((s, o) => s + (Number(o.presupuesto) || 0), 0)

  // Metas vs Tiempos reales por etapa (en días)
  const comparativaMetas = [
    { etapa: 'Diseño', real: 2.4, meta: 2.0 },
    { etapa: 'Aprobación', real: 1.3, meta: 1.0 },
    { etapa: 'Impresión', real: 3.2, meta: 2.5 },
    { etapa: 'Acabados', real: 2.1, meta: 2.0 },
    { etapa: 'Despacho', real: 0.8, meta: 1.0 },
  ]

  // Carga de tareas activas por usuario
  const cargaUsuarios = data.users
    .filter((u) => u.rol !== 'Gerencia')
    .map((u) => ({
      label: u.nombre,
      value: data.tasks.filter((t) => t.responsable === u.nombre && t.estado !== 'Finalizada').length,
    }))

  // Canales de comunicación
  const commsCanal = [
    { label: 'WhatsApp', value: 8, color: 'verde' },
    { label: 'Correo', value: 4, color: 'azul' },
    { label: 'Telefonía', value: 2, color: 'amarillo' },
  ]

  const columnasProblemas = [
    {
      clave: 'id',
      titulo: 'Orden',
      ordenar: true,
      render: (o) => (
        <button className="link-inline" onClick={() => irA('detalle', o.id)}>
          <strong>{o.id}</strong>
        </button>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente' },
    { clave: 'producto', titulo: 'Producto' },
    { clave: 'estado', titulo: 'Etapa actual', render: (o) => <StatusBadge estado={o.estado} /> },
    { clave: 'responsable', titulo: 'Responsable' },
    {
      clave: 'fechaEntrega',
      titulo: 'Entrega',
      render: (o) => (
        <div>
          <span>{o.fechaEntrega}</span>
          <small className="cell-sub text-rojo">{textoPlazo(o)}</small>
        </div>
      ),
    },
    { clave: 'alerta', titulo: 'Severidad', render: (o) => <StatusBadge estado={o.alerta} /> },
  ]

  function handleDescargarInformeGestion() {
    generarInformeGestionPDF(data, { periodo })
    actions?.notify?.('Informe de gestión de producción (PDF) descargado.', 'exito')
  }

  return (
    <div>
      <PageHeader
        titulo="Reportes ejecutivos y desempeño"
        subtitulo="Cifras de cumplimiento, cuellos de botella y presupuesto general de ORVEX — Huellas Publicidad."
        icono="bar-chart"
        acciones={
          role === 'gerencia' && (
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="inline-select"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                aria-label="Seleccionar periodo del informe de gestión"
                style={{ height: '36px' }}
              >
                {PERIODOS_GESTION.map((p) => (
                  <option key={p.id} value={p.id}>
                    Periodo: {p.label}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleDescargarInformeGestion}>
                <Icon nombre="download" tamano={16} /> Informe de gestión (PDF)
              </button>
            </div>
          )
        }
      />

      {/* Tarjetas ejecutivas */}
      <div className="kpis">
        <StatCard titulo="Cumplimiento a tiempo" valor="86%" icono="check-circle" color="verde" detalle="Meta superior al 85%" />
        <StatCard titulo="Ciclo promedio orden" valor="11.4 d" icono="clock" color="azul" detalle="Desde solicitud hasta entrega" />
        <StatCard titulo="Aprobados a la 1ª versión" valor="58%" icono="pen" color="amarillo" detalle="Ratio de eficiencia gráfica" />
        <StatCard titulo="Total presupuestado" valor={formatoCOP(facturado)} icono="trending-up" color="azul" detalle={`${activas.length} órdenes en curso`} />
      </div>

      {/* Gráficos de cumplimiento y distribución */}
      <div className="grid-2">
        <Panel titulo="Cumplimiento de entregas y calidad" icono="check-circle">
          <DonutChart
            centro="86%"
            subtitulo="A tiempo"
            items={[
              { label: 'A tiempo', value: 86, color: 'verde' },
              { label: 'Con retraso', value: 14, color: 'rojo' },
            ]}
          />
        </Panel>

        <Panel titulo="Comunicaciones por canal de contacto" icono="message">
          <DonutChart
            centro="14"
            subtitulo="Conversaciones"
            items={commsCanal}
          />
        </Panel>
      </div>

      {/* Tiempos reales frente a la meta (Gráfico técnico de preprensa) */}
      <Panel titulo="Días promedio por etapa vs. Meta técnica" icono="clock" style={{ marginBottom: '24px' }}>
        <p className="sm mut" style={{ marginBottom: '16px' }}>
          La línea negra representa la meta de tiempo de taller; las barras indican la duración real observada.
        </p>
        <div className="bars">
          {comparativaMetas.map((c) => {
            const porcentaje = Math.min((c.real / 4) * 100, 100)
            const metaPos = Math.min((c.meta / 4) * 100, 100)
            const excede = c.real > c.meta
            return (
              <div key={c.etapa} className="b">
                <span className="ell"><strong>{c.etapa}</strong></span>
                <div className="bar">
                  <i
                    style={{
                      width: `${porcentaje}%`,
                      background: excede ? 'var(--state-amber)' : 'var(--blue-600)',
                    }}
                  />
                  <u style={{ left: `${metaPos}%` }} title={`Meta: ${c.meta} días`} />
                </div>
                <span className="r tn">{c.real} d <small className="mut">({c.meta}d)</small></span>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Carga por responsable */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <Panel titulo="Carga de trabajo por colaborador" icono="users">
          <BarChart items={cargaUsuarios} unidad=" tareas" />
        </Panel>

        <Panel titulo="Distribución de casos postventa" icono="life-buoy">
          <DonutChart
            centro={data.cases.length}
            subtitulo="Casos"
            items={[
              { label: 'Resueltos', value: data.cases.filter((c) => c.estado === 'Resuelto').length, color: 'verde' },
              { label: 'En trámite', value: data.cases.filter((c) => c.estado === 'En trámite').length, color: 'amarillo' },
              { label: 'Abiertos', value: data.cases.filter((c) => c.estado === 'Abierto').length, color: 'rojo' },
            ]}
          />
        </Panel>
      </div>

      {/* Tabla de órdenes que requieren atención */}
      <Panel titulo="Órdenes que requieren atención inmediata" icono="alert-triangle">
        <DataTable
          columnas={columnasProblemas}
          filas={problemas}
          porPagina={6}
          buscar={(o) => `${o.id} ${o.cliente} ${o.responsable}`}
          placeholder="Buscar orden con alerta..."
          vacioTitulo="No hay órdenes con alertas críticas"
        />
      </Panel>
    </div>
  )
}
