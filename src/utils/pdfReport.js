// ============================================================================
// Generador minimalista de reportes PDF nativos (PDF 1.4 estándar, sin librerías externas)
// Diseño sobrio: fondo blanco, sin logos ni elementos decorativos, tipografía legible,
// acento azul institucional discreto y tablas limpias con información puntual.
// ============================================================================

import { formatoCOP, formatearFecha, formatearHora, progreso, estaActiva } from './format.js'

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

// Paleta sobria e institucional sobre fondo blanco
const COLOR_AZUL = [0.11, 0.31, 0.65]       // Azul institucional discreto (#1C4FA6)
const COLOR_TEXTO = [0.12, 0.16, 0.22]      // Gris carbón legible (#1E2938)
const COLOR_SUB = [0.42, 0.47, 0.55]        // Gris secundario (#6B788C)
const COLOR_BORDE = [0.85, 0.88, 0.92]      // Línea divisoria sutil (#D9E0EB)
const COLOR_CABECERA = [0.95, 0.97, 0.99]   // Fondo muy tenue para encabezado de tabla

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
    // Fondo blanco limpio con encabezado sobrio sin logotipo
    this.y = this.height - this.margin

    // Título principal a la izquierda y fecha a la derecha
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

    // Línea de acento azul institucional discreta
    this.line(this.margin, this.y, this.width - this.margin, this.y, ...COLOR_AZUL, 1)
    this.y -= 20
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
    this.ensureSpace(34)
    this.y -= 4
    this.text(this.margin, this.y, titulo, {
      size: 10,
      bold: true,
      color: COLOR_AZUL,
    })
    this.y -= 6
    this.line(this.margin, this.y, this.width - this.margin, this.y, ...COLOR_BORDE, 0.6)
    this.y -= 12
  }

  // Tabla de pares Clave / Valor en 2 columnas limpias
  drawKeyValueTable(pairs) {
    const contentW = this.width - this.margin * 2
    const colW = contentW / 2
    const rowH = 18
    const rows = Math.ceil(pairs.length / 2)
    this.ensureSpace(rows * rowH + 12)

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
          maxLen: 24,
        })
        this.text(x + 108, rowBottom + 5, String(item[1] ?? '—'), {
          size: 8.5,
          color: COLOR_TEXTO,
          maxLen: 32,
        })
      }

      this.line(this.margin, rowBottom, this.width - this.margin, rowBottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH
    }

    this.y -= 12
  }

  // Tabla tabular limpia y minimalista
  drawTable(columns, rows) {
    const contentW = this.width - this.margin * 2
    const headH = 20
    const rowH = 18

    this.ensureSpace(headH + rowH + 10)

    const drawHeader = () => {
      const top = this.y + 4
      const bottom = top - headH
      this.rectFill(this.margin, bottom, contentW, headH, ...COLOR_CABECERA)
      this.line(this.margin, top, this.width - this.margin, top, ...COLOR_AZUL, 0.7)
      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.6)

      let cx = this.margin + 6
      columns.forEach((col) => {
        this.text(cx, bottom + 6, col.title, {
          size: 8.5,
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
      this.text(this.margin + 6, bottom + 5, 'Sin registros para mostrar.', {
        size: 8.5,
        color: COLOR_SUB,
      })
      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH + 12
      return
    }

    rows.forEach((r) => {
      if (this.y - rowH < 52) {
        this.addPage()
        drawHeader()
      }
      const top = this.y + 4
      const bottom = top - rowH
      let cx = this.margin + 6

      columns.forEach((col) => {
        const val = r[col.key] ?? '—'
        this.text(cx, bottom + 5, String(val), {
          size: 8.5,
          bold: Boolean(col.bold),
          color: COLOR_TEXTO,
          maxLen: col.maxLen || Math.max(8, Math.floor(col.width / 4.8)),
        })
        cx += col.width
      })

      this.line(this.margin, bottom, this.width - this.margin, bottom, ...COLOR_BORDE, 0.4)
      this.y -= rowH
    })

    this.y -= 12
  }

  drawNote(label, texto) {
    if (!texto) return
    this.ensureSpace(26)
    this.text(this.margin, this.y, `${label}: `, {
      size: 8.5,
      bold: true,
      color: COLOR_SUB,
    })
    this.text(this.margin + (label.length + 2) * 4.5, this.y, String(texto), {
      size: 8.5,
      color: COLOR_TEXTO,
      maxLen: 95,
    })
    this.y -= 14
  }

  drawFooters() {
    const total = this.pages.length
    this.pages.forEach((cmds, idx) => {
      this.currentCmds = cmds
      const fy = 32
      this.line(this.margin, fy + 10, this.width - this.margin, fy + 10, ...COLOR_BORDE, 0.5)
      this.text(this.margin, fy, 'Huellas Publicidad · Documento interno', {
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
// 1. COORDINADOR: Reporte de orden de producción
// ============================================================================
export function generarReporteOrdenPDF(order, data = {}, options = {}) {
  if (!order) return null
  const tasks = (data.tasks || []).filter((t) => t.ordenId === order.id)
  const avance = progreso(order)

  const costoActividades = tasks.length * 45000
  const costoMaterialBase = Math.round((Number(order.presupuesto) || 0) * 0.42)
  const costoEstimado = order.costoInterno || order.costoEstimado || costoMaterialBase + costoActividades

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: `Reporte de Orden de Producción — ${order.id}`,
    subtitulo: `${order.cliente || 'Cliente'} · ${order.producto || 'Producto'}`,
  })

  pdf.drawSectionTitle('1. Información de la orden')
  pdf.drawKeyValueTable([
    ['Código de orden', order.id],
    ['Estado actual', `${order.estado} (${avance}%)`],
    ['Cliente', order.cliente],
    ['Prioridad', order.prioridad || 'Media'],
    ['Producto', order.producto],
    ['Cantidad', order.cantidad || '—'],
    ['Material', order.material || '—'],
    ['Dimensiones', order.dimensiones || '—'],
    ['Fecha de inicio', order.fechaSolicitud || '—'],
    ['Fecha de entrega', order.fechaEntrega || '—'],
    ['Diseñador(a)', order.disenador || 'Por asignar'],
    ['Responsable planta', order.operario || 'Por asignar'],
    ['Presupuesto orden', formatoCOP(order.presupuesto || 0)],
    ['Costo estimado', formatoCOP(costoEstimado)],
  ])

  if (order.observaciones) {
    pdf.drawNote('Especificaciones técnicas', order.observaciones)
  }

  pdf.drawSectionTitle('2. Actividades y responsables asignados')
  pdf.drawTable(
    [
      { key: 'actividad', title: 'Actividad', width: 175, maxLen: 34, bold: true },
      { key: 'etapa', title: 'Etapa', width: 75, maxLen: 14 },
      { key: 'responsable', title: 'Responsable', width: 115, maxLen: 22 },
      { key: 'fechaLimite', title: 'Fecha límite', width: 75, maxLen: 14 },
      { key: 'estado', title: 'Estado', width: 76, maxLen: 14 },
    ],
    tasks.map((t) => ({
      actividad: t.actividad,
      etapa: t.etapa || 'Taller',
      responsable: t.responsable || 'Sin asignar',
      fechaLimite: t.fechaLimite || order.fechaEntrega || '—',
      estado: t.estado,
    }))
  )

  const bytes = pdf.buildBytes()
  const filename = `Reporte_Orden_${order.id}.pdf`
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// ============================================================================
// 2. COORDINADOR: Reporte de asignación de responsables
// ============================================================================
export function generarReporteResponsablesPDF(data = {}, options = {}) {
  const orders = data.orders || []
  const tasks = data.tasks || []
  const activas = orders.filter(estaActiva)

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: 'Reporte de Asignación de Responsables',
    subtitulo: 'Coordinación de Producción · Responsables por orden y actividades de taller',
  })

  pdf.drawSectionTitle('1. Responsables asignados por orden activa')
  pdf.drawTable(
    [
      { key: 'id', title: 'Orden', width: 72, maxLen: 14, bold: true },
      { key: 'cliente', title: 'Cliente', width: 100, maxLen: 19 },
      { key: 'producto', title: 'Producto', width: 108, maxLen: 21 },
      { key: 'estado', title: 'Etapa', width: 58, maxLen: 11 },
      { key: 'disenador', title: 'Diseñador(a)', width: 88, maxLen: 17 },
      { key: 'operario', title: 'Operario planta', width: 90, maxLen: 17 },
    ],
    activas.map((o) => ({
      id: o.id,
      cliente: o.cliente,
      producto: o.producto,
      estado: o.estado,
      disenador: o.disenador || 'Por asignar',
      operario: o.operario || 'Por asignar',
    }))
  )

  pdf.drawSectionTitle('2. Actividades de taller y responsables')
  pdf.drawTable(
    [
      { key: 'ordenId', title: 'Orden', width: 72, maxLen: 14, bold: true },
      { key: 'actividad', title: 'Actividad', width: 156, maxLen: 30 },
      { key: 'etapa', title: 'Etapa', width: 68, maxLen: 12 },
      { key: 'responsable', title: 'Responsable', width: 100, maxLen: 19 },
      { key: 'fechaLimite', title: 'Vencimiento', width: 62, maxLen: 12 },
      { key: 'estado', title: 'Estado', width: 58, maxLen: 12 },
    ],
    tasks.map((t) => ({
      ordenId: t.ordenId,
      actividad: t.actividad,
      etapa: t.etapa || 'Taller',
      responsable: t.responsable || 'Sin asignar',
      fechaLimite: t.fechaLimite || '—',
      estado: t.estado,
    }))
  )

  const bytes = pdf.buildBytes()
  const filename = 'Reporte_Asignacion_Responsables.pdf'
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// ============================================================================
// 3. COORDINADOR: Reporte de inventario
// ============================================================================
export function generarReporteInventarioPDF(data = {}, options = {}) {
  const inventory = data.inventory || []
  const suppliers = data.suppliers || []

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: 'Reporte de Inventario de Materiales',
    subtitulo: 'Existencias disponibles, consumo acumulado y proveedores asociados',
  })

  pdf.drawSectionTitle('1. Existencias de materiales e insumos')
  pdf.drawTable(
    [
      { key: 'id', title: 'Código', width: 56, maxLen: 10, bold: true },
      { key: 'nombre', title: 'Material', width: 146, maxLen: 28 },
      { key: 'categoria', title: 'Categoría', width: 72, maxLen: 14 },
      { key: 'disponible', title: 'Disponible', width: 64, maxLen: 12 },
      { key: 'utilizado', title: 'Utilizado', width: 60, maxLen: 12 },
      { key: 'costo', title: 'Costo unit.', width: 64, maxLen: 13 },
      { key: 'estado', title: 'Estado', width: 54, maxLen: 11 },
    ],
    inventory.map((m) => {
      const actual = Number(m.stockActual || 0)
      const min = Number(m.stockMinimo || 0)
      const estado = actual === 0 ? 'Agotado' : actual <= min ? 'Bajo stock' : 'Disponible'
      return {
        id: m.id,
        nombre: m.nombre,
        categoria: m.categoria,
        disponible: `${actual} ${m.unidad || ''}`.trim(),
        utilizado: `${Number(m.cantidadUtilizada || 0)} ${m.unidad || ''}`.trim(),
        costo: formatoCOP(m.costoUnitario || 0),
        estado,
      }
    })
  )

  if (suppliers.length > 0) {
    pdf.drawSectionTitle('2. Proveedores registrados')
    pdf.drawTable(
      [
        { key: 'nombre', title: 'Proveedor', width: 120, maxLen: 22, bold: true },
        { key: 'contacto', title: 'Contacto', width: 95, maxLen: 18 },
        { key: 'telefono', title: 'Teléfono', width: 85, maxLen: 16 },
        { key: 'productos', title: 'Insumos suministrados', width: 216, maxLen: 42 },
      ],
      suppliers.map((p) => ({
        nombre: p.nombre,
        contacto: p.contacto || '—',
        telefono: p.telefono || '—',
        productos: Array.isArray(p.productos) ? p.productos.join(', ') : (p.productos || '—'),
      }))
    )
  }

  const bytes = pdf.buildBytes()
  const filename = 'Reporte_Inventario_Materiales.pdf'
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}

// ============================================================================
// 4. GERENCIA: Reporte general de producción y presupuesto
// ============================================================================
export function generarReporteGeneralPDF(data = {}, options = {}) {
  const orders = data.orders || []
  const tasks = data.tasks || []
  const activas = orders.filter(estaActiva)
  const cerradas = orders.filter((o) => o.estado === 'Entrega' || o.estado === 'Cerrada')

  const presupuestoTotal = orders.reduce((acc, o) => acc + Number(o.presupuesto || 0), 0)
  const calcularCostoOrden = (o) => {
    const numTareas = tasks.filter((t) => t.ordenId === o.id).length
    return o.costoInterno || o.costoEstimado || Math.round(Number(o.presupuesto || 0) * 0.42 + numTareas * 45000)
  }
  const costoTotal = orders.reduce((acc, o) => acc + calcularCostoOrden(o), 0)
  const margenEstimado = Math.max(0, presupuestoTotal - costoTotal)

  const pdf = new MinimalPdfBuilder()
  pdf.initDocument({
    titulo: 'Reporte General de Producción y Presupuesto',
    subtitulo: 'Gerencia · Consolidado operativo y financiero de órdenes de producción',
  })

  pdf.drawSectionTitle('1. Resumen general y presupuestal')
  pdf.drawKeyValueTable([
    ['Total de órdenes', `${orders.length} registradas`],
    ['Órdenes en producción', `${activas.length} activas`],
    ['Órdenes entregadas / cerradas', `${cerradas.length} completadas`],
    ['Presupuesto total acumulado', formatoCOP(presupuestoTotal)],
    ['Costo interno estimado', formatoCOP(costoTotal)],
    ['Margen operativo estimado', formatoCOP(margenEstimado)],
  ])

  pdf.drawSectionTitle('2. Detalle de órdenes y presupuesto')
  pdf.drawTable(
    [
      { key: 'id', title: 'Orden', width: 70, maxLen: 14, bold: true },
      { key: 'cliente', title: 'Cliente', width: 96, maxLen: 18 },
      { key: 'producto', title: 'Producto', width: 108, maxLen: 21 },
      { key: 'estado', title: 'Estado', width: 58, maxLen: 11 },
      { key: 'entrega', title: 'Entrega', width: 56, maxLen: 11 },
      { key: 'presupuesto', title: 'Presupuesto', width: 64, maxLen: 13 },
      { key: 'costo', title: 'Costo est.', width: 64, maxLen: 13 },
    ],
    orders.map((o) => ({
      id: o.id,
      cliente: o.cliente,
      producto: o.producto,
      estado: o.estado,
      entrega: o.fechaEntrega || '—',
      presupuesto: formatoCOP(o.presupuesto || 0),
      costo: formatoCOP(calcularCostoOrden(o)),
    }))
  )

  const bytes = pdf.buildBytes()
  const filename = 'Reporte_General_Produccion_Presupuesto.pdf'
  if (options.skipDownload) return { filename, bytes }
  return descargarBytesPDF(bytes, filename)
}
