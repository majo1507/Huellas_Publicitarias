import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Icon from '../components/Icon.jsx'
import { OPERARIOS } from '../data/mockData.js'
import { ROLES } from '../data/roles.js'

export default function Tasks({ data, actions, irA, role }) {
  const [pestaña, setPestaña] = useState('todas') // 'todas' | 'mis' | 'Pendiente' | 'En proceso' | 'Finalizada' | 'Pausada'
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevoPct, setNuevoPct] = useState(0)
  const [errorModal, setErrorModal] = useState('')

  const usuarioActual = ROLES[role]?.usuario?.nombre || 'Carlos Ruiz'
  const orden = (ordenId) => data.orders.find((o) => o.id === ordenId)

  // Filtrado por pestaña
  const filtradas = data.tasks.filter((t) => {
    if (pestaña === 'mis') return t.responsable === usuarioActual
    if (pestaña !== 'todas') return t.estado === pestaña
    return true
  })

  const filas = filtradas.map((t) => {
    const o = orden(t.ordenId)
    return {
      ...t,
      cliente: o?.cliente || '',
      producto: o?.producto || '',
    }
  })

  function abrirModalEdicion(t) {
    setTareaSeleccionada(t)
    setNuevoEstado(t.estado)
    setNuevoPct(t.pct || (t.estado === 'Finalizada' ? 100 : t.estado === 'En proceso' ? 50 : 0))
    setErrorModal('')
  }

  function handleGuardarAvance(e) {
    e.preventDefault()
    if (!tareaSeleccionada) return

    // Validar dependencias si se intenta marcar como En proceso o Finalizada
    if (nuevoEstado !== 'Pendiente' && nuevoEstado !== 'Pausada' && tareaSeleccionada.deps?.length > 0) {
      const depIncompleta = tareaSeleccionada.deps
        .map((depId) => data.tasks.find((x) => x.id === depId))
        .find((dep) => dep && dep.estado !== 'Finalizada')

      if (depIncompleta) {
        setErrorModal(`Esta actividad depende de «${depIncompleta.actividad}», que aún no ha finalizado.`)
        return
      }
    }

    const pctFinal = nuevoEstado === 'Finalizada' ? 100 : nuevoPct
    actions.updateTaskProgress(tareaSeleccionada.id, nuevoEstado, pctFinal)
    setTareaSeleccionada(null)
  }

  const columnas = [
    {
      clave: 'ordenId',
      titulo: 'Orden',
      ordenar: true,
      render: (t) => (
        <div>
          <button className="link-inline" onClick={() => irA('detalle', t.ordenId)}>
            <strong>{t.ordenId}</strong>
          </button>
          <small className="cell-sub">{t.cliente}</small>
        </div>
      ),
    },
    {
      clave: 'actividad',
      titulo: 'Actividad',
      ordenar: true,
      render: (t) => (
        <div>
          <strong>{t.actividad}</strong>
          <small className="cell-sub">{t.producto} · Etapa: {t.etapa}</small>
        </div>
      ),
    },
    {
      clave: 'responsable',
      titulo: 'Responsable',
      render: (t) => (
        <span className="person">
          <Avatar nombre={t.responsable} tamano="sm" />
          <select
            className="inline-select"
            value={t.responsable}
            disabled={t.estado === 'Finalizada'}
            aria-label={`Responsable de ${t.actividad}`}
            onChange={(e) => actions.assignTask(t.id, e.target.value)}
          >
            {OPERARIOS.map((n) => <option key={n}>{n}</option>)}
          </select>
        </span>
      ),
    },
    { clave: 'prioridad', titulo: 'Prioridad', render: (t) => <StatusBadge estado={t.prioridad} /> },
    { clave: 'fechaLimite', titulo: 'Fecha límite' },
    {
      clave: 'pct',
      titulo: 'Avance',
      render: (t) => (
        <div style={{ width: '130px' }}>
          <ProgressBar valor={t.pct !== undefined ? t.pct : (t.estado === 'Finalizada' ? 100 : t.estado === 'En proceso' ? 50 : 0)} />
        </div>
      ),
    },
    { clave: 'estado', titulo: 'Estado', render: (t) => <StatusBadge estado={t.estado} /> },
    {
      clave: 'acciones',
      titulo: '',
      render: (t) => (
        <button className="btn btn-sm" onClick={() => abrirModalEdicion(t)}>
          <Icon nombre="edit" tamano={13} /> Gestionar
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Actividades y tareas de taller"
        subtitulo="Control de responsabilidades, dependencias, tiempos límite y avance porcentual."
        icono="list"
      />

      {/* Pestañas inspiradas en el HTML */}
      <div className="tabs" role="tablist">
        <button
          className={pestaña === 'todas' ? 'on' : ''}
          onClick={() => setPestaña('todas')}
        >
          Todas <span className="pill">{data.tasks.length}</span>
        </button>
        <button
          className={pestaña === 'mis' ? 'on' : ''}
          onClick={() => setPestaña('mis')}
        >
          Mis tareas <span className="pill">{data.tasks.filter((t) => t.responsable === usuarioActual).length}</span>
        </button>
        <button
          className={pestaña === 'Pendiente' ? 'on' : ''}
          onClick={() => setPestaña('Pendiente')}
        >
          Pendientes <span className="pill">{data.tasks.filter((t) => t.estado === 'Pendiente').length}</span>
        </button>
        <button
          className={pestaña === 'En proceso' ? 'on' : ''}
          onClick={() => setPestaña('En proceso')}
        >
          En proceso <span className="pill">{data.tasks.filter((t) => t.estado === 'En proceso').length}</span>
        </button>
        <button
          className={pestaña === 'Finalizada' ? 'on' : ''}
          onClick={() => setPestaña('Finalizada')}
        >
          Finalizadas <span className="pill">{data.tasks.filter((t) => t.estado === 'Finalizada').length}</span>
        </button>
      </div>

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={8}
        buscar={(t) => `${t.ordenId} ${t.actividad} ${t.producto} ${t.responsable}`}
        placeholder="Buscar por actividad, orden o responsable..."
        filtros={[
          { titulo: 'Prioridad', valor: (t) => t.prioridad, opciones: ['Alta', 'Media', 'Baja'] },
          { titulo: 'Responsable', valor: (t) => t.responsable, opciones: OPERARIOS },
        ]}
        vacioTitulo="No hay actividades en esta vista"
      />

      {/* Modal interactivo de avance de tarea */}
      {tareaSeleccionada && (
        <div className="modal-backdrop" onClick={() => setTareaSeleccionada(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Gestionar tarea">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="list" tamano={20} /></span>
              <div>
                <h2>{tareaSeleccionada.actividad}</h2>
                <p>Orden {tareaSeleccionada.ordenId} · Responsable: {tareaSeleccionada.responsable}</p>
              </div>
              <button className="icon-btn" onClick={() => setTareaSeleccionada(null)}><Icon nombre="x" /></button>
            </div>

            <form onSubmit={handleGuardarAvance} className="modal-body">
              {errorModal && (
                <div className="ban rd" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-triangle" tamano={16} />
                  <span>{errorModal}</span>
                </div>
              )}

              {tareaSeleccionada.deps?.length > 0 && (
                <div style={{ marginBottom: '16px' }} className="sm">
                  <strong>Depende de: </strong>
                  {tareaSeleccionada.deps.map((depId) => {
                    const depObj = data.tasks.find((x) => x.id === depId)
                    return (
                      <span key={depId} className="pill" style={{ marginLeft: '4px' }}>
                        {depObj ? `${depObj.actividad} (${depObj.estado})` : depId}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="taskEstado">Estado de la actividad</label>
                  <select
                    id="taskEstado"
                    value={nuevoEstado}
                    onChange={(e) => {
                      setNuevoEstado(e.target.value)
                      setErrorModal('')
                    }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Pausada">Pausada</option>
                    <option value="Finalizada">Finalizada</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="taskPct">
                    Porcentaje de avance: <strong>{nuevoPct}%</strong>
                  </label>
                  <input
                    id="taskPct"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={nuevoPct}
                    onChange={(e) => setNuevoPct(Number(e.target.value))}
                    disabled={nuevoEstado === 'Finalizada'}
                  />
                </div>
              </div>

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setTareaSeleccionada(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"><Icon nombre="check" tamano={15} /> Guardar avance</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
