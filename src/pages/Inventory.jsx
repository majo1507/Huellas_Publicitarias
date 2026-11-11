import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Panel from '../components/Panel.jsx'
import StatCard from '../components/StatCard.jsx'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Alert from '../components/Alert.jsx'
import Icon from '../components/Icon.jsx'
import { formatoCOP } from '../utils/format.js'
import { generarReporteInventarioPDF } from '../utils/pdfReport.js'
import {
  PAISES,
  TIPOS_DOCUMENTO,
  CATALOGO_MATERIALES,
  obtenerDepartamentosPorPais,
  obtenerMunicipiosPorDepartamento,
} from '../data/catalogos.js'

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
  tipoDocumento: 'NIT',
  nit: '',
  contacto: '',
  telefono: '',
  correo: '',
  pais: 'Colombia',
  departamento: 'Antioquia',
  municipio: 'Medellín',
  ciudad: 'Medellín',
  productos: '',
}

const FORM_MOVIMIENTO_VACIO = {
  tipo: 'Entrada',
  materialId: '',
  cantidad: '',
  ordenId: '',
  observacion: '',
}

export default function Inventory({ data, actions, irA, role }) {
  // Coordinación opera el inventario; Gerencia lo consulta y descarga el informe.
  const puedeOperar = role === 'coordinador'
  const puedeInforme = role === 'coordinador' || role === 'gerencia'
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

  const departamentosProveedor = obtenerDepartamentosPorPais(formProveedor.pais)
  const municipiosProveedor = obtenerMunicipiosPorDepartamento(
    formProveedor.pais,
    formProveedor.departamento
  )

  function handleCambioPaisProveedor(nuevoPais) {
    const deptos = obtenerDepartamentosPorPais(nuevoPais)
    const primerDepto = deptos[0] || ''
    const munis = obtenerMunicipiosPorDepartamento(nuevoPais, primerDepto)
    const primerMuni = munis[0] || ''
    setFormProveedor((prev) => ({
      ...prev,
      pais: nuevoPais,
      departamento: primerDepto,
      municipio: primerMuni,
      ciudad: primerMuni,
    }))
  }

  function handleCambioDeptoProveedor(nuevoDepto) {
    const munis = obtenerMunicipiosPorDepartamento(formProveedor.pais, nuevoDepto)
    const primerMuni = munis[0] || ''
    setFormProveedor((prev) => ({
      ...prev,
      departamento: nuevoDepto,
      municipio: primerMuni,
      ciudad: primerMuni,
    }))
  }

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
      tipoDocumento: formProveedor.tipoDocumento || 'NIT',
      nit: formProveedor.nit?.trim() || '',
      contacto: formProveedor.contacto.trim(),
      telefono: formProveedor.telefono.trim(),
      correo: formProveedor.correo.trim(),
      pais: formProveedor.pais || 'Colombia',
      departamento: formProveedor.departamento || 'Antioquia',
      municipio: formProveedor.municipio || formProveedor.ciudad || 'Medellín',
      ciudad: formProveedor.municipio || formProveedor.ciudad || 'Medellín',
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
      minAncho: '200px',
      ordenar: true,
      render: (m) => (
        <div>
          <strong style={{ fontSize: '13px' }}>{m.nombre}</strong>
          <small
            className="cell-sub cell-truncate"
            style={{ display: 'block', maxWidth: '240px', fontSize: '11px', marginTop: '1px' }}
            title={`${m.id} · ${m.descripcion}`}
          >
            {m.id} · {m.descripcion}
          </small>
        </div>
      ),
    },
    {
      clave: 'categoria',
      titulo: 'Categoría / Proveedor',
      ancho: '165px',
      ordenar: true,
      render: (m) => (
        <div>
          <span style={{ fontSize: '12px' }}>{m.categoria}</span>
          <small className="cell-sub" style={{ display: 'block', fontSize: '11px', marginTop: '1px' }}>
            {m.proveedor}
          </small>
        </div>
      ),
    },
    {
      clave: 'stockActual',
      titulo: 'Existencias',
      ancho: '145px',
      ordenar: true,
      render: (m) => {
        const esBajo = Number(m.stockActual) <= Number(m.stockMinimo)
        return (
          <div>
            <strong className={esBajo ? 'text-rojo' : ''} style={{ fontSize: '12.5px' }}>
              {m.stockActual} {m.unidad}
            </strong>
            <small className="cell-sub" style={{ display: 'block', fontSize: '11px', marginTop: '1px' }}>
              Mín: {m.stockMinimo} {m.unidad} · Usado: {m.cantidadUtilizada} {m.unidad}
            </small>
          </div>
        )
      },
    },
    {
      clave: 'costoUnitario',
      titulo: 'Costo y presupuesto',
      ancho: '150px',
      ordenar: true,
      render: (m) => (
        <div>
          <strong style={{ fontSize: '12.5px' }}>{formatoCOP(m.valorDisponible)}</strong>
          <small className="cell-sub" style={{ display: 'block', fontSize: '11px', marginTop: '1px' }}>
            Unit: {formatoCOP(m.costoUnitario)}/{m.unidad}
          </small>
        </div>
      ),
    },
    {
      clave: 'estadoStock',
      titulo: 'Estado',
      ancho: '130px',
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
      ancho: '140px',
      render: (m) => (
        <div className="row-actions" style={{ gap: '4px' }}>
          <button
            className="btn btn-soft btn-xs"
            onClick={() => abrirMovimientoRapido(m, 'Entrada')}
            title="Registrar entrada de material"
          >
            <Icon nombre="plus" tamano={11} /> Entrada
          </button>
          <button
            className="btn btn-sm btn-xs"
            onClick={() => abrirMovimientoRapido(m, 'Salida')}
            title="Registrar consumo o salida a taller"
          >
            <Icon nombre="arrow-right" tamano={11} /> Salida
          </button>
        </div>
      ),
    },
  ]

  const columnasProveedores = [
    {
      clave: 'nombre',
      titulo: 'Proveedor / Documento',
      ancho: '220px',
      ordenar: true,
      render: (p) => (
        <div>
          <strong style={{ fontSize: '13px' }}>{p.nombre}</strong>
          <small
            className="cell-sub cell-truncate"
            style={{ display: 'block', maxWidth: '210px', fontSize: '11px', marginTop: '1px' }}
          >
            {p.id} · {p.tipoDocumento || 'NIT'}: {p.nit || '—'} · {p.municipio || p.ciudad || 'Medellín'}
            {p.departamento ? `, ${p.departamento}` : ''}
          </small>
        </div>
      ),
    },
    {
      clave: 'contacto',
      titulo: 'Contacto comercial',
      ancho: '180px',
      render: (p) => (
        <div>
          <strong style={{ fontSize: '12px' }}>{p.contacto}</strong>
          <small className="cell-sub" style={{ display: 'block', fontSize: '11px', marginTop: '1px' }}>
            {p.correo}
          </small>
        </div>
      ),
    },
    { clave: 'telefono', titulo: 'Teléfono', ancho: '130px' },
    {
      clave: 'productos',
      titulo: 'Insumos y materiales que suministra',
      render: (p) => <span className="sm" style={{ fontSize: '12px' }}>{p.productos}</span>,
    },
  ]

  const columnasMovimientos = [
    {
      clave: 'fecha',
      titulo: 'Fecha y hora',
      ancho: '130px',
      render: (mv) => (
        <div>
          <strong style={{ fontSize: '12px' }}>{mv.fecha}</strong>
          <small className="cell-sub" style={{ display: 'block', fontSize: '11px' }}>{mv.hora || '09:00'}</small>
        </div>
      ),
    },
    {
      clave: 'tipo',
      titulo: 'Tipo',
      ancho: '95px',
      render: (mv) => (
        <StatusBadge
          estado={mv.tipo === 'Entrada' ? 'Aprobado' : 'En proceso'}
          texto={mv.tipo}
        />
      ),
    },
    {
      clave: 'material',
      titulo: 'Material y observación',
      minAncho: '180px',
      render: (mv) => (
        <div>
          <strong style={{ fontSize: '12.5px' }}>{mv.material}</strong>
          <small
            className="cell-sub cell-truncate"
            style={{ display: 'block', maxWidth: '260px', fontSize: '11px', marginTop: '1px' }}
            title={mv.observacion}
          >
            {mv.observacion}
          </small>
        </div>
      ),
    },
    {
      clave: 'cantidad',
      titulo: 'Cantidad',
      ancho: '110px',
      render: (mv) => (
        <strong style={{ fontSize: '12px' }}>
          {mv.tipo === 'Entrada' ? '+' : '-'}{mv.cantidad} {mv.unidad || ''}
        </strong>
      ),
    },
    {
      clave: 'costoTotal',
      titulo: 'Valor estimado',
      ancho: '125px',
      render: (mv) => <strong style={{ fontSize: '12px' }}>{formatoCOP(mv.costoTotal || 0)}</strong>,
    },
    {
      clave: 'ordenId',
      titulo: 'Orden vinculada',
      ancho: '140px',
      render: (mv) =>
        mv.ordenId ? (
          <button className="link-inline" onClick={() => irA('detalle', mv.ordenId)} title="Ver orden vinculada">
            <strong>{mv.ordenId}</strong>
          </button>
        ) : (
          <span className="muted sm" style={{ fontSize: '11px' }}>Abastecimiento almacén</span>
        ),
    },
    { clave: 'responsable', titulo: 'Responsable', ancho: '125px' },
  ]

  return (
    <div>
      <PageHeader
        etiqueta="ABASTECIMIENTO · CONTROL DE INSUMOS Y COSTOS"
        titulo="Inventario de materiales y proveedores"
        subtitulo="Control de existencias, alertas de stock mínimo, proveedores, costos de materiales y movimientos de planta."
        icono="package"
        compacto={true}
        acciones={
          <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
            {puedeInforme && (
              <button
                className="btn btn-soft btn-sm"
                onClick={() => {
                  generarReporteInventarioPDF(data)
                  actions.notify('Informe de inventario y materiales (PDF) descargado.', 'exito')
                }}
              >
                <Icon nombre="download" tamano={13} /> Informe PDF
              </button>
            )}
            {puedeOperar && (
              <>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    setErrores({})
                    setFormProveedor(FORM_PROVEEDOR_VACIO)
                    setModalProveedor(true)
                  }}
                >
                  <Icon nombre="users" tamano={13} /> + Proveedor
                </button>
                <button
                  className="btn btn-soft btn-sm"
                  onClick={() => {
                    setErrores({})
                    setFormMovimiento({
                      ...FORM_MOVIMIENTO_VACIO,
                      materialId: materiales[0]?.id || '',
                    })
                    setModalMovimiento(true)
                  }}
                >
                  <Icon nombre="refresh" tamano={13} /> Movimiento
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setErrores({})
                    setFormMaterial({
                      ...FORM_MATERIAL_VACIO,
                      proveedorId: proveedores[0]?.id || '',
                    })
                    setModalMaterial(true)
                  }}
                >
                  <Icon nombre="plus" tamano={13} /> Nuevo material
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Alertas de pocas existencias */}
      {enAlerta.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <Alert
            tipo="aviso"
            titulo={`Alerta de inventario: ${enAlerta.length} ${
              enAlerta.length === 1 ? 'material tiene' : 'materiales tienen'
            } pocas existencias`}
          >
            Revisa y programa reposición con el proveedor para evitar bloqueos en órdenes de taller:{' '}
            {enAlerta.map((m) => (
              <strong key={m.id} style={{ marginRight: '10px' }}>
                {m.nombre} ({m.stockActual}/{m.stockMinimo} {m.unidad})
              </strong>
            ))}
          </Alert>
        </div>
      )}

      {/* 4 Indicadores clave de Inventario con redirección directa */}
      <div className="kpis" style={{ marginBottom: '16px' }}>
        <StatCard
          titulo="Alertas de bajo stock"
          valor={enAlerta.length}
          icono="alert-triangle"
          color={enAlerta.length > 0 ? 'rojo' : 'verde'}
          detalle={enAlerta.length > 0 ? 'Requieren reposición inmediata' : 'Niveles óptimos en almacén'}
          compacta={true}
          onClick={() => setTab('materiales')}
        />
        <StatCard
          titulo="Valor stock disponible"
          valor={formatoCOP(valorDisponibleTotal)}
          icono="package"
          color="azul"
          detalle={`${materiales.length} materiales · Utilizado: ${formatoCOP(valorUtilizadoTotal)}`}
          compacta={true}
          onClick={() => setTab('materiales')}
        />
        <StatCard
          titulo="Proveedores registrados"
          valor={proveedores.length}
          icono="users"
          color="azul"
          detalle="Directorio de abastecimiento"
          compacta={true}
          onClick={() => setTab('proveedores')}
        />
        <StatCard
          titulo="Movimientos de planta"
          valor={movimientos.length}
          icono="clock"
          color="verde"
          detalle="Entradas y consumos en órdenes"
          compacta={true}
          onClick={() => setTab('movimientos')}
        />
      </div>

      {/* Pestañas del módulo */}
      <div className="tabs" role="tablist" style={{ marginBottom: '14px' }}>
        <button className={tab === 'materiales' ? 'on' : ''} onClick={() => setTab('materiales')}>
          <Icon nombre="package" tamano={14} /> Materiales y existencias <span className="pill">{materiales.length}</span>
        </button>
        <button className={tab === 'proveedores' ? 'on' : ''} onClick={() => setTab('proveedores')}>
          <Icon nombre="users" tamano={14} /> Proveedores <span className="pill">{proveedores.length}</span>
        </button>
        <button className={tab === 'movimientos' ? 'on' : ''} onClick={() => setTab('movimientos')}>
          <Icon nombre="clock" tamano={14} /> Entradas y salidas <span className="pill">{movimientos.length}</span>
        </button>
      </div>

      {tab === 'materiales' && (
        <DataTable
          columnas={puedeOperar ? columnasMateriales : columnasMateriales.filter((c) => c.clave !== 'acciones')}
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
                <div className="field">
                  <label className="field-label" htmlFor="provTipoDoc">Tipo de identificación</label>
                  <select
                    id="provTipoDoc"
                    value={formProveedor.tipoDocumento}
                    onChange={(e) => setFormProveedor({ ...formProveedor, tipoDocumento: e.target.value })}
                  >
                    {TIPOS_DOCUMENTO.map((td) => (
                      <option key={td} value={td}>{td}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="provNit">Número de documento / NIT</label>
                  <input
                    id="provNit"
                    value={formProveedor.nit}
                    onChange={(e) => setFormProveedor({ ...formProveedor, nit: e.target.value })}
                    placeholder="Ej. 900.567.890-1"
                  />
                </div>
                <div className={`field ${errores.nombre ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provNombre">Empresa proveedora *</label>
                  <input
                    id="provNombre"
                    value={formProveedor.nombre}
                    onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                    placeholder="Ej. Distribuidora Gráfica del Norte"
                  />
                  {errores.nombre && <span className="field-error">{errores.nombre}</span>}
                </div>
                <div className={`field ${errores.contacto ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provContacto">Contacto comercial *</label>
                  <input
                    id="provContacto"
                    value={formProveedor.contacto}
                    onChange={(e) => setFormProveedor({ ...formProveedor, contacto: e.target.value })}
                    placeholder="Ej. Andrés Mejía"
                  />
                  {errores.contacto && <span className="field-error">{errores.contacto}</span>}
                </div>
                <div className={`field ${errores.telefono ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provTel">Teléfono *</label>
                  <input
                    id="provTel"
                    value={formProveedor.telefono}
                    onChange={(e) => setFormProveedor({ ...formProveedor, telefono: e.target.value })}
                    placeholder="Ej. 312 450 9988"
                  />
                  {errores.telefono && <span className="field-error">{errores.telefono}</span>}
                </div>
                <div className={`field ${errores.correo ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provCorreo">Correo electrónico *</label>
                  <input
                    id="provCorreo"
                    type="email"
                    value={formProveedor.correo}
                    onChange={(e) => setFormProveedor({ ...formProveedor, correo: e.target.value })}
                    placeholder="comercial@proveedor.co"
                  />
                  {errores.correo && <span className="field-error">{errores.correo}</span>}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="provPais">País</label>
                  <select
                    id="provPais"
                    value={formProveedor.pais}
                    onChange={(e) => handleCambioPaisProveedor(e.target.value)}
                  >
                    {PAISES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="provDepto">Departamento</label>
                  <select
                    id="provDepto"
                    value={formProveedor.departamento}
                    onChange={(e) => handleCambioDeptoProveedor(e.target.value)}
                  >
                    {departamentosProveedor.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="provMuni">Municipio / Ciudad</label>
                  <select
                    id="provMuni"
                    value={formProveedor.municipio}
                    onChange={(e) =>
                      setFormProveedor({
                        ...formProveedor,
                        municipio: e.target.value,
                        ciudad: e.target.value,
                      })
                    }
                  >
                    {municipiosProveedor.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className={`field full ${errores.productos ? 'has-error' : ''}`}>
                  <label className="field-label" htmlFor="provProd">Productos que suministra *</label>
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
