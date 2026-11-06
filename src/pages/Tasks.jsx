import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Icon from '../components/Icon.jsx'
import { OPERARIOS } from '../data/mockData.js'
import { ROLES } from '../data/roles.js'
import { ACTIVIDADES_TALLER_POR_ETAPA } from '../data/catalogos.js'
import { estaActiva } from '../utils/format.js'

export default function Tasks({ data, actions, irA, role }) {
  const [pestaña, setPestaña] = useState('todas')
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevoPct, setNuevoPct] = useState(0)
  const [errorModal, setErrorModal] = useState('')

  // Modal HU-15: Registro de incidencia
  const [modalIncidencia, setModalIncidencia] = useState(null)

  // Modal para crear nueva actividad (Coordinador / Gerencia)
  const [modalNuevaActividad, setModalNuevaActividad] = useState(false)
  const [ordenNuevaAct, setOrdenNuevaAct] = useState('')
  const [nombreNuevaAct, setNombreNuevaAct] = useState('')
  const [descNuevaAct, setDescNuevaAct] = useState('')
  const [instNuevaAct, setInstNuevaAct] = useState('')
  const [etapaNuevaAct, setEtapaNuevaAct] = useState('Impresión')
  const [respNuevaAct, setRespNuevaAct] = useState('Pedro Morales')
  const [prioNuevaAct, setPrioNuevaAct] = useState('Media')
  const [fechaNuevaAct, setFechaNuevaAct] = useState('12/10/2026')
  const [errNuevaAct, setErrNuevaAct] = useState('')

  const usuarioActual = ROLES[role]?.usuario?.nombre || 'Carlos Gómez'
  const orden = (ordenId) => data.orders.find((o) => o.id === ordenId)
  const puedeReasignar = ['coordinador', 'gerencia'].includes(role)
  const listaResponsables = [
    ...new Set([
      'Pedro Morales',
      ...OPERARIOS,
      ...(data.users?.length
        ? data.users.filter((u) => u.estado === 'Activo' && u.rol !== 'Cliente').map((u) => u.nombre)
        : []),
    ]),
  ]

  const ordenesActivas = data.orders.filter(estaActiva)
  const contarEstado = (est) => data.tasks.filter((t) => t.estado === est).length

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

  function abrirModalNuevaActividad() {
    const primeraOrden = ordenesActivas[0] || data.orders[0]
    setOrdenNuevaAct(primeraOrden?.id || '')
    setNombreNuevaAct('')
    setDescNuevaAct('')
    setInstNuevaAct('')
    setEtapaNuevaAct('Impresión')
    setRespNuevaAct('Pedro Morales')
    setPrioNuevaAct('Media')
    setFechaNuevaAct(primeraOrden?.fechaEntrega || '12/10/2026')
    setErrNuevaAct('')
    setModalNuevaActividad(true)
  }

  function handleCrearNuevaActividad(e) {
    e.preventDefault()
    if (!ordenNuevaAct || !nombreNuevaAct.trim()) {
      setErrNuevaAct('Selecciona la orden relacionada e ingresa el nombre de la actividad.')
      return
    }
    actions.createTask?.({
      ordenId: ordenNuevaAct,
      actividad: nombreNuevaAct.trim(),
      descripcion: descNuevaAct.trim(),
      instrucciones: instNuevaAct.trim(),
      etapa: etapaNuevaAct,
      responsable: respNuevaAct || 'Pedro Morales',
      prioridad: prioNuevaAct,
      fechaLimite: fechaNuevaAct.trim() || '12/10/2026',
    })
    setModalNuevaActividad(false)
  }

  function abrirModalEdicion(t) {
    setTareaSeleccionada(t)
    setNuevoEstado(t.estado)
    setNuevoPct(t.pct !== undefined ? t.pct : t.estado === 'Finalizada' ? 100 : t.estado === 'En proceso' ? 50 : 0)
    setErrorModal('')
  }

  // Actualización de estado y avance con validación estricta de coherencia (HU-14)
  function handleGuardarAvance(e) {
    e.preventDefault()
    if (!tareaSeleccionada) return

    if (nuevoEstado !== 'Pendiente' && nuevoEstado !== 'Pausada' && tareaSeleccionada.deps?.length > 0) {
      const depIncompleta = tareaSeleccionada.deps
        .map((depId) => data.tasks.find((x) => x.id === depId))
        .find((dep) => dep && dep.estado !== 'Finalizada')

      if (depIncompleta) {
        setErrorModal(`Esta actividad depende de «${depIncompleta.actividad}», que aún no ha finalizado.`)
        return
      }
    }

    if (nuevoPct < 0 || nuevoPct > 100) {
      setErrorModal('El porcentaje de avance debe estar entre 0% y 100%.')
      return
    }
    if (nuevoEstado === 'Pendiente' && nuevoPct !== 0) {
      setErrorModal('Una actividad en estado Pendiente debe tener exactamente 0% de avance.')
      return
    }
    if (nuevoEstado === 'Finalizada' && nuevoPct !== 100) {
      setErrorModal('Una actividad Finalizada debe registrar el 100% de avance.')
      return
    }
    if ((nuevoEstado === 'En proceso' || nuevoEstado === 'Pausada') && (nuevoPct <= 0 || nuevoPct >= 100)) {
      setErrorModal('Una actividad En proceso o Pausada debe tener un avance entre 1% y 99%.')
      return
    }

    actions.updateTaskProgress(tareaSeleccionada.id, nuevoEstado, nuevoPct)
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
      titulo: 'Actividad, descripción e instrucciones',
      ordenar: true,
      render: (t) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>{t.actividad}</strong>
            {t.incidencias?.length > 0 && (
              <span
                className="badge badge-rojo"
                style={{ fontSize: '10px', padding: '1px 5px' }}
                title={`${t.incidencias.length} incidencia(s) registrada(s)`}
              >
                {t.incidencias.length} inc.
              </span>
            )}
          </div>
          <small className="cell-sub">
            {t.producto} · Etapa: {t.etapa}
          </small>
          {t.descripcion && (
            <small className="cell-sub" style={{ display: 'block', marginTop: '2px' }}>
              {t.descripcion}
            </small>
          )}
          {t.instrucciones && (
            <small className="cell-sub" style={{ display: 'block', color: 'var(--blue-600)' }}>
              Instrucciones: {t.instrucciones}
            </small>
          )}
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
            disabled={t.estado === 'Finalizada' || !puedeReasignar}
            aria-label={`Responsable de ${t.actividad}`}
            onChange={(e) => actions.assignTask(t.id, e.target.value)}
            title={!puedeReasignar ? 'Solo el coordinador o gerencia pueden reasignar responsables' : undefined}
          >
            {[...new Set([...listaResponsables, t.responsable])].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
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
          <ProgressBar
            valor={
              t.pct !== undefined && t.pct > 0
                ? t.pct
                : t.estado === 'Finalizada'
                  ? 100
                  : t.estado === 'En proceso' || t.estado === 'Pausada'
                    ? 50
                    : 0
            }
          />
        </div>
      ),
    },
    { clave: 'estado', titulo: 'Estado', render: (t) => <StatusBadge estado={t.estado} /> },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (t) => (
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-sm" onClick={() => abrirModalEdicion(t)} title="Gestionar estado y avance">
            <Icon nombre="edit" tamano={13} /> Gestionar
          </button>
          <button
            className="btn btn-ghost btn-sm danger-text"
            onClick={() => setModalIncidencia(t)}
            title="Registrar incidencia técnica"
          >
            <Icon nombre="alert-triangle" tamano={13} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo="Actividades y tareas de taller"
        subtitulo="Control de responsabilidades, dependencias, tiempos límite y avance porcentual."
        icono="list"
        acciones={
          puedeReasignar && (
            <button className="btn btn-primary" onClick={abrirModalNuevaActividad}>
              <Icon nombre="plus" tamano={15} /> Asignar nueva actividad
            </button>
          )
        }
      />

      {/* Indicadores en tiempo real de las actividades de taller */}
      <div className="kpis" style={{ marginBottom: '16px' }}>
        <StatCard
          titulo="Pendientes"
          valor={contarEstado('Pendiente')}
          icono="clock"
          color={contarEstado('Pendiente') ? 'amarillo' : 'azul'}
        />
        <StatCard titulo="En proceso" valor={contarEstado('En proceso')} icono="play" />
        <StatCard titulo="Pausadas" valor={contarEstado('Pausada')} icono="pause" />
        <StatCard titulo="Finalizadas" valor={contarEstado('Finalizada')} icono="check-circle" color="verde" />
      </div>

      {/* Pestañas de estado */}
      <div className="tabs" role="tablist">
        <button className={pestaña === 'todas' ? 'on' : ''} onClick={() => setPestaña('todas')}>
          Todas <span className="pill">{data.tasks.length}</span>
        </button>
        <button className={pestaña === 'mis' ? 'on' : ''} onClick={() => setPestaña('mis')}>
          Mis tareas <span className="pill">{data.tasks.filter((t) => t.responsable === usuarioActual).length}</span>
        </button>
        <button className={pestaña === 'Pendiente' ? 'on' : ''} onClick={() => setPestaña('Pendiente')}>
          Pendientes <span className="pill">{contarEstado('Pendiente')}</span>
        </button>
        <button className={pestaña === 'En proceso' ? 'on' : ''} onClick={() => setPestaña('En proceso')}>
          En proceso <span className="pill">{contarEstado('En proceso')}</span>
        </button>
        <button className={pestaña === 'Pausada' ? 'on' : ''} onClick={() => setPestaña('Pausada')}>
          Pausadas <span className="pill">{contarEstado('Pausada')}</span>
        </button>
        <button className={pestaña === 'Finalizada' ? 'on' : ''} onClick={() => setPestaña('Finalizada')}>
          Finalizadas <span className="pill">{contarEstado('Finalizada')}</span>
        </button>
      </div>

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={8}
        buscar={(t) => `${t.ordenId} ${t.actividad} ${t.descripcion || ''} ${t.producto} ${t.responsable}`}
        placeholder="Buscar por actividad, orden o responsable..."
        filtros={[
          { titulo: 'Estado', valor: (t) => t.estado, opciones: ['Pendiente', 'En proceso', 'Pausada', 'Finalizada'] },
          { titulo: 'Prioridad', valor: (t) => t.prioridad, opciones: ['Alta', 'Media', 'Baja'] },
          { titulo: 'Responsable', valor: (t) => t.responsable, opciones: [...new Set(data.tasks.map((t) => t.responsable))] },
        ]}
        vacioTitulo="No se encontraron actividades"
      />

      {/* MODAL PARA ASIGNAR NUEVA ACTIVIDAD A UNA ORDEN */}
      {modalNuevaActividad && (
        <div className="modal-backdrop" onClick={() => setModalNuevaActividad(false)}>
          <div
            className="modal"
            style={{ maxWidth: '640px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Asignar nueva actividad"
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="plus" tamano={20} />
              </span>
              <div>
                <h2>Programar y asignar nueva actividad</h2>
                <p>Selecciona la orden de producción, el responsable y las instrucciones operativas.</p>
              </div>
              <button className="icon-btn" onClick={() => setModalNuevaActividad(false)}>
                <Icon nombre="x" />
              </button>
            </div>
            <form onSubmit={handleCrearNuevaActividad} className="modal-body" noValidate>
              {errNuevaAct && (
                <div className="ban rd" style={{ marginBottom: '12px' }}>
                  <Icon nombre="alert-triangle" tamano={15} /> <span>{errNuevaAct}</span>
                </div>
              )}
              <div className="form-grid">
                <div className="field full">
                  <label className="field-label" htmlFor="newTaskOrden">
                    Orden relacionada *
                  </label>
                  <select
                    id="newTaskOrden"
                    value={ordenNuevaAct}
                    onChange={(e) => {
                      const idSel = e.target.value
                      setOrdenNuevaAct(idSel)
                      const ordObj = data.orders.find((o) => o.id === idSel)
                      if (ordObj?.fechaEntrega) setFechaNuevaAct(ordObj.fechaEntrega)
                    }}
                  >
                    {data.orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} · {o.cliente} — {o.producto} ({o.estado})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="newTaskResp">
                    Responsable asignado *
                  </label>
                  <select id="newTaskResp" value={respNuevaAct} onChange={(e) => setRespNuevaAct(e.target.value)}>
                    {listaResponsables.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="newTaskEtapa">
                    Etapa del proceso
                  </label>
                  <select id="newTaskEtapa" value={etapaNuevaAct} onChange={(e) => setEtapaNuevaAct(e.target.value)}>
                    <option value="Diseño">Diseño</option>
                    <option value="Impresión">Impresión</option>
                    <option value="Acabados">Acabados</option>
                    <option value="Despacho">Despacho</option>
                  </select>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="newTaskNombre">
                    Nombre de la actividad *
                  </label>
                  <input
                    id="newTaskNombre"
                    list="sug-actividades-taller"
                    value={nombreNuevaAct}
                    onChange={(e) => {
                      setNombreNuevaAct(e.target.value)
                      setErrNuevaAct('')
                    }}
                    placeholder="Ej. Selecciona una sugerencia o escribe la actividad..."
                    autoFocus
                  />
                  <datalist id="sug-actividades-taller">
                    {(ACTIVIDADES_TALLER_POR_ETAPA[etapaNuevaAct] || []).map((sug) => (
                      <option key={sug} value={sug} />
                    ))}
                  </datalist>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                    {(ACTIVIDADES_TALLER_POR_ETAPA[etapaNuevaAct] || []).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        className="btn btn-soft btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px' }}
                        onClick={() => {
                          setNombreNuevaAct(sug)
                          setErrNuevaAct('')
                        }}
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="newTaskDesc">
                    Descripción de la actividad
                  </label>
                  <input
                    id="newTaskDesc"
                    value={descNuevaAct}
                    onChange={(e) => setDescNuevaAct(e.target.value)}
                    placeholder="Detalle del trabajo a ejecutar sobre el material o lote..."
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="newTaskPrio">
                    Prioridad
                  </label>
                  <select id="newTaskPrio" value={prioNuevaAct} onChange={(e) => setPrioNuevaAct(e.target.value)}>
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="newTaskFecha">
                    Fecha límite
                  </label>
                  <input
                    id="newTaskFecha"
                    value={fechaNuevaAct}
                    onChange={(e) => setFechaNuevaAct(e.target.value)}
                    placeholder="DD/MM/AAAA"
                  />
                </div>

                <div className="field full">
                  <label className="field-label" htmlFor="newTaskInst">
                    Instrucciones operativas
                  </label>
                  <textarea
                    id="newTaskInst"
                    rows={2}
                    value={instNuevaAct}
                    onChange={(e) => setInstNuevaAct(e.target.value)}
                    placeholder="Indicaciones específicas de máquina, calibración, empaque o control de calidad..."
                  />
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalNuevaActividad(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Confirmar asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HU-14: Gestión de estado y avance porcentual coherente */}
      {tareaSeleccionada && (
        <div className="modal-backdrop" onClick={() => setTareaSeleccionada(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Gestionar actividad"
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="list" tamano={20} />
              </span>
              <div>
                <h2>Gestionar: {tareaSeleccionada.actividad}</h2>
                <p>
                  Orden {tareaSeleccionada.ordenId} · Responsable: {tareaSeleccionada.responsable}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setTareaSeleccionada(null)}>
                <Icon nombre="x" />
              </button>
            </div>

            <form onSubmit={handleGuardarAvance} className="modal-body">
              {errorModal && (
                <div className="ban rd" style={{ marginBottom: '14px' }}>
                  <Icon nombre="alert-triangle" tamano={16} />
                  <span>{errorModal}</span>
                </div>
              )}

              {(tareaSeleccionada.descripcion || tareaSeleccionada.instrucciones) && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '8px 10px',
                    background: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {tareaSeleccionada.descripcion && (
                    <p className="sm" style={{ margin: 0 }}>
                      <strong>Descripción:</strong> {tareaSeleccionada.descripcion}
                    </p>
                  )}
                  {tareaSeleccionada.instrucciones && (
                    <p className="sm" style={{ margin: tareaSeleccionada.descripcion ? '4px 0 0' : 0 }}>
                      <strong>Instrucciones:</strong> {tareaSeleccionada.instrucciones}
                    </p>
                  )}
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
                  <label className="field-label" htmlFor="taskEstado">
                    Estado de la actividad
                  </label>
                  <select
                    id="taskEstado"
                    value={nuevoEstado}
                    onChange={(e) => {
                      const est = e.target.value
                      setNuevoEstado(est)
                      setErrorModal('')
                      if (est === 'Pendiente') setNuevoPct(0)
                      else if (est === 'Finalizada') setNuevoPct(100)
                      else if (nuevoPct <= 0 || nuevoPct >= 100) setNuevoPct(50)
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
                    disabled={nuevoEstado === 'Finalizada' || nuevoEstado === 'Pendiente'}
                  />
                  <span className="field-hint">
                    {nuevoEstado === 'Pendiente'
                      ? '0% obligatorio'
                      : nuevoEstado === 'Finalizada'
                        ? '100% al completar'
                        : 'Entre 1% y 99%'}
                  </span>
                </div>
              </div>

              {/* Registro histórico de notas e incidencias previas */}
              {(tareaSeleccionada.notas?.length > 0 || tareaSeleccionada.incidencias?.length > 0) && (
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                  <strong className="sm" style={{ display: 'block', marginBottom: '8px' }}>
                    Registro de observaciones e incidencias:
                  </strong>
                  {[
                    ...tareaSeleccionada.notas.map((n) => ({ ...n, tipo: 'Observación' })),
                    ...tareaSeleccionada.incidencias.map((n) => ({ ...n, tipo: 'Incidencia' })),
                  ].map((r, i) => (
                    <p key={i} className={r.tipo === 'Incidencia' ? 'note note-error' : 'note'} style={{ margin: '4px 0' }}>
                      <strong>{r.tipo}</strong> ({r.fecha} {r.hora} - {r.autor}): {r.texto}
                    </p>
                  ))}
                </div>
              )}

              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setTareaSeleccionada(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Guardar avance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HU-15: Registro de incidencia técnica */}
      {modalIncidencia && (
        <Modal
          titulo="Registrar incidencia técnica"
          subtitulo={`${modalIncidencia.id} · ${modalIncidencia.actividad} (Orden ${modalIncidencia.ordenId})`}
          icono="alert-triangle"
          tipoBoton="danger"
          etiqueta="Describe la falla, problema de insumos o contratiempo ocurrido"
          ayuda="Quedará documentado en la auditoría y trazabilidad de la orden."
          minimo={10}
          textoBoton="Registrar incidencia"
          onClose={() => setModalIncidencia(null)}
          onConfirm={(texto) => {
            actions.addTaskNote(modalIncidencia.id, 'incidencias', texto)
            setModalIncidencia(null)
          }}
        />
      )}
    </div>
  )
}
