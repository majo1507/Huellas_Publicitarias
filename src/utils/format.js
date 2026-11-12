import { ETAPAS } from '../data/mockData.js'

// Funciones auxiliares de fechas, dinero y estados de las órdenes

// Criterio temporal unificado: siempre la fecha actual del sistema
export function obtenerFechaReferencia() {
  return new Date()
}

const dos = (n) => String(n).padStart(2, '0')
const DIA_MS = 86400000

// "10/10/2026" -> objeto Date
export function parseFecha(texto) {
  if (!texto) return new Date()
  if (texto instanceof Date) return texto
  if (typeof texto === 'string' && texto.includes('/')) {
    const [dia, mes, anio] = texto.split('/').map(Number)
    return new Date(anio, mes - 1, dia)
  }
  return new Date(texto)
}

// Date -> "dd/MM/yyyy" en zona horaria America/Bogota
export function formatearFechaBogota(fecha = new Date()) {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return typeof fecha === 'string' ? fecha : ''
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

// Date -> "HH:mm" en zona horaria America/Bogota
export function formatearHoraBogota(fecha = new Date()) {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

// Date -> "dd/MM/yyyy"
export function formatearFecha(fecha = new Date()) {
  return formatearFechaBogota(fecha)
}

// Date -> "HH:mm"
export function formatearHora(fecha = new Date()) {
  return formatearHoraBogota(fecha)
}

// 350000 -> "$ 350.000"
export function formatoCOP(valor) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor)
}

// "María López" -> "ML"
export const iniciales = (nombre = '') =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

// Una orden está activa mientras no haya sido entregada o cerrada
export const estaActiva = (orden) => orden.estado !== 'Entrega' && orden.estado !== 'Postventa' && orden.estado !== 'Cerrada'

export function diasParaEntrega(orden) {
  const fRef = obtenerFechaReferencia()
  fRef.setHours(0, 0, 0, 0)
  const fEnt = parseFecha(orden.fechaEntrega)
  fEnt.setHours(0, 0, 0, 0)
  return Math.round((fEnt - fRef) / DIA_MS)
}

export const estaRetrasada = (orden) => estaActiva(orden) && diasParaEntrega(orden) < 0

// En riesgo: faltan 3 días o menos para la entrega
export function estaEnRiesgo(orden) {
  const dias = diasParaEntrega(orden)
  return estaActiva(orden) && dias >= 0 && dias <= 3
}

// Prioridad de una orden según qué tan cerca está su entrega
export function prioridadOrden(orden) {
  if (!estaActiva(orden)) return 'Baja'
  if (estaRetrasada(orden) || estaEnRiesgo(orden)) return 'Alta'
  return diasParaEntrega(orden) <= 8 ? 'Media' : 'Baja'
}

// Texto corto sobre el plazo de entrega: "Faltan 7 días", "2 días de retraso"...
export function textoPlazo(orden) {
  if (orden.estado === 'Cerrada') return 'Orden cerrada'
  if (!estaActiva(orden)) return 'Entregada'
  const d = diasParaEntrega(orden)
  if (d < 0) return `${-d} ${-d === 1 ? 'día' : 'días'} de retraso`
  if (d === 0) return 'Vence hoy'
  return `Faltan ${d} ${d === 1 ? 'día' : 'días'}`
}

// Porcentaje de avance según la etapa (Solicitud = 0%, Entrega/Cerrada = 100%)
export function progreso(orden) {
  if (orden.estado === 'Cerrada') return 100
  const posicion = ETAPAS.indexOf(orden.estado)
  return Math.round((Math.min(posicion, 6) / 6) * 100)
}

// Texto del estado del diseño que ve el cliente
export function etiquetaDiseno(estado) {
  return estado === 'Enviado' ? 'Pendiente de aprobación' : estado
}

// Última versión de diseño de una orden (o undefined si aún no hay)
export const ultimaVersion = (orden) => orden.versiones?.[orden.versiones.length - 1]

// REGLA DE NEGOCIO (HU-13, RF-07): una orden no puede pasar a Impresión (ni a etapas posteriores)
// si la última versión vigente de diseño no está explícitamente aprobada por el cliente con evidencia.
export function puedeAvanzar(orden, tareas = []) {
  if (orden.estado === 'Cerrada') {
    return { ok: false, bloqueada: true, siguiente: null, motivo: 'La orden está cerrada formalmente y no admite más avances.' }
  }
  const siguiente = ETAPAS[ETAPAS.indexOf(orden.estado) + 1]
  if (!siguiente) return { ok: false, bloqueada: false, siguiente: null, motivo: 'La orden ya completó todo el flujo.' }
  const ultima = ultimaVersion(orden)
  const aprobado = (
    orden.disenoEstado === 'Aprobado' ||
    orden.disenoEstado === 'Aprobado por el cliente' ||
    orden.disenoEstado === 'Listo para impresión'
  ) && Boolean(
    ultima && (
      ultima.estado === 'Aprobada' ||
      ultima.estado === 'Aprobado por el cliente' ||
      ultima.estado_aprobacion === 'aprobado'
    )
  )

  const estadosBloqueantes = [
    'En diseño',
    'Revisión técnica de archivo',
    'Pendiente de gestión comercial',
    'Esperando respuesta del cliente',
    'Cambios solicitados',
  ]

  if (ETAPAS.indexOf(siguiente) >= ETAPAS.indexOf('Impresión')) {
    if (estadosBloqueantes.includes(orden.disenoEstado) || !aprobado) {
      let motivo = 'El pedido no puede pasar a impresión porque el diseño vigente aún no ha sido aprobado formalmente.'
      if (orden.disenoEstado === 'Revisión técnica de archivo') {
        motivo = 'Paso a impresión bloqueado: el archivo suministrado está pendiente de revisión técnica de pre-prensa y VoBo del cliente.'
      } else if (orden.disenoEstado === 'Esperando respuesta del cliente') {
        motivo = 'Paso a impresión bloqueado: el diseño está esperando respuesta del cliente.'
      } else if (orden.disenoEstado === 'Pendiente de gestión comercial') {
        motivo = 'Paso a impresión bloqueado: el diseño está pendiente de gestión comercial con el cliente.'
      } else if (orden.disenoEstado === 'Cambios solicitados') {
        motivo = 'Paso a impresión bloqueado: el cliente solicitó modificaciones para el diseño.'
      } else if (orden.disenoEstado === 'En diseño') {
        motivo = 'Paso a impresión bloqueado: el diseño se encuentra en preparación.'
      }
      return {
        ok: false,
        bloqueada: true,
        siguiente,
        motivo,
      }
    }
  }

  // Verificación de actividades obligatorias de la etapa actual (solo si existen actividades asignadas)
  if (Array.isArray(tareas) && tareas.length > 0) {
    const tareasEtapaActual = tareas.filter(
      (t) => (t.ordenId === orden.id || String(t.orden_id) === String(orden.id)) && t.etapa === orden.estado
    )
    if (tareasEtapaActual.length > 0) {
      const tareasIncompletas = tareasEtapaActual.filter(
        (t) => t.estado !== 'Finalizada' || (t.pct !== undefined && Number(t.pct) < 100)
      )
      if (tareasIncompletas.length > 0) {
        return {
          ok: false,
          bloqueada: true,
          siguiente,
          motivo: `Etapa en ejecución: aún hay ${tareasIncompletas.length} actividad(es) obligatoria(s) sin finalizar en ${orden.estado}.`,
        }
      }
    }
  }

  return { ok: true, bloqueada: false, siguiente, motivo: '' }
}

// REGLA DE NEGOCIO (HU-20): Validación exhaustiva para el cierre de una orden.
// Verifica que se hayan completado todas las etapas, finalizado todas las actividades,
// registrado la entrega con acta de conformidad y que no existan casos de postventa abiertos.
export function validarCierreOrden(orden, tareas = [], casos = []) {
  const impedimentos = []

  // 1. Debe estar en etapa de Entrega o Postventa
  if (!['Entrega', 'Postventa'].includes(orden.estado)) {
    impedimentos.push(`La orden se encuentra en etapa "${orden.estado}". Solo pueden cerrarse órdenes que hayan completado la entrega (etapas Entrega o Postventa).`)
  }

  // 2. Diseño vigente debe estar aprobado
  const ultima = ultimaVersion(orden)
  const disenoOrdenAprobado = ['Aprobado', 'Aprobado por el cliente', 'Listo para impresión'].includes(orden.disenoEstado)
  const versionVigenteAprobada = Boolean(
    ultima &&
      (ultima.estado === 'Aprobada' ||
        ultima.estado === 'Aprobado por el cliente' ||
        ultima.estado_aprobacion === 'aprobado')
  )
  if (!disenoOrdenAprobado || !versionVigenteAprobada) {
    impedimentos.push('El diseño de la orden no cuenta con versión vigente aprobada.')
  }

  // 3. Actividades de taller finalizadas al 100%
  const tareasDeOrden = tareas.filter((t) => t.ordenId === orden.id)
  const tareasIncompletas = tareasDeOrden.filter((t) => t.estado !== 'Finalizada')
  if (tareasIncompletas.length > 0) {
    const nombres = tareasIncompletas.map((t) => `"${t.actividad}" (${t.estado}, ${t.pct || 0}%)`).join(', ')
    impedimentos.push(`Existen ${tareasIncompletas.length} actividad(es) de taller pendientes de finalizar: ${nombres}.`)
  }

  // 4. Datos de recepción y entrega registrados
  const tieneContacto = Boolean(orden.entrega?.contacto && orden.entrega.contacto.trim().length > 0)
  if (!tieneContacto) {
    impedimentos.push('Falta registrar los datos del receptor en el acta de entrega.')
  }

  // 5. Casos de postventa abiertos o en trámite (excluye calificaciones de satisfacción y casos resueltos o cerrados)
  const casosPendientes = casos.filter(
    (c) =>
      c.ordenId === orden.id &&
      c.categoria !== 'Satisfacción' &&
      c.tipo !== 'Satisfacción' &&
      c.estado !== 'Resuelto' &&
      c.estado !== 'Cerrado'
  )
  if (casosPendientes.length > 0) {
    const ids = casosPendientes.map((c) => `${c.id} (${c.subtipo || c.tipo} - ${c.estado})`).join(', ')
    impedimentos.push(`Existen ${casosPendientes.length} caso(s) de postventa sin resolver: ${ids}.`)
  }

  return {
    puedeCerrar: impedimentos.length === 0,
    impedimentos,
  }
}

// "05/10/2026" + "14:30" -> Date
function fechaHoraEvento(evento) {
  const base = parseFecha(evento.fecha)
  const [h, m] = (evento.hora || '00:00').split(':').map(Number)
  base.setHours(h, m)
  return base
}

// Eventos más recientes de todas las órdenes (para el resumen de actividad).
// Si "soloPublicos" es true se omiten los eventos internos (vista del cliente).
export function eventosRecientes(orders, { soloPublicos = false, limite = 6 } = {}) {
  return orders
    .flatMap((o) => o.historial.map((h) => ({ ...h, ordenId: o.id, cliente: o.cliente })))
    .filter((h) => !(soloPublicos && h.interno))
    .sort((a, b) => fechaHoraEvento(b) - fechaHoraEvento(a))
    .slice(0, limite)
}

// Serie de las últimas 6 semanas: órdenes recibidas y entregadas (calculada dinámicamente con fechas reales)
export function serieSemanal(orders, semanas = 6) {
  const resultado = []
  const ref = obtenerFechaReferencia()
  for (let i = semanas - 1; i >= 0; i--) {
    const fin = new Date(ref.getTime() - i * 7 * DIA_MS)
    const inicio = new Date(fin.getTime() - 6 * DIA_MS)
    const enRango = (texto) => {
      const f = parseFecha(texto)
      return f >= inicio && f <= fin
    }
    resultado.push({
      label: `${dos(inicio.getDate())}/${dos(inicio.getMonth() + 1)}`,
      recibidas: orders.filter((o) => enRango(o.fechaSolicitud)).length,
      entregadas: orders.filter((o) => !estaActiva(o) && enRango(o.fechaEntrega)).length,
    })
  }
  return resultado
}

// Calificación en estrellas: 4 -> ★★★★☆ (o "-" si no hay calificación)
export const estrellas = (n) => (n ? '\u2605'.repeat(n) + '\u2606'.repeat(5 - n) : '-')
