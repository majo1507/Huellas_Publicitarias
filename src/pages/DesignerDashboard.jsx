import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DataTable from '../components/DataTable.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'
import { estaRetrasada, estaEnRiesgo, ultimaVersion } from '../utils/format.js'

// Qué debe hacer el diseñador según el estado del diseño
const TAREA_POR_ESTADO = {
  Pendiente: 'Iniciar diseño',
  'En proceso': 'Terminar y enviar a aprobación',
  Enviado: 'Esperando respuesta del cliente',
  'Requiere cambios': 'Corregir y crear nueva versión',
  Aprobado: 'Diseño aprobado',
}

// DISEÑADOR GRÁFICO: sus tareas y el estado de sus diseños
export default function DesignerDashboard({ data, irA }) {
  const nombre = ROLES.disenador.usuario.nombre
  const mios = data.orders.filter((o) => o.disenador === nombre)
  const contar = (estado) => mios.filter((o) => o.disenoEstado === estado).length
  const tareas = mios.filter((o) => o.disenoEstado !== 'Aprobado').map((o) => ({
    ...o,
    tarea: TAREA_POR_ESTADO[o.disenoEstado],
    prioridad: estaRetrasada(o) || estaEnRiesgo(o) ? 'Alta' : 'Media',
  }))
  const comentarios = mios.filter((o) => o.disenoEstado === 'Requiere cambios')

  const columnas = [
    { clave: 'id', titulo: 'Orden', ordenar: true, render: (o) => <strong>{o.id}</strong> },
    { clave: 'producto', titulo: 'Producto', ordenar: true, render: (o) => <div><strong>{o.producto}</strong><small className="cell-sub">{o.cliente}</small></div> },
    { clave: 'tarea', titulo: 'Tarea pendiente' },
    { clave: 'disenoEstado', titulo: 'Estado', render: (o) => <StatusBadge estado={o.disenoEstado} /> },
    { clave: 'fechaEntrega', titulo: 'Entrega', ordenar: true },
    { clave: 'abrir', titulo: 'Acción', render: (o) => <button className="btn btn-soft btn-sm" onClick={() => irA('disenos', o.id)}><Icon nombre="eye" tamano={14} /> Abrir</button> },
  ]

  return (
    <div>
      <PageHeader titulo="Mis tareas de diseño" subtitulo={`Diseños asignados a ${nombre}.`} icono="pen"
        acciones={<button className="btn btn-primary" onClick={() => irA('disenos')}>Ver todos los diseños</button>} />

      <div className="kpis">
        <StatCard variante="featured" titulo="Diseños pendientes" valor={contar('Pendiente')} icono="inbox" color={contar('Pendiente') ? 'amarillo' : 'azul'} />
        <StatCard titulo="En proceso" valor={contar('En proceso')} icono="pen" />
        <StatCard titulo="Enviados a aprobación" valor={contar('Enviado')} icono="send" />
        <StatCard titulo="Aprobados" valor={contar('Aprobado')} icono="check-circle" color="verde" progreso={Math.round((contar('Aprobado') / Math.max(mios.length, 1)) * 100)} />
        <StatCard titulo="Rechazados" valor={contar('Requiere cambios')} icono="x-circle" color={contar('Requiere cambios') ? 'rojo' : 'azul'} />
      </div>

      <div className="grid-main">
        <div>
          <DataTable
            columnas={columnas}
            filas={tareas}
            porPagina={6}
            buscar={(o) => `${o.id} ${o.producto} ${o.cliente}`}
            placeholder="Buscar en mis tareas..."
            filtros={[{ titulo: 'Estado', valor: (o) => o.disenoEstado, opciones: ['Pendiente', 'En proceso', 'Enviado', 'Requiere cambios'] }]}
            vacioTitulo="No tienes tareas pendientes"
            vacioTexto="Todos tus diseños están aprobados."
          />
        </div>

        <Panel titulo="Comentarios de clientes" icono="message">
          {comentarios.length === 0 ? (
            <p className="muted">Ningún cliente ha solicitado cambios.</p>
          ) : comentarios.map((o) => (
            <div key={o.id} className="comment-box">
              <strong>{o.id} · {o.cliente}</strong>
              <p>“{ultimaVersion(o).comentario}”</p>
              <button className="btn btn-soft btn-sm" onClick={() => irA('disenos', o.id)}>Crear nueva versión</button>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  )
}
