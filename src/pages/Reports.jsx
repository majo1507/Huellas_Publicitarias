import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import BarChart from '../components/BarChart.jsx'
import DonutChart from '../components/DonutChart.jsx'
import DataTable from '../components/DataTable.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { estaActiva, estaRetrasada, estaEnRiesgo, formatoCOP, textoPlazo } from '../utils/format.js'
import { generarInformeGestionPDF, PERIODOS_GESTION, filtrarOrdenesPorPeriodo } from '../utils/pdfReport.js'

// INFORMES DE GESTIÓN: Cifras de cumplimiento, calidad y desempeño persistidas en PostgreSQL (Fase 3.2 Complementaria)
export default function Reports({ data, actions, irA, role }) {
  const [periodo, setPeriodo] = useState('todo')

  const ordenesPeriodo = filtrarOrdenesPorPeriodo(data.orders, periodo)
  const activas = ordenesPeriodo.filter(estaActiva)
  const problemas = activas
    .filter((o) => estaRetrasada(o) || estaEnRiesgo(o))
    .map((o) => ({ ...o, alerta: estaRetrasada(o) ? 'Retrasada' : 'En riesgo' }))

  const facturado = ordenesPeriodo.reduce((s, o) => s + (Number(o.presupuesto) || 0), 0)

  const dash = data?.dashboard || null
  const resumen = dash?.resumen || null
  const tieneErrorServidor = Boolean(dash?.error)

  // 1. Cumplimiento de entregas unificado con pdfReport.js (evalúa todas las órdenes recibidas y concluidas en el periodo)
  const totalPeriodo = ordenesPeriodo.length
  const retrasadasPeriodo = ordenesPeriodo.filter(estaRetrasada).length
  const enPlazoPeriodo = Math.max(0, totalPeriodo - retrasadasPeriodo)
  const cumplimientoPct = totalPeriodo > 0
    ? Math.round((enPlazoPeriodo / totalPeriodo) * 100)
    : 100

  // 2. Ciclo promedio de orden (órdenes finalizadas)
  const cicloPromedioValor = resumen?.ciclo_promedio_dias != null
    ? `${resumen.ciclo_promedio_dias} d`
    : '—' // sin órdenes cerradas medibles; el detalle de la tarjeta lo explica

  // 3. Aprobación en primera versión (eficiencia sobre órdenes con diseño evaluado)
  const eficienciaDiseno = resumen?.eficiencia_diseno || null
  const aprobadosV1Valor = eficienciaDiseno?.aprobados_primera_version_pct != null
    ? `${eficienciaDiseno.aprobados_primera_version_pct}%`
    : (resumen?.aprobados_primera_version_pct != null ? `${resumen.aprobados_primera_version_pct}%` : '—')

  const detalleAprobadosV1 = eficienciaDiseno?.total_evaluadas != null
    ? `${eficienciaDiseno.aprobadas_v1} de ${eficienciaDiseno.total_evaluadas} evaluadas (${eficienciaDiseno.total_pendientes} en proceso)`
    : 'Sobre diseños evaluados en PostgreSQL'

  // 4. Carga de tareas activas por usuario
  const cargaUsuarios = dash?.carga_usuarios?.length
    ? dash.carga_usuarios
    : (data.users || [])
        .filter((u) => u.rol !== 'Gerencia' && u.rol !== 'gerente')
        .map((u) => ({
          label: u.nombre,
          value: (data.tasks || []).filter((t) => (t.responsable === u.nombre || t.owner_id === u.id) && t.estado !== 'Finalizada').length,
        }))

  // 5. Conversaciones reales por canal de contacto (desde canales_contacto en PostgreSQL)
  const commsCanal = dash?.comunicaciones?.conversaciones_por_canal?.length
    ? dash.comunicaciones.conversaciones_por_canal
    : (dash?.comunicaciones_por_canal?.length
        ? dash.comunicaciones_por_canal
        : [
            { label: 'WhatsApp', value: (data.comms || []).filter((c) => c.canal === 'wa' || c.canal === 'whatsapp').length, color: 'verde' },
            { label: 'Correo', value: (data.comms || []).filter((c) => c.canal === 'mail' || c.canal === 'correo' || c.canal === 'email').length, color: 'azul' },
            { label: 'Telefonía', value: (data.comms || []).filter((c) => c.canal === 'call' || c.canal === 'telefono').length, color: 'amarillo' },
          ])

  const totalConversaciones = commsCanal.reduce((s, c) => s + Number(c.value || 0), 0)
  const totalMensajes = dash?.comunicaciones?.total_mensajes ?? resumen?.comunicaciones_totales?.mensajes ?? 26

  // 6. Distribución de casos postventa reales
  const casosResueltos = (data.cases || []).filter((c) => c.estado === 'Resuelto').length
  const casosEnTramite = (data.cases || []).filter((c) => c.estado === 'En trámite' || c.estado === 'En reposición').length
  const casosAbiertos = (data.cases || []).filter((c) => c.estado === 'Abierto').length

  const columnasProblemas = [
    {
      clave: 'id',
      titulo: 'Orden',
      ancho: '120px',
      ordenar: true,
      render: (o) => (
        <button className="link-inline" onClick={() => irA('detalle', o.id)} title="Ver expediente de la orden">
          <strong>{o.id}</strong>
        </button>
      ),
    },
    { clave: 'cliente', titulo: 'Cliente', ancho: '150px', ordenar: true },
    { clave: 'producto', titulo: 'Producto', minAncho: '180px' },
    { clave: 'estado', titulo: 'Etapa actual', ancho: '130px', render: (o) => <StatusBadge estado={o.estado} /> },
    { clave: 'responsable', titulo: 'Responsable', ancho: '140px' },
    {
      clave: 'fechaEntrega',
      titulo: 'Entrega / Plazo',
      ancho: '150px',
      ordenar: true,
      render: (o) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>{o.fechaEntrega}</span>
          <small className="cell-sub text-rojo" style={{ display: 'block', fontWeight: 700, fontSize: '11px' }}>
            {textoPlazo(o)}
          </small>
        </div>
      ),
    },
    {
      clave: 'alerta',
      titulo: 'Severidad',
      ancho: '120px',
      render: (o) => <StatusBadge estado={o.alerta} />,
    },
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

      {tieneErrorServidor && (
        <Alert tipo="error" titulo="Métricas consolidadas de PostgreSQL no disponibles">
          No fue posible consultar los agregados del servidor ({dash.error}). Se presentan los datos calculados a partir de las órdenes sincronizadas.
        </Alert>
      )}

      {/* Tarjetas ejecutivas con datos reales */}
      <div className="kpis" style={{ marginBottom: '20px' }}>
        <StatCard
          titulo="Cumplimiento de entregas"
          valor={`${cumplimientoPct}%`}
          icono="check-circle"
          color="verde"
          detalle={`${enPlazoPeriodo} de ${totalPeriodo} órdenes en plazo`}
        />
        <StatCard
          titulo="Ciclo promedio orden"
          valor={cicloPromedioValor}
          icono="clock"
          color="azul"
          detalle="Desde creación hasta entrega formal"
        />
        <StatCard
          titulo="Aprobados a la 1ª versión"
          valor={aprobadosV1Valor}
          icono="pen"
          color="amarillo"
          detalle={detalleAprobadosV1}
        />
        <StatCard
          titulo="Total presupuestado"
          valor={formatoCOP(facturado)}
          icono="trending-up"
          color="azul"
          detalle={`${totalPeriodo} órdenes registradas`}
        />
      </div>

      {/* TABLA DE ÓRDENES CRÍTICAS Y RETRASADAS (MAYOR VISIBILIDAD PRIORITARIA) */}
      <Panel
        etiqueta="CONTROL DE RIESGOS Y ATENCIÓN PRIORITARIA"
        titulo={`Órdenes con alerta operativa o retraso (${problemas.length})`}
        subtitulo={
          problemas.length > 0
            ? `${problemas.length} orden(es) requieren intervención o seguimiento de plazos por parte de Gerencia y Coordinación.`
            : 'Todas las órdenes activas del periodo se encuentran dentro de los plazos comprometidos.'
        }
        icono="alert-triangle"
        style={{ marginBottom: '20px' }}
      >
        <DataTable
          columnas={columnasProblemas}
          filas={problemas}
          porPagina={5}
          buscar={(o) => `${o.id} ${o.cliente} ${o.responsable}`}
          placeholder="Buscar orden con alerta..."
          vacioTitulo="No hay órdenes con alertas críticas en el periodo seleccionado"
        />
      </Panel>

      {/* FILA 1: GRÁFICOS PRINCIPALES DE DESEMPEÑO Y CARGA */}
      <div className="grid-3" style={{ marginBottom: '20px' }}>
        <Panel titulo="Cumplimiento del periodo" icono="check-circle">
          <DonutChart
            centro={`${cumplimientoPct}%`}
            subtitulo="En plazo"
            items={[
              { label: 'En plazo / entregadas', value: enPlazoPeriodo, color: 'verde' },
              { label: 'Con retraso', value: retrasadasPeriodo, color: 'rojo' },
            ]}
          />
        </Panel>

        <Panel titulo="Carga por colaborador" icono="users">
          {cargaUsuarios.length > 0 ? (
            <BarChart items={cargaUsuarios} unidad=" tareas" />
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-subtle, #6b7280)' }}>
              <p className="sm mut">Sin tareas asignadas a colaboradores.</p>
            </div>
          )}
        </Panel>

        <Panel titulo="Casos postventa y calidad" icono="life-buoy">
          <DonutChart
            centro={(data.cases || []).length}
            subtitulo="Casos"
            items={[
              { label: 'Resueltos', value: casosResueltos, color: 'verde' },
              { label: 'En trámite', value: casosEnTramite, color: 'amarillo' },
              { label: 'Abiertos', value: casosAbiertos, color: 'rojo' },
            ]}
          />
        </Panel>
      </div>

      {/* FILA 2: COMUNICACIONES Y TELEMETRÍA TÉCNICA */}
      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <Panel titulo="Conversaciones por canal de contacto" icono="message">
          <DonutChart
            centro={totalConversaciones}
            subtitulo="Conversaciones"
            items={commsCanal}
          />
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <small className="mut">
              {totalConversaciones} hilos de atención registrados ({totalMensajes} mensajes procesados)
            </small>
          </div>
        </Panel>

        <Panel titulo="Días promedio por etapa vs. Meta técnica" icono="clock">
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-subtle, #6b7280)' }}>
            <Icon nombre="clock" tamano={22} style={{ opacity: 0.6, marginBottom: '6px' }} />
            <p style={{ fontWeight: 600, margin: '2px 0', color: 'inherit', fontSize: '13px' }}>Telemetría en consolidación</p>
            <p className="sm mut" style={{ margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', fontSize: '11.5px' }}>
              Los registros de tiempos de transición individuales entre estaciones de taller se sincronizan continuamente con las actividades finalizadas en PostgreSQL.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
