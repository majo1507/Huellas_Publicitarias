// ============================================================
// notificaciones.js — Avisos internos derivados de los datos reales
// ============================================================
// Las notificaciones de la barra superior se calculan a partir de las solicitudes, órdenes,
// tareas y casos cargados (PostgreSQL o modo demostración). No existe un servicio externo
// de mensajería: cada aviso refleja un estado que el rol activo debe atender.

import { estaRetrasada } from './format.js'

const ESTADOS_DISENO_APROBADO = ['Aprobado', 'Aprobado por el cliente', 'Listo para impresión']
const ESTADOS_GESTION_COMERCIAL = ['Pendiente de gestión comercial', 'Enviado', 'Esperando respuesta del cliente', 'Pendiente de soporte']
const ESTADOS_CAMBIOS = ['Requiere cambios', 'Cambios solicitados']
const ETAPAS_TALLER = ['Impresión', 'Acabados', 'Despacho']

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const mismaPersona = (a, b) => Boolean(a && b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

/**
 * Construye la lista de avisos para un rol a partir de los datos cargados.
 * @returns {{ id: string, texto: string, page: string, orderId?: string, tipo: 'aviso'|'error'|'info' }[]}
 */
export function construirNotificaciones(rol, data = {}, usuarioNombre = '') {
  const orders = data.orders || []
  const requests = data.requests || []
  const tasks = data.tasks || []
  const cases = data.cases || []
  const avisos = []
  const add = (id, cantidad, texto, page, tipo = 'aviso', orderId = null) => {
    if (cantidad > 0) avisos.push({ id, texto, page, tipo, orderId })
  }

  switch (rol) {
    case 'comercial': {
      const sinEnviar = requests.filter((s) => s.estado === 'Pendiente').length
      const devueltas = requests.filter((s) => s.estado === 'Devuelta para corrección').length
      const porGestionar = orders.filter((o) => ESTADOS_GESTION_COMERCIAL.includes(o.disenoEstado))
      add('com-sin-enviar', sinEnviar, `${plural(sinEnviar, 'solicitud está', 'solicitudes están')} sin enviar a Coordinación.`, 'solicitudes')
      add('com-devueltas', devueltas, `${plural(devueltas, 'solicitud fue devuelta', 'solicitudes fueron devueltas')} para corrección.`, 'solicitudes', 'error')
      add('com-disenos', porGestionar.length, `${plural(porGestionar.length, 'diseño espera', 'diseños esperan')} respuesta del cliente.`, 'aprobacion_disenos', 'aviso', porGestionar.length === 1 ? porGestionar[0].id : null)
      break
    }
    case 'coordinador': {
      const enValidacion = requests.filter((s) => s.estado === 'En validación').length
      const aprobadasSinOrden = requests.filter((s) => s.estado === 'Aprobada' && !s.ordenId).length
      const porLiberar = orders.filter((o) => o.estado === 'Aprobación' && ESTADOS_DISENO_APROBADO.includes(o.disenoEstado))
      const retrasadas = orders.filter((o) => estaRetrasada(o)).length
      add('coo-validar', enValidacion, `${plural(enValidacion, 'solicitud espera', 'solicitudes esperan')} validación.`, 'solicitudes')
      add('coo-sin-orden', aprobadasSinOrden, `${plural(aprobadasSinOrden, 'solicitud aprobada', 'solicitudes aprobadas')} sin orden de producción.`, 'solicitudes', 'info')
      add('coo-liberar', porLiberar.length, `${plural(porLiberar.length, 'diseño aprobado espera', 'diseños aprobados esperan')} liberación a impresión.`, 'pedidos', 'aviso', porLiberar.length === 1 ? porLiberar[0].id : null)
      add('coo-retraso', retrasadas, `${plural(retrasadas, 'orden está retrasada', 'órdenes están retrasadas')}.`, 'pedidos', 'error')
      break
    }
    case 'disenador': {
      const propias = orders.filter((o) => !usuarioNombre || !o.disenador || mismaPersona(o.disenador, usuarioNombre))
      const cambios = propias.filter((o) => ESTADOS_CAMBIOS.includes(o.disenoEstado))
      const pendientes = propias.filter((o) => o.estado === 'Diseño' && ['Pendiente', 'En proceso'].includes(o.disenoEstado))
      add('dis-cambios', cambios.length, `${plural(cambios.length, 'diseño tiene', 'diseños tienen')} cambios solicitados por el cliente.`, 'disenos', 'error', cambios.length === 1 ? cambios[0].id : null)
      add('dis-pendientes', pendientes.length, `${plural(pendientes.length, 'orden espera', 'órdenes esperan')} propuesta de diseño.`, 'disenos', 'info')
      break
    }
    case 'operario': {
      const propias = tasks.filter((t) => !usuarioNombre || !t.responsable || mismaPersona(t.responsable, usuarioNombre))
      const pendientes = propias.filter((t) => t.estado === 'Pendiente').length
      const enTaller = orders.filter((o) => ETAPAS_TALLER.includes(o.estado)).length
      add('ope-tareas', pendientes, `${plural(pendientes, 'tarea asignada está pendiente', 'tareas asignadas están pendientes')}.`, 'inicio')
      add('ope-taller', enTaller, `${plural(enTaller, 'orden está', 'órdenes están')} en impresión, acabados o despacho.`, 'inicio', 'info')
      break
    }
    case 'postventa': {
      const abiertos = cases.filter((c) => ['Abierto', 'En trámite'].includes(c.estado)).length
      const reposicion = cases.filter((c) => c.estado === 'En reposición').length
      const porCerrar = orders.filter((o) => o.estado === 'Postventa').length
      add('pv-abiertos', abiertos, `${plural(abiertos, 'caso abierto requiere', 'casos abiertos requieren')} seguimiento.`, 'inicio')
      add('pv-reposicion', reposicion, `${plural(reposicion, 'caso está', 'casos están')} en reposición.`, 'inicio', 'info')
      add('pv-cierre', porCerrar, `${plural(porCerrar, 'orden entregada espera', 'órdenes entregadas esperan')} cierre o encuesta.`, 'pedidos', 'info')
      break
    }
    case 'gerencia': {
      const retrasadas = orders.filter((o) => estaRetrasada(o)).length
      const bloqueadas = orders.filter((o) => o.blocked || o.bloqueado).length
      const casos = cases.filter((c) => ['Abierto', 'En trámite'].includes(c.estado)).length
      add('ger-retraso', retrasadas, `${plural(retrasadas, 'orden está retrasada', 'órdenes están retrasadas')}.`, 'inicio', 'error')
      add('ger-bloqueo', bloqueadas, `${plural(bloqueadas, 'orden está bloqueada', 'órdenes están bloqueadas')} por reglas de aprobación.`, 'inicio')
      add('ger-casos', casos, `${plural(casos, 'caso de postventa sigue', 'casos de postventa siguen')} abiertos.`, 'inicio', 'info')
      break
    }
    default:
      break
  }
  return avisos
}
