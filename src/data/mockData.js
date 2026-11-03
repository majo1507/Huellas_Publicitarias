// Datos ficticios del prototipo. Todos los roles leen y modifican ESTOS mismos datos
// (viven en el estado de React dentro de App.jsx). Más adelante se reemplazarán por una base de datos.

// Etapas del flujo de producción (en orden)
export const ETAPAS = [
  'Solicitud',
  'Diseño',
  'Aprobación',
  'Impresión',
  'Acabados',
  'Despacho',
  'Entrega',
  'Postventa',
]

// Tiempo promedio (en días) que toma cada etapa. Dato ficticio para gerencia.
export const TIEMPO_PROMEDIO_ETAPA = {
  Diseño: 2.4,
  Aprobación: 1.3,
  Impresión: 3.2,
  Acabados: 2.1,
  Despacho: 0.8,
}

// Operarios disponibles para asignar actividades
export const OPERARIOS = ['Juan Pérez', 'Pedro Ramírez']

// ---------------------------------------------------------------------------
// USUARIOS INTERNOS
// ---------------------------------------------------------------------------
export const initialUsers = [
  { id: 'U1', nombre: 'Ana Martínez', cargo: 'Comercial / Recepción', rol: 'Comercial', correo: 'ana.martinez@orvex.test', estado: 'Activo' },
  { id: 'U2', nombre: 'Carlos Ruiz', cargo: 'Coordinador de producción', rol: 'Coordinador', correo: 'carlos.ruiz@orvex.test', estado: 'Activo' },
  { id: 'U3', nombre: 'María López', cargo: 'Diseñadora gráfica', rol: 'Diseñador', correo: 'maria.lopez@orvex.test', estado: 'Activo' },
  { id: 'U4', nombre: 'Juan Pérez', cargo: 'Operario de impresión', rol: 'Operario', correo: 'juan.perez@orvex.test', estado: 'Activo' },
  { id: 'U5', nombre: 'Pedro Ramírez', cargo: 'Operario de acabados', rol: 'Operario', correo: 'pedro.ramirez@orvex.test', estado: 'Activo' },
  { id: 'U6', nombre: 'Sofía Herrera', cargo: 'Atención postventa', rol: 'Postventa', correo: 'sofia.herrera@orvex.test', estado: 'Activo' },
  { id: 'U7', nombre: 'Andrés Torres', cargo: 'Gerente general', rol: 'Gerencia', correo: 'andres.torres@orvex.test', estado: 'Activo' },
]

// ---------------------------------------------------------------------------
// CLIENTES
// ---------------------------------------------------------------------------
export const initialClients = [
  { id: 'C1', nombre: 'Empresa ABC', contacto: 'Laura Gómez', telefono: '300 111 2233', correo: 'laura@empresaabc.test', direccion: 'Cra 15 # 80-20', ciudad: 'Bogotá' },
  { id: 'C2', nombre: 'Comercial XYZ', contacto: 'Mario Díaz', telefono: '301 222 3344', correo: 'mario@comercialxyz.test', direccion: 'Calle 45 # 12-30', ciudad: 'Medellín' },
  { id: 'C3', nombre: 'Café Central', contacto: 'Paula Ortiz', telefono: '302 333 4455', correo: 'paula@cafecentral.test', direccion: 'Cra 7 # 32-10', ciudad: 'Bogotá' },
  { id: 'C4', nombre: 'Gimnasio Fuerza', contacto: 'Diego Castro', telefono: '303 444 5566', correo: 'diego@gimnasiofuerza.test', direccion: 'Av. 68 # 45-12', ciudad: 'Bogotá' },
  { id: 'C5', nombre: 'Droguería Salud Total', contacto: 'Natalia Rojas', telefono: '304 555 6677', correo: 'natalia@saludtotal.test', direccion: 'Calle 100 # 15-40', ciudad: 'Cali' },
  { id: 'C6', nombre: 'Constructora Andes', contacto: 'Felipe Vargas', telefono: '305 666 7788', correo: 'felipe@constructoraandes.test', direccion: 'Cra 50 # 20-15', ciudad: 'Medellín' },
  { id: 'C7', nombre: 'Colegio San Marcos', contacto: 'Rosa Medina', telefono: '306 777 8899', correo: 'rosa@sanmarcos.test', direccion: 'Calle 63 # 24-50', ciudad: 'Bogotá' },
  { id: 'C8', nombre: 'Restaurante El Fogón', contacto: 'Camilo Peña', telefono: '307 888 9900', correo: 'camilo@elfogon.test', direccion: 'Cra 13 # 85-25', ciudad: 'Bogotá' },
]

// ---------------------------------------------------------------------------
// ÓRDENES DE PRODUCCIÓN
// ---------------------------------------------------------------------------

// Atajos para escribir los datos de ejemplo más corto
// ev = evento del historial, ver = versión de diseño
const ev = (fecha, hora, actividad, responsable, estado = 'Completado', interno = false) => ({ fecha, hora, actividad, responsable, estado, interno })
const ver = (numero, fecha, estado, comentario = '') => ({ numero, fecha, disenador: 'María López', estado, comentario })

// Completa los datos que se repiten en todas las órdenes
function crearOrden(datos) {
  const { n, metodoEntrega, blocked = false, blockReason = '', ...resto } = datos
  const cliente = initialClients.find((c) => c.id === datos.clienteId)
  return {
    disenador: 'María López',
    observaciones: '',
    requerimientos: '',
    blocked,
    blockReason,
    ...resto,
    id: `OP-2026-${String(n).padStart(4, '0')}`,
    cliente: cliente.nombre,
    costoInterno: Math.round(datos.presupuesto * 0.6), // dato interno: el cliente NO lo ve
    entrega: { direccion: `${cliente.direccion}, ${cliente.ciudad}`, metodo: metodoEntrega, contacto: cliente.contacto },
  }
}

// disenoEstado: Pendiente | En proceso | Enviado | Aprobado | Requiere cambios
export const initialOrders = [
  crearOrden({
    n: 1, clienteId: 'C1', producto: 'Pendón publicitario', cantidad: 5, material: 'Lona', dimensiones: '2m x 1m',
    colores: 'Azul y verde corporativo', acabados: 'Ojales y refuerzo', fechaSolicitud: '28/09/2026', fechaEntrega: '10/10/2026',
    estado: 'Impresión', disenoEstado: 'Aprobado', responsable: 'Juan Pérez', presupuesto: 350000, metodoEntrega: 'Domicilio',
    requerimientos: 'Logo en alta resolución, colores corporativos.', observaciones: 'Entregar en la sede principal.',
    versiones: [ver(1, '29/09/2026', 'Aprobada')],
    historial: [
      ev('28/09/2026', '09:15', 'Solicitud creada', 'Ana Martínez'),
      ev('28/09/2026', '10:40', 'Orden generada', 'Carlos Ruiz'),
      ev('28/09/2026', '11:00', 'Actividad asignada: diseño a María López', 'Carlos Ruiz', 'Completado', true),
      ev('29/09/2026', '14:20', 'Diseño creado (versión 1)', 'María López'),
      ev('30/09/2026', '08:50', 'Diseño enviado al cliente', 'María López'),
      ev('30/09/2026', '16:05', 'Diseño aprobado', 'Laura Gómez'),
      ev('01/10/2026', '09:00', 'Orden enviada a impresión', 'Carlos Ruiz'),
    ],
  }),
  crearOrden({
    n: 2, clienteId: 'C2', producto: 'Papelería corporativa', cantidad: 100, material: 'Papel', dimensiones: 'Carta',
    colores: 'Negro y azul', acabados: 'Corte y empaque', fechaSolicitud: '01/10/2026', fechaEntrega: '12/10/2026',
    estado: 'Diseño', disenoEstado: 'En proceso', responsable: 'María López', presupuesto: 220000, metodoEntrega: 'Domicilio',
    requerimientos: 'Hojas membretadas y tarjetas de presentación.',
    versiones: [ver(1, '02/10/2026', 'En proceso')],
    historial: [
      ev('01/10/2026', '10:10', 'Solicitud creada', 'Ana Martínez'),
      ev('01/10/2026', '11:30', 'Orden generada', 'Carlos Ruiz'),
      ev('02/10/2026', '09:20', 'Diseño creado (versión 1)', 'María López'),
    ],
  }),
  crearOrden({
    n: 3, clienteId: 'C1', producto: 'Vinilo para vitrina', cantidad: 2, material: 'Vinilo adhesivo', dimensiones: '1.5m x 1m',
    colores: 'Verde y blanco', acabados: 'Laminado mate', fechaSolicitud: '29/09/2026', fechaEntrega: '13/10/2026',
    estado: 'Aprobación', disenoEstado: 'Enviado', responsable: 'María López', presupuesto: 180000, metodoEntrega: 'Instalación en sitio',
    requerimientos: 'Incluir horario de atención.', observaciones: 'Instalar en horario de la mañana.',
    versiones: [
      ver(1, '30/09/2026', 'Rechazada', 'Cambiar el color del logo al verde corporativo.'),
      ver(2, '02/10/2026', 'Enviada'),
    ],
    historial: [
      ev('29/09/2026', '08:45', 'Solicitud creada', 'Ana Martínez'),
      ev('29/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
      ev('30/09/2026', '15:30', 'Diseño enviado al cliente', 'María López'),
      ev('01/10/2026', '09:40', 'Diseño rechazado: cambiar el color del logo al verde corporativo.', 'Laura Gómez', 'Pendiente'),
      ev('02/10/2026', '16:15', 'Diseño enviado para aprobación (versión 2)', 'María López'),
    ],
  }),
  crearOrden({
    n: 4, clienteId: 'C3', producto: 'Volantes promocionales', cantidad: 500, material: 'Papel propalcote', dimensiones: 'Media carta',
    colores: 'Rojo y negro', acabados: 'Sin acabados', fechaSolicitud: '30/09/2026', fechaEntrega: '09/10/2026',
    estado: 'Diseño', disenoEstado: 'Requiere cambios', responsable: 'María López', presupuesto: 120000, metodoEntrega: 'Recoge en taller',
    requerimientos: 'Impresión a full color por ambas caras.',
    versiones: [ver(1, '01/10/2026', 'Rechazada', 'El logo se ve muy pequeño; aumentar su tamaño.')],
    historial: [
      ev('30/09/2026', '11:00', 'Solicitud creada', 'Ana Martínez'),
      ev('30/09/2026', '14:00', 'Orden generada', 'Carlos Ruiz'),
      ev('01/10/2026', '10:30', 'Diseño enviado al cliente', 'María López'),
      ev('02/10/2026', '08:55', 'Diseño rechazado: el logo se ve muy pequeño; aumentar su tamaño.', 'Paula Ortiz', 'Pendiente'),
    ],
  }),
  crearOrden({
    n: 5, clienteId: 'C4', producto: 'Plegables informativos', cantidad: 300, material: 'Papel bond 90g', dimensiones: 'Tríptico carta',
    colores: 'Naranja y gris', acabados: 'Plegado', fechaSolicitud: '20/09/2026', fechaEntrega: '02/10/2026',
    estado: 'Impresión', disenoEstado: 'Aprobado', responsable: 'Juan Pérez', presupuesto: 260000, metodoEntrega: 'Recoge en taller',
    versiones: [ver(1, '22/09/2026', 'Aprobada')],
    historial: [
      ev('20/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
      ev('21/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
      ev('25/09/2026', '11:00', 'Diseño aprobado', 'Diego Castro'),
      ev('29/09/2026', '08:00', 'Orden enviada a impresión', 'Carlos Ruiz'),
    ],
  }),
  crearOrden({
    n: 6, clienteId: 'C5', producto: 'Cajas para empaque', cantidad: 200, material: 'Cartulina', dimensiones: '20cm x 15cm x 10cm',
    colores: 'Verde y blanco', acabados: 'Laminado y troquelado', fechaSolicitud: '18/09/2026', fechaEntrega: '01/10/2026',
    estado: 'Acabados', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 840000, metodoEntrega: 'Domicilio',
    versiones: [ver(1, '20/09/2026', 'Aprobada')],
    historial: [
      ev('18/09/2026', '09:30', 'Solicitud creada', 'Ana Martínez'),
      ev('19/09/2026', '10:00', 'Orden generada', 'Carlos Ruiz'),
      ev('24/09/2026', '15:00', 'Diseño aprobado', 'Natalia Rojas'),
      ev('26/09/2026', '09:00', 'Impresión finalizada', 'Juan Pérez'),
    ],
  }),
  crearOrden({
    n: 7, clienteId: 'C6', producto: 'Valla publicitaria', cantidad: 1, material: 'Lona banner', dimensiones: '6m x 3m',
    colores: 'Amarillo y gris', acabados: 'Marco metálico', fechaSolicitud: '02/10/2026', fechaEntrega: '20/10/2026',
    estado: 'Diseño', disenoEstado: 'Pendiente', responsable: 'María López', presupuesto: 1500000, metodoEntrega: 'Instalación en sitio',
    requerimientos: 'Incluir teléfono y dirección de la obra.',
    versiones: [],
    historial: [
      ev('02/10/2026', '15:00', 'Solicitud creada', 'Ana Martínez'),
      ev('03/10/2026', '08:30', 'Orden generada', 'Carlos Ruiz'),
      ev('03/10/2026', '08:35', 'Actividad asignada: diseño a María López', 'Carlos Ruiz', 'Completado', true),
    ],
  }),
  crearOrden({
    n: 8, clienteId: 'C7', producto: 'Agendas institucionales', cantidad: 80, material: 'Papel bond y cartón', dimensiones: 'A5',
    colores: 'Azul y dorado', acabados: 'Encuadernación argollada', fechaSolicitud: '22/09/2026', fechaEntrega: '06/10/2026',
    estado: 'Acabados', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 960000, metodoEntrega: 'Domicilio',
    versiones: [ver(1, '24/09/2026', 'Aprobada')],
    historial: [
      ev('22/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
      ev('22/09/2026', '12:00', 'Orden generada', 'Carlos Ruiz'),
      ev('27/09/2026', '10:00', 'Diseño aprobado', 'Rosa Medina'),
      ev('01/10/2026', '14:00', 'Impresión finalizada', 'Juan Pérez'),
    ],
  }),
  crearOrden({
    n: 9, clienteId: 'C1', producto: 'Tarjetas de presentación', cantidad: 250, material: 'Cartulina 300g', dimensiones: '9cm x 5cm',
    colores: 'Azul y verde', acabados: 'Laminado mate', fechaSolicitud: '15/09/2026', fechaEntrega: '26/09/2026',
    estado: 'Entrega', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 90000, metodoEntrega: 'Domicilio',
    observaciones: 'Entregado a recepción.',
    versiones: [ver(1, '16/09/2026', 'Aprobada')],
    historial: [
      ev('15/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
      ev('17/09/2026', '11:00', 'Diseño aprobado', 'Laura Gómez'),
      ev('24/09/2026', '16:00', 'Despacho realizado', 'Pedro Ramírez'),
      ev('26/09/2026', '10:30', 'Pedido entregado al cliente', 'Pedro Ramírez'),
    ],
  }),
  crearOrden({
    n: 10, clienteId: 'C8', producto: 'Menús plastificados', cantidad: 40, material: 'Papel couché plastificado', dimensiones: 'Carta',
    colores: 'Rojo y crema', acabados: 'Plastificado', fechaSolicitud: '24/09/2026', fechaEntrega: '05/10/2026',
    estado: 'Despacho', disenoEstado: 'Aprobado', responsable: 'Pedro Ramírez', presupuesto: 210000, metodoEntrega: 'Domicilio',
    versiones: [ver(1, '26/09/2026', 'Aprobada')],
    historial: [
      ev('24/09/2026', '10:00', 'Solicitud creada', 'Ana Martínez'),
      ev('28/09/2026', '09:00', 'Diseño aprobado', 'Camilo Peña'),
      ev('02/10/2026', '15:00', 'Acabados finalizados', 'Pedro Ramírez'),
    ],
  }),
  crearOrden({
    n: 11, clienteId: 'C2', producto: 'Catálogo de productos', cantidad: 60, material: 'Papel couché', dimensiones: 'A4, 20 páginas',
    colores: 'Full color', acabados: 'Encuadernación grapada', fechaSolicitud: '10/09/2026', fechaEntrega: '28/09/2026',
    estado: 'Entrega', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 780000, metodoEntrega: 'Domicilio',
    versiones: [ver(1, '12/09/2026', 'Aprobada')],
    historial: [
      ev('10/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
      ev('15/09/2026', '10:00', 'Diseño aprobado', 'Mario Díaz'),
      ev('28/09/2026', '11:00', 'Pedido entregado al cliente', 'Pedro Ramírez'),
    ],
  }),
  crearOrden({
    n: 12, clienteId: 'C4', producto: 'Stickers promocionales', cantidad: 1000, material: 'Vinilo adhesivo', dimensiones: '5cm x 5cm',
    colores: 'Naranja', acabados: 'Corte troquelado', fechaSolicitud: '08/09/2026', fechaEntrega: '22/09/2026',
    estado: 'Postventa', disenoEstado: 'Aprobado', responsable: 'Sofía Herrera', presupuesto: 150000, metodoEntrega: 'Recoge en taller',
    versiones: [ver(1, '10/09/2026', 'Aprobada')],
    historial: [
      ev('08/09/2026', '09:00', 'Solicitud creada', 'Ana Martínez'),
      ev('12/09/2026', '10:00', 'Diseño aprobado', 'Diego Castro'),
      ev('22/09/2026', '11:00', 'Pedido entregado al cliente', 'Pedro Ramírez'),
      ev('25/09/2026', '09:30', 'Caso de postventa registrado', 'Sofía Herrera'),
    ],
  }),
]

// ---------------------------------------------------------------------------
// SOLICITUDES (las 12 primeras ya generaron una orden; las otras 5 siguen en proceso)
// ---------------------------------------------------------------------------
export const initialRequests = [
  ...initialOrders.map((o, i) => ({
    id: `SOL-2026-${String(i + 1).padStart(4, '0')}`,
    clienteId: o.clienteId,
    cliente: o.cliente,
    producto: o.producto,
    cantidad: o.cantidad,
    dimensiones: o.dimensiones,
    material: o.material,
    fechaEntrega: o.fechaEntrega,
    presupuesto: o.presupuesto,
    requerimientos: o.requerimientos,
    observaciones: o.observaciones,
    fechaSolicitud: o.fechaSolicitud,
    estado: 'Aprobada',
    ordenId: o.id,
    motivoRechazo: '',
  })),
  { id: 'SOL-2026-0013', clienteId: 'C3', cliente: 'Café Central', producto: 'Banner roll-up', cantidad: 2, dimensiones: '85cm x 200cm', material: 'Lona y estructura', fechaEntrega: '22/10/2026', presupuesto: 300000, requerimientos: 'Incluir código QR del menú.', observaciones: '', fechaSolicitud: '03/10/2026', estado: 'Pendiente', ordenId: null, motivoRechazo: '' },
  { id: 'SOL-2026-0014', clienteId: 'C5', cliente: 'Droguería Salud Total', producto: 'Etiquetas adhesivas', cantidad: 2000, dimensiones: '4cm x 3cm', material: 'Papel adhesivo', fechaEntrega: '24/10/2026', presupuesto: 180000, requerimientos: '', observaciones: '', fechaSolicitud: '03/10/2026', estado: 'Pendiente', ordenId: null, motivoRechazo: '' },
  { id: 'SOL-2026-0015', clienteId: 'C6', cliente: 'Constructora Andes', producto: 'Pendones de obra', cantidad: 6, dimensiones: '1m x 2m', material: 'Lona', fechaEntrega: '23/10/2026', presupuesto: 420000, requerimientos: 'Incluir normas de seguridad.', observaciones: '', fechaSolicitud: '02/10/2026', estado: 'En validación', ordenId: null, motivoRechazo: '' },
  { id: 'SOL-2026-0016', clienteId: 'C8', cliente: 'Restaurante El Fogón', producto: 'Bolsas de papel impresas', cantidad: 500, dimensiones: '25cm x 30cm', material: 'Papel kraft', fechaEntrega: '25/10/2026', presupuesto: 390000, requerimientos: 'Logo a una tinta.', observaciones: '', fechaSolicitud: '02/10/2026', estado: 'En validación', ordenId: null, motivoRechazo: '' },
  { id: 'SOL-2026-0017', clienteId: 'C7', cliente: 'Colegio San Marcos', producto: 'Carnés estudiantiles', cantidad: 10, dimensiones: '8.5cm x 5.4cm', material: 'PVC', fechaEntrega: '15/10/2026', presupuesto: 50000, requerimientos: '', observaciones: '', fechaSolicitud: '01/10/2026', estado: 'Rechazada', ordenId: null, motivoRechazo: 'La cantidad es inferior al mínimo de producción (50 unidades).' },
]

// ---------------------------------------------------------------------------
// ACTIVIDADES DE PRODUCCIÓN (tareas de los operarios)
// estado: Pendiente | En proceso | Pausada | Finalizada
// ---------------------------------------------------------------------------
const tarea = (id, ordenId, actividad, etapa, responsable, prioridad, fechaLimite, estado, pct = 0, deps = []) => ({
  id, ordenId, actividad, etapa, responsable, prioridad, fechaLimite, estado, pct, deps, notas: [], incidencias: [],
})

export const initialTasks = [
  tarea('T-001', 'OP-2026-0001', 'Impresión de pendones', 'Impresión', 'Juan Pérez', 'Alta', '08/10/2026', 'En proceso', 65, []),
  tarea('T-002', 'OP-2026-0001', 'Corte y ojales', 'Acabados', 'Juan Pérez', 'Media', '09/10/2026', 'Pendiente', 0, ['T-001']),
  tarea('T-003', 'OP-2026-0005', 'Impresión de plegables', 'Impresión', 'Juan Pérez', 'Alta', '02/10/2026', 'En proceso', 40, []),
  tarea('T-004', 'OP-2026-0006', 'Laminado de cajas', 'Acabados', 'Pedro Ramírez', 'Alta', '01/10/2026', 'En proceso', 50, []),
  tarea('T-005', 'OP-2026-0008', 'Encuadernación de agendas', 'Acabados', 'Pedro Ramírez', 'Media', '06/10/2026', 'Pendiente', 0, []),
  tarea('T-006', 'OP-2026-0010', 'Despacho de menús', 'Despacho', 'Pedro Ramírez', 'Media', '05/10/2026', 'Pendiente', 0, []),
  tarea('T-007', 'OP-2026-0006', 'Corte de cajas', 'Acabados', 'Juan Pérez', 'Media', '30/09/2026', 'Finalizada', 100, []),
]

// ---------------------------------------------------------------------------
// CASOS DE POSTVENTA (siempre ligados a una orden ya entregada)
// tipo: Reclamo | Ajuste | Reimpresión | Garantía | Comentario
// estado: Abierto | En trámite | Resuelto
// ---------------------------------------------------------------------------
export const initialCases = [
  { id: 'PV-001', ordenId: 'OP-2026-0009', tipo: 'Garantía', fecha: '28/09/2026', descripcion: 'Consulta por la garantía de 6 meses sobre la impresión.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se confirmó la garantía por escrito.', calificacion: 5 },
  { id: 'PV-002', ordenId: 'OP-2026-0009', tipo: 'Comentario', fecha: '29/09/2026', descripcion: 'Excelente calidad y entrega puntual.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Comentario registrado.', calificacion: 5 },
  { id: 'PV-003', ordenId: 'OP-2026-0009', tipo: 'Ajuste', fecha: '30/09/2026', descripcion: 'Cambiar el cargo en una de las tarjetas.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se reimprimieron 25 tarjetas sin costo.', calificacion: 4 },
  { id: 'PV-004', ordenId: 'OP-2026-0011', tipo: 'Reclamo', fecha: '01/10/2026', descripcion: 'Dos catálogos llegaron con páginas mal engrapadas.', responsable: '', estado: 'Abierto', solucion: '', calificacion: null },
  { id: 'PV-005', ordenId: 'OP-2026-0011', tipo: 'Reimpresión', fecha: '02/10/2026', descripcion: 'Solicitan reimprimir 10 catálogos con la portada corregida.', responsable: 'Sofía Herrera', estado: 'En trámite', solucion: '', calificacion: null },
  { id: 'PV-006', ordenId: 'OP-2026-0012', tipo: 'Reclamo', fecha: '25/09/2026', descripcion: 'El color naranja se ve más oscuro de lo esperado.', responsable: '', estado: 'Abierto', solucion: '', calificacion: null },
  { id: 'PV-007', ordenId: 'OP-2026-0012', tipo: 'Ajuste', fecha: '27/09/2026', descripcion: 'Solicitan cortar los stickers con esquinas redondeadas.', responsable: 'Sofía Herrera', estado: 'En trámite', solucion: '', calificacion: null },
  { id: 'PV-008', ordenId: 'OP-2026-0012', tipo: 'Garantía', fecha: '29/09/2026', descripcion: 'Garantía por adhesivo que se despega.', responsable: 'Sofía Herrera', estado: 'Resuelto', solucion: 'Se enviaron 100 stickers de reposición.', calificacion: 4 },
]

// ---------------------------------------------------------------------------
// COMUNICACIONES MULTICANAL (WhatsApp, Correo, Telefonía vinculadas a clientes y órdenes)
// ---------------------------------------------------------------------------
export const initialComms = [
  {
    id: 'COM-001',
    canal: 'wa',
    clienteId: 'C1',
    cliente: 'Empresa ABC',
    ordenId: 'OP-2026-0003',
    responsable: 'Ana Martínez',
    estado: 'Pendiente de respuesta',
    asunto: 'Ajuste en versión 2 de vinilo para vitrina',
    mensajes: [
      { de: 'usuario', texto: 'Laura, te compartimos la versión 2 del vinilo para tu aprobación.', fecha: '02/10/2026', hora: '16:20' },
      { de: 'cliente', texto: 'Hola Ana, nos gustó mucho, pero necesitamos confirmar si pueden instalarlo el viernes temprano.', fecha: '03/10/2026', hora: '08:50' },
    ],
  },
  {
    id: 'COM-002',
    canal: 'mail',
    clienteId: 'C1',
    cliente: 'Empresa ABC',
    ordenId: 'OP-2026-0001',
    responsable: 'Ana Martínez',
    estado: 'Cerrada',
    asunto: 'Cotización aprobada: 5 pendones publicitarios',
    mensajes: [
      { de: 'usuario', texto: 'Adjuntamos la cotización de los 5 pendones publicitarios (2m x 1m, lona con refuerzo).', fecha: '28/09/2026', hora: '10:00', adjuntos: ['Cotizacion_OP-0001.pdf'] },
      { de: 'cliente', texto: 'Cotización aprobada formalmente. Procedan con el diseño.', fecha: '28/09/2026', hora: '14:20' },
    ],
  },
  {
    id: 'COM-003',
    canal: 'call',
    clienteId: 'C1',
    cliente: 'Empresa ABC',
    ordenId: 'OP-2026-0001',
    responsable: 'Ana Martínez',
    estado: 'Cerrada',
    asunto: 'Llamada de recepción y especificaciones',
    mensajes: [
      { de: 'cliente', texto: 'Llamada entrante (6:15 min). La cliente Laura Gómez detalla los colores corporativos y solicita entrega el 10/10.', fecha: '28/09/2026', hora: '09:10', llamadaMinutos: '6:15' },
    ],
  },
  {
    id: 'COM-004',
    canal: 'wa',
    clienteId: 'C2',
    cliente: 'Comercial XYZ',
    ordenId: 'OP-2026-0002',
    responsable: 'Ana Martínez',
    estado: 'Respondida',
    asunto: 'Avance de diseño papelería',
    mensajes: [
      { de: 'cliente', texto: 'Mario Díaz: ¿para cuándo tendríamos el boceto de las hojas membretadas?', fecha: '02/10/2026', hora: '11:00' },
      { de: 'usuario', texto: 'Hola Mario, la diseñadora María López lo tendrá listo hoy al final de la tarde.', fecha: '02/10/2026', hora: '11:25' },
    ],
  },
  {
    id: 'COM-005',
    canal: 'mail',
    clienteId: 'C3',
    cliente: 'Café Central',
    ordenId: 'OP-2026-0004',
    responsable: 'Ana Martínez',
    estado: 'Pendiente de respuesta',
    asunto: 'Observaciones de diseño en volantes',
    mensajes: [
      { de: 'cliente', texto: 'Revisamos la propuesta pero el logo se ve muy pequeño. Por favor aumentarlo un 25% y centrar los teléfonos.', fecha: '02/10/2026', hora: '08:50' },
    ],
  },
  {
    id: 'COM-006',
    canal: 'call',
    clienteId: 'C5',
    cliente: 'Droguería Salud Total',
    ordenId: 'OP-2026-0007',
    responsable: 'Ana Martínez',
    estado: 'Respondida',
    asunto: 'Confirmación de medidas de etiquetas',
    mensajes: [
      { de: 'cliente', texto: 'Llamada saliente (3:40 min). Se acordó que las etiquetas circulares serán de 6cm de diámetro.', fecha: '26/09/2026', hora: '15:10', llamadaMinutos: '3:40' },
    ],
  },
  {
    id: 'COM-007',
    canal: 'wa',
    clienteId: 'C6',
    cliente: 'Constructora Andes',
    ordenId: 'OP-2026-0005',
    responsable: 'Carlos Ruiz',
    estado: 'Abierta',
    asunto: 'Insumo de papel para plegables de obra',
    mensajes: [
      { de: 'cliente', texto: 'Felipe: ¿cómo va la producción de los 1.000 plegables? Los requerimos para el lanzamiento.', fecha: '03/10/2026', hora: '09:15' },
      { de: 'usuario', texto: 'Estamos en proceso de impresión, el proveedor nos despacha el papel faltante para completar el lote.', fecha: '03/10/2026', hora: '09:30' },
    ],
  },
  {
    id: 'COM-008',
    canal: 'mail',
    clienteId: 'C8',
    cliente: 'Restaurante El Fogón',
    ordenId: 'OP-2026-0010',
    responsable: 'Pedro Ramírez',
    estado: 'Cerrada',
    asunto: 'Despacho de menús plastificados',
    mensajes: [
      { de: 'usuario', texto: 'Camilo, tus menús plastificados están listos y salen hoy a despacho con nuestro mensajero.', fecha: '03/10/2026', hora: '07:45' },
      { de: 'cliente', texto: 'Excelente noticia, estaremos atentos para recibirlos. Gracias.', fecha: '03/10/2026', hora: '08:10' },
    ],
  },
]


// ---------------------------------------------------------------------------
// PROVEEDORES E INVENTARIO DE PLANTA
// ---------------------------------------------------------------------------
export const initialSuppliers = [
  {
    id: 'PROV-001',
    nombre: 'Suministros Gráficos Andinos S.A.S.',
    contacto: 'Héctor Salcedo',
    telefono: '310 540 8812',
    correo: 'ventas@graficosandinos.co',
    productos: 'Lona banner 13oz, Lona mate, Vinilo adhesivo brillante y microperforado',
    ciudad: 'Bogotá',
  },
  {
    id: 'PROV-002',
    nombre: 'Papelera Nacional del Centro',
    contacto: 'Marcela Quintero',
    telefono: '315 782 1940',
    correo: 'pedidos@papeleranacional.co',
    productos: 'Propalcote 150g y 300g, Bond 90g, Cartulina Maule y Opalina',
    ciudad: 'Medellín',
  },
  {
    id: 'PROV-003',
    nombre: 'Tintas & Polímeros UV Colombia',
    contacto: 'Ricardo Montoya',
    telefono: '318 334 9021',
    correo: 'comercial@tintasuv.co',
    productos: 'Tintas ecosolventes CMYK, Barniz UV, Laminado frío mate y brillante',
    ciudad: 'Bogotá',
  },
  {
    id: 'PROV-004',
    nombre: 'Estructuras y Acrílicos Industriales',
    contacto: 'Claudia Pineda',
    telefono: '320 611 4500',
    correo: 'logistica@estructurasacrilicos.co',
    productos: 'Acrílico cristal 3mm, Arañas publicitarias, Roll-up aluminio, Ojales metálicos',
    ciudad: 'Cali',
  },
]

export const initialInventory = [
  {
    id: 'MAT-001',
    nombre: 'Lona banner 13 oz',
    descripcion: 'Sustrato flexible de alta resistencia para pendones y vallas exteriores',
    categoria: 'Sustratos gran formato',
    unidad: 'm²',
    stockActual: 145,
    cantidadUtilizada: 85,
    stockMinimo: 40,
    costoUnitario: 18500,
    proveedorId: 'PROV-001',
    proveedor: 'Suministros Gráficos Andinos S.A.S.',
    ultimaActualizacion: '02/10/2026',
  },
  {
    id: 'MAT-002',
    nombre: 'Vinilo adhesivo brillante',
    descripcion: 'Vinilo calandrado blanco con adhesivo permanente para vitrinas y rotulación',
    categoria: 'Vinilos y adhesivos',
    unidad: 'm²',
    stockActual: 22,
    cantidadUtilizada: 68,
    stockMinimo: 30,
    costoUnitario: 24000,
    proveedorId: 'PROV-001',
    proveedor: 'Suministros Gráficos Andinos S.A.S.',
    ultimaActualizacion: '03/10/2026',
  },
  {
    id: 'MAT-003',
    nombre: 'Propalcote 300g',
    descripcion: 'Papel esmaltado de alto gramaje para tarjetas, carpetas y catálogos',
    categoria: 'Papelería comercial',
    unidad: 'pliegos',
    stockActual: 180,
    cantidadUtilizada: 420,
    stockMinimo: 250,
    costoUnitario: 2800,
    proveedorId: 'PROV-002',
    proveedor: 'Papelera Nacional del Centro',
    ultimaActualizacion: '03/10/2026',
  },
  {
    id: 'MAT-004',
    nombre: 'Propalcote 150g',
    descripcion: 'Papel esmaltado para volantes promocionales y afiches publicitarios',
    categoria: 'Papelería comercial',
    unidad: 'pliegos',
    stockActual: 640,
    cantidadUtilizada: 360,
    stockMinimo: 200,
    costoUnitario: 1450,
    proveedorId: 'PROV-002',
    proveedor: 'Papelera Nacional del Centro',
    ultimaActualizacion: '01/10/2026',
  },
  {
    id: 'MAT-005',
    nombre: 'Tinta ecosolvente CMYK (Set)',
    descripcion: 'Cartuchos de tinta de alta densidad para plotters de impresión digital',
    categoria: 'Tintas y químicos',
    unidad: 'litros',
    stockActual: 6,
    cantidadUtilizada: 14,
    stockMinimo: 8,
    costoUnitario: 165000,
    proveedorId: 'PROV-003',
    proveedor: 'Tintas & Polímeros UV Colombia',
    ultimaActualizacion: '03/10/2026',
  },
  {
    id: 'MAT-006',
    nombre: 'Laminado plástico mate',
    descripcion: 'Película protectora UV para acabados en menús, tarjetas y vinilos',
    categoria: 'Acabados y protección',
    unidad: 'm²',
    stockActual: 95,
    cantidadUtilizada: 45,
    stockMinimo: 30,
    costoUnitario: 12000,
    proveedorId: 'PROV-003',
    proveedor: 'Tintas & Polímeros UV Colombia',
    ultimaActualizacion: '30/09/2026',
  },
  {
    id: 'MAT-007',
    nombre: 'Estructura Roll-Up aluminio 85x200cm',
    descripcion: 'Base retráctil en aluminio anodizado con maletín de transporte',
    categoria: 'Estructuras y exhibidores',
    unidad: 'unidades',
    stockActual: 14,
    cantidadUtilizada: 11,
    stockMinimo: 6,
    costoUnitario: 78000,
    proveedorId: 'PROV-004',
    proveedor: 'Estructuras y Acrílicos Industriales',
    ultimaActualizacion: '29/09/2026',
  },
]

export const initialInventoryMovements = [
  {
    id: 'MOV-001',
    fecha: '28/09/2026',
    hora: '08:30',
    tipo: 'Entrada',
    materialId: 'MAT-001',
    material: 'Lona banner 13 oz',
    cantidad: 100,
    unidad: 'm²',
    costoTotal: 1850000,
    ordenId: null,
    responsable: 'Carlos Ruiz',
    observacion: 'Compra de lote mensual a Suministros Gráficos Andinos',
  },
  {
    id: 'MOV-002',
    fecha: '30/09/2026',
    hora: '10:15',
    tipo: 'Salida',
    materialId: 'MAT-001',
    material: 'Lona banner 13 oz',
    cantidad: 25,
    unidad: 'm²',
    costoTotal: 462500,
    ordenId: 'OP-2026-0001',
    responsable: 'Juan Pérez',
    observacion: 'Consumo de impresión para pendones Empresa ABC',
  },
  {
    id: 'MOV-003',
    fecha: '01/10/2026',
    hora: '14:20',
    tipo: 'Salida',
    materialId: 'MAT-003',
    material: 'Propalcote 300g',
    cantidad: 180,
    unidad: 'pliegos',
    costoTotal: 504000,
    ordenId: 'OP-2026-0005',
    responsable: 'Juan Pérez',
    observacion: 'Tiraje inicial de plegables Constructora Andes',
  },
  {
    id: 'MOV-004',
    fecha: '02/10/2026',
    hora: '16:00',
    tipo: 'Salida',
    materialId: 'MAT-002',
    material: 'Vinilo adhesivo brillante',
    cantidad: 18,
    unidad: 'm²',
    costoTotal: 432000,
    ordenId: 'OP-2026-0006',
    responsable: 'Pedro Ramírez',
    observacion: 'Rotulación promocional Gimnasio Fuerza',
  },
  {
    id: 'MOV-005',
    fecha: '03/10/2026',
    hora: '09:10',
    tipo: 'Entrada',
    materialId: 'MAT-004',
    material: 'Propalcote 150g',
    cantidad: 300,
    unidad: 'pliegos',
    costoTotal: 435000,
    ordenId: null,
    responsable: 'Carlos Ruiz',
    observacion: 'Reposición de stock de papelería comercial',
  },
]
