// Etiqueta de estado con punto semántico e indicador de actividad en vivo.
// Azules/grises: etapas del proceso. Verde, amarillo y rojo: SOLO estados (aprobado, advertencia, error).
const colores = {
  // Etapas del pedido
  Solicitud: 'celeste',
  Diseño: 'azul',
  Aprobación: 'azul',
  Impresión: 'azul',
  Acabados: 'azul',
  Despacho: 'celeste',
  Entrega: 'verde',
  Entregado: 'verde',
  Postventa: 'gris',
  Cerrada: 'gris',
  Cerrado: 'gris',
  // Diseño
  Aprobado: 'verde',
  Aprobada: 'verde',
  'Aprobado por el cliente': 'verde',
  'Listo para impresión': 'verde',
  'En diseño': 'azul',
  'Pendiente de gestión comercial': 'amarillo',
  'Esperando respuesta del cliente': 'amarillo',
  'Cambios solicitados': 'rojo',
  Pendiente: 'amarillo',
  Enviado: 'amarillo',
  Enviada: 'amarillo',
  'Pendiente de aprobación': 'amarillo',
  'Requiere cambios': 'rojo',
  Rechazada: 'rojo',
  'Devuelta para corrección': 'amarillo',
  // Estados financieros y pagos
  Pagado: 'verde',
  'Abono parcial': 'amarillo',
  'Pendiente de pago': 'rojo',
  'Sin pago': 'gris',
  // Historial, tareas y solicitudes
  Completado: 'verde',
  'En proceso': 'azul',
  'En validación': 'celeste',
  Pausada: 'amarillo',
  Finalizada: 'verde',
  // Casos de postventa
  Abierto: 'rojo',
  'En trámite': 'amarillo',
  'En revisión': 'celeste',
  Resuelto: 'verde',
  Vigente: 'verde',
  Registrado: 'gris',
  Activo: 'verde',
  // Tipos PQRSF
  Petición: 'celeste',
  Queja: 'amarillo',
  Reclamo: 'rojo',
  Sugerencia: 'azul',
  Felicitación: 'verde',
  // Dictámenes de garantía
  Procedente: 'verde',
  'Procedente parcial': 'amarillo',
  'No procedente': 'rojo',
  'Pendiente de evaluación': 'amarillo',
  // Alertas y prioridad
  Retrasada: 'rojo',
  'En riesgo': 'amarillo',
  Alta: 'rojo',
  Media: 'amarillo',
  Baja: 'gris',
  'En despacho': 'celeste',
  Entregada: 'verde',
}

const ESTADOS_EN_VIVO = new Set([
  'En proceso',
  'Impresión',
  'Acabados',
  'En validación',
  'En despacho',
  'En trámite',
  'En revisión',
  'Abierto',
  'Retrasada',
])

export default function StatusBadge({ estado, texto }) {
  const tono = colores[estado] || 'gris'
  const enVivo = ESTADOS_EN_VIVO.has(estado)

  return (
    <span className={`badge badge-${tono}${enVivo ? ' badge-live' : ''}`}>
      <span className={`badge-dot${enVivo ? ' live-indicator' : ''}`} />
      <span className="badge-label">{texto || estado}</span>
    </span>
  )
}
