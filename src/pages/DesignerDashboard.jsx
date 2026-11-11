import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import DataTable from '../components/DataTable.jsx'
import Icon from '../components/Icon.jsx'
import { ROLES } from '../data/roles.js'
import { estaRetrasada, estaEnRiesgo, ultimaVersion } from '../utils/format.js'

// Tarea sugerida al diseñador según el estado del diseño
const TAREA_POR_ESTADO = {
  Pendiente: 'Iniciar propuesta gráfica',
  'En diseño': 'Preparar propuesta gráfica',
  'En proceso': 'Terminar y enviar a Comercial',
  'Pendiente de gestión comercial': 'En gestión con Comercial',
  'Esperando respuesta del cliente': 'En espera de respuesta del cliente',
  Enviado: 'En gestión con Comercial',
  'Cambios solicitados': 'Ajustar diseño y preparar nueva versión',
  'Requiere cambios': 'Ajustar diseño y preparar nueva versión',
  'Aprobado por el cliente': 'Aprobado por el cliente',
  'Listo para impresión': 'Listo para taller de impresión',
  Aprobado: 'Diseño aprobado',
}

// DISEÑADOR GRÁFICO: sus tareas y el estado de sus diseños
export default function DesignerDashboard({ data, irA, role, usuarioActual }) {
  const [pestaña, setPestaña] = useState('por_disenar') // 'por_disenar' | 'en_comercial' | 'aprobadas'
  const [modalObs, setModalObs] = useState(null) // orden seleccionada para ver observaciones

  const nombre = (role === 'disenador' && usuarioActual?.nombre) || ROLES.disenador?.usuario?.nombre || 'María López'
  const mios = data.orders.filter((o) => o.disenador === nombre)
  const contar = (estado) => mios.filter((o) => o.disenoEstado === estado).length

  const esAprobado = (o) =>
    o.disenoEstado === 'Aprobado por el cliente' ||
    o.disenoEstado === 'Listo para impresión' ||
    o.disenoEstado === 'Aprobado'

  const esEnComercial = (o) =>
    o.disenoEstado === 'Pendiente de gestión comercial' ||
    o.disenoEstado === 'Esperando respuesta del cliente' ||
    o.disenoEstado === 'Enviado'

  const esPorDisenar = (o) =>
    !esAprobado(o) && !esEnComercial(o)

  // Listas según pestaña
  const ordenesPorDisenar = mios.filter(esPorDisenar).map((o) => ({
    ...o,
    tarea: TAREA_POR_ESTADO[o.disenoEstado] || 'Preparar propuesta',
    prioridad: estaRetrasada(o) || estaEnRiesgo(o) ? 'Alta' : 'Media',
  }))

  const ordenesEnComercial = mios.filter(esEnComercial).map((o) => ({
    ...o,
    tarea: TAREA_POR_ESTADO[o.disenoEstado] || 'En seguimiento comercial',
    prioridad: 'Media',
  }))

  const ordenesAprobadas = mios.filter(esAprobado).map((o) => ({
    ...o,
    tarea: TAREA_POR_ESTADO[o.disenoEstado] || 'Listo para taller',
    prioridad: 'Baja',
  }))

  const totalAprobados = contar('Aprobado por el cliente') + contar('Listo para impresión') + contar('Aprobado')
  const totalCambios = contar('Cambios solicitados') + contar('Requiere cambios')
  const totalEnComercial = contar('Pendiente de gestión comercial') + contar('Esperando respuesta del cliente') + contar('Enviado')
  const totalEnDiseno = contar('En diseño') + contar('En proceso') + contar('Pendiente')

  // Columnas compactas y legibles
  const columnas = [
    {
      clave: 'id',
      titulo: 'Orden',
      ordenar: true,
      render: (o) => (
        <button className="link-inline" onClick={() => irA('disenos', o.id)}>
          <strong>{o.id}</strong>
        </button>
      ),
    },
    {
      clave: 'producto',
      titulo: 'Producto / Cliente',
      ordenar: true,
      render: (o) => (
        <div>
          <strong>{o.producto}</strong>
          <small className="cell-sub">{o.cliente}</small>
        </div>
      ),
    },
    {
      clave: 'disenoEstado',
      titulo: 'Estado del arte',
      render: (o) => {
        const u = ultimaVersion(o)
        const tieneCambios = o.disenoEstado === 'Cambios solicitados' || o.disenoEstado === 'Requiere cambios'
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
            <StatusBadge estado={o.disenoEstado} />
            {tieneCambios && (
              <button
                type="button"
                className="btn btn-soft btn-xs"
                style={{ fontSize: '11px', padding: '2px 7px', color: 'var(--state-red-text)' }}
                onClick={() => setModalObs(o)}
                title="Ver observaciones del cliente"
              >
                <Icon nombre="message" tamano={12} /> Ver ajustes (v{u?.numero || 1})
              </button>
            )}
          </div>
        )
      },
    },
    {
      clave: 'tarea',
      titulo: 'Acción requerida',
      render: (o) => {
        const u = ultimaVersion(o)
        const f = u?.fechaEnvioComercialTexto || u?.fechaEnvioTexto
        const h = u?.horaEnvioComercialTexto || u?.horaEnvioTexto
        return (
          <div>
            <div>{o.tarea}</div>
            {f && (
              <small
                className="cell-sub"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: 'var(--blue-700, #1d4ed8)',
                  marginTop: '2px',
                }}
              >
                <Icon nombre="send" tamano={11} /> Enviado: {f} {h}
              </small>
            )}
          </div>
        )
      },
    },
    { clave: 'fechaEntrega', titulo: 'Entrega', ordenar: true },
    {
      clave: 'abrir',
      titulo: 'Mesa',
      render: (o) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => irA('disenos', o.id)}
          title="Abrir mesa de trabajo de diseño para esta orden"
        >
          <Icon nombre="pen" tamano={13} /> Diseñar
        </button>
      ),
    },
  ]

  // Filas según pestaña activa
  const filasActivas =
    pestaña === 'por_disenar'
      ? ordenesPorDisenar
      : pestaña === 'en_comercial'
      ? ordenesEnComercial
      : ordenesAprobadas

  return (
    <div>
      <PageHeader
        etiqueta="ESTACIÓN CREATIVA · PREPRENSA Y ARTES"
        titulo="Mis tareas de diseño"
        subtitulo={`Propuestas gráficas asignadas a ${nombre}.`}
        icono="pen"
        acciones={
          <button className="btn btn-primary" onClick={() => irA('disenos')}>
            <Icon nombre="grid" tamano={15} /> Ver todos los diseños
          </button>
        }
      />

      {/* 4 Indicadores clave de Diseño con redirección directa por pestaña */}
      <div className="kpis">
        <StatCard
          titulo="Por diseñar / En proceso"
          valor={ordenesPorDisenar.length}
          icono="pen"
          color="azul"
          detalle="Propuestas asignadas a mi cargo"
          onClick={() => setPestaña('por_disenar')}
        />
        <StatCard
          titulo="Ajustes solicitados"
          valor={totalCambios}
          icono="alert-triangle"
          color={totalCambios > 0 ? 'rojo' : 'azul'}
          detalle="Requieren nueva versión V2+"
          onClick={() => setPestaña('por_disenar')}
        />
        <StatCard
          titulo="En gestión comercial"
          valor={ordenesEnComercial.length}
          icono="send"
          color="amarillo"
          detalle="Esperando respuesta del cliente"
          onClick={() => setPestaña('en_comercial')}
        />
        <StatCard
          titulo="Aprobadas por cliente"
          valor={ordenesAprobadas.length}
          icono="check-circle"
          color="verde"
          detalle="Listas para impresión en planta"
          onClick={() => setPestaña('aprobadas')}
        />
      </div>

      {/* NAVEGACIÓN EN PESTAÑAS DE FLUJO DE TRABAJO */}
      <div className="tabs" role="tablist" aria-label="Fases de mis diseños" style={{ marginBottom: '16px' }}>
        <button
          type="button"
          role="tab"
          aria-selected={pestaña === 'por_disenar'}
          className={pestaña === 'por_disenar' ? 'on' : ''}
          onClick={() => setPestaña('por_disenar')}
        >
          <Icon nombre="pen" tamano={14} /> Por diseñar y en ajustes <span className="pill">{ordenesPorDisenar.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestaña === 'en_comercial'}
          className={pestaña === 'en_comercial' ? 'on' : ''}
          onClick={() => setPestaña('en_comercial')}
        >
          <Icon nombre="send" tamano={14} /> En Comercial / Esperando cliente <span className="pill">{ordenesEnComercial.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pestaña === 'aprobadas'}
          className={pestaña === 'aprobadas' ? 'on' : ''}
          onClick={() => setPestaña('aprobadas')}
        >
          <Icon nombre="check-circle" tamano={14} /> Aprobadas recientes <span className="pill">{ordenesAprobadas.length}</span>
        </button>
      </div>

      {/* TABLA PRINCIPAL DE TRABAJO */}
      <DataTable
        columnas={columnas}
        filas={filasActivas}
        porPagina={6}
        buscar={(o) => `${o.id} ${o.producto} ${o.cliente}`}
        placeholder="Buscar en mis tareas de diseño..."
        filtros={[
          {
            titulo: 'Estado',
            valor: (o) => o.disenoEstado,
            opciones: [
              'En diseño',
              'Pendiente de gestión comercial',
              'Esperando respuesta del cliente',
              'Cambios solicitados',
              'Aprobado por el cliente',
              'Listo para impresión',
            ],
          },
        ]}
        vacioTitulo={
          pestaña === 'por_disenar'
            ? 'No tienes tareas pendientes por diseñar'
            : pestaña === 'en_comercial'
            ? 'No hay propuestas en gestión comercial'
            : 'Sin diseños aprobados recientes'
        }
        vacioTexto="Todos tus diseños están al día según este filtro."
      />

      {/* MODAL / DRAWER LIMPIO PARA LEER OBSERVACIONES DEL CLIENTE BAJO DEMANDA */}
      {modalObs && (
        <div className="modal-backdrop" onClick={() => setModalObs(null)}>
          <div
            className="modal"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Observaciones para ${modalObs.id}`}
          >
            <div className="modal-head">
              <span className="modal-icon modal-icon-amber">
                <Icon nombre="message" tamano={20} />
              </span>
              <div>
                <h2>Ajustes solicitados en orden {modalObs.id}</h2>
                <p>
                  {modalObs.cliente} · {modalObs.producto}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setModalObs(null)} aria-label="Cerrar">
                <Icon nombre="x" />
              </button>
            </div>

            <div className="modal-body">
              {(() => {
                const u = ultimaVersion(modalObs)
                const obs = u?.comentario || u?.contactoClienteObservaciones || 'Sin observaciones detalladas.'
                const canal = u?.contactoClienteCanal || 'Comercial'
                const contacto = u?.contactoClienteNombre || 'Cliente'
                const fecha = u?.contactoClienteFechaTexto || u?.fechaEnvioTexto || 'Reciente'
                const hora = u?.contactoClienteHoraTexto || ''

                return (
                  <div className="stack" style={{ gap: '14px' }}>
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'var(--state-red-bg, #fef2f2)',
                        border: '1px solid var(--state-red-border, #fecaca)',
                        borderRadius: 'var(--radius-sm, 6px)',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong style={{ color: 'var(--state-red-text, #991b1b)', fontSize: '13px' }}>
                          Retroalimentación de la versión {u?.numero || 1}:
                        </strong>
                        <span className="sm mut">
                          {fecha} {hora}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: 'var(--text-main)' }}>
                        “{obs}”
                      </p>
                      <div className="sm mut" style={{ marginTop: '8px', fontSize: '11.5px' }}>
                        Registrado vía <strong>{canal}</strong> por contacto <strong>{contacto}</strong>.
                      </div>
                    </div>

                    <p className="sm mut" style={{ margin: 0 }}>
                      Al ingresar a la mesa de trabajo podrás cargar una nueva versión (v{Number(u?.numero || 1) + 1}) con los ajustes solicitados, conservando intacta la versión previa en la trazabilidad.
                    </p>
                  </div>
                )
              })()}
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setModalObs(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const id = modalObs.id
                  setModalObs(null)
                  irA('disenos', id)
                }}
              >
                <Icon nombre="pen" tamano={14} /> Abrir mesa y preparar nueva versión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
