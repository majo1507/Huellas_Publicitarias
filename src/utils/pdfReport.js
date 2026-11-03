// ============================================================================
// Generador minimalista de reportes PDF nativos (PDF 1.4 estándar, sin librerías externas)
// Tres documentos administrativos oficiales con datos reales de ORVEX:
// 1. Orden de producción (Coordinador)
// 2. Informe de inventario y materiales (Coordinador)
// 3. Informe de gestión de producción por periodo (Gerencia)
// ============================================================================

import {
  formatoCOP,
  formatearFecha,
  formatearHora,
  parseFecha,
  FECHA_DEMO,
  estaActiva,
  estaRetrasada,
} from './format.js'

export const PERIODOS_GESTION = [
  { id: 'todo', label: 'Todo el registro histórico' },
  { id: 'ultimos_7', label: 'Últimos 7 días' },
  { id: 'ultimos_15', label: 'Últimos 15 días' },
  { id: 'octubre_2026', label: 'Octubre 2026' },
  { id: 'septiembre_2026', label: 'Septiembre 2026' },
]

export function filtrarOrdenesPorPeriodo(orders = [], periodo = 'todo') {
  if (!periodo || periodo === 'todo') return orders
  const DIA_MS = 86400000

  return orders.filter((o) => {
    const f = parseFecha(o.fechaSolicitud)
    if (periodo === 'ultimos_7') {
      const diff = (FECHA_DEMO - f) / DIA_MS
      return diff >= -365 && diff <= 7
    }
    if (periodo === 'ultimos_15') {
      const diff = (FECHA_DEMO - f) / DIA_MS
      return diff >= -365 && diff <= 15
    }
    if (periodo === 'octubre_2026') {
      return f.getMonth() === 9 && f.getFullYear() === 2026
    }
    if (periodo === 'septiembre_2026') {
      return f.getMonth() === 8 && f.getFullYear() === 2026
    }
    return true
  })
}

const WIN1252_EXT = {
  0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133,
  0x2020: 134, 0x2021: 135, 0x02c6: 136, 0x2030: 137, 0x0160: 138,
  0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146,
  0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151,
  0x02dc: 152, 0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156,
  0x017e: 158, 0x0178: 159,
}

function pdfStr(str) {
  const s = String(str ?? '')
  let out = '('
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += '\\' + s[i]
    } else if (code >= 32 && code <= 126) {
      out += s[i]
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0')
    } else if (WIN1252_EXT[code]) {
      out += '\\' + WIN1252_EXT[code].toString(8).padStart(3, '0')
    } else {
      out += ' '
    }
  }
  return out + ')'
}

function truncar(texto, maxLen) {
  const s = String(texto ?? '—').replace(/\s+/g, ' ').trim()
  if (!maxLen || s.length <= maxLen) return s
  return s.slice(0, Math.max(1, maxLen - 1)).trim() + '…'
}

// Paleta minimalista en fondo blanco
const COLOR_AZUL = [0.11, 0.31, 0.65]       // Azul institucional discreto (#1C4FA6)
const COLOR_TEXTO = [0.12, 0.16, 0.22]      // Gris carbón legible (#1E2938)
const COLOR_SUB = [0.42, 0.47, 0.55]        // Gris secundario (#6B788C)
const COLOR_BORDE = [0.85, 0.88, 0.92]      // Línea divisoria sutil (#D9E0EB)
const COLOR_CABECERA = [0.96, 0.97, 0.99]   // Gris/azul muy tenue para encabezado de tabla

class MinimalPdfBuilder {
  constructor() {
    this.width = 612  // Carta (8.5 x 11 in)
    this.height = 792
    this.margin = 48
    this.pages = []
    this.currentCmds = null
    this.y = 0
    this.meta = { titulo: '', subtitulo: '', fecha: '' }
  }

  initDocument({ titulo, subtitulo = '' }) {
    this.meta = {
      titulo,
      subtitulo,
      fecha: `${formatearFecha()} · ${formatearHora()}`,
    }
    this.addPage()
  }

  addPage() {
    this.currentCmds = []
    this.pages.push(this.currentCmds)
    this.y = this.height - this.margin

    // Título sobrio sin logotipo ni bloques decorativos
    this.text(this.margin, this.y, this.meta.titulo, {
      size: 13,
      bold: true,
      color: COLOR_TEXTO,
    })
    const fechaTxt = `Fecha: ${this.meta.fecha}`
    const fechaX = this.width - this.margin - fechaTxt.length * 4.3
    this.text(fechaX, this.y + 1, fechaTxt, {
      size: 8.5,
      color: COLOR_SUB,
    })
    this.y -= 14

    if (this.meta.subtitulo) {
      this.text(this.margin, this.y, this.meta.subtitulo, {
        size: 9,
        color: COLOR_SUB,
      })
      this.y -= 10
    }

    this.line(this.margin, this.y, this.width - this.margin, this.y, ...COLOR_AZUL, 0.9)
    this.y -= 18
  }

  ensureSpace(neededHeight) {
    if (this.y - neededHeight < 52) {
      this.addPage()
    }
  }

  cmd(str) {
    this.currentCmds.push(str)
  }

  rectFill(x, y, w, h, r, g, b) {
    this.cmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`)
  }

  line(x1, y1, x2, y2, r, g, b, width = 0.5) {
    this.cmd(`${width.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
  }

  text(x, y, str, { size = 9, bold = false, color = COLOR_TEXTO, maxLen = 0 } = {}) {
    const font = bold ? '/F2' : '/F1'
    const [r, g, b] = color
    const clean = maxLen ? truncar(str, maxLen) : String(str ?? '')
    this.cmd(`BT ${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${pdfStr(clean)} Tj ET`)
  }

  drawSectionTitle(titulo) {
    this.ensureSpace(32)
    this.y -= 2
    this.text(this.margin, this.y, titulo, {
      size: 9.5,
      bold: true,
      color: COLOR_AZUL,
    })
    this.y -= 5
    this.line(this.margin, this.y, this.width - this.margin, this.y, ...COLOR_BORDE, 0.6)
    this.y -= 12
  }

  drawKeyValueTable(pairs) {
    const contentW = this.width - this.margin * 2
    const colW = contentW / 2
    const rowH = 18
    const rows = Math.ceil(pairs.length / 2)
    this.ensureSpace(rows * rowH + 10)

    this.line(this.margin, this.y + 4, this.width - this.margin, this.y + 4, ...COLOR_BORDE, 0.5)

    for (let r = 0; r < rows; r++) {
      const rowTop = this.y + 4
      const rowBottom = rowTop - rowH

      for (let c = 0; c < 2; c++) {
        const item = pairs[r * 2 + c]
        if (!item) continue
        const x = this.margin + c * colW
        this.text(x + 4, rowBottom + 5, `${item[0]}:`, {
          size: 8.5,
          bold: true,
          color: COLOR_SUB,
          maxLen: 25,
        })
        this.text(x + 112, rowBottom + 5, String(item[1] ?? '—'), {
          size: 8.5,
          color: COLOR_TEXTO,
          maxLen: 31,
        })
      }

      this.line(this.margin, rowBottom, this.width - this.margin, rowBottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH
    }

    this.y -= 10
  }

  drawTable(columns, rows) {
    const contentW = this.width - this.margin * 2
    const headH = 19
    const rowH = 17

    this.ensureSpace(headH + rowH + 10)

    const drawHeader = () => {
      const top = this.y + 4
      const bottom = top - headH
      this.rectFill(this.margin, bottom, contentW, headH, ...COLOR_CABECERA)
      this.line(this.margin, top, this.width - this.margin, top, ...COLOR_AZUL, 0.6)
      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.6)

      let cx = this.margin + 5
      columns.forEach((col) => {
        this.text(cx, bottom + 5, col.title, {
          size: 8,
          bold: true,
          color: COLOR_AZUL,
          maxLen: col.maxLen || 28,
        })
        cx += col.width
      })
      this.y -= headH
    }

    drawHeader()

    if (!rows || rows.length === 0) {
      const bottom = this.y + 4 - rowH
      this.text(this.margin + 5, bottom + 5, 'Sin registros en este apartado.', {
        size: 8,
        color: COLOR_SUB,
      })
      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH + 10
      return
    }

    rows.forEach((r) => {
      if (this.y - rowH < 52) {
        this.addPage()
        drawHeader()
      }
      const top = this.y + 4
      const bottom = top - rowH
      let cx = this.margin + 5

      columns.forEach((col) => {
        const val = r[col.key] ?? '—'
        this.text(cx, bottom + 5, String(val), {
          size: 8,
          bold: Boolean(col.bold),
          color: COLOR_TEXTO,
          maxLen: col.maxLen || Math.max(8, Math.floor(col.width / 4.6)),
        })
        cx += col.width
      })

      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH
    })

    this.y -= 10
  }

  drawFooters() {
    const total = this.pages.length
    this.pages.forEach((cmds, idx) => {
      this.currentCmds = cmds
      const fy = 32
      this.line(this.margin, fy + 10, this.width - this.margin, fy + 10, ...COLOR_BORDE, 0.5)
      this.text(this.margin, fy, 'Huellas Publicidad · Documento administrativo interno', {
        size: 7.5,
        color: COLOR_SUB,
      })
      const pagTxt = `Página ${idx + 1} de ${total}`
      this.text(this.width - this.margin - pagTxt.length * 4.2, fy, pagTxt, {
        size: 7.5,
        color: COLOR_SUB,
      })
    })
  }

  buildBytes() {
    this.drawFooters()

    const objects = []
    const addObj = (body) => {
      objects.push(body)
      return objects.length
    }

    const fontRegularId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    const fontBoldId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    const pagesId = addObj('')

    const pageIds = this.pages.map((cmds) => {
      const stream = cmds.join('\n')
      const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
      return addObj(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
      )
    })

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((body, idx) => {
      offsets.push(pdf.length)
      pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`
    })

    const xrefOffset = pdf.length
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

    const bytes = new Uint8Array(pdf.length)
    for (let i = 0; i < pdf.length; i++) {
      bytes[i] = pdf.charCodeAt(i) & 0xff
    }
    return bytes
  }
}

export function descargarBytesPDF(bytes, filename) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { filename, byteLength: bytes.byteLength }
  }
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { filename, byteLength: bytes.byteLength }
}

// ============================================================================
// 1. COORDINADOR: Orden de producción
// Información esencial de la orden: especificaciones, cantidad, responsables, fechas y estado.
// ============================================================================
export function generarReporteOrdenPDF(order, _data = {}, options = {}) {
  if (!order) return null

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: `Orden de Producción — ${order.id}`,
    subtitulo: `Cliente: ${order.cliente || '—'} · Estado: ${order.estado || '—'}`,
  })

  pdf.drawSectionTitle('1. Datos generales, fechas y responsables')
  pdf.drawKeyValueTable([
    ['Código de orden', order.id],
    ['Estado actual', order.estado || '—'],
    ['Cliente', order.cliente || '—'],
    ['Estado de diseño', order.disenoEstado || '—'],
    ['Fecha de solicitud', order.fechaSolicitud || '—'],
    ['Fecha de entrega', order.fechaEntrega || '—'],
    ['Diseñador(a) asignado(a)', order.disenador || 'Por asignar'],
    ['Responsable producción', order.responsable || 'Por asignar'],
    ['Método de entrega', order.entrega?.metodo || '—'],
    ['Contacto recepción', order.entrega?.contacto || order.cliente || '—'],
    ['Presupuesto registrado', formatoCOP(Number(order.presupuesto || 0))],
    ['Costo registrado', order.costoInterno !== undefined ? formatoCOP(Number(order.costoInterno || 0)) : '—'],
  ])

  pdf.drawSectionTitle('2. Especificaciones del producto')
  pdf.drawTable(
    [
      { key: 'producto', title: 'Producto', width: 135, maxLen: 26, bold: true },
      { key: 'cantidad', title: 'Cantidad', width: 58, maxLen: 12 },
      { key: 'material', title: 'Material', width: 95, maxLen: 18 },
      { key: 'dimensiones', title: 'Dimensiones', width: 78, maxLen: 15 },
      { key: 'colores', title: 'Colores', width: 75, maxLen: 15 },
      { key: 'acabados', title: 'Acabados', width: 75, maxLen: 15 },
    ],
    [
      {
        producto: order.producto || '—',
        cantidad: `${order.cantidad || 0} uds`,
        material: order.material || '—',
        dimensiones: order.dimensiones || '—',
        colores: order.colores || '—',
        acabados: order.acabados || '—',
      },
    ]
  )

  const detallesAdicionales = []
  if (order.requerimientos) detallesAdicionales.push(['Requerimientos técnicos', order.requerimientos])
  if (order.observaciones) detallesAdicionales.push(['Observaciones', order.observaciones])
  if (order.entrega?.direccion) detallesAdicionales.push(['Dirección de entrega', order.entrega.direccion])

  if (detallesAdicionales.length > 0) {
    pdf.drawSectionTitle('3. Requerimientos y observaciones registradas')
    pdf.drawTable(
      [
        { key: 'concepto', title: 'Concepto', width: 140, maxLen: 26, bold: true },
        { key: 'detalle', title: 'Detalle registrado', width: 376, maxLen: 78 },
      ],
      detallesAdicionales.map(([concepto, detalle]) => ({ concepto, detalle }))
    )
  }

  const bytes = pdf.buildBytes()
  const filename = `Orden_Produccion_${order.id}.pdf`
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// ============================================================================
// 2. COORDINADOR: Informe de inventario y materiales
// Existencias actuales, materiales con stock bajo o agotados y necesidades de reposición.
// ============================================================================
export function generarReporteInventarioPDF(data = {}, options = {}) {
  const inventory = data.inventory || []
  const criticos = inventory.filter((m) => Number(m.stockActual || 0) <= Number(m.stockMinimo || 0))

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: 'Informe de Inventario y Materiales',
    subtitulo: `Materiales registrados: ${inventory.length} · En nivel crítico o agotados: ${criticos.length}`,
  })

  pdf.drawSectionTitle('1. Existencias actuales de materiales')
  pdf.drawTable(
    [
      { key: 'id', title: 'Código', width: 52, maxLen: 10, bold: true },
      { key: 'nombre', title: 'Material', width: 148, maxLen: 29 },
      { key: 'categoria', title: 'Categoría', width: 92, maxLen: 18 },
      { key: 'actual', title: 'Existencia', width: 64, maxLen: 13 },
      { key: 'minimo', title: 'Stock mín.', width: 60, maxLen: 12 },
      { key: 'costo', title: 'Costo unit.', width: 52, maxLen: 12 },
      { key: 'estado', title: 'Estado', width: 48, maxLen: 10 },
    ],
    inventory.map((m) => {
      const actual = Number(m.stockActual || 0)
      const min = Number(m.stockMinimo || 0)
      const estado = actual <= 0 ? 'Agotado' : actual <= min ? 'Stock bajo' : 'Normal'
      return {
        id: m.id,
        nombre: m.nombre,
        categoria: m.categoria || '—',
        actual: `${actual} ${m.unidad || ''}`.trim(),
        minimo: `${min} ${m.unidad || ''}`.trim(),
        costo: formatoCOP(Number(m.costoUnitario || 0)),
        estado,
      }
    })
  )

  pdf.drawSectionTitle('2. Materiales con stock bajo o agotados y necesidades de reposición')
  pdf.drawTable(
    [
      { key: 'id', title: 'Código', width: 52, maxLen: 10, bold: true },
      { key: 'nombre', title: 'Material en alerta', width: 138, maxLen: 27 },
      { key: 'actual', title: 'Actual', width: 58, maxLen: 12 },
      { key: 'minimo', title: 'Mínimo', width: 58, maxLen: 12 },
      { key: 'reponer', title: 'Por reponer', width: 68, maxLen: 14, bold: true },
      { key: 'proveedor', title: 'Proveedor asignado', width: 142, maxLen: 28 },
    ],
    criticos.map((m) => {
      const actual = Number(m.stockActual || 0)
      const min = Number(m.stockMinimo || 0)
      const faltante = Math.max(1, min - actual)
      return {
        id: m.id,
        nombre: m.nombre,
        actual: `${actual} ${m.unidad || ''}`.trim(),
        minimo: `${min} ${m.unidad || ''}`.trim(),
        reponer: `${faltante} ${m.unidad || ''}`.trim(),
        proveedor: m.proveedor || '—',
      }
    })
  )

  const bytes = pdf.buildBytes()
  const filename = 'Informe_Inventario_Materiales.pdf'
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// ============================================================================
// 3. GERENCIA: Informe de gestión de producción (con selección de periodo)
// Órdenes recibidas, terminadas, pendientes y retrasadas, cumplimiento de entregas
// y comparación entre presupuesto y costos registrados.
// ============================================================================
export function generarInformeGestionPDF(data = {}, options = {}) {
  const periodoId = options.periodo || 'todo'
  const periodoObj = PERIODOS_GESTION.find((p) => p.id === periodoId) || PERIODOS_GESTION[0]
  const ordenes = filtrarOrdenesPorPeriodo(data.orders || [], periodoObj.id)

  const recibidas = ordenes.length
  const terminadas = ordenes.filter((o) => !estaActiva(o))
  const pendientes = ordenes.filter(estaActiva)
  const retrasadas = ordenes.filter(estaRetrasada)

  // Cumplimiento de entregas sobre las órdenes del periodo (órdenes sin retraso / total)
  const enPlazo = Math.max(0, recibidas - retrasadas.length)
  const cumplimientoPct = recibidas > 0 ? Math.round((enPlazo / recibidas) * 100) : 100

  // Comparación estrictamente con presupuesto y costoInterno registrados en ORVEX
  const presupuestoTotal = ordenes.reduce((acc, o) => acc + Number(o.presupuesto || 0), 0)
  const costoTotal = ordenes.reduce((acc, o) => acc + Number(o.costoInterno || 0), 0)
  const diferenciaTotal = presupuestoTotal - costoTotal

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: 'Informe de Gestión de Producción',
    subtitulo: `Periodo: ${periodoObj.label}`,
  })

  pdf.drawSectionTitle('1. Balance de órdenes y cumplimiento de entregas')
  pdf.drawKeyValueTable([
    ['Periodo evaluado', periodoObj.label],
    ['Órdenes recibidas', `${recibidas}`],
    ['Órdenes terminadas / entregadas', `${terminadas.length}`],
    ['Órdenes pendientes (en curso)', `${pendientes.length}`],
    ['Órdenes retrasadas', `${retrasadas.length}`],
    ['Cumplimiento de entregas', `${cumplimientoPct}% (${enPlazo} de ${recibidas} en plazo)`],
    ['Presupuesto total registrado', formatoCOP(presupuestoTotal)],
    ['Costos registrados', formatoCOP(costoTotal)],
    ['Diferencia presupuesto vs. costo', formatoCOP(diferenciaTotal)],
  ])

  pdf.drawSectionTitle('2. Detalle de órdenes, presupuesto y costos registrados')
  pdf.drawTable(
    [
      { key: 'id', title: 'Orden', width: 66, maxLen: 13, bold: true },
      { key: 'cliente', title: 'Cliente', width: 92, maxLen: 18 },
      { key: 'producto', title: 'Producto', width: 100, maxLen: 19 },
      { key: 'solicitud', title: 'Recibida', width: 52, maxLen: 10 },
      { key: 'entrega', title: 'Entrega', width: 52, maxLen: 10 },
      { key: 'estado', title: 'Estado', width: 54, maxLen: 11 },
      { key: 'presupuesto', title: 'Presupuesto', width: 50, maxLen: 12 },
      { key: 'costo', title: 'Costo reg.', width: 50, maxLen: 12 },
    ],
    ordenes.map((o) => ({
      id: o.id,
      cliente: o.cliente || '—',
      producto: o.producto || '—',
      solicitud: o.fechaSolicitud || '—',
      entrega: o.fechaEntrega || '—',
      estado: estaRetrasada(o) ? 'Retrasada' : o.estado,
      presupuesto: formatoCOP(Number(o.presupuesto || 0)),
      costo: formatoCOP(Number(o.costoInterno || 0)),
    }))
  )

  const bytes = pdf.buildBytes()
  const filename = `Informe_Gestion_Produccion_${periodoObj.id}.pdf`
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// Alias de compatibilidad
export const generarReporteGeneralPDF = generarInformeGestionPDF
