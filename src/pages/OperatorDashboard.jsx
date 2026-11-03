import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'

const FILTROS = [
  ['Todas', null],
  ['Pendientes', 'Pendiente'],
  ['En proceso', 'En proceso'],
  ['Pausadas', 'Pausada'],
  ['Finalizadas', 'Finalizada'],
]

// OPERARIO: interfaz centrada en sus tareas asignadas (ej. Pedro Morales)
export default function OperatorDashboard({ data, actions, usuarioActual }) {
  const nombre = usuarioActual?.nombre || ROLES.operario.usuario.nombre
  const misTareas = data.tasks.filter((t) => t.responsable === nombre)
  // Modal abierto: { id: 'T-001', tipo: 'notas' | 'incidencias' } o null
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState(null)

  const contar = (estado) => misTareas.filter((t) => t.estado === estado).length
  const orden = (ordenId) => data.orders.find((o) => o.id === ordenId)
  const lista = filtro ? misTareas.filter((t) => t.estado === filtro) : misTareas
  const avance = { Pendiente: 0, 'En proceso': 50, Pausada: 50, Finalizada: 100 }

  return (
    <div>
      <PageHeader titulo="Mis tareas" subtitulo={`Actividades asignadas a ${nombre}.`} icono="list" />

      <div className="kpis">
        <StatCard titulo="Pendientes" valor={contar('Pendiente')} icono="clock" color={contar('Pendiente') ? 'amarillo' : 'azul'} />
        <StatCard titulo="En proceso" valor={contar('En proceso')} icono="play" />
        <StatCard titulo="Pausadas" valor={contar('Pausada')} icono="pause" />
        <StatCard titulo="Finalizadas" valor={contar('Finalizada')} icono="check-circle" color="verde" />
      </div>

      <div className="chips">
        {FILTROS.map(([texto, valor]) => (
          <button
            key={texto}
            className={filtro === valor ? 'chip active' : 'chip'}
            onClick={() => setFiltro(valor)}
          >
            {texto} ({valor ? contar(valor) : misTareas.length})
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="card">
          <EmptyState icono="check-circle" titulo="No hay tareas en este estado" />
        </div>
      )}

      <div className="task-grid">
        {lista.map((t) => {
          const finalizada = t.estado === 'Finalizada'
          const o = orden(t.ordenId)
          const pctActual = t.pct !== undefined && t.pct > 0 ? t.pct : avance[t.estado] ?? 0
          return (
            <article
              key={t.id}
              className={`card task-card prioridad-${(t.prioridad || 'Media').toLowerCase()}${finalizada ? ' done' : ''}`}
            >
              <header>
                <div>
                  <span className="order-id">{t.ordenId}</span>
                  <h3>{t.actividad}</h3>
                  <p className="muted">
                    {o ? `${o.producto} · ${o.cliente}` : `Orden ${t.ordenId}`}
                  </p>
                </div>
                <StatusBadge estado={t.estado} />
              </header>

              {(t.descripcion || t.instrucciones) && (
                <div
                  style={{
                    margin: '10px 0',
                    padding: '8px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {t.descripcion && (
                    <p className="sm" style={{ margin: 0 }}>
                      <strong>Descripción:</strong> {t.descripcion}
                    </p>
                  )}
                  {t.instrucciones && (
                    <p className="sm" style={{ margin: t.descripcion ? '4px 0 0' : 0 }}>
                      <strong>Instrucciones:</strong> {t.instrucciones}
                    </p>
                  )}
                </div>
              )}

              <dl className="order-meta">
                <div>
                  <dt>Etapa</dt>
                  <dd>{t.etapa}</dd>
                </div>
                <div>
                  <dt>Prioridad</dt>
                  <dd>
                    <StatusBadge estado={t.prioridad} />
                  </dd>
                </div>
                <div>
                  <dt>Fecha límite</dt>
                  <dd>{t.fechaLimite}</dd>
                </div>
              </dl>

              <div className="progress" title={`${pctActual}%`}>
                <div className="progress-fill" style={{ width: `${pctActual}%` }} />
                <span className="progress-text">{pctActual}%</span>
              </div>

              <div className="task-actions">
                <button
                  className="btn btn-primary"
                  disabled={t.estado === 'En proceso' || finalizada}
                  onClick={() => actions.taskAction(t.id, 'iniciar')}
                >
                  <Icon nombre="play" tamano={15} /> {t.estado === 'Pausada' ? 'Reanudar' : 'Iniciar tarea'}
                </button>
                <button
                  className="btn"
                  disabled={t.estado !== 'En proceso'}
                  onClick={() => actions.taskAction(t.id, 'pausar')}
                >
                  <Icon nombre="pause" tamano={15} /> Pausar
                </button>
                <button
                  className="btn btn-success"
                  disabled={finalizada}
                  onClick={() => actions.taskAction(t.id, 'finalizar')}
                >
                  <Icon nombre="check" tamano={15} /> Finalizar
                </button>
              </div>
              <div className="task-actions secondary">
                <button className="btn btn-ghost btn-sm" onClick={() => setModal({ id: t.id, tipo: 'notas' })}>
                  <Icon nombre="message" tamano={14} /> Registrar observación
                </button>
                <button
                  className="btn btn-ghost btn-sm danger-text"
                  onClick={() => setModal({ id: t.id, tipo: 'incidencias' })}
                >
                  <Icon nombre="alert-triangle" tamano={14} /> Registrar incidencia
                </button>
              </div>

              {[
                ...(t.notas || []).map((n) => ({ ...n, tipo: 'Observación' })),
                ...(t.incidencias || []).map((n) => ({ ...n, tipo: 'Incidencia' })),
              ].map((r, i) => (
                <p key={i} className={r.tipo === 'Incidencia' ? 'note note-error' : 'note'}>
                  <strong>{r.tipo}</strong> · {r.fecha} {r.hora}
                  <br />
                  {r.texto}
                </p>
              ))}
            </article>
          )
        })}
      </div>

      {modal && (
        <Modal
          titulo={modal.tipo === 'incidencias' ? 'Registrar incidencia' : 'Registrar observación'}
          subtitulo={`Tarea ${modal.id}`}
          icono={modal.tipo === 'incidencias' ? 'alert-triangle' : 'message'}
          tipoBoton={modal.tipo === 'incidencias' ? 'danger' : 'primary'}
          etiqueta={modal.tipo === 'incidencias' ? 'Describe el problema ocurrido' : 'Escribe tu observación'}
          ayuda="Quedará registrado en el historial interno de la orden."
          onClose={() => setModal(null)}
          onConfirm={(texto) => {
            actions.addTaskNote(modal.id, modal.tipo, texto)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}
