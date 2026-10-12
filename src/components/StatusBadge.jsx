// Etiqueta de estado con punto de color.
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
  // Diseño
  Aprobado: 'verde',
  Aprobada: 'verde',
  Pendiente: 'amarillo',
  Enviado: 'amarillo',
  Enviada: 'amarillo',
  'Pendiente de aprobación': 'amarillo',
  'Requiere cambios': 'rojo',
  Rechazada: 'rojo',
  // Historial, tareas y solicitudes
  Completado: 'verde',
  'En proceso': 'azul',
  'En validación': 'celeste',
  Pausada: 'amarillo',
  Finalizada: 'verde',
  // Casos de postventa
  Abierto: 'rojo',
  'En trámite': 'amarillo',
  Resuelto: 'verde',
  Vigente: 'verde',
  Registrado: 'gris',
  Activo: 'verde',
  // Alertas y prioridad
  Retrasada: 'rojo',
  'En riesgo': 'amarillo',
  Alta: 'rojo',
  Media: 'amarillo',
  Baja: 'gris',
  'En despacho': 'celeste',
  Entregada: 'verde',
}

export default function StatusBadge({ estado, texto }) {
  return (
    <span className={`badge badge-${colores[estado] || 'gris'}`}>
      <span className="badge-dot" />
      {texto || estado}
    </span>
  )
}
