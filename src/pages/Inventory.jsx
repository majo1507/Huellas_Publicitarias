import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { formatoCOP } from '../utils/format.js'
import { generarReporteGeneralPDF } from '../utils/pdfReport.js'

const CATEGORIAS_MATERIAL = [
  'Sustratos gran formato',
  'Vinilos y adhesivos',
  'Papelería comercial',
  'Tintas y químicos',
  'Acabados y protección',
  'Estructuras y exhibidores',
]

const UNIDADES_MEDIDA = ['m²', 'pliegos', 'unidades', 'litros', 'rollos', 'metros']

const FORM_MATERIAL_VACIO = {
  nombre: '',
  descripcion: '',
  categoria: 'Sustratos gran formato',
  unidad: 'm²',
  stockActual: '',
  cantidadUtilizada: '0',
  stockMinimo: '',
  costoUnitario: '',
  proveedorId: '',
}

const FORM_PROVEEDOR_VACIO = {
  nombre: '',
  contacto: '',
  telefono: '',
  correo: '',
  ciudad: 'Bogotá',
  productos: '',
}

const FORM_MOVIMIENTO_VACIO = {
  tipo: 'Entrada',
  materialId: '',
  cantidad: '',
  ordenId: '',
  observacion: '',
}

export default function Inventory({ data, actions, irA }) {
  const [tab, setTab] = useState('materiales') // 'materiales' | 'proveedores' | 'movimientos'
  const [modalMaterial, setModalMaterial] = useState(false)
  const [modalProveedor, setModalProveedor] = useState(false)
  const [modalMovimiento, setModalMovimiento] = useState(false)

  const [formMaterial, setFormMaterial] = useState(FORM_MATERIAL_VACIO)
  const [formProveedor, setFormProveedor] = useState(FORM_PROVEEDOR_VACIO)
  const [formMovimiento, setFormMovimiento] = useState(FORM_MOVIMIENTO_VACIO)
  const [errores, setErrores] = useState({})

  const materiales = data.inventory || []
  const proveedores = data.suppliers || []
  const movimientos = data.inventoryMovements || []

  const enAlerta = materiales.filter((m) => Number(m.stockActual) <= Number(m.stockMinimo))
  const valorDisponibleTotal = materiales.reduce(
    (acc, m) => acc + Number(m.stockActual || 0) * Number(m.costoUnitario || 0),
    0
  )
  const valorUtilizadoTotal = materiales.reduce(
    (acc, m) => acc + Number(m.cantidadUtilizada || 0) * Number(m.costoUnitario || 0),
    0
  )

  function abrirMovimientoRapido(material, tipo = 'Entrada') {
    setFormMovimiento({
      tipo,
      materialId: material.id,
      cantidad: '',
      ordenId: '',
      observacion: tipo === 'Entrada' ? `Reposición de stock (${material.nombre})` : `Consumo en taller (${material.nombre})`,
    })
    setErrores({})
    setModalMovimiento(true)
  }

  function handleGuardarMaterial(e) {
    e.preventDefault()
    const err = {}
    if (!formMaterial.nombre.trim()) err.nombre = 'Ingresa el nombre del material.'
    if (!formMaterial.descripcion.trim()) err.descripcion = 'Ingresa una descripción breve.'
    if (formMaterial.stockActual === '' || Number(formMaterial.stockActual) < 0) err.stockActual = 'Ingresa una cantidad válida.'
    if (formMaterial.stockMinimo === '' || Number(formMaterial.stockMinimo) < 0) err.stockMinimo = 'Ingresa el stock mínimo.'
    if (formMaterial.costoUnitario === '' || Number(formMaterial.costoUnitario) <= 0) err.costoUnitario = 'Ingresa el costo unitario.'
    setErrores(err)
    if (Object.keys(err).length > 0) return

    const provObj = proveedores.find((p) => p.id === formMaterial.proveedorId) || proveedores[0]
    actions.addInventoryMaterial({
      nombre: formMaterial.nombre.trim(),
      descripcion: formMaterial.descripcion.trim(),
      categoria: formMaterial.categoria,
      unidad: formMaterial.unidad,
      stockActual: Number(formMaterial.stockActual),
      cantidadUtilizada: Number(formMaterial.cantidadUtilizada || 0),
      stockMinimo: Number(formMaterial.stockMinimo),
      costoUnitario: Number(formMaterial.costoUnitario),
      proveedorId: provObj?.id || 'PROV-001',
      proveedor: provObj?.nombre || 'Proveedor general',
    })
    setModalMaterial(false)
    setFormMaterial(FORM_MATERIAL_VACIO)
  }

  function handleGuardarProveedor(e) {
    e.preventDefault()
    const err = {}
    if (!formProveedor.nombre.trim()) err.nombre = 'El nombre del proveedor es obligatorio.'
    if (!formProveedor.contacto.trim()) err.contacto = 'El nombre de contacto es obligatorio.'
    if (!formProveedor.telefono.trim()) err.telefono = 'El teléfono es obligatorio.'
    if (!formProveedor.correo.trim()) err.correo = 'El correo es obligatorio.'
    if (!formProveedor.productos.trim()) err.productos = 'Indica los productos que suministra.'
    setErrores(err)
    if (Object.keys(err).length > 0) return

    actions.addSupplier({
      nombre: formProveedor.nombre.trim(),
      contacto: formProveedor.contacto.trim(),
      telefono: formProveedor.telefono.trim(),
      correo: formProveedor.correo.trim(),
      ciudad: formProveedor.ciudad.trim() || 'Bogotá',
      productos: formProveedor.productos.trim(),
    })
    setModalProveedor(false)
    setFormProveedor(FORM_PROVEEDOR_VACIO)
  }

  function handleGuardarMovimiento(e) {
    e.preventDefault()
    const err = {}
    if (!formMovimiento.materialId) err.materialId = 'Selecciona un material.'
    const cant = Number(formMovimiento.cantidad)
    if (!formMovimiento.cantidad || cant <= 0) err.cantidad = 'La cantidad debe ser mayor que cero.'

    const mat = materiales.find((m) => m.id === formMovimiento.materialId)
    if (mat && formMovimiento.tipo === 'Salida' && cant > Number(mat.stockActual)) {
      err.cantidad = `Stock insuficiente. Disponible: ${mat.stockActual} ${mat.unidad}.`
    }

    setErrores(err)
    if (Object.keys(err).length > 0) return

    actions.registerInventoryMovement({
      tipo: formMovimiento.tipo,
      materialId: formMovimiento.materialId,
      cantidad: cant,
      ordenId: formMovimiento.ordenId || null,
      observacion: formMovimiento.observacion.trim() || `${formMovimiento.tipo} de inventario`,
    })
    setModalMovimiento(false)
    setFormMovimiento(FORM_MOVIMIENTO_VACIO)
  }

  const filasMateriales = materiales.map((m) => {
    const bajo = Number(m.stockActual) <= Number(m.stockMinimo)
    const valorDisponible = Number(m.stockActual || 0) * Number(m.costoUnitario || 0)
    const valorUtilizado = Number(m.cantidadUtilizada || 0) * Number(m.costoUnitario || 0)
    return {
      ...m,
      estadoStock: bajo ? 'Pocas existencias' : 'Disponible',
      valorDisponible,
      valorUtilizado,
    }
  })

  const columnasMateriales = [
    {
      clave: 'nombre',
      titulo: 'Material e insumo',
      ordenar: true,
      render: (m) => (
        <div>
          <strong>{m.nombre}</strong>
          <small className="cell-sub">{m.id} · {m.descripcion}</small>
        </div>
      ),
    },
    {
      clave: 'categoria',
      titulo: 'Categoría / Proveedor',
      ordenar: true,
      render: (m) => (
        <div>
          <span>{m.categoria}</span>
          <small className="cell-sub">{m.proveedor}</small>
        </div>
      ),
    },
    {
      clave: 'stockActual',
      titulo: 'Existencias',
      ordenar: true,
      render: (m) => (
        <div>
          <strong className={Number(m.stockActual) <= Number(m.stockMinimo) ? 'text-rojo' : ''}>
            {m.stockActual} {m.unidad}
          </strong>
          <small className="cell-sub">
            Mín: {m.stockMinimo} {m.unidad} · Usado: {m.cantidadUtilizada} {m.unidad}
          </small>
        </div>
      ),
    },
    {
      clave: 'costoUnitario',
      titulo: 'Costo y presupuesto',
      ordenar: true,
      render: (m) => (
        <div>
          <strong>{formatoCOP(m.valorDisponible)}</strong>
          <small className="cell-sub">
            Unit: {formatoCOP(m.costoUnitario)}/{m.unidad} · Usado: {formatoCOP(m.valorUtilizado)}
          </small>
        </div>
      ),
    },
    {
      clave: 'estadoStock',
      titulo: 'Estado',
      render: (m) => (
        <StatusBadge
          estado={m.estadoStock === 'Pocas existencias' ? 'Retrasada' : 'Aprobado'}
          texto={m.estadoStock}
        />
      ),
    },
    {
      clave: 'acciones',
      titulo: 'Movimientos',
      render: (m) => (
        <div className="row-actions" style={{ gap: '4px' }}>
          <button
            className="btn btn-soft btn-sm"
            onClick={() => abrirMovimientoRapido(m, 'Entrada')}
            title="Registrar entrada de material"
          >
            <Icon nombre="plus" tamano={13} /> Entrada
          </button>
          <button
            className="btn btn-sm"
            onClick={() => abrirMovimientoRapido(m, 'Salida')}
            title="Registrar consumo o salida a taller"
          >
            <Icon nombre="arrow-right" tamano={13} /> Salida
          </button>
        </div>
      ),
    },
  ]

  const columnasProveedores = [
    {
      clave: 'nombre',
      titulo: 'Proveedor',
      ordenar: true,
      render: (p) => (
        <div>
          <strong>{p.nombre}</strong>
          <small className="cell-sub">{p.id} · {p.ciudad || 'Bogotá'}</small>
        </div>
      ),
    },
    {
      clave: 'contacto',
      titulo: 'Contacto comercial',
      render: (p) => (
        <div>
          <strong>{p.contacto}</strong>
          <small className="cell-sub">{p.correo}</small>
        </div>
      ),
    },
    { clave: 'telefono', titulo: 'Teléfono' },
    {
      clave: 'productos',
      titulo: 'Productos y materiales que suministra',
      render: (p) => <span className="sm">{p.productos}</span>,
    },
  ]

  const columnasMovimientos = [
    {
      clave: 'fecha',
      titulo: 'Fecha y hora',
      render: (mv) => (
        <div>
          <strong>{mv.fecha}</strong>
          <small className="cell-sub">{mv.hora || '09:00'}</small>
        </div>
      ),
    },
    {
      clave: 'tipo',
      titulo: 'Tipo',
      render: (mv) => (
        <StatusBadge
          estado={mv.tipo === 'Entrada' ? 'Aprobado' : 'En proceso'}
          texto={mv.tipo}
        />
      ),
    },
    {
      clave: 'material',
      titulo: 'Material',
      render: (mv) => (
        <div>
          <strong>{mv.material}</strong>
          <small className="cell-sub">{mv.observacion}</small>
        </div>
      ),
    },
    {
      clave: 'cantidad',
      titulo: 'Cantidad',
      render: (mv) => (
        <strong>
          {mv.tipo === 'Entrada' ? '+' : '-'}{mv.cantidad} {mv.unidad || ''}
        </strong>
      ),
    },
    {
      clave: 'costoTotal',
      titulo: 'Valor estimado',
      render: (mv) => formatoCOP(mv.costoTotal || 0),
    },
    {
      clave: 'ordenId',
      titulo: 'Orden vinculada',
      render: (mv) =>
        mv.ordenId ? (
          <button className="link-inline" onClick={() => irA('detalle', mv.ordenId)}>
            <strong>{mv.ordenId}</strong>
          </button>
        ) : (
          <span className="muted">Abastecimiento almacén</span>
        ),
    },
    { clave: 'responsable', titulo: 'Responsable' },
  ]

  return (
    <div>
      <PageHeader
        etiqueta="ABASTECIMIENTO · CONTROL DE INSUMOS Y COSTOS"
        titulo="Inventario de materiales y proveedores"
        subtitulo="Control de existencias, alertas de stock mínimo, proveedores, costos de materiales y movimientos de planta."
        icono="package"
        acciones={
          <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-soft"
              onClick={() => {
                generarReporteGeneralPDF(data)
                actions.notify('Reporte PDF de producción e inventario descargado.', 'exito')
              }}
            >
              <Icon nombre="download" tamano={15} /> Reporte PDF
            </button>
            <button
              className="btn"
              onClick={() => {
                setErrores({})
                setFormProveedor(FORM_PROVEEDOR_VACIO)
                setModalProveedor(true)
              }}
            >
              <Icon nombre="users" tamano={15} /> Nuevo proveedor
            </button>
            <button
              className="btn"
              onClick={() => {
                setErrores({})
                setFormMovimiento({
                  ...FORM_MOVIMIENTO_VACIO,
                  materialId: materiales[0]?.id || '',
                })
                setModalMovimiento(true)
              }}
            >
              <Icon nombre="refresh" tamano={15} /> Registrar movimiento
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setErrores({})
                setFormMaterial({
                  ...FORM_MATERIAL_VACIO,
                  proveedorId: proveedores[0]?.id || '',
                })
                setModalMaterial(true)
              }}
            >
              <Icon nombre="plus" tamano={15} /> Nuevo material
            </button>
          </div>
        }
      />

      {/* Alertas de pocas existencias */}
      {enAlerta.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <Alert
            tipo="aviso"
            titulo={`Alerta de inventario: ${enAlerta.length} ${
              enAlerta.length === 1 ? 'material tiene' : 'materiales tienen'
            } pocas existencias`}
          >
            Revisa y programa reposición con el proveedor para evitar bloqueos en órdenes de impresión:{' '}
            {enAlerta.map((m) => (
              <strong key={m.id} style={{ marginRight: '10px' }}>
                {m.nombre} ({m.stockActual}/{m.stockMinimo} {m.unidad})
              </strong>
            ))}
          </Alert>
        </div>
      )}

      {/* KPIs de Inventario y Presupuesto de Recursos */}
      <div className="kpis">
        <StatCard
          titulo="Materiales en catálogo"
          valor={materiales.length}
          icono="package"
          detalle={`${proveedores.length} proveedores activos`}
        />
        <StatCard
          titulo="Alertas de bajo stock"
          valor={enAlerta.length}
          icono="alert-triangle"
          color={enAlerta.length > 0 ? 'rojo' : 'verde'}
          detalle={enAlerta.length > 0 ? 'Requieren reposición inmediata' : 'Niveles óptimos'}
        />
        <StatCard
          titulo="Valor stock disponible"
          valor={formatoCOP(valorDisponibleTotal)}
          icono="layers"
          color="azul"
          detalle="Presupuesto actual en almacén"
        />
        <StatCard
          titulo="Recursos utilizados"
          valor={formatoCOP(valorUtilizadoTotal)}
          icono="trending-up"
          color="amarillo"
          detalle="Valor estimado consumido en órdenes"
        />
      </div>

      {/* Pestañas del módulo */}
      <div className="tabs" role="tablist">
        <button className={tab === 'materiales' ? 'on' : ''} onClick={() => setTab('materiales')}>
          <Icon nombre="package" tamano={15} /> Materiales y existencias <span className="pill">{materiales.length}</span>
        </button>
        <button className={tab === 'proveedores' ? 'on' : ''} onClick={() => setTab('proveedores')}>
          <Icon nombre="users" tamano={15} /> Proveedores <span className="pill">{proveedores.length}</span>
        </button>
        <button className={tab === 'movimientos' ? 'on' : ''} onClick={() => setTab('movimientos')}>
          <Icon nombre="clock" tamano={15} /> Entradas y salidas <span className="pill">{movimientos.length}</span>
        </button>
      </div>

      {tab === 'materiales' && (
        <DataTable
          columnas={columnasMateriales}
          filas={filasMateriales}
          porPagina={8}
          buscar={(m) => `${m.id} ${m.nombre} ${m.descripcion} ${m.categoria} ${m.proveedor}`}
          placeholder="Buscar material por nombre, categoría o proveedor..."
          filtros={[
            { titulo: 'Categoría', valor: (m) => m.categoria, opciones: [...new Set(materiales.map((m) => m.categoria))] },
            { titulo: 'Estado stock', valor: (m) => m.estadoStock, opciones: ['Disponible', 'Pocas existencias'] },
          ]}
          vacioTitulo="No se encontraron materiales"
        />
      )}

      {tab === 'proveedores' && (
        <DataTable
          columnas={columnasProveedores}
          filas={proveedores}
          porPagina={8}
          buscar={(p) => `${p.nombre} ${p.contacto} ${p.correo} ${p.productos} ${p.ciudad}`}
          placeholder="Buscar proveedor, contacto o insumo suministrado..."
          vacioTitulo="No hay proveedores registrados"
        />
      )}

      {tab === 'movimientos' && (
        <Panel
          titulo="Historial de entradas, salidas y consumo por orden"
          subtitulo="Trazabilidad de fechas, cantidades y presupuesto consumido en producción"
          icono="clock"
        >
          <DataTable
            columnas={columnasMovimientos}
            filas={movimientos}
            porPagina={8}
            buscar={(mv) => `${mv.material} ${mv.tipo} ${mv.ordenId || ''} ${mv.responsable} ${mv.observacion}`}
            placeholder="Buscar movimiento por material, orden o responsable..."
            filtros={[{ titulo: 'Tipo', valor: (mv) => mv.tipo, opciones: ['Entrada', 'Salida'] }]}
            vacioTitulo="Sin movimientos registrados"
          />
        </Panel>
      )}

      {/* Modal: Registrar nuevo material */}
      {modalMaterial && (
        <div className="modal-backdrop" onClick={() => setModalMaterial(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nuevo material">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="package" tamano={20} /></span>
              <div>
                <h2>Registrar material en inventario</h2>
                <p>Define categoría, unidad de medida, stock mínimo de alerta y costo unitario.</p>
              </div>
              <button className="icon-btn" onClick={() => setModalMaterial(false)}><Icon nombre="x" /></button>
            </div>
            <form onSubmit={handleGuardarMaterial} className="modal-body" noValidate>
              <div className="form-grid">
                <div className={`field ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="matNombre">Nombre del material</label>
                  <input
                    id="matNombre"
                    value={formMaterial.nombre}
                    onChange={(e) => setFormMaterial({ ...formMaterial, nombre: e.target.value })}
                    placeholder="Ej. Vinilo microperforado"
                  />
                  {errores.nombre && <span className="field-error">{errores.nombre}</span>}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="matCat">Categoría</label>
                  <select
                    id="matCat"
                    value={formMaterial.categoria}
                    onChange={(e) => setFormMaterial({ ...formMaterial, categoria: e.target.value })}
                  >
                    {CATEGORIAS_MATERIAL.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={`field full ${errores.descripcion ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="matDesc">Descripción técnica</label>
                  <input
                    id="matDesc"
                    value={formMaterial.descripcion}
                    onChange={(e) => setFormMaterial({ ...formMaterial, descripcion: e.target.value })}
                    placeholder="Especificación de gramaje, calibre o uso en planta"
                  />
                  {errores.descripcion && <span className="field-error">{errores.descripcion}</span>}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="matUnidad">Unidad de medida</label>
                  <select
                    id="matUnidad"
                    value={formMaterial.unidad}
                    onChange={(e) => setFormMaterial({ ...formMaterial, unidad: e.target.value })}
                  >
                    {UNIDADES_MEDIDA.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="matProv">Proveedor</label>
                  <select
                    id="matProv"
                    value={formMaterial.proveedorId}
                    onChange={(e) => setFormMaterial({ ...formMaterial, proveedorId: e.target.value })}
                  >
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className={`field ${errores.stockActual ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="matStock">Cantidad disponible inicial</label>
                  <input
                    id="matStock"
                    type="number"
                    min="0"
                    value={formMaterial.stockActual}
                    onChange={(e) => setFormMaterial({ ...formMaterial, stockActual: e.target.value })}
                  />
                  {errores.stockActual && <span className="field-error">{errores.stockActual}</span>}
                </div>
                <div className={`field ${errores.stockMinimo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="matMin">Stock mínimo (alerta)</label>
                  <input
                    id="matMin"
                    type="number"
                    min="0"
                    value={formMaterial.stockMinimo}
                    onChange={(e) => setFormMaterial({ ...formMaterial, stockMinimo: e.target.value })}
                  />
                  {errores.stockMinimo && <span className="field-error">{errores.stockMinimo}</span>}
                </div>
                <div className={`field full ${errores.costoUnitario ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="matCosto">Costo unitario (COP)</label>
                  <input
                    id="matCosto"
                    type="number"
                    min="1"
                    value={formMaterial.costoUnitario}
                    onChange={(e) => setFormMaterial({ ...formMaterial, costoUnitario: e.target.value })}
                    placeholder="Ej. 22000"
                  />
                  {errores.costoUnitario && <span className="field-error">{errores.costoUnitario}</span>}
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalMaterial(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Guardar material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar nuevo proveedor */}
      {modalProveedor && (
        <div className="modal-backdrop" onClick={() => setModalProveedor(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Nuevo proveedor">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="users" tamano={20} /></span>
              <div>
                <h2>Registrar proveedor de insumos</h2>
                <p>Agrega datos de contacto y los materiales que suministra a planta.</p>
              </div>
              <button className="icon-btn" onClick={() => setModalProveedor(false)}><Icon nombre="x" /></button>
            </div>
            <form onSubmit={handleGuardarProveedor} className="modal-body" noValidate>
              <div className="form-grid">
                <div className={`field ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provNombre">Empresa proveedora</label>
                  <input
                    id="provNombre"
                    value={formProveedor.nombre}
                    onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                    placeholder="Ej. Distribuidora Gráfica del Norte"
                  />
                  {errores.nombre && <span className="field-error">{errores.nombre}</span>}
                </div>
                <div className={`field ${errores.contacto ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provContacto">Contacto comercial</label>
                  <input
                    id="provContacto"
                    value={formProveedor.contacto}
                    onChange={(e) => setFormProveedor({ ...formProveedor, contacto: e.target.value })}
                    placeholder="Ej. Andrés Mejía"
                  />
                  {errores.contacto && <span className="field-error">{errores.contacto}</span>}
                </div>
                <div className={`field ${errores.telefono ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provTel">Teléfono</label>
                  <input
                    id="provTel"
                    value={formProveedor.telefono}
                    onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })}
                    placeholder="Ej. 312 450 9988"
                  />
                  {errores.telefono && <span className="field-error">{errores.telefono}</span>}
                </div>
                <div className={`field ${errores.correo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provCorreo">Correo electrónico</label>
                  <input
                    id="provCorreo"
                    type="email"
                    value={formProveedor.correo}
                    onChange={(e) => setFormProveedor({ ...formProveedor, correo: e.target.value })}
                    placeholder="comercial@proveedor.co"
                  />
                  {errores.correo && <span className="field-error">{errores.correo}</span>}
                </div>
                <div className={`field full ${errores.productos ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provProd">Productos que suministra</label>
                  <input
                    id="provProd"
                    value={formProveedor.productos}
                    onChange={(e) => setFormProveedor({ ...formProveedor, productos: e.target.value })}
                    placeholder="Ej. Lonas gran formato, vinilos adhesivos, laminado UV"
                  />
                  {errores.productos && <span className="field-error">{errores.productos}</span>}
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalProveedor(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Guardar proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar entrada o salida de inventario */}
      {modalMovimiento && (
        <div className="modal-backdrop" onClick={() => setModalMovimiento(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Movimiento de inventario">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="refresh" tamano={20} /></span>
              <div>
                <h2>Registrar movimiento de inventario</h2>
                <p>Actualiza las existencias por compra (entrada) o consumo en orden (salida).</p>
              </div>
              <button className="icon-btn" onClick={() => setModalMovimiento(false)}><Icon nombre="x" /></button>
            </div>
            <form onSubmit={handleGuardarMovimiento} className="modal-body" noValidate>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="movTipo">Tipo de movimiento</label>
                  <select
                    id="movTipo"
                    value={formMovimiento.tipo}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, tipo: e.target.value })}
                  >
                    <option value="Entrada">Entrada (abastecimiento / compra)</option>
                    <option value="Salida">Salida (consumo en producción)</option>
                  </select>
                </div>
                <div className={`field ${errores.materialId ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="movMat">Material</label>
                  <select
                    id="movMat"
                    value={formMovimiento.materialId}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, materialId: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {materiales.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} (Disp: {m.stockActual} {m.unidad})
                      </option>
                    ))}
                  </select>
                  {errores.materialId && <span className="field-error">{errores.materialId}</span>}
                </div>
                <div className={`field ${errores.cantidad ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="movCant">Cantidad</label>
                  <input
                    id="movCant"
                    type="number"
                    min="1"
                    value={formMovimiento.cantidad}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, cantidad: e.target.value })}
                  />
                  {errores.cantidad && <span className="field-error">{errores.cantidad}</span>}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="movOrden">Orden asociada (opcional)</label>
                  <select
                    id="movOrden"
                    value={formMovimiento.ordenId}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, ordenId: e.target.value })}
                  >
                    <option value="">Sin orden (almacén general)</option>
                    {(data.orders || []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} · {o.cliente} ({o.producto})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field full">
                  <label className="field-label" htmlFor="movObs">Observación o motivo</label>
                  <input
                    id="movObs"
                    value={formMovimiento.observacion}
                    onChange={(e) => setFormMovimiento({ ...formMovimiento, observacion: e.target.value })}
                    placeholder="Ej. Lote de impresión orden OP-2026-0001 o factura de proveedor"
                  />
                </div>
              </div>
              <div className="modal-foot" style={{ marginTop: '20px', padding: 0, background: 'none', border: 'none' }}>
                <button type="button" className="btn" onClick={() => setModalMovimiento(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <Icon nombre="check" tamano={15} /> Registrar movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
