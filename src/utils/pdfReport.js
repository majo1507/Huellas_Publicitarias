// ============================================================
// src/utils/pdfReport.js
// Generador nativo de reportes ejecutivos en formato PDF (estándar PDF 1.4)
// para ORVEX — Huellas Publicidad (Órdenes individuales y Reporte General
// de Producción e Inventario).
// ============================================================

import { formatoCOP, progreso, estaRetrasada, estaEnRiesgo, textoPlazo, prioridadOrden, estaActiva } from './format.js'

// Convierte texto UTF-8 a bytes WinAnsi (Windows-1252 / Latin-1) escapados para literales PDF
function pdfEscapeWinAnsi(input) {
  const str = String(input ?? '')
    .replace(/—|–/g, '-')
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .replace(/•/g, '-')
    .replace(/→/g, '->')
    .replace(/²/g, '2')

  let out = ''
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code === 40) out += '\\('
    else if (code === 41) out += '\\)'
    else if (code === 92) out += '\\\\'
    else if (code >= 32 && code <= 126) {
      out += str[i]
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0')
    } else {
      out += ' '
    }
  }
  return out
}

// Divide un texto largo en líneas según un máximo aproximado de caracteres
function wrapText(text, maxChars = 85) {
  const clean = String(text ?? '').replace(/\r?\n/g, ' ').trim()
  if (!clean) return ['Sin registro']
  const words = clean.split(/\s+/)
  const lines = []
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w
    } else if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

function truncateText(text, maxChars = 32) {
  const clean = String(text ?? '').trim()
  if (clean.length <= maxChars) return clean
  return clean.slice(0, Math.max(0, maxChars - 3)) + '...'
}

// Clase constructora de documento PDF multipágina en formato A4 (595.28 x 841.89 pt)
class OrvexPdfBuilder {
  constructor({ reportNumber, title, subtitle, fechaGeneracion }) {
    this.width = 595.28
    this.height = 841.89
    this.margin = 38
    this.reportNumber = reportNumber
    this.title = title
    this.subtitle = subtitle
    this.fechaGeneracion = fechaGeneracion
    this.pages = []
    this.currentOps = []
    this.y = 0
    this.newPage()
  }

  newPage() {
    if (this.currentOps.length > 0) {
      this.pages.push(this.currentOps.join('\n'))
    }
    this.currentOps = []
    this.drawHeader()
    this.y = this.height - 118
  }

  ensureSpace(neededHeight = 40) {
    if (this.y - neededHeight < 58) {
      this.newPage()
    }
  }

  // Convierte coordenada Y superior-izquierda o directa; aquí trabajamos con Y desde abajo (PDF nativo)
  rectFill(x, y, w, h, r, g, b) {
    this.currentOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`)
    this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`)
  }

  rectStroke(x, y, w, h, r, g, b, lineWidth = 0.75) {
    this.currentOps.push(`${lineWidth.toFixed(2)} w`)
    this.currentOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`)
    this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`)
  }

  rectFillStroke(x, y, w, h, fr, fg, fb, sr, sg, sb, lineWidth = 0.75) {
    this.currentOps.push(`${lineWidth.toFixed(2)} w`)
    this.currentOps.push(`${fr.toFixed(3)} ${fg.toFixed(3)} ${fb.toFixed(3)} rg`)
    this.currentOps.push(`${sr.toFixed(3)} ${sg.toFixed(3)} ${sb.toFixed(3)} RG`)
    this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B`)
  }

  line(x1, y1, x2, y2, r, g, b, lineWidth = 0.75) {
    this.currentOps.push(`${lineWidth.toFixed(2)} w`)
    this.currentOps.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`)
    this.currentOps.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`)
  }

  text(str, x, y, { size = 9.5, bold = false, color = [0.09, 0.14, 0.23] } = {}) {
    const font = bold ? '/F2' : '/F1'
    const [r, g, b] = color
    const escaped = pdfEscapeWinAnsi(str)
    this.currentOps.push(
      `BT ${font} ${size.toFixed(2)} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`
    )
  }

  drawHeader() {
    const topY = this.height - 92
    // Franja superior azul oscuro corporativo ORVEX (#0B1424)
    this.rectFill(0, topY, this.width, 92, 0.043, 0.078, 0.141)
    // Franja acento cian luminoso (#19C6E5)
    this.rectFill(0, topY, this.width, 3.5, 0.098, 0.776, 0.898)

    // Emblema vectorial ORVEX (cuadro azul eléctrico + anillo blanco + diagonal cian)
    const bx = this.margin
    const by = topY + 24
    this.rectFillStroke(bx, by, 42, 42, 0.141, 0.482, 1.0, 0.396, 0.894, 0.949, 1.4)
    // Trazo diagonal cian dentro del logo
    this.line(bx + 11, by + 10, bx + 31, by + 32, 0.396, 0.894, 0.949, 2.8)
    this.text('O', bx + 13.5, by + 13.5, { size: 21, bold: true, color: [1, 1, 1] })

    // Nombre corporativo y título del reporte
    this.text('ORVEX - HUELLAS PUBLICIDAD', bx + 54, topY + 52, {
      size: 13.5,
      bold: true,
      color: [0.94, 0.97, 1.0],
    })
    this.text(this.title.toUpperCase(), bx + 54, topY + 35, {
      size: 10.5,
      bold: true,
      color: [0.396, 0.894, 0.949],
    })
    this.text(this.subtitle, bx + 54, topY + 20, {
      size: 8.5,
      bold: false,
      color: [0.72, 0.81, 0.92],
    })

    // Caja derecha con Número de Reporte y Fecha
    const rx = this.width - this.margin - 165
    this.rectFillStroke(rx, topY + 18, 165, 52, 0.078, 0.137, 0.22, 0.18, 0.35, 0.58, 0.8)
    this.text('REPORTE OFICIAL', rx + 10, topY + 55, {
      size: 7.5,
      bold: true,
      color: [0.396, 0.894, 0.949],
    })
    this.text(`No. ${this.reportNumber}`, rx + 10, topY + 40, {
      size: 10,
      bold: true,
      color: [1, 1, 1],
    })
    this.text(`Emitido: ${this.fechaGeneracion}`, rx + 10, topY + 26, {
      size: 8,
      bold: false,
      color: [0.78, 0.85, 0.94],
    })
  }

  drawSectionTitle(numero, titulo) {
    this.ensureSpace(38)
    const w = this.width - this.margin * 2
    const boxY = this.y - 22
    this.rectFill(this.margin, boxY, w, 22, 0.93, 0.96, 0.995)
    this.rectFill(this.margin, boxY, 4.5, 22, 0.141, 0.482, 1.0)
    this.text(`${numero}. ${titulo.toUpperCase()}`, this.margin + 12, boxY + 6.5, {
      size: 9.5,
      bold: true,
      color: [0.06, 0.16, 0.32],
    })
    this.y = boxY - 8
  }

  drawKpiRow(items = []) {
    if (!items.length) return
    this.ensureSpace(54)
    const totalW = this.width - this.margin * 2
    const gap = 8
    const cardW = (totalW - gap * (items.length - 1)) / items.length
    const cardH = 44
    const boxY = this.y - cardH

    items.forEach((item, idx) => {
      const x = this.margin + idx * (cardW + gap)
      this.rectFillStroke(x, boxY, cardW, cardH, 0.975, 0.985, 1.0, 0.82, 0.88, 0.95, 0.75)
      this.rectFill(x, boxY + cardH - 3, cardW, 3, 0.141, 0.482, 1.0)
      this.text(truncateText(item.label.toUpperCase(), 24), x + 8, boxY + 28, {
        size: 7.2,
        bold: true,
        color: [0.35, 0.45, 0.58],
      })
      this.text(truncateText(String(item.value ?? '-'), 22), x + 8, boxY + 11, {
        size: 11,
        bold: true,
        color: [0.06, 0.13, 0.25],
      })
    })

    this.y = boxY - 12
  }

  drawKeyValueGrid(pairs = [], columns = 2) {
    const rows = Math.ceil(pairs.length / columns)
    const rowH = 19
    this.ensureSpace(rows * rowH + 14)

    const totalW = this.width - this.margin * 2
    const colW = totalW / columns

    for (let r = 0; r < rows; r++) {
      this.ensureSpace(rowH + 6)
      const rowY = this.y - rowH
      const bg = r % 2 === 0 ? [0.985, 0.99, 0.998] : [1, 1, 1]
      this.rectFillStroke(this.margin, rowY, totalW, rowH, bg[0], bg[1], bg[2], 0.87, 0.91, 0.96, 0.5)

      for (let c = 0; c < columns; c++) {
        const item = pairs[r * columns + c]
        if (!item) continue
        const [label, value] = item
        const x = this.margin + c * colW
        if (c > 0) {
          this.line(x, rowY, x, rowY + rowH, 0.87, 0.91, 0.96, 0.5)
        }
        this.text(`${label}:`, x + 8, rowY + 5.5, {
          size: 8.3,
          bold: true,
          color: [0.28, 0.37, 0.49],
        })
        this.text(truncateText(String(value ?? '—'), columns === 2 ? 36 : 75), x + 98, rowY + 5.5, {
          size: 8.6,
          bold: false,
          color: [0.07, 0.12, 0.21],
        })
      }
      this.y = rowY
    }
    this.y -= 10
  }

  drawTable(headers = [], rows = []) {
    const headerH = 20
    const rowH = 18
    this.ensureSpace(headerH + rowH + 12)

    const totalW = this.width - this.margin * 2
    const totalWeight = headers.reduce((acc, h) => acc + (h.width || 1), 0)
    const colWidths = headers.map((h) => ((h.width || 1) / totalWeight) * totalW)

    const renderTableHeader = () => {
      const hy = this.y - headerH
      this.rectFill(this.margin, hy, totalW, headerH, 0.08, 0.16, 0.29)
      let cx = this.margin
      headers.forEach((h, i) => {
        this.text(h.title.toUpperCase(), cx + 6, hy + 6, {
          size: 7.6,
          bold: true,
          color: [0.94, 0.97, 1.0],
        })
        cx += colWidths[i]
      })
      this.y = hy
    }

    renderTableHeader()

    if (!rows.length) {
      const ry = this.y - rowH
      this.rectFillStroke(this.margin, ry, totalW, rowH, 0.99, 0.99, 1.0, 0.86, 0.9, 0.95, 0.5)
      this.text('Sin registros asociados en esta sección.', this.margin + 8, ry + 5.5, {
        size: 8.3,
        bold: false,
        color: [0.45, 0.52, 0.62],
      })
      this.y = ry - 10
      return
    }

    rows.forEach((row, rIdx) => {
      if (this.y - rowH < 58) {
        this.newPage()
        renderTableHeader()
      }
      const ry = this.y - rowH
      const bg = rIdx % 2 === 0 ? [1, 1, 1] : [0.975, 0.985, 0.998]
      this.rectFillStroke(this.margin, ry, totalW, rowH, bg[0], bg[1], bg[2], 0.87, 0.91, 0.96, 0.5)

      let cx = this.margin
      headers.forEach((h, cIdx) => {
        const maxChars = Math.max(8, Math.floor(colWidths[cIdx] / 4.6))
        const val = truncateText(String(row[cIdx] ?? '—'), maxChars)
        this.text(val, cx + 6, ry + 5.5, {
          size: 8.1,
          bold: cIdx === 0,
          color: cIdx === 0 ? [0.08, 0.24, 0.52] : [0.12, 0.18, 0.26],
        })
        cx += colWidths[cIdx]
      })
      this.y = ry
    })

    this.y -= 10
  }

  drawParagraphBox(titulo, texto) {
    const lines = wrapText(texto, 88)
    const boxH = 22 + lines.length * 13
    this.ensureSpace(boxH + 10)

    const totalW = this.width - this.margin * 2
    const boxY = this.y - boxH
    this.rectFillStroke(this.margin, boxY, totalW, boxH, 0.98, 0.99, 1.0, 0.83, 0.89, 0.96, 0.7)
    this.text(titulo.toUpperCase(), this.margin + 10, boxY + boxH - 14, {
      size: 8,
      bold: true,
      color: [0.14, 0.36, 0.72],
    })

    lines.forEach((lineStr, idx) => {
      this.text(lineStr, this.margin + 10, boxY + boxH - 28 - idx * 13, {
        size: 8.6,
        bold: false,
        color: [0.12, 0.18, 0.28],
      })
    })

    this.y = boxY - 10
  }

  drawSignatures(firmas = ['Coordinador de Producción', 'Control de Calidad / Planta', 'Cliente / Recepción']) {
    this.ensureSpace(68)
    const totalW = this.width - this.margin * 2
    const gap = 24
    const sigW = (totalW - gap * (firmas.length - 1)) / firmas.length
    const baseLineY = this.y - 38

    firmas.forEach((cargo, idx) => {
      const x = this.margin + idx * (sigW + gap)
      this.line(x, baseLineY, x + sigW, baseLineY, 0.55, 0.64, 0.75, 0.8)
      this.text(cargo, x + 8, baseLineY - 12, {
        size: 8,
        bold: true,
        color: [0.25, 0.34, 0.46],
      })
      this.text('Firma y sello de conformidad', x + 8, baseLineY - 22, {
        size: 7.2,
        bold: false,
        color: [0.48, 0.55, 0.65],
      })
    })
    this.y = baseLineY - 30
  }

  build() {
    if (this.currentOps.length > 0) {
      this.pages.push(this.currentOps.join('\n'))
      this.currentOps = []
    }

    const totalPages = this.pages.length
    const finalPages = this.pages.map((content, idx) => {
      const footerOps = [
        `0.85 0.89 0.94 RG 0.6 w ${this.margin.toFixed(2)} 38 m ${(this.width - this.margin).toFixed(2)} 38 l S`,
        `BT /F1 7.8 Tf 0.42 0.49 0.58 rg ${this.margin.toFixed(2)} 25 Td (${pdfEscapeWinAnsi(
          `ORVEX - Huellas Publicidad · Sistema Integral de Gestión de Producción · Reporte ${this.reportNumber}`
        )}) Tj ET`,
        `BT /F2 7.8 Tf 0.14 0.36 0.72 rg ${(this.width - this.margin - 72).toFixed(2)} 25 Td (${pdfEscapeWinAnsi(
          `Página ${idx + 1} de ${totalPages}`
        )}) Tj ET`,
      ].join('\n')
      return content + '\n' + footerOps
    })

    // Ensamblar objetos PDF 1.4
    // Obj 1: Catalog
    // Obj 2: Pages
    // Obj 3: Font Helvetica (/F1)
    // Obj 4: Font Helvetica-Bold (/F2)
    // Obj 5..(4 + totalPages*2): Page y Content stream por página
    const objects = []
    const pageObjNums = []

    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')
    // Placeholder para Pages (Obj 2)
    objects.push('')
    objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj')
    objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj')

    let nextObjNum = 5
    finalPages.forEach((streamContent) => {
      const pageObjNum = nextObjNum++
      const contentObjNum = nextObjNum++
      pageObjNums.push(`${pageObjNum} 0 R`)

      objects.push(
        `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(
          2
        )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj`
      )
      objects.push(
        `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`
      )
    })

    objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.join(' ')}] /Count ${totalPages} >>\nendobj`

    let pdfBody = '%PDF-1.4\n'
    const offsets = [0]
    for (const objStr of objects) {
      offsets.push(pdfBody.length)
      pdfBody += objStr + '\n'
    }

    const xrefStart = pdfBody.length
    pdfBody += `xref\n0 ${objects.length + 1}\n`
    pdfBody += '0000000000 65535 f \n'
    for (let i = 1; i <= objects.length; i++) {
      pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
    }
    pdfBody += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

    const bytes = new Uint8Array(pdfBody.length)
    for (let i = 0; i < pdfBody.length; i++) {
      bytes[i] = pdfBody.charCodeAt(i) & 0xff
    }
    return bytes
  }
}

export function descargarBytesPDF(bytes, filename) {
  if (typeof window === 'undefined') return
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function obtenerFechaHoraActual() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/**
 * Genera y descarga el reporte PDF ejecutivo de una Orden de Producción individual
 */
export function generarReporteOrdenPDF(order, data = {}, { descargar = true } = {}) {
  if (!order) return null

  const fechaGen = obtenerFechaHoraActual()
  const sufijo = String(order.id || '0001').replace(/[^0-9A-Z]/gi, '').slice(-4)
  const reportNumber = `REP-ORD-${sufijo}`

  const clienteObj = (data.clients || []).find(
    (c) => c.id === order.clienteId || c.nombre === order.cliente
  ) || {}
  const tareasOrden = (data.tasks || []).filter((t) => t.ordenId === order.id)
  const solicitudOrigen = (data.requests || []).find(
    (s) => s.id === order.solicitudId || s.ordenId === order.id
  )
  const materialInv = (data.inventory || []).find((m) =>
    m.nombre.toLowerCase().includes(String(order.material || '').toLowerCase()) ||
    String(order.material || '').toLowerCase().includes(m.nombre.toLowerCase().split(' ')[0])
  )

  const presupuesto = Number(order.presupuesto || 0)
  const costoInterno = Number(order.costoInterno || Math.round(presupuesto * 0.6))
  const margen = presupuesto - costoInterno
  const margenPct = presupuesto > 0 ? Math.round((margen / presupuesto) * 100) : 0
  const pctAvance = progreso(order)

  const pdf = new OrvexPdfBuilder({
    reportNumber,
    title: `Ficha y Reporte de Orden ${order.id}`,
    subtitle: `Cliente: ${order.cliente} · Producto: ${order.producto}`,
    fechaGeneracion: fechaGen,
  })

  // KPIs rápidos de la orden
  pdf.drawKpiRow([
    { label: 'Estado Actual', value: `${order.estado} (${pctAvance}%)` },
    { label: 'Presupuesto Cliente', value: formatoCOP(presupuesto) },
    { label: 'Costo Interno Est.', value: formatoCOP(costoInterno) },
    { label: 'Fecha de Entrega', value: `${order.fechaEntrega}` },
  ])

  // 1. Información de la Orden y Cliente Relacionado
  pdf.drawSectionTitle(1, 'Información de la Orden y Cliente Relacionado')
  pdf.drawKeyValueGrid([
    ['Código de orden', order.id],
    ['Solicitud origen', order.solicitudId || solicitudOrigen?.id || 'Directa'],
    ['Cliente / Empresa', order.cliente],
    ['NIT Cliente', clienteObj.nit || '900.412.890-1'],
    ['Contacto principal', clienteObj.contacto || order.entrega?.contacto || order.cliente],
    ['Teléfono / Correo', `${clienteObj.telefono || '300 111 2233'} · ${clienteObj.correo || 'contacto@cliente.co'}`],
    ['Ciudad y Destino', order.entrega?.direccion || `${clienteObj.direccion || 'Sede principal'}, ${clienteObj.ciudad || 'Bogotá'}`],
    ['Prioridad y Plazo', `${prioridadOrden(order)} · ${textoPlazo(order)}`],
  ])

  // 2. Responsables Asignados y Actividades de Producción
  pdf.drawSectionTitle(2, 'Responsables Asignados y Coordinación de Planta')
  pdf.drawKeyValueGrid([
    ['Coordinador de planta', 'Carlos Gómez'],
    ['Ejecutiva comercial', order.ejecutiva_nombre || 'Ana Martínez'],
    ['Diseñador(a) asignado', order.disenador || 'María López'],
    ['Responsable actual', order.responsable || 'Pedro Morales'],
    ['Estado de diseño', `${order.disenoEstado || 'Pendiente'} (${(order.versiones || []).length} versión/es)`],
    ['Método de despacho', order.entrega?.metodo || order.metodoEntrega || 'Domicilio'],
  ])

  pdf.drawTable(
    [
      { title: 'Código', width: 0.9 },
      { title: 'Actividad de Taller', width: 2.3 },
      { title: 'Etapa', width: 1.1 },
      { title: 'Responsable', width: 1.5 },
      { title: 'Límite', width: 1.0 },
      { title: 'Avance', width: 0.8 },
      { title: 'Estado', width: 1.1 },
    ],
    tareasOrden.map((t) => [
      t.id,
      t.actividad,
      t.etapa || order.estado,
      t.responsable,
      t.fechaLimite || order.fechaEntrega,
      `${t.pct !== undefined ? t.pct : t.estado === 'Finalizada' ? 100 : 50}%`,
      t.estado,
    ])
  )

  // 3. Materiales Utilizados y Especificaciones Técnicas
  pdf.drawSectionTitle(3, 'Materiales Utilizados y Especificaciones Técnicas')
  const archivosRef = order.archivosReferencia || solicitudOrigen?.archivosReferencia || []
  pdf.drawKeyValueGrid([
    ['Producto solicitado', order.producto],
    ['Cantidad programada', `${order.cantidad} unidades`],
    ['Material principal', order.material],
    ['Dimensiones', order.dimensiones],
    ['Paleta de colores', order.colores || 'CMYK institucional'],
    ['Acabados de taller', order.acabados || 'Corte y empaque estándar'],
    [
      'Stock en inventario',
      materialInv
        ? `${materialInv.stockActual} ${materialInv.unidad} disponibles (${materialInv.proveedor})`
        : 'Disponible en almacén general',
    ],
    [
      'Archivos de referencia',
      archivosRef.length > 0 ? archivosRef.map((a) => a.nombre).join(', ') : 'Brief técnico estándar',
    ],
  ])

  // 4. Costos, Presupuesto y Fechas de Control
  pdf.drawSectionTitle(4, 'Presupuesto, Costos Asociados y Cronograma')
  pdf.drawKeyValueGrid([
    ['Presupuesto aprobado', formatoCOP(presupuesto)],
    ['Costo interno estimado', formatoCOP(costoInterno)],
    ['Margen operativo est.', `${formatoCOP(margen)} (${margenPct}%)`],
    ['Costo unitario promedio', formatoCOP(Math.round(presupuesto / Math.max(1, Number(order.cantidad) || 1)))],
    ['Fecha de solicitud', order.fechaSolicitud],
    ['Fecha límite entrega', order.fechaEntrega],
    ['Estado de cumplimiento', estaRetrasada(order) ? 'Con retraso' : estaEnRiesgo(order) ? 'En riesgo próximo' : 'En plazo normal'],
    ['Conformidad recepción', order.entrega?.conformidad || 'Pendiente de entrega final'],
  ])

  // 5. Observaciones y Resumen Ejecutivo Final
  pdf.drawSectionTitle(5, 'Observaciones Técnicas y Resumen Final')
  pdf.drawParagraphBox(
    'Requerimientos y Observaciones de la Orden',
    `Requerimientos: ${order.requerimientos || 'Sin requerimientos especiales.'} | Observaciones: ${
      order.observaciones || 'Ninguna observación adicional.'
    }`
  )

  const resumenFinal = `La orden ${order.id} del cliente ${order.cliente} (${order.producto}, ${order.cantidad} uds) registra un avance integral del ${pctAvance}% en la etapa de ${order.estado}. El diseño se encuentra en estado "${order.disenoEstado}" bajo responsabilidad gráfica de ${order.disenador || 'María López'} y coordinación operativa con ${order.responsable}. Presupuesto pactado: ${formatoCOP(presupuesto)} con costo estimado de planta de ${formatoCOP(costoInterno)}.`
  pdf.drawParagraphBox('Resumen Ejecutivo de Cierre / Supervisión', resumenFinal)

  pdf.drawSignatures()

  const bytes = pdf.build()
  const filename = `Reporte_Orden_${order.id}.pdf`
  if (descargar) {
    descargarBytesPDF(bytes, filename)
  }
  return { bytes, filename, reportNumber, fechaGen }
}

/**
 * Genera y descarga el Reporte General Ejecutivo de Producción e Inventario en PDF
 */
export function generarReporteGeneralPDF(data = {}, { descargar = true } = {}) {
  const orders = data.orders || []
  const inventory = data.inventory || []
  const suppliers = data.suppliers || []
  const movements = data.inventoryMovements || []

  const fechaGen = obtenerFechaHoraActual()
  const reportNumber = `REP-GEN-${new Date().getFullYear()}-${String(orders.length).padStart(2, '0')}${String(
    inventory.length
  ).padStart(2, '0')}`

  const activas = orders.filter(estaActiva)
  const retrasadas = activas.filter(estaRetrasada)
  const presupuestoTotal = orders.reduce((acc, o) => acc + Number(o.presupuesto || 0), 0)
  const costoTotal = orders.reduce((acc, o) => acc + Number(o.costoInterno || Math.round(Number(o.presupuesto || 0) * 0.6)), 0)
  const valorInventario = inventory.reduce((acc, m) => acc + Number(m.stockActual || 0) * Number(m.costoUnitario || 0), 0)
  const valorUtilizado = inventory.reduce((acc, m) => acc + Number(m.cantidadUtilizada || 0) * Number(m.costoUnitario || 0), 0)
  const alertasStock = inventory.filter((m) => Number(m.stockActual || 0) <= Number(m.stockMinimo || 0))

  const pdf = new OrvexPdfBuilder({
    reportNumber,
    title: 'Reporte General de Producción e Inventario',
    subtitle: `Consolidado de Órdenes, Responsables, Materiales, Proveedores y Presupuesto`,
    fechaGeneracion: fechaGen,
  })

  // KPIs ejecutivos
  pdf.drawKpiRow([
    { label: 'Órdenes Totales / Activas', value: `${orders.length} (${activas.length} activas)` },
    { label: 'Órdenes Retrasadas', value: `${retrasadas.length} en alerta` },
    { label: 'Presupuesto Total Órdenes', value: formatoCOP(presupuestoTotal) },
    { label: 'Valor Stock en Bodega', value: formatoCOP(valorInventario) },
  ])

  // 1. Resumen Financiero y Operativo de Planta
  pdf.drawSectionTitle(1, 'Indicadores Globales de Producción y Presupuesto')
  pdf.drawKeyValueGrid([
    ['Total órdenes registradas', `${orders.length} órdenes`],
    ['Órdenes activas en planta', `${activas.length} órdenes`],
    ['Facturación / Presupuesto', formatoCOP(presupuestoTotal)],
    ['Costo interno de órdenes', formatoCOP(costoTotal)],
    ['Valor inventario disponible', formatoCOP(valorInventario)],
    ['Valor recursos utilizados', formatoCOP(valorUtilizado)],
    ['Materiales con bajo stock', `${alertasStock.length} insumos en alerta`],
    ['Proveedores homologados', `${suppliers.length} proveedores activos`],
  ])

  // 2. Consolidado de Órdenes de Producción
  pdf.drawSectionTitle(2, 'Estado General de Órdenes de Producción y Responsables')
  pdf.drawTable(
    [
      { title: 'Orden', width: 1.15 },
      { title: 'Cliente', width: 1.55 },
      { title: 'Producto', width: 1.75 },
      { title: 'Etapa', width: 0.95 },
      { title: 'Diseñador', width: 1.15 },
      { title: 'Responsable', width: 1.15 },
      { title: 'Entrega', width: 0.9 },
      { title: 'Presupuesto', width: 1.1 },
    ],
    orders.map((o) => [
      o.id,
      o.cliente,
      o.producto,
      o.estado,
      o.disenador || 'María López',
      o.responsable,
      o.fechaEntrega,
      formatoCOP(o.presupuesto),
    ])
  )

  // 3. Inventario de Materiales, Existencias y Costos
  pdf.drawSectionTitle(3, 'Inventario de Materiales, Existencias y Alertas')
  pdf.drawTable(
    [
      { title: 'Código', width: 0.85 },
      { title: 'Material / Insumo', width: 1.9 },
      { title: 'Categoría', width: 1.35 },
      { title: 'Disponible', width: 0.95 },
      { title: 'Utilizado', width: 0.9 },
      { title: 'Mínimo', width: 0.8 },
      { title: 'Costo Unit.', width: 1.0 },
      { title: 'Estado', width: 0.95 },
    ],
    inventory.map((m) => [
      m.id,
      m.nombre,
      m.categoria,
      `${m.stockActual} ${m.unidad}`,
      `${m.cantidadUtilizada} ${m.unidad}`,
      `${m.stockMinimo} ${m.unidad}`,
      formatoCOP(m.costoUnitario),
      Number(m.stockActual) <= Number(m.stockMinimo) ? 'BAJO STOCK' : 'Óptimo',
    ])
  )

  // 4. Proveedores y Movimientos Recientes
  pdf.drawSectionTitle(4, 'Proveedores Activos y Movimientos Recientes de Almacén')
  pdf.drawTable(
    [
      { title: 'Código', width: 0.9 },
      { title: 'Proveedor', width: 1.9 },
      { title: 'Contacto', width: 1.2 },
      { title: 'Teléfono', width: 1.1 },
      { title: 'Correo', width: 1.6 },
      { title: 'Productos que suministra', width: 2.3 },
    ],
    suppliers.map((p) => [p.id, p.nombre, p.contacto, p.telefono, p.correo, p.productos])
  )

  if (movements.length > 0) {
    pdf.drawTable(
      [
        { title: 'Fecha', width: 1.0 },
        { title: 'Tipo', width: 0.8 },
        { title: 'Material', width: 1.8 },
        { title: 'Cantidad', width: 1.0 },
        { title: 'Orden', width: 1.1 },
        { title: 'Responsable', width: 1.2 },
        { title: 'Observación', width: 2.1 },
      ],
      movements.slice(0, 8).map((mv) => [
        `${mv.fecha} ${mv.hora || ''}`.trim(),
        mv.tipo,
        mv.material,
        `${mv.cantidad} ${mv.unidad || ''}`.trim(),
        mv.ordenId || 'Almacén',
        mv.responsable,
        mv.observacion,
      ])
    )
  }

  pdf.drawParagraphBox(
    'Resumen Ejecutivo Final',
    `El presente reporte consolida ${orders.length} órdenes de producción por un valor presupuestado de ${formatoCOP(
      presupuestoTotal
    )} y un inventario valorizado en ${formatoCOP(valorInventario)} (${formatoCOP(
      valorUtilizado
    )} en materiales consumidos). Se registran ${alertasStock.length} materiales en nivel de reposición prioritaria.`
  )

  pdf.drawSignatures(['Coordinación de Producción', 'Gerencia General', 'Auditoría de Inventario'])

  const bytes = pdf.build()
  const filename = `Reporte_General_Produccion_Inventario_ORVEX.pdf`
  if (descargar) {
    descargarBytesPDF(bytes, filename)
  }
  return { bytes, filename, reportNumber, fechaGen }
}
