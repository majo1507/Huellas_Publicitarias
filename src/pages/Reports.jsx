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
import { generarReporteOrdenPDF, generarReporteGeneralPDF } from '../utils/pdfReport.js'

export default function Reports({ data, actions, irA }) {
  const [ordenSeleccionadaId, setOrdenSeleccionadaId] = useState(() => data.orders[0]?.id || '')

  const activas = data.orders.filter(estaActiva)
  const problemas = activas
    .filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
    .map((o) => ({ ...o, alerta: estaRetrasada(o) ? 'Retrasada' : 'En riesgo' }))

  const facturado = data.orders.reduce((s, o) => s + (Number(o.presupuesto) || 0), 0)
  const costoInternoTotal = data.orders.reduce((s, o) => s + (Number(o.costoInterno) || 0), 0)

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
    {
      clave: 'pdf',
      titulo: 'Reporte PDF',
      render: (o) => (
        <button
          className="btn btn-soft btn-sm"
          onClick={() => {
            generarReporteOrdenPDF(o, data)
            actions?.notify?.(`Reporte PDF de ${o.id} descargado.`, 'exito')
          }}
        >
          <Icon nombre="download" tamano={13} /> PDF
        </button>
      ),
    },
  ]

  function handleDescargarOrdenSeleccionada() {
    const ord = data.orders.find((o) => o.id === ordenSeleccionadaId) || data.orders[0]
    if (!ord) return
    generarReporteOrdenPDF(ord, data)
    actions?.notify?.(`Reporte PDF de la orden ${ord.id} descargado con éxito.`, 'exito')
  }

  function handleDescargarReporteGeneral() {
    generarReporteGeneralPDF(data)
    actions?.notify?.('Reporte general PDF de producción e inventario descargado con éxito.', 'exito')
  }

  return (
    <div>
      <PageHeader
        titulo="Reportes ejecutivos, producción y exportación PDF"
        subtitulo="Cifras de cumplimiento, costos, inventario y generación de reportes oficiales en PDF de ORVEX — Huellas Publicidad."
        icono="bar-chart"
        acciones={
          <button className="btn btn-primary" onClick={handleDescargarReporteGeneral}>
            <Icon nombre="download" tamano={16} /> Descargar reporte general PDF
          </button>
        }
      />

      {/* CENTRO DE EXPORTACIÓN DE REPORTES EN PDF */}
      <Panel
        etiqueta="CENTRO DE DOCUMENTACIÓN OFICIAL"
        titulo="Generación y descarga de reportes en PDF"
        subtitulo="Genera reportes individuales por orden de producción o el informe consolidado de planta e inventario."
        icono="file-text"
        style={{ marginBottom: '22px' }}
      >
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <div className="card p" style={{ background: 'var(--bg-subtle)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong>Reporte individual de Orden de Producción (PDF)</strong>
              <span className="pill">Ficha completa</span>
            </div>
            <p className="sm mut" style={{ marginBottom: '12px' }}>
              Incluye logo ORVEX, número de reporte, cliente, responsables asignados, actividades, materiales utilizados, costos, presupuesto, fechas, observaciones y firmas.
            </p>
            <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={ordenSeleccionadaId}
                onChange={(e) => setOrdenSeleccionadaId(e.target.value)}
                style={{ flex: 1, minWidth: '220px' }}
                aria-label="Seleccionar orden para PDF"
              >
                {data.orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.cliente} — {o.producto} ({o.estado})
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleDescargarOrdenSeleccionada}>
                <Icon nombre="download" tamano={15} /> Generar PDF de orden
              </button>
            </div>
          </div>

          <div className="card p" style={{ background: 'var(--bg-subtle)' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong>Reporte general de Producción, Costos e Inventario (PDF)</strong>
              <span className="pill">Consolidado</span>
            </div>
            <p className="sm mut" style={{ marginBottom: '12px' }}>
              Incluye resumen ejecutivo de todas las órdenes ({data.orders.length}), estado de planta, presupuesto consolidado ({formatoCOP(facturado)}), costos internos ({formatoCOP(costoInternoTotal)}), existencias de inventario y alertas de stock.
            </p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-soft" onClick={handleDescargarReporteGeneral}>
                <Icon nombre="download" tamano={15} /> Descargar reporte general PDF
              </button>
            </div>
          </div>
        </div>
      </Panel>

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
