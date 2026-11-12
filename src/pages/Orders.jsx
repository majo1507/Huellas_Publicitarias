import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import OrderCard from '../components/OrderCard.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Avatar from '../components/Avatar.jsx'
import Icon from '../components/Icon.jsx'
import { ETAPAS } from '../data/mockData.js'
import { estaActiva, estaRetrasada, estaEnRiesgo, prioridadOrden, textoPlazo, formatoCOP, progreso } from '../utils/format.js'
import { generarReporteOrdenPDF } from '../utils/pdfReport.js'

// Listado y programación de órdenes. Comercial, coordinador, postventa y gerencia la usan según su rol.
export default function Orders({ data, actions, irA, role }) {
  const [ordenProgramando, setOrdenProgramando] = useState(null)
  const [prioridadEdit, setPrioridadEdit] = useState('Media')
  const [fechaEntregaEdit, setFechaEntregaEdit] = useState('')
  const [disenadorEdit, setDisenadorEdit] = useState('')
  const [responsableEdit, setResponsableEdit] = useState('')
  const [presupuestoEdit, setPresupuestoEdit] = useState(0)
  const [costoEdit, setCostoEdit] = useState(0)
  const [filtroEstado, setFiltroEstado] = useState('activas') // 'activas' | 'archivadas' | 'todas'

  const esCoordinador = role === 'coordinador' || role === 'gerencia'
  const soloEntregadas = role === 'postventa'
  let base = soloEntregadas ? data.orders.filter((o) => !estaActiva(o)) : data.orders

  if (filtroEstado === 'activas') {
    base = base.filter((o) => !o.archivado)
  } else if (filtroEstado === 'archivadas') {
    base = base.filter((o) => Boolean(o.archivado))
  }
  const titulo = soloEntregadas
    ? 'Órdenes entregadas'
    : role === 'comercial'
      ? 'Órdenes generadas'
      : esCoordinador
        ? 'Programación de órdenes de producción'
        : 'Órdenes de producción'

  // Se respeta la prioridad definida o calculada para ordenar y filtrar por ella
  const filas = base.map((o) => ({ ...o, prioridad: o.prioridad || prioridadOrden(o) }))

  const activas = base.filter(estaActiva)
  const urgentes = activas.filter((o) => (o.prioridad || prioridadOrden(o)) === 'Alta' || estaRetrasada(o))
  const retrasadas = activas.filter(estaRetrasada)
  const costoTotal = base.reduce((acc, o) => acc + (Number(o.costoInterno) || 0), 0)

  const usuariosEquipo = data.users?.length
    ? data.users.filter((u) => u.estado === 'Activo' && u.rol !== 'Cliente')
    : []
  const listaDisenadores = usuariosEquipo.some((u) => u.rol === 'Diseñador')
    ? usuariosEquipo.filter((u) => u.rol === 'Diseñador' || u.rol === 'Coordinador').map((u) => u.nombre)
    : []
  const listaOperarios = [
    ...new Set([
      ...usuariosEquipo.map((u) => u.nombre),
    ]),
  ]

  function abrirModalProgramar(o) {
    setOrdenProgramando(o)
    setPrioridadEdit(o.prioridad || prioridadOrden(o) || 'Media')
    setFechaEntregaEdit(o.fechaEntrega || '')
    setDisenadorEdit(o.disenador || '')
    setResponsableEdit(o.responsable || '')
    setPresupuestoEdit(Number(o.presupuesto || 0))
    setCostoEdit(Number(o.costoInterno || 0))
  }

  function handleGuardarProgramacion(e) {
    e.preventDefault()
    if (!ordenProgramando) return
    actions?.assignOrderTeam?.(ordenProgramando.id, {
      prioridad: prioridadEdit,
      fechaEntrega: fechaEntregaEdit.trim() || ordenProgramando.fechaEntrega,
      disenador: disenadorEdit,
      responsable: responsableEdit,
      presupuesto: Number(presupuestoEdit) || 0,
      costoInterno: Number(costoEdit) || 0,
    })
    setOrdenProgramando(null)
  }

  const columnas = [
    {
      clave: 'id',
      titulo: 'Orden / Cliente',
      ancho: '165px',
      ordenar: true,
      render: (o) => (
        <div>
          <button className="link-inline" onClick={() => irA('detalle', o.id)} title="Ver detalle de la orden">
            <strong style={{ fontSize: '13px' }}>{o.id}</strong>
          </button>
          <div style={{ fontWeight: 600, fontSize: '12px', marginTop: '1px' }}>{o.cliente}</div>
          {o.esArteCliente && (
            <small className="cell-sub" style={{ color: 'var(--blue-600)', fontWeight: 600, display: 'inline-block', marginTop: '2px' }}>
              Arte cliente
            </small>
          )}
        </div>
      ),
    },
    {
      clave: 'producto',
      titulo: 'Producto / Material',
      minAncho: '190px',
      ordenar: true,
      render: (o) => (
        <div>
          <strong style={{ fontSize: '13px' }}>{o.producto}</strong>
          <small className="cell-sub" style={{ display: 'block', marginTop: '2px' }}>
            {o.cantidad} uds · {o.material}
          </small>
        </div>
      ),
    },
    {
      clave: 'estado',
      titulo: 'Etapa y Avance',
      ancho: '145px',
      ordenar: true,
      render: (o) => (
        <div style={{ minWidth: '125px' }}>
          <StatusBadge estado={o.estado === 'Entrega' ? 'Entregado' : o.estado} />
          <div style={{ marginTop: '5px' }}>
            <ProgressBar valor={progreso(o)} />
          </div>
        </div>
      ),
    },
    {
      clave: 'prioridad',
      titulo: 'Prioridad y Plazo',
      ancho: '140px',
      ordenar: true,
      render: (o) => (
        <div>
          {estaActiva(o) ? <StatusBadge estado={o.prioridad} /> : <span className="muted">—</span>}
          <div style={{ fontSize: '11.5px', marginTop: '3px' }}>
            <span>{o.fechaEntrega}</span>
            <small
              className={`cell-sub ${estaRetrasada(o) ? 'text-rojo' : estaEnRiesgo(o) ? 'text-amarillo' : ''}`}
              style={{ display: 'block', fontWeight: 600, fontSize: '11px' }}
            >
              {textoPlazo(o)}
            </small>
          </div>
        </div>
      ),
    },
    {
      clave: 'responsable',
      titulo: esCoordinador ? 'Personal asignado' : 'Responsable',
      ancho: '150px',
      ordenar: true,
      render: (o) =>
        esCoordinador ? (
          <div style={{ fontSize: '11.5px', lineHeight: '1.4' }}>
            <div>
              <span className="mut">D: </span><strong>{o.disenador || 'Sin asignar'}</strong>
            </div>
            <div>
              <span className="mut">T: </span><strong>{o.responsable}</strong>
            </div>
          </div>
        ) : (
          <span className="person" style={{ fontSize: '12px' }}>
            <Avatar nombre={o.responsable} tamano="sm" />
            {o.responsable}
          </span>
        ),
    },
    {
      clave: 'presupuesto',
      titulo: 'Presupuesto',
      ancho: '135px',
      ordenar: true,
      render: (o) => (
        <div>
          <strong style={{ fontSize: '12.5px' }}>{formatoCOP(o.presupuesto)}</strong>
          {(role === 'coordinador' || role === 'gerencia') && (
            <small className="cell-sub" style={{ display: 'block', fontSize: '11px', marginTop: '2px' }}>
              Costo: {formatoCOP(o.costoInterno)}
            </small>
          )}
        </div>
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '165px',
      render: (o) => (
        <div className="row-actions" style={{ gap: '4px', flexWrap: 'wrap' }}>
          {esCoordinador && (
            <button
              className="btn btn-primary btn-xs"
              onClick={() => abrirModalProgramar(o)}
              title="Organizar prioridad, fecha comprometida, personal y costos"
            >
              <Icon nombre="sliders" tamano={12} /> Programar
            </button>
          )}
          <button className="btn btn-soft btn-xs" onClick={() => irA('detalle', o.id)} title="Ver trazabilidad completa">
            <Icon nombre="eye" tamano={12} /> {esCoordinador ? 'Trazabilidad' : 'Ver pedido'}
          </button>
          {esCoordinador && (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => {
                generarReporteOrdenPDF(o, data)
                actions?.notify?.(`Reporte de orden ${o.id} (PDF) descargado.`, 'exito')
              }}
              title={`Descargar reporte PDF de ${o.id}`}
            >
              <Icon nombre="download" tamano={12} /> PDF
            </button>
          )}
          {esCoordinador && (
            <>
              {o.archivado ? (
                <button
                  className="btn btn-outline btn-xs"
                  onClick={() => actions?.restoreOrder && actions.restoreOrder(o.id)}
                  title="Restaurar orden archivada"
                >
                  <Icon nombre="refresh-cw" tamano={12} />
                </button>
              ) : (
                <button
                  className="btn btn-outline btn-xs"
                  onClick={() => actions?.archiveOrder && actions.archiveOrder(o.id)}
                  title="Archivar orden"
                >
                  <Icon nombre="archive" tamano={12} />
                </button>
              )}
              <button
                className="btn btn-outline btn-xs"
                style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                onClick={() => {
                  if (window.confirm(`¿Está seguro de eliminar permanentemente la orden ${o.id}? Si cuenta con registros de tareas, pagos o entregas asociadas, el sistema bloqueará la acción para preservar la integridad.`)) {
                    actions?.deleteOrder && actions.deleteOrder(o.id)
                  }
                }}
                title="Eliminar orden permanente"
              >
                <Icon nombre="trash-2" tamano={12} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        titulo={titulo}
        subtitulo={
          esCoordinador
            ? `${base.length} órdenes registradas. Organiza fechas comprometidas, prioridades, personal y costos internos.`
            : `${base.length} órdenes. Consulta su prioridad, responsable, presupuesto y plazo de entrega.`
        }
        icono="clipboard"
        acciones={
          role === 'comercial' ? (
            <button className="btn btn-primary" onClick={() => irA('nuevo')}>
              <Icon nombre="plus" tamano={16} /> Registrar solicitud
            </button>
          ) : esCoordinador ? (
            <button className="btn" onClick={() => irA('tareas')}>
              <Icon nombre="list" tamano={16} /> Asignación de actividades
            </button>
          ) : null
        }
      />

      {/* Selector de estado (Activas / Archivadas / Todas) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn btn-sm ${filtroEstado === 'activas' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('activas')}
        >
          Activas ({data.orders.filter((o) => !o.archivado).length})
        </button>
        <button
          className={`btn btn-sm ${filtroEstado === 'archivadas' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('archivadas')}
        >
          Archivadas ({data.orders.filter((o) => o.archivado).length})
        </button>
        <button
          className={`btn btn-sm ${filtroEstado === 'todas' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFiltroEstado('todas')}
        >
          Todas ({data.orders.length})
        </button>
      </div>

      {esCoordinador && (
        <div className="kpis" style={{ marginBottom: '16px' }}>
          <StatCard
            titulo="Órdenes activas"
            valor={activas.length}
            icono="clipboard"
            detalle="En programación de planta"
          />
          <StatCard
            titulo="Prioridad alta / Urgentes"
            valor={urgentes.length}
            icono="zap"
            color={urgentes.length ? 'amarillo' : 'azul'}
            detalle="Atención preferente"
          />
          <StatCard
            titulo="Retrasadas"
            valor={retrasadas.length}
            icono="alert-triangle"
            color={retrasadas.length ? 'rojo' : 'verde'}
            detalle="Fuera de fecha comprometida"
          />
          <StatCard
            titulo="Costos internos"
            valor={formatoCOP(costoTotal)}
            icono="dollar-sign"
            color="azul"
            detalle="Acumulado de producción"
          />
        </div>
      )}

      <DataTable
        columnas={columnas}
        filas={filas}
        porPagina={8}
        buscar={(o) => `${o.id} ${o.cliente} ${o.producto} ${o.responsable} ${o.disenador || ''}`}
        placeholder="Buscar por orden, cliente, producto, responsable..."
        filtros={[
          { titulo: 'Etapa', valor: (o) => o.estado, opciones: ETAPAS.slice(1) },
          { titulo: 'Prioridad', valor: (o) => o.prioridad, opciones: ['Alta', 'Media', 'Baja'] },
          { titulo: 'Responsable', valor: (o) => o.responsable, opciones: [...new Set(base.map((o) => o.responsable))] },
        ]}
        tarjeta={(o) => <OrderCard order={o} onAbrir={() => irA('detalle', o.id)} />}
        vacioTitulo="No se encontraron órdenes"
      />

      {ordenProgramando && (
        <div className="modal-backdrop" onClick={() => setOrdenProgramando(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary">
                <Icon nombre="sliders" tamano={20} />
              </span>
              <div>
                <h2>Programar orden {ordenProgramando.id}</h2>
                <p>
                  {ordenProgramando.cliente} · {ordenProgramando.producto} ({ordenProgramando.cantidad} uds)
                </p>
              </div>
              <button className="icon-btn" onClick={() => setOrdenProgramando(null)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>
            <form onSubmit={handleGuardarProgramacion} className="modal-body">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="progPrio">Prioridad operativa</label>
                  <select id="progPrio" value={prioridadEdit} onChange={(e) => setPrioridadEdit(e.target.value)}>
                    <option value="Alta">Alta (Urgente)</option>
                    <option value="Media">Media (Estándar)</option>
                    <option value="Baja">Baja (Flexible)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="progFecha">Fecha comprometida de entrega</label>
                  <input
                    id="progFecha"
                    value={fechaEntregaEdit}
                    onChange={(e) => setFechaEntregaEdit(e.target.value)}
                    placeholder="DD/MM/AAAA"
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="progDis">Diseñador(a) asignado(a)</label>
                  <select id="progDis" value={disenadorEdit} onChange={(e) => setDisenadorEdit(e.target.value)}>
                    {[...new Set([...listaDisenadores, disenadorEdit])].filter(Boolean).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="progResp">Responsable operativo de taller</label>
                  <select id="progResp" value={responsableEdit} onChange={(e) => setResponsableEdit(e.target.value)}>
                    {[...new Set([...listaOperarios, responsableEdit])].filter(Boolean).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="progPres">Presupuesto estimado (COP)</label>
                  <input
                    id="progPres"
                    type="number"
                    min="0"
                    value={presupuestoEdit}
                    onChange={(e) => setPresupuestoEdit(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="progCosto">Costo interno de producción (COP)</label>
                  <input
                    id="progCosto"
                    type="number"
                    min="0"
                    value={costoEdit}
                    onChange={(e) => setCostoEdit(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setOrdenProgramando(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Guardar programación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
