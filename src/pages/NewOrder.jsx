import { useState, useMemo, useEffect } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import Alert from '../components/Alert.jsx'
import Modal from '../components/Modal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import {
  FECHA_DEMO,
  formatearFecha,
  formatoCOP,
  formatearFechaBogota,
  formatearHoraBogota,
} from '../utils/format.js'
import {
  CATALOGO_PRODUCTOS,
  CATALOGO_MATERIALES,
  CATALOGO_DIMENSIONES,
  CATALOGO_ACABADOS,
  PRIORIDADES,
  METODOS_ENTREGA,
} from '../data/catalogos.js'
import {
  validarDimensiones,
  MENSAJE_ERROR_DIMENSIONES,
} from '../utils/validacionesDimensiones.js'
import {
  SERVICIOS_ADICIONALES_DEMO,
  AVISO_DATOS_DEMO,
} from '../data/preciosDemo.js'
import {
  calcularCotizacion,
  formatearResumenCotizacion,
} from '../utils/cotizador.js'

export const MEDIOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo en caja' },
  { id: 'Nequi', label: 'Nequi' },
  { id: 'Daviplata', label: 'Daviplata' },
  { id: 'transferencia', label: 'Transferencia (Bancolombia/PSE)' },
  { id: 'tarjeta', label: 'Tarjeta débito / crédito' },
  { id: 'otros', label: 'Otros / Cheque corporativo' },
]

const formVacio = {
  clienteId: '',
  producto: CATALOGO_PRODUCTOS[0],
  cantidad: '1',
  dimensionesPreset: CATALOGO_DIMENSIONES[0],
  dimensionesPersonalizada: '',
  material: CATALOGO_MATERIALES[0],
  prioridad: 'Media',
  metodoEntrega: METODOS_ENTREGA[0],
  acabadosSeleccionados: ['Corte y empaque estándar'],
  acabadosDetalle: '',
  fechaEntrega: '',
  presupuesto: '',
  requerimientos: '',
  observaciones: '',
  modalidadDiseno: 'huellas', // 'huellas' | 'cliente'
  archivosReferencia: [],
  tipoPago: 'sin_pago', // 'sin_pago' | 'parcial' | 'completo'
  pagos: [],
  // Precios y cotización automática en tiempo real
  serviciosAdicionales: [],
  incluirIva: true,
  descuentoPct: 0,
  modoCotizacionManual: false,
}

const FORMATOS_PERMITIDOS = ['png', 'jpg', 'jpeg', 'pdf', 'svg', 'webp', 'ai', 'psd', 'doc', 'docx']

// Fecha mínima permitida (aaaa-mm-dd) a partir de la fecha de referencia del sistema
function fechaMinima() {
  const d = new Date(FECHA_DEMO)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function formatearTamano(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return 'Archivo adjunto'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Validación modular por etapas para el wizard comercial
export function validarEtapa(etapa, f) {
  const e = {}

  if (etapa === 1) {
    if (!f.clienteId) {
      e.clienteId = 'Selecciona un cliente de la lista.'
    }
    if (!f.producto) {
      e.producto = 'Selecciona el tipo de producto publicitario.'
    }
    const cant = Number(f.cantidad)
    if (!f.cantidad || isNaN(cant) || cant <= 0 || !Number.isInteger(cant)) {
      e.cantidad = 'Ingresa una cantidad válida (número entero mayor a 0, ej: 10).'
    }
    if (!f.prioridad) {
      e.prioridad = 'Selecciona la prioridad comercial (Alta, Media o Baja).'
    }
  }

  if (etapa === 2) {
    if (!f.material || !f.material.trim()) {
      e.material = 'Selecciona o indica el material técnico (ej: Lona banner 13 oz).'
    }

    if (f.dimensionesPreset === 'Medida personalizada') {
      const dimPers = (f.dimensionesPersonalizada || '').trim()
      if (!dimPers) {
        e.dimensionesPersonalizada = 'Especifica las medidas (ancho x alto, ej: 1.20 x 2.00 m o 9 x 5 cm).'
      } else if (!validarDimensiones(dimPers)) {
        e.dimensionesPersonalizada = MENSAJE_ERROR_DIMENSIONES
      }
    } else {
      if (!f.dimensionesPreset || !f.dimensionesPreset.trim()) {
        e.dimensionesPreset = 'Selecciona un formato o elige "Medida personalizada".'
      } else if (!validarDimensiones(f.dimensionesPreset)) {
        e.dimensionesPreset = MENSAJE_ERROR_DIMENSIONES
      }
    }

    if (!f.metodoEntrega) {
      e.metodoEntrega = 'Selecciona el método de entrega acordado.'
    }

    if (!f.fechaEntrega) {
      e.fechaEntrega = 'Selecciona la fecha límite de entrega acordada.'
    } else if (f.fechaEntrega < fechaMinima()) {
      e.fechaEntrega = 'La fecha de entrega no puede ser anterior a la fecha de hoy.'
    }

    if (f.modalidadDiseno === 'cliente' && (!f.archivosReferencia || f.archivosReferencia.length === 0)) {
      e.archivosReferencia = 'Debes adjuntar el archivo de diseño final suministrado por el cliente para revisión técnica.'
    }
  }

  if (etapa === 3) {
    // Validación financiera
    const presNum = Number(f.presupuesto)
    if (f.presupuesto === '' || isNaN(presNum) || presNum < 0) {
      e.presupuesto = 'Ingresa un valor total válido para la cotización en COP (0 o más, ej: 350000).'
    }

    const totalCot = Math.max(0, presNum || 0)
    const pagos = Array.isArray(f.pagos) ? f.pagos : []
    const totalAbonado = f.tipoPago === 'sin_pago' ? 0 : pagos.reduce((sum, p) => sum + (Number(p.valor) || 0), 0)

    if (f.tipoPago === 'completo') {
      if (totalCot <= 0) {
        e.pagos = 'Para registrar pago completo, el valor de la cotización debe ser mayor a $0.'
      } else if (totalAbonado < totalCot) {
        e.pagos = `El pago completo debe cubrir el 100% de la cotización (${formatoCOP(totalCot)}). Total abonado: ${formatoCOP(totalAbonado)}.`
      } else if (totalAbonado > totalCot) {
        e.pagos = `El total de abonos (${formatoCOP(totalAbonado)}) excede el valor total cotizado (${formatoCOP(totalCot)}).`
      }
    } else if (f.tipoPago === 'parcial') {
      if (pagos.length === 0 || totalAbonado <= 0) {
        e.pagos = 'Debes registrar al menos un abono mayor a $0 en modalidad de abono parcial.'
      } else if (totalAbonado > totalCot) {
        e.pagos = `El total de abonos (${formatoCOP(totalAbonado)}) no puede superar la cotización (${formatoCOP(totalCot)}).`
      } else if (totalAbonado >= totalCot && totalCot > 0) {
        e.pagos = 'Los abonos cubren el 100% de la cotización. Selecciona la modalidad "Pago completo".'
      }
    }

    if (f.tipoPago !== 'sin_pago') {
      pagos.forEach((p, idx) => {
        const v = Number(p.valor)
        if (!p.valor || isNaN(v) || v <= 0) {
          e[`abono_valor_${p.id || idx}`] = 'El valor del abono debe ser mayor a $0.'
        }
        if (!p.metodo) {
          e[`abono_metodo_${p.id || idx}`] = 'Selecciona el medio de pago.'
        }
      })
    }
  }

  return e
}

// Validación global completa (suma de todas las etapas)
function validar(f) {
  return {
    ...validarEtapa(1, f),
    ...validarEtapa(2, f),
    ...validarEtapa(3, f),
  }
}

// Formulario para registrar una solicitud de cliente estructurado en 3 etapas ergonómicas
export default function NewOrder({ clients, onSubmit, irA, clienteInicialId }) {
  const [etapaActual, setEtapaActual] = useState(1) // 1: Cliente/Pedido, 2: Especificaciones/Entrega, 3: Instrucciones/Confirmación
  const [etapaMax, setEtapaMax] = useState(1)
  const [form, setForm] = useState(() => ({
    ...formVacio,
    clienteId: clienteInicialId && clients.some((c) => c.id === clienteInicialId) ? clienteInicialId : '',
  }))
  const [errores, setErrores] = useState({})
  const [confirmar, setConfirmar] = useState(false)
  const [archivoPreview, setArchivoPreview] = useState(null)

  // Cálculos financieros y cotización automática en tiempo real
  const cotizacionDinamica = useMemo(() => {
    const dimTexto =
      form.dimensionesPreset === 'Medida personalizada'
        ? form.dimensionesPersonalizada
        : form.dimensionesPreset

    const todosAcabados = [
      ...form.acabadosSeleccionados,
      form.acabadosDetalle?.trim(),
    ].filter(Boolean)

    return calcularCotizacion({
      producto: form.producto,
      material: form.material,
      dimensiones: dimTexto,
      cantidad: form.cantidad,
      acabados: todosAcabados,
      servicios: form.serviciosAdicionales || [],
      incluirIva: form.incluirIva,
      descuentoPct: form.descuentoPct,
    })
  }, [
    form.producto,
    form.material,
    form.dimensionesPreset,
    form.dimensionesPersonalizada,
    form.cantidad,
    form.acabadosSeleccionados,
    form.acabadosDetalle,
    form.serviciosAdicionales,
    form.incluirIva,
    form.descuentoPct,
  ])

  // Sincronizar automáticamente el valor cotizado con el cálculo en tiempo real
  useEffect(() => {
    if (!form.modoCotizacionManual && cotizacionDinamica.total > 0) {
      setForm((prev) => {
        if (prev.modoCotizacionManual) return prev
        const totalStr = String(cotizacionDinamica.total)
        if (prev.presupuesto === totalStr) return prev
        return { ...prev, presupuesto: totalStr }
      })
    }
  }, [cotizacionDinamica.total, form.modoCotizacionManual])

  const valorCotizacionNum = Math.max(0, Number(form.presupuesto) || 0)
  const totalAbonado = form.tipoPago === 'sin_pago'
    ? 0
    : (form.pagos || []).reduce((acc, p) => acc + (Number(p.valor) || 0), 0)
  const saldoPendiente = Math.max(0, valorCotizacionNum - totalAbonado)
  const estadoPago = valorCotizacionNum > 0 && saldoPendiente === 0
    ? 'Pagado'
    : (totalAbonado > 0 ? 'Abono parcial' : 'Pendiente de pago')

  function handleToggleServicio(servicioId) {
    setForm((prev) => {
      const actuales = prev.serviciosAdicionales || []
      const existe = actuales.includes(servicioId)
      const nuevos = existe ? actuales.filter((s) => s !== servicioId) : [...actuales, servicioId]
      return { ...prev, serviciosAdicionales: nuevos }
    })
  }

  function enfocarPrimerError(errs, ordenCampos) {
    const primerCampoErr = ordenCampos.find((campo) => errs[campo]) || Object.keys(errs)[0]
    if (primerCampoErr) {
      setTimeout(() => {
        const el = document.getElementById(primerCampoErr)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.focus()
        }
      }, 50)
    }
  }

  function avanzarEtapa(siguiente) {
    // Validar rigurosamente la etapa actual antes de permitir el paso
    const errs = validarEtapa(etapaActual, form)
    if (Object.keys(errs).length > 0) {
      setErrores((prev) => ({ ...prev, ...errs }))
      const orden = etapaActual === 1
        ? ['clienteId', 'producto', 'cantidad', 'prioridad']
        : ['material', form.dimensionesPreset === 'Medida personalizada' ? 'dimensionesPersonalizada' : 'dimensionesPreset', 'metodoEntrega', 'fechaEntrega', 'archivosReferencia']
      enfocarPrimerError(errs, orden)
      return
    }

    // Limpiar errores resueltos de la etapa actual
    setErrores((prev) => {
      const act = { ...prev }
      if (etapaActual === 1) {
        delete act.clienteId
        delete act.producto
        delete act.cantidad
        delete act.prioridad
      } else if (etapaActual === 2) {
        delete act.material
        delete act.dimensionesPreset
        delete act.dimensionesPersonalizada
        delete act.metodoEntrega
        delete act.fechaEntrega
        delete act.archivosReferencia
      }
      return act
    })

    setEtapaActual(siguiente)
    setEtapaMax((prev) => Math.max(prev, siguiente))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function retrocederEtapa(anterior) {
    setEtapaActual(anterior)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleIrAEtapa(num) {
    if (num === etapaActual) return
    if (num < etapaActual) {
      // Regresar siempre está permitido y conserva los datos
      retrocederEtapa(num)
    } else {
      // Si intenta saltar hacia adelante, validar etapa actual
      avanzarEtapa(num)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    const nuevoForm = { ...form, [name]: value }
    if (name === 'presupuesto') {
      nuevoForm.modoCotizacionManual = true
    }
    setForm(nuevoForm)

    // Revalidación reactiva: si el campo tenía error, eliminarlo si el nuevo valor es válido
    if (Object.keys(errores).length > 0) {
      const errsNuevos = validar(nuevoForm)
      setErrores((prev) => {
        const actualizado = { ...prev }
        if (!errsNuevos[name]) {
          delete actualizado[name]
        }
        if (name === 'dimensionesPersonalizada' && !errsNuevos.dimensionesPersonalizada) {
          delete actualizado.dimensionesPersonalizada
        }
        if (name === 'dimensionesPreset') {
          delete actualizado.dimensionesPreset
          if (value !== 'Medida personalizada') {
            delete actualizado.dimensionesPersonalizada
          }
        }
        if (name === 'presupuesto' && !errsNuevos.presupuesto) {
          delete actualizado.presupuesto
          delete actualizado.pagos
        }
        return actualizado
      })
    }
  }

  function handleSeleccionarTipoPago(tipo) {
    const presVal = Math.max(0, Number(form.presupuesto) || 0)
    let nuevosPagos = []

    if (tipo === 'completo') {
      nuevosPagos = [
        {
          id: `PAG-${Date.now()}-1`,
          valor: presVal > 0 ? String(presVal) : '',
          metodo: 'efectivo',
          fecha: formatearFechaBogota(),
          hora: formatearHoraBogota(),
          referencia: '',
          soporte: '',
        },
      ]
    } else if (tipo === 'parcial') {
      const abonoSugerido = presVal > 0 ? Math.round(presVal * 0.5) : ''
      nuevosPagos = [
        {
          id: `PAG-${Date.now()}-1`,
          valor: String(abonoSugerido),
          metodo: 'Nequi',
          fecha: formatearFechaBogota(),
          hora: formatearHoraBogota(),
          referencia: '',
          soporte: '',
        },
      ]
    }

    const nuevoForm = { ...form, tipoPago: tipo, pagos: nuevosPagos }
    setForm(nuevoForm)
    setErrores((prev) => {
      const act = { ...prev }
      delete act.pagos
      return act
    })
  }

  function handleAgregarAbono() {
    const remanente = Math.max(0, valorCotizacionNum - totalAbonado)
    const nuevo = {
      id: `PAG-${Date.now()}-${(form.pagos?.length || 0) + 1}`,
      valor: remanente > 0 ? String(remanente) : '',
      metodo: 'transferencia',
      fecha: formatearFechaBogota(),
      hora: formatearHoraBogota(),
      referencia: '',
      soporte: '',
    }
    setForm((prev) => ({
      ...prev,
      pagos: [...(prev.pagos || []), nuevo],
    }))
    setErrores((prev) => {
      const act = { ...prev }
      delete act.pagos
      return act
    })
  }

  function handleActualizarAbono(id, campo, valor) {
    setForm((prev) => {
      const nuevos = (prev.pagos || []).map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
      return { ...prev, pagos: nuevos }
    })
    setErrores((prev) => {
      const act = { ...prev }
      delete act[`abono_${campo}_${id}`]
      delete act.pagos
      return act
    })
  }

  function handleEliminarAbono(id) {
    setForm((prev) => ({
      ...prev,
      pagos: (prev.pagos || []).filter((p) => p.id !== id),
    }))
  }

  function handleToggleAcabado(acabado) {
    setForm((prev) => {
      const existe = prev.acabadosSeleccionados.includes(acabado)
      const nuevos = existe
        ? prev.acabadosSeleccionados.filter((a) => a !== acabado)
        : [...prev.acabadosSeleccionados, acabado]
      return { ...prev, acabadosSeleccionados: nuevos }
    })
  }

  // Adjuntar archivos de referencia (imágenes, PDF o documentos del cliente)
  function handleArchivosChange(e) {
    const seleccionados = Array.from(e.target.files || [])
    if (seleccionados.length === 0) return

    const erroresArchivo = []
    const promesas = []

    seleccionados.forEach((file) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!FORMATOS_PERMITIDOS.includes(ext)) {
        erroresArchivo.push(`Formato no compatible: ${file.name}`)
        return
      }
      promesas.push(
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nombre: file.name,
              tipo: file.type || ext.toUpperCase(),
              tamano: formatearTamano(file.size),
              fecha: formatearFecha(),
              dataUrl: typeof reader.result === 'string' ? reader.result : '',
            })
          }
          reader.onerror = () => {
            resolve({
              id: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nombre: file.name,
              tipo: file.type || ext.toUpperCase(),
              tamano: formatearTamano(file.size),
              fecha: formatearFecha(),
              dataUrl: '',
            })
          }
          reader.readAsDataURL(file)
        })
      )
    })

    if (erroresArchivo.length > 0) {
      setErrores((prev) => ({ ...prev, archivosReferencia: erroresArchivo.join(', ') }))
    } else {
      setErrores((prev) => ({ ...prev, archivosReferencia: undefined }))
    }

    Promise.all(promesas).then((nuevos) => {
      setForm((prev) => ({
        ...prev,
        archivosReferencia: [...(prev.archivosReferencia || []), ...nuevos],
      }))
    })

    e.target.value = ''
  }

  function quitarArchivo(idArchivo) {
    setForm((prev) => ({
      ...prev,
      archivosReferencia: (prev.archivosReferencia || []).filter((a) => a.id !== idArchivo),
    }))
  }

  function descargarAdjunto(a) {
    if (!a?.dataUrl) return
    const link = document.createElement('a')
    link.href = a.dataUrl
    link.download = a.nombre || 'referencia'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault()

    // Si está en una etapa previa, avanzar en lugar de enviar directamente
    if (etapaActual < 3) {
      avanzarEtapa(etapaActual + 1)
      return
    }

    const errs = validar(form)
    setErrores(errs)
    if (Object.keys(errs).length > 0) {
      // Si hay errores en etapas anteriores, redirigir a esa etapa
      const errEtapa1 = validarEtapa(1, form)
      if (Object.keys(errEtapa1).length > 0) {
        setEtapaActual(1)
        enfocarPrimerError(errEtapa1, ['clienteId', 'producto', 'cantidad', 'prioridad'])
        return
      }
      const errEtapa2 = validarEtapa(2, form)
      if (Object.keys(errEtapa2).length > 0) {
        setEtapaActual(2)
        enfocarPrimerError(errEtapa2, ['material', form.dimensionesPreset === 'Medida personalizada' ? 'dimensionesPersonalizada' : 'dimensionesPreset', 'metodoEntrega', 'fechaEntrega', 'archivosReferencia'])
        return
      }
      enfocarPrimerError(errs, ['presupuesto', 'pagos'])
      return
    }
    setConfirmar(true)
  }

  async function enviar() {
    setConfirmar(false)
    const [anio, mes, dia] = form.fechaEntrega.split('-')
    const cliente = clients.find((c) => c.id === form.clienteId)
    const dimensionesFinal =
      form.dimensionesPreset === 'Medida personalizada'
        ? form.dimensionesPersonalizada.trim()
        : form.dimensionesPreset

    const todosAcabados = [
      ...form.acabadosSeleccionados,
      form.acabadosDetalle.trim(),
    ].filter(Boolean)

    const acabadosFinal = todosAcabados.length > 0 ? todosAcabados.join(', ') : 'Corte y empaque estándar'

    const presFinal = Math.max(0, Number(form.presupuesto) || 0)
    const pagosFinales = form.tipoPago === 'sin_pago' ? [] : (form.pagos || []).map((p) => ({
      id: p.id || `PAG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      valor: Number(p.valor),
      metodo: p.metodo,
      referencia: (p.referencia || '').trim(),
      soporte: (p.soporte || '').trim(),
      fecha: p.fecha || formatearFechaBogota(),
      hora: p.hora || formatearHoraBogota(),
      tipoDocumento: 'Recibo de caja interno (No constituye factura electrónica)',
    }))
    const totalAbonadoFinal = form.tipoPago === 'sin_pago' ? 0 : pagosFinales.reduce((acc, p) => acc + p.valor, 0)
    const saldoPendienteFinal = Math.max(0, presFinal - totalAbonadoFinal)
    const estadoPagoFinal = presFinal > 0 && saldoPendienteFinal === 0
      ? 'Pagado'
      : (totalAbonadoFinal > 0 ? 'Abono parcial' : 'Pendiente de pago')

    try {
      await onSubmit({
        clienteId: form.clienteId,
        cliente: cliente?.nombre || '',
        producto: form.producto,
        cantidad: Number(form.cantidad),
        dimensiones: dimensionesFinal,
        material: form.material,
        prioridad: form.prioridad,
        metodoEntrega: form.metodoEntrega,
        acabados: acabadosFinal,
        fechaEntrega: `${dia}/${mes}/${anio}`,
        presupuesto: presFinal,
        cotizacionTotal: presFinal,
        tipoPago: form.tipoPago,
        estadoPago: estadoPagoFinal,
        totalAbonado: totalAbonadoFinal,
        saldoPendiente: saldoPendienteFinal,
        pagos: pagosFinales,
        requerimientos: form.requerimientos,
        observaciones: form.observaciones.trim()
          ? `${form.observaciones.trim()}\n\n${formatearResumenCotizacion(cotizacionDinamica)}`
          : formatearResumenCotizacion(cotizacionDinamica),
        desgloseCotizacion: cotizacionDinamica.items,
        cotizacionResumen: {
          subtotalNeto: cotizacionDinamica.subtotalNeto,
          ivaMonto: cotizacionDinamica.ivaMonto,
          incluirIva: cotizacionDinamica.incluirIva,
          descuentoPct: cotizacionDinamica.descuentoPct,
          descuentoMonto: cotizacionDinamica.descuentoMonto,
          total: cotizacionDinamica.total,
        },
        modalidadDiseno: form.modalidadDiseno || 'huellas',
        archivosReferencia: (form.archivosReferencia || []).map((a) => ({
          ...a,
          esArteCliente: form.modalidadDiseno === 'cliente' ? true : Boolean(a.esArteCliente),
        })),
      })
    } catch (err) {
      const msg = err.message || err.error || 'Error al registrar la solicitud.'
      const msgLower = msg.toLowerCase()
      const nuevosErr = {}
      let campoEnfocar = null

      if (msgLower.includes('dimensiones')) {
        const campoDim = form.dimensionesPreset === 'Medida personalizada' ? 'dimensionesPersonalizada' : 'dimensionesPreset'
        nuevosErr[campoDim] = msg
        campoEnfocar = campoDim
        setEtapaActual(2)
      } else if (msgLower.includes('cantidad')) {
        nuevosErr.cantidad = msg
        campoEnfocar = 'cantidad'
        setEtapaActual(1)
      } else if (msgLower.includes('presupuesto') || msgLower.includes('cotización')) {
        nuevosErr.presupuesto = msg
        campoEnfocar = 'presupuesto'
        setEtapaActual(3)
      } else if (msgLower.includes('abono') || msgLower.includes('pago')) {
        nuevosErr.pagos = msg
        campoEnfocar = 'presupuesto'
        setEtapaActual(3)
      } else if (msgLower.includes('cliente')) {
        nuevosErr.clienteId = msg
        campoEnfocar = 'clienteId'
        setEtapaActual(1)
      } else if (msgLower.includes('producto')) {
        nuevosErr.producto = msg
        campoEnfocar = 'producto'
        setEtapaActual(1)
      } else if (msgLower.includes('material')) {
        nuevosErr.material = msg
        campoEnfocar = 'material'
        setEtapaActual(2)
      } else if (msgLower.includes('fecha')) {
        nuevosErr.fechaEntrega = msg
        campoEnfocar = 'fechaEntrega'
        setEtapaActual(2)
      }

      if (campoEnfocar) {
        setErrores((prev) => ({ ...prev, ...nuevosErr }))
        setTimeout(() => {
          const el = document.getElementById(campoEnfocar)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.focus()
          }
        }, 50)
      }
    }
  }

  const campo = (nombre, etiqueta, control, ayuda, completo = false) => {
    const tieneError = Boolean(errores[nombre])
    return (
      <div className={`field${tieneError ? ' has-error' : ''}${completo ? ' full' : ''}`}>
        <label className="field-label" htmlFor={nombre}>{etiqueta}</label>
        {control}
        {ayuda && !tieneError && <span className="field-hint">{ayuda}</span>}
        {tieneError && (
          <span className="field-error" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Icon nombre="alert-triangle" tamano={12} /> {errores[nombre]}
          </span>
        )}
      </div>
    )
  }

  const input = (nombre, extra = {}) => (
    <input id={nombre} name={nombre} value={form[nombre]} onChange={handleChange} {...extra} />
  )

  const hayErrores = Object.values(errores).some(Boolean)
  const clienteSeleccionado = clients.find((c) => c.id === form.clienteId)

  // Resumen formateado de dimensiones
  const dimensionesTexto = form.dimensionesPreset === 'Medida personalizada'
    ? (form.dimensionesPersonalizada || 'No especificada')
    : form.dimensionesPreset

  return (
    <div>
      <PageHeader
        titulo="Registrar solicitud comercial"
        subtitulo="Registra la solicitud del cliente mediante un flujo estructurado en tres etapas con control de cotización y abonos en tiempo real."
        icono="file-plus"
        volver={{ texto: 'Volver a solicitudes', onClick: () => irA('solicitudes') }}
      />

      {/* INDICADOR DE PROGRESO EN TRES ETAPAS (STEPPER WIZARD) */}
      <nav className="wizard-nav-card" aria-label="Progreso del formulario de solicitud">
        <div className="wizard-steps">
          {/* ETAPA 1 */}
          <button
            type="button"
            className={`wizard-step-btn${etapaActual === 1 ? ' active' : ''}${etapaMax > 1 ? ' completed' : ''}`}
            onClick={() => handleIrAEtapa(1)}
            aria-current={etapaActual === 1 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">
              {etapaMax > 1 && etapaActual !== 1 ? <Icon nombre="check" tamano={15} /> : '1'}
            </span>
            <div className="wizard-step-content">
              <span className="wizard-step-num">Etapa 1</span>
              <span className="wizard-step-title">Cliente y pedido</span>
              <span className="wizard-step-sub">Cliente, producto, unidades y prioridad</span>
            </div>
          </button>

          {/* ETAPA 2 */}
          <button
            type="button"
            className={`wizard-step-btn${etapaActual === 2 ? ' active' : ''}${etapaMax > 2 ? ' completed' : ''}`}
            onClick={() => handleIrAEtapa(2)}
            aria-current={etapaActual === 2 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">
              {etapaMax > 2 && etapaActual !== 2 ? <Icon nombre="check" tamano={15} /> : '2'}
            </span>
            <div className="wizard-step-content">
              <span className="wizard-step-num">Etapa 2</span>
              <span className="wizard-step-title">Especificaciones y entrega</span>
              <span className="wizard-step-sub">Sustrato, medidas, acabados y archivos</span>
            </div>
          </button>

          {/* ETAPA 3 */}
          <button
            type="button"
            className={`wizard-step-btn${etapaActual === 3 ? ' active' : ''}`}
            onClick={() => handleIrAEtapa(3)}
            aria-current={etapaActual === 3 ? 'step' : undefined}
          >
            <span className="wizard-step-badge">3</span>
            <div className="wizard-step-content">
              <span className="wizard-step-num">Etapa 3</span>
              <span className="wizard-step-title">Instrucciones y confirmación</span>
              <span className="wizard-step-sub">Instrucciones, balance y confirmación</span>
            </div>
          </button>
        </div>
      </nav>

      {hayErrores && (
        <Alert tipo="error" titulo="Revisa la información del formulario">
          Hay campos pendientes o inconsistencias en los valores introducidos. Corrige las alertas para continuar.
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="new-order-layout">
          {/* =======================================================
              COLUMNA PRINCIPAL (68%): ETAPAS ESTRUCTURADAS DEL WIZARD
              ======================================================= */}
          <div className="order-main-column">
            <div className="card form-card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* ===================================================
                  ETAPA 1: CLIENTE Y PEDIDO
                  =================================================== */}
              {etapaActual === 1 && (
                <section aria-labelledby="stage1-title">
                  <header className="stage-head-banner">
                    <div className="stage-head-info">
                      <span className="stage-icon-circle" aria-hidden="true">
                        <Icon nombre="users" tamano={18} />
                      </span>
                      <div>
                        <h2 id="stage1-title">Etapa 1: Cliente y Datos Básicos del Pedido</h2>
                        <p>Selecciona el cliente solicitante, el producto publicitario a elaborar y la prioridad.</p>
                      </div>
                    </div>
                    <span className="stage-badge-pill">Paso 1 de 3</span>
                  </header>

                  <div className="stage-body">
                    {/* Fila 1: Cliente y Producto en 2 columnas */}
                    <div className="stage-grid-2">
                      {campo('clienteId', 'Cliente registrado *',
                        <select id="clienteId" name="clienteId" value={form.clienteId} onChange={handleChange}>
                          <option value="">Selecciona un cliente...</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nombre} {c.nit ? `(${c.nit})` : ''} — {c.municipio || c.ciudad || 'Colombia'}
                            </option>
                          ))}
                        </select>,
                        'Si es un cliente nuevo, regístralo previamente en el módulo Clientes.'
                      )}

                      {campo('producto', 'Tipo de producto publicitario *',
                        <select id="producto" name="producto" value={form.producto} onChange={handleChange}>
                          {CATALOGO_PRODUCTOS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>,
                        'Línea de producción técnica a elaborar.'
                      )}
                    </div>

                    {/* Fila 2: Cantidad y Prioridad en 2 columnas */}
                    <div className="stage-grid-2">
                      {campo('cantidad', 'Cantidad de unidades requeridas *',
                        input('cantidad', { type: 'number', min: 1, step: 1, placeholder: 'Ej: 10' }),
                        'Número entero de ejemplares o piezas a producir.'
                      )}

                      {campo('prioridad', 'Prioridad comercial del pedido *',
                        <select id="prioridad" name="prioridad" value={form.prioridad} onChange={handleChange}>
                          {PRIORIDADES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>,
                        'Determina la atención comercial y la secuencia inicial en taller.'
                      )}
                    </div>

                    {/* Resumen contextual si ya hay un cliente seleccionado */}
                    {clienteSeleccionado && (
                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-light)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Icon nombre="check-circle" tamano={16} />
                          <span style={{ fontSize: '0.82rem', color: 'var(--navy-900)' }}>
                            Cliente seleccionado: <strong>{clienteSeleccionado.nombre}</strong> {clienteSeleccionado.nit ? `· NIT ${clienteSeleccionado.nit}` : ''}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {clienteSeleccionado.telefono || clienteSeleccionado.correo || clienteSeleccionado.ciudad || 'Sin contacto directo'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Etapa 1 */}
                  <footer className="stage-actions-bar">
                    <button type="button" className="btn btn-ghost" onClick={() => irA('solicitudes')}>
                      Cancelar
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => avanzarEtapa(2)}>
                      <span>Continuar a Especificaciones</span>
                      <Icon nombre="arrow-right" tamano={15} />
                    </button>
                  </footer>
                </section>
              )}

              {/* ===================================================
                  ETAPA 2: ESPECIFICACIONES DE PRODUCCIÓN Y ENTREGA
                  =================================================== */}
              {etapaActual === 2 && (
                <section aria-labelledby="stage2-title">
                  <header className="stage-head-banner">
                    <div className="stage-head-info">
                      <span className="stage-icon-circle" aria-hidden="true">
                        <Icon nombre="layers" tamano={18} />
                      </span>
                      <div>
                        <h2 id="stage2-title">Etapa 2: Especificaciones Técnicas y Entrega</h2>
                        <p>Define sustratos, dimensiones, acabados, fecha pactada y archivos suministrados.</p>
                      </div>
                    </div>
                    <span className="stage-badge-pill">Paso 2 de 3</span>
                  </header>

                  <div className="stage-body">
                    {/* Material y Dimensiones en 2 columnas */}
                    <div className="stage-grid-2">
                      {campo('material', 'Sustrato / Material principal *',
                        <select id="material" name="material" value={form.material} onChange={handleChange}>
                          {CATALOGO_MATERIALES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>,
                        'Material base sobre el cual se imprimirá.'
                      )}

                      {campo('dimensionesPreset', 'Formato / Dimensiones *',
                        <select id="dimensionesPreset" name="dimensionesPreset" value={form.dimensionesPreset} onChange={handleChange}>
                          {CATALOGO_DIMENSIONES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>,
                        'Elige formato estándar o personalizada.'
                      )}
                    </div>

                    {/* Si seleccionó medida personalizada */}
                    {form.dimensionesPreset === 'Medida personalizada' && (
                      <div>
                        {campo('dimensionesPersonalizada', 'Especifica las medidas (ancho x alto con unidad) *',
                          input('dimensionesPersonalizada', { placeholder: 'Ej: 1.20 x 2.00 m o 9 x 5 cm' }),
                          'Indica el formato numérico con unidad (ej: 1.20 x 2.00 m, 9 x 5 cm, 6 x 3 m).'
                        )}
                      </div>
                    )}

                    {/* Método de entrega y Fecha límite en 2 columnas */}
                    <div className="stage-grid-2">
                      {campo('metodoEntrega', 'Método de entrega acordado *',
                        <select id="metodoEntrega" name="metodoEntrega" value={form.metodoEntrega} onChange={handleChange}>
                          {METODOS_ENTREGA.map((me) => (
                            <option key={me} value={me}>{me}</option>
                          ))}
                        </select>
                      )}

                      {campo('fechaEntrega', 'Fecha límite de entrega pactada con cliente *',
                        input('fechaEntrega', { type: 'date', min: fechaMinima() }),
                        'Fecha concertada para despacho o entrega final.'
                      )}
                    </div>

                    {/* Acabados y confección gráfica */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      <span className="field-label" style={{ display: 'block', marginBottom: '8px' }}>
                        Acabados y confección gráfica requeridos
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                        {CATALOGO_ACABADOS.map((acabado) => (
                          <label
                            key={acabado}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              padding: '6px 10px',
                              background: 'var(--bg-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-light)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.acabadosSeleccionados.includes(acabado)}
                              onChange={() => handleToggleAcabado(acabado)}
                            />
                            <span>{acabado}</span>
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <input
                          id="acabadosDetalle"
                          name="acabadosDetalle"
                          value={form.acabadosDetalle}
                          onChange={handleChange}
                          placeholder="Otro acabado específico (opcional, ej. Barniz UV sectorizado)..."
                          style={{ fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    {/* Modalidad de diseño y archivos suministrados */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      <label className="field-label" style={{ marginBottom: '8px', fontWeight: 600, display: 'block' }}>
                        Modalidad de diseño del pedido *
                      </label>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '12px',
                          marginBottom: '14px',
                        }}
                      >
                        {/* Opción 1: Huellas elabora diseño */}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${form.modalidadDiseno !== 'cliente' ? 'var(--blue-600)' : 'var(--border-light)'}`,
                            background: form.modalidadDiseno !== 'cliente' ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="modalidadDiseno"
                            value="huellas"
                            checked={form.modalidadDiseno !== 'cliente'}
                            onChange={() => setForm((p) => ({ ...p, modalidadDiseno: 'huellas' }))}
                            style={{ marginTop: '3px' }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.84rem', color: 'var(--navy-900)', display: 'block' }}>
                              Elaboración de diseño por Huellas
                            </strong>
                            <small style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.35', display: 'block', marginTop: '2px' }}>
                              Flujo creativo completo. El diseñador crea las propuestas y versiones gráficas hasta el VoBo formal del cliente.
                            </small>
                          </div>
                        </label>

                        {/* Opción 2: Cliente suministra diseño */}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${form.modalidadDiseno === 'cliente' ? 'var(--blue-600)' : 'var(--border-light)'}`,
                            background: form.modalidadDiseno === 'cliente' ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-subtle)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="modalidadDiseno"
                            value="cliente"
                            checked={form.modalidadDiseno === 'cliente'}
                            onChange={() => setForm((p) => ({ ...p, modalidadDiseno: 'cliente' }))}
                            style={{ marginTop: '3px' }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.84rem', color: 'var(--navy-900)', display: 'block' }}>
                              Cliente suministra diseño terminado
                            </strong>
                            <small style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: '1.35', display: 'block', marginTop: '2px' }}>
                              Revisión técnica de preprensa. Se evita el ciclo creativo y pasa directamente a verificar CMYK, resolución y medidas.
                            </small>
                          </div>
                        </label>
                      </div>

                      {/* Input de archivos */}
                      {campo(
                        'archivosReferencia',
                        form.modalidadDiseno === 'cliente'
                          ? 'Adjuntar archivo final suministrado por el cliente (PDF, AI, PSD, SVG, JPG alta resolución) *'
                          : 'Adjuntar logotipos, bocetos o manual de marca (PNG, JPG, PDF, SVG, AI, PSD)',
                        <input
                          id="archivosReferencia"
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg,.pdf,.svg,.webp,.ai,.psd,.doc,.docx"
                          onChange={handleArchivosChange}
                          style={{ padding: '7px 10px' }}
                        />,
                        form.modalidadDiseno === 'cliente'
                          ? 'El archivo adjunto se asignará a preprensa para verificación técnica antes de impresión.'
                          : 'Archivos de referencia para el equipo de diseño y producción.',
                        true
                      )}

                      {/* Lista de archivos adjuntos */}
                      {form.archivosReferencia.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                            Archivos listos ({form.archivosReferencia.length}):
                          </span>
                          <div className="stack" style={{ gap: '6px' }}>
                            {form.archivosReferencia.map((archivo) => (
                              <div
                                key={archivo.id}
                                className="row"
                                style={{
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  background: 'var(--bg-subtle)',
                                  borderRadius: 'var(--radius-md)',
                                  border: '1px solid var(--border-light)',
                                }}
                              >
                                <div className="row" style={{ gap: '8px' }}>
                                  {archivo.dataUrl && archivo.dataUrl.startsWith('data:image') ? (
                                    <img
                                      src={archivo.dataUrl}
                                      alt={archivo.nombre}
                                      style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                                    />
                                  ) : (
                                    <Icon nombre="paperclip" tamano={15} />
                                  )}
                                  <div>
                                    <strong style={{ fontSize: '0.8rem', display: 'block' }}>{archivo.nombre}</strong>
                                    <small className="cell-sub">{archivo.tipo} · {archivo.tamano}</small>
                                  </div>
                                </div>

                                <div className="row" style={{ gap: '6px' }}>
                                  {archivo.dataUrl && (
                                    <>
                                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArchivoPreview(archivo)}>
                                        <Icon nombre="eye" tamano={13} /> Ver
                                      </button>
                                      <button type="button" className="btn btn-soft btn-sm" onClick={() => descargarAdjunto(archivo)}>
                                        <Icon nombre="download" tamano={13} /> Descargar
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm danger-text"
                                    onClick={() => quitarArchivo(archivo.id)}
                                    title="Quitar archivo"
                                  >
                                    <Icon nombre="x" tamano={13} /> Quitar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PREVIEW EN VIVO DE COTIZACIÓN AUTOMÁTICA */}
                  <div
                    className="card"
                    style={{
                      marginTop: '16px',
                      marginBottom: '16px',
                      padding: '14px 18px',
                      background: 'var(--bg-subtle, #f8fafc)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ display: 'inline-flex', padding: '6px', background: '#dbeafe', borderRadius: '6px', color: '#1d4ed8' }}>
                          <Icon nombre="dollar-sign" tamano={18} />
                        </span>
                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #64748b)', fontWeight: 700 }}>
                            Cotización estimada en tiempo real (Catálogo Demo)
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <strong style={{ fontSize: '1.25rem', color: 'var(--primary, #2563eb)' }}>
                              {formatoCOP(cotizacionDinamica.total)}
                            </strong>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                              ({cotizacionDinamica.items.length} conceptos · {cotizacionDinamica.dimensionesAnalizadas.valido ? `${cotizacionDinamica.dimensionesAnalizadas.areaM2} m²/ud` : 'Estándar'})
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-celeste" style={{ fontSize: '11px', padding: '4px 8px' }}>
                        {cotizacionDinamica.incluirIva ? 'IVA 19% incluido' : 'Sin IVA'}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de la Etapa 2 */}
                  <footer className="stage-actions-bar">
                    <button type="button" className="btn btn-soft" onClick={() => retrocederEtapa(1)}>
                      <Icon nombre="arrow-left" tamano={15} />
                      <span>Anterior (Cliente y pedido)</span>
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => avanzarEtapa(3)}>
                      <span>Continuar a Instrucciones y Confirmación</span>
                      <Icon nombre="arrow-right" tamano={15} />
                    </button>
                  </footer>
                </section>
              )}

              {/* ===================================================
                  ETAPA 3: INSTRUCCIONES Y CONFIRMACIÓN
                  =================================================== */}
              {etapaActual === 3 && (
                <section aria-labelledby="stage3-title">
                  <header className="stage-head-banner">
                    <div className="stage-head-info">
                      <span className="stage-icon-circle" aria-hidden="true">
                        <Icon nombre="check-circle" tamano={18} />
                      </span>
                      <div>
                        <h2 id="stage3-title">Etapa 3: Instrucciones, Revisión y Confirmación</h2>
                        <p>Añade observaciones para taller, revisa los datos capturados y guarda la solicitud.</p>
                      </div>
                    </div>
                    <span className="stage-badge-pill">Paso 3 de 3</span>
                  </header>

                  <div className="stage-body">
                    {/* Instrucciones y Observaciones en 2 columnas */}
                    <div className="stage-grid-2">
                      {campo('requerimientos', 'Requerimientos técnicos de preprensa y diseño',
                        <textarea
                          id="requerimientos"
                          name="requerimientos"
                          rows="3"
                          value={form.requerimientos}
                          onChange={handleChange}
                          placeholder="Ej: Logo vectorizado, inclusión de código QR, colores corporativos pantone..."
                        />,
                        'Instrucciones operativas para el diseñador y taller.',
                        false
                      )}

                      {campo('observaciones', 'Observaciones comerciales y de logística',
                        <textarea
                          id="observaciones"
                          name="observaciones"
                          rows="3"
                          value={form.observaciones}
                          onChange={handleChange}
                          placeholder="Ej: Entregar en horario matutino en sede administrativa, factura con orden de compra..."
                        />,
                        'Notas de facturación, empaque o entrega.',
                        false
                      )}
                    </div>

                    {/* Resumen de verificación integral de la solicitud */}
                    <div className="stage-summary-card">
                      <div className="stage-summary-title">
                        <span>Resumen integral de la solicitud a registrar</span>
                        <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          Verifica los datos antes de guardar
                        </span>
                      </div>

                      <div className="stage-summary-grid">
                        <div className="stage-summary-item">
                          <span className="lbl">Cliente</span>
                          <strong className="val">{clienteSeleccionado?.nombre || 'No seleccionado'}</strong>
                        </div>
                        <div className="stage-summary-item">
                          <span className="lbl">Producto</span>
                          <strong className="val">{form.producto} ({form.cantidad} unidades)</strong>
                        </div>
                        <div className="stage-summary-item">
                          <span className="lbl">Sustrato / Dimensiones</span>
                          <strong className="val">{form.material} · {dimensionesTexto}</strong>
                        </div>
                        <div className="stage-summary-item">
                          <span className="lbl">Prioridad / Entrega</span>
                          <strong className="val">{form.prioridad} · {form.fechaEntrega || 'Sin fecha'} ({form.metodoEntrega})</strong>
                        </div>
                        <div className="stage-summary-item">
                          <span className="lbl">Modalidad de diseño</span>
                          <strong className="val">
                            {form.modalidadDiseno === 'cliente'
                              ? `Arte del cliente (${form.archivosReferencia.length} adjuntos)`
                              : 'Flujo creativo Huellas'}
                          </strong>
                        </div>
                        <div className="stage-summary-item">
                          <span className="lbl">Balance cotización</span>
                          <strong className="val" style={{ color: 'var(--blue-700)' }}>
                            {formatoCOP(valorCotizacionNum)} ({estadoPago})
                          </strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => retrocederEtapa(1)}>
                          <Icon nombre="edit" tamano={13} /> Modificar cliente o producto
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => retrocederEtapa(2)}>
                          <Icon nombre="edit" tamano={13} /> Modificar especificaciones o archivos
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Etapa 3 */}
                  <footer className="stage-actions-bar">
                    <button type="button" className="btn btn-soft" onClick={() => retrocederEtapa(2)}>
                      <Icon nombre="arrow-left" tamano={15} />
                      <span>Anterior (Especificaciones)</span>
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                      <Icon nombre="check" tamano={16} />
                      <span>Registrar y guardar solicitud</span>
                    </button>
                  </footer>
                </section>
              )}
            </div>
          </div>

          {/* =======================================================
              COLUMNA DERECHA (32%): PANEL DE COTIZACIÓN Y PAGOS
              ======================================================= */}
          <aside className="quote-sidebar-column">
            <div className="card quote-card">
              <div className="quote-card-header">
                <div className="quote-card-title">
                  <Icon nombre="dollar-sign" tamano={18} />
                  <span>Cotización y pagos</span>
                </div>
                <StatusBadge estado={estadoPago} />
              </div>

              {/* BANNER INFORMATIVO DE PRECIOS DE SIMULACIÓN */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  marginBottom: '12px',
                  fontSize: '11px',
                  color: '#1e40af',
                  lineHeight: '1.4',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '2px' }}>
                  <Icon nombre="info" tamano={13} />
                  <span>Cálculo automático (Tarifas demo)</span>
                </div>
                <span>Valores de simulación según medidas, producto y acabados. Tarifas oficiales pendientes por Huellas Publicidad.</span>
              </div>

              {/* DESGLOSE EN TIEMPO REAL DE CONCEPTOS CALCULADOS */}
              <div
                style={{
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '6px',
                  background: '#fff',
                  marginBottom: '14px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-subtle, #f8fafc)',
                    padding: '8px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  }}
                >
                  <span>Concepto / Medidas</span>
                  <span>Subtotal</span>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {cotizacionDinamica.items.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '11px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{it.concepto}</div>
                        <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '10px' }}>
                          {it.detalle}
                        </div>
                        <div style={{ color: '#0369a1', fontSize: '10px', fontWeight: 500, marginTop: '1px' }}>
                          {it.cantidad} {it.unidadMedida} x {formatoCOP(it.precioUnitario)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {formatoCOP(it.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* SERVICIOS ADICIONALES CONFIGURABLES */}
                <div style={{ padding: '8px 10px', background: '#fafafa', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Icon nombre="tool" tamano={12} /> Servicios adicionales:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {SERVICIOS_ADICIONALES_DEMO.map((srv) => {
                      const activo = (form.serviciosAdicionales || []).includes(srv.id)
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => handleToggleServicio(srv.id)}
                          className={`btn btn-sm ${activo ? 'btn-primary' : 'btn-outline'}`}
                          style={{
                            fontSize: '10px',
                            padding: '3px 7px',
                            fontWeight: activo ? 700 : 500,
                          }}
                          title={srv.desc}
                        >
                          {activo ? '✓ ' : '+ '}{srv.nombre} ({formatoCOP(srv.tarifa)})
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* OPCIONES DE IVA Y DESCUENTO */}
                <div
                  style={{
                    padding: '8px 10px',
                    background: '#f8fafc',
                    borderTop: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={form.incluirIva}
                      onChange={(e) => setForm((prev) => ({ ...prev, incluirIva: e.target.checked }))}
                      style={{ width: '14px', height: '14px' }}
                    />
                    <span>IVA (19%)</span>
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="muted">Dcto:</span>
                    <select
                      value={form.descuentoPct || 0}
                      onChange={(e) => setForm((prev) => ({ ...prev, descuentoPct: Number(e.target.value) }))}
                      style={{ fontSize: '11px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value={0}>0%</option>
                      <option value={3}>3%</option>
                      <option value={5}>5%</option>
                      <option value={8}>8%</option>
                      <option value={10}>10%</option>
                    </select>
                  </div>
                </div>

                {/* RESUMEN DE TOTALES CALCULADOS */}
                <div style={{ padding: '8px 10px', background: '#fff', borderTop: '1px solid var(--border-color, #e2e8f0)', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span className="muted">Subtotal neto:</span>
                    <span>{formatoCOP(cotizacionDinamica.subtotalNeto)}</span>
                  </div>
                  {cotizacionDinamica.descuentoMonto > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--state-green, #16a34a)', marginBottom: '2px' }}>
                      <span>Descuento ({cotizacionDinamica.descuentoPct}%):</span>
                      <span>-{formatoCOP(cotizacionDinamica.descuentoMonto)}</span>
                    </div>
                  )}
                  {cotizacionDinamica.incluirIva && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span className="muted">IVA (19%):</span>
                      <span>+{formatoCOP(cotizacionDinamica.ivaMonto)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '12px',
                      paddingTop: '4px',
                      borderTop: '1px dashed #cbd5e1',
                      marginTop: '4px',
                    }}
                  >
                    <span>Total sugerido en vivo:</span>
                    <span style={{ color: 'var(--primary, #2563eb)' }}>{formatoCOP(cotizacionDinamica.total)}</span>
                  </div>
                </div>
              </div>

              {/* VALOR TOTAL COTIZADO */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="field-label" htmlFor="presupuesto" style={{ marginBottom: 0 }}>
                    Valor total cotizado (COP) *
                  </label>
                  {form.modoCotizacionManual ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          modoCotizacionManual: false,
                          presupuesto: String(cotizacionDinamica.total),
                        }))
                      }
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '10px', padding: '1px 6px', color: 'var(--primary, #2563eb)' }}
                      title="Restablecer al total sugerido por el catálogo"
                    >
                      <Icon nombre="refresh-cw" tamano={10} /> Auto-sincronizar
                    </button>
                  ) : (
                    <span className="badge badge-verde" style={{ fontSize: '9px', padding: '2px 5px' }}>
                      ✓ Sincronizado
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="presupuesto"
                    name="presupuesto"
                    type="number"
                    min="0"
                    step="1000"
                    value={form.presupuesto}
                    onChange={handleChange}
                    placeholder="Ej. 350000"
                    className={`form-control${errores.presupuesto ? ' is-invalid' : ''}`}
                    style={{ fontWeight: 600, fontSize: '1rem', paddingRight: '40px' }}
                  />
                </div>
                {errores.presupuesto ? (
                  <span className="field-error" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Icon nombre="alert-triangle" tamano={12} /> {errores.presupuesto}
                  </span>
                ) : (
                  <span className="field-hint">
                    Equivale a: <strong>{formatoCOP(valorCotizacionNum)}</strong>
                  </span>
                )}
              </div>

              {/* MODALIDAD DE PAGO */}
              <div className="field">
                <label className="field-label">Modalidad de pago</label>
                <div className="quote-payment-modes" role="group" aria-label="Modalidad de pago">
                  <button
                    type="button"
                    className={`quote-mode-btn${form.tipoPago === 'sin_pago' ? ' active' : ''}`}
                    onClick={() => handleSeleccionarTipoPago('sin_pago')}
                  >
                    Sin pago
                  </button>
                  <button
                    type="button"
                    className={`quote-mode-btn${form.tipoPago === 'parcial' ? ' active' : ''}`}
                    onClick={() => handleSeleccionarTipoPago('parcial')}
                  >
                    Abono parcial
                  </button>
                  <button
                    type="button"
                    className={`quote-mode-btn${form.tipoPago === 'completo' ? ' active' : ''}`}
                    onClick={() => handleSeleccionarTipoPago('completo')}
                  >
                    Pago completo
                  </button>
                </div>
              </div>

              {/* RESUMEN FINANCIERO (KPIs EN TIEMPO REAL) */}
              <div className="quote-kpis-grid">
                <div className="quote-kpi-row">
                  <span className="muted">Total cotización:</span>
                  <strong>{formatoCOP(valorCotizacionNum)}</strong>
                </div>
                <div className="quote-kpi-row">
                  <span className="muted">Total abonado:</span>
                  <strong style={{ color: totalAbonado > 0 ? 'var(--state-green, #16a34a)' : 'inherit' }}>
                    {formatoCOP(totalAbonado)}
                  </strong>
                </div>
                <div className="quote-kpi-row saldo-destacado">
                  <span>Saldo pendiente:</span>
                  <span style={{ color: saldoPendiente > 0 ? 'var(--state-red, #dc2626)' : 'var(--state-green, #16a34a)' }}>
                    {formatoCOP(saldoPendiente)}
                  </span>
                </div>
              </div>

              {/* ERROR GLOBAL DE PAGOS */}
              {errores.pagos && (
                <div className="field-error" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                  <Icon nombre="alert-triangle" tamano={13} />
                  <span>{errores.pagos}</span>
                </div>
              )}

              {/* REGISTRO DE ABONOS Y PAGOS MIXTOS */}
              {form.tipoPago !== 'sin_pago' && (
                <div className="quote-abonos-container">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="field-label" style={{ margin: 0 }}>
                      Registro de comprobantes / abonos ({form.pagos.length}):
                    </label>
                  </div>

                  <div className="stack" style={{ gap: '10px' }}>
                    {form.pagos.map((abono, idx) => {
                      const errValor = errores[`abono_valor_${abono.id || idx}`]
                      return (
                        <div key={abono.id || idx} className="quote-abono-item">
                          <div className="quote-abono-header">
                            <span>Abono #{idx + 1}</span>
                            {form.pagos.length > 1 && (
                              <button
                                type="button"
                                className="icon-btn danger-text"
                                style={{ padding: '2px', fontSize: '11px' }}
                                onClick={() => handleEliminarAbono(abono.id)}
                                title="Eliminar este abono"
                              >
                                <Icon nombre="trash-2" tamano={13} />
                              </button>
                            )}
                          </div>

                          {/* Medio de pago y Monto */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="field">
                              <label className="field-label" style={{ fontSize: '0.74rem' }}>Medio de pago</label>
                              <select
                                value={abono.metodo}
                                onChange={(e) => handleActualizarAbono(abono.id, 'metodo', e.target.value)}
                                style={{ fontSize: '12px', padding: '6px 8px' }}
                              >
                                {MEDIOS_PAGO.map((m) => (
                                  <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                              </select>
                            </div>

                            <div className={`field${errValor ? ' has-error' : ''}`}>
                              <label className="field-label" style={{ fontSize: '0.74rem' }}>Monto (COP) *</label>
                              <input
                                type="number"
                                min="1"
                                step="1000"
                                value={abono.valor}
                                onChange={(e) => handleActualizarAbono(abono.id, 'valor', e.target.value)}
                                placeholder="Monto"
                                className={`form-control${errValor ? ' is-invalid' : ''}`}
                                style={{ fontSize: '12px', padding: '6px 8px', fontWeight: 600 }}
                              />
                            </div>
                          </div>

                          {/* Referencia y Timestamp */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div className="field">
                              <label className="field-label" style={{ fontSize: '0.74rem' }}>N° Comprobante / Ref</label>
                              <input
                                type="text"
                                value={abono.referencia}
                                onChange={(e) => handleActualizarAbono(abono.id, 'referencia', e.target.value)}
                                placeholder="Ej: Neq-98120"
                                style={{ fontSize: '12px', padding: '6px 8px' }}
                              />
                            </div>

                            <div className="field">
                              <label className="field-label" style={{ fontSize: '0.74rem' }}>Fecha y hora</label>
                              <input
                                type="text"
                                value={`${abono.fecha} ${abono.hora}`}
                                readOnly
                                title="Timestamp oficial en zona America/Bogota"
                                style={{ fontSize: '11px', padding: '6px 8px', background: 'var(--bg-subtle)' }}
                              />
                            </div>
                          </div>

                          <div className="field">
                            <label className="field-label" style={{ fontSize: '0.74rem' }}>Detalle de soporte / verificación interna</label>
                            <input
                              type="text"
                              value={abono.soporte}
                              onChange={(e) => handleActualizarAbono(abono.id, 'soporte', e.target.value)}
                              placeholder="Ej: Captura validada en portal Bancolombia"
                              style={{ fontSize: '12px', padding: '6px 8px' }}
                            />
                          </div>

                          {errValor && (
                            <span className="field-error" style={{ fontSize: '11px' }}>
                              {errValor}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* BOTÓN PARA PAGOS MIXTOS */}
                  {saldoPendiente > 0 && (
                    <button
                      type="button"
                      className="btn btn-soft btn-sm"
                      onClick={handleAgregarAbono}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Icon nombre="plus" tamano={14} /> Agregar otro medio de pago (pago mixto)
                    </button>
                  )}
                </div>
              )}

              {/* LEYENDA FISCAL Y DE INTEGRIDAD */}
              <div className="quote-fiscal-note">
                <strong style={{ display: 'block', marginBottom: '2px', color: 'var(--navy-900, #0f172a)' }}>
                  Comprobante interno de caja / cotización
                </strong>
                Este registro tiene fines de control operativo preliminar y no sustituye la factura electrónica DIAN ni acredita dineros no confirmados en cuentas bancarias.
              </div>

              {/* BOTÓN DE ACCIÓN DESDE PANEL LATERAL */}
              {etapaActual === 3 ? (
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontWeight: 700 }}
                >
                  <Icon nombre="check" tamano={16} /> Registrar y guardar solicitud
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontWeight: 600 }}
                  onClick={() => avanzarEtapa(etapaActual + 1)}
                >
                  <span>Continuar ({etapaActual === 1 ? 'Especificaciones' : 'Confirmación'})</span>
                  <Icon nombre="arrow-right" tamano={15} />
                </button>
              )}
            </div>
          </aside>
        </div>
      </form>

      {/* MODAL VISTA PREVIA DE ARCHIVO DE REFERENCIA */}
      {archivoPreview && (
        <div className="modal-backdrop" onClick={() => setArchivoPreview(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-icon modal-icon-primary"><Icon nombre="paperclip" tamano={20} /></span>
              <div>
                <h2>{archivoPreview.nombre}</h2>
                <p>{archivoPreview.tipo} · {archivoPreview.tamano}</p>
              </div>
              <button className="icon-btn" onClick={() => setArchivoPreview(null)}><Icon nombre="x" /></button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              {archivoPreview.dataUrl?.startsWith('data:image') ? (
                <img src={archivoPreview.dataUrl} alt={archivoPreview.nombre} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: 'var(--radius-md)' }} />
              ) : archivoPreview.dataUrl?.startsWith('data:application/pdf') ? (
                <iframe title={archivoPreview.nombre} src={archivoPreview.dataUrl} style={{ width: '100%', height: '400px', border: '1px solid var(--border-light)' }} />
              ) : (
                <p className="sm mut">Archivo listo para ser adjuntado y descargado por el equipo.</p>
              )}
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setArchivoPreview(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" onClick={() => descargarAdjunto(archivoPreview)}>
                <Icon nombre="download" tamano={14} /> Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN */}
      {confirmar && (
        <Modal
          titulo="Confirmar registro de solicitud"
          icono="file-plus"
          mensaje={`Se registrará la solicitud de "${form.producto}" (${form.cantidad} uds, ${form.material}) para ${clienteSeleccionado?.nombre || 'cliente seleccionado'} por un valor cotizado de ${formatoCOP(valorCotizacionNum)} (${estadoPago})${totalAbonado > 0 ? ` con un abono registrado de ${formatoCOP(totalAbonado)}` : ''}. ¿Deseas continuar?`}
          textoBoton="Registrar solicitud"
          onClose={() => setConfirmar(false)}
          onConfirm={enviar}
        />
      )}
    </div>
  )
}
