// Catálogos estructurados de ORVEX — Huellas Publicidad
// Fuente única de verdad para formularios, filtros y validaciones

export const PAISES = [
  'Colombia',
  'Ecuador',
  'Panamá',
  'Perú',
  'México',
  'Estados Unidos',
  'España',
];

export const DEPARTAMENTOS_MUNICIPIOS = {
  Antioquia: [
    'Medellín',
    'Bello',
    'Itagüí',
    'Envigado',
    'Sabaneta',
    'Rionegro',
    'La Estrella',
    'Copacabana',
    'Apartadó',
    'Turbo',
    'Caucasia',
  ],
  Atlántico: [
    'Barranquilla',
    'Soledad',
    'Malambo',
    'Sabanalarga',
    'Puerto Colombia',
    'Galapa',
    'Baranoa',
  ],
  'Bogotá D.C.': ['Bogotá'],
  Bolívar: [
    'Cartagena de Indias',
    'Magangué',
    'Turbaco',
    'Arjona',
    'El Carmen de Bolívar',
  ],
  Boyacá: [
    'Tunja',
    'Duitama',
    'Sogamoso',
    'Chiquinquirá',
    'Paipa',
    'Puerto Boyacá',
  ],
  Caldas: [
    'Manizales',
    'La Dorada',
    'Chinchiná',
    'Villamaría',
    'Riosucio',
  ],
  Caquetá: ['Florencia', 'San Vicente del Caguán', 'Puerto Rico'],
  Casanare: ['Yopal', 'Aguazul', 'Villanueva', 'Paz de Ariporo'],
  Cauca: [
    'Popayán',
    'Santander de Quilichao',
    'Puerto Tejada',
    'Patía',
    'Piendamó',
  ],
  Cesar: ['Valledupar', 'Aguachica', 'Agustín Codazzi', 'Bosconia'],
  Chocó: ['Quibdó', 'Istmina', 'Tadó'],
  Córdoba: ['Montería', 'Lorica', 'Sahagún', 'Cereté', 'Montelíbano'],
  Cundinamarca: [
    'Soacha',
    'Chía',
    'Zipaquirá',
    'Facatativá',
    'Fusagasugá',
    'Mosquera',
    'Madrid',
    'Funza',
    'Cajicá',
    'Girardot',
    'Cota',
    'Tocancipá',
  ],
  Huila: ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'Fonseca', 'San Juan del Cesar'],
  Magdalena: ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato'],
  Meta: ['Villavicencio', 'Acacías', 'Granada', 'Puerto López'],
  Nariño: ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres'],
  'Norte de Santander': [
    'Cúcuta',
    'Ocaña',
    'Villa del Rosario',
    'Los Patios',
    'Pamplona',
  ],
  Putumayo: ['Mocoa', 'Puerto Asís', 'Orito'],
  Quindío: ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Circasia'],
  Risaralda: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  Santander: [
    'Bucaramanga',
    'Floridablanca',
    'Girón',
    'Piedecuesta',
    'Barrancabermeja',
    'San Gil',
    'Socorro',
  ],
  Sucre: ['Sincelejo', 'Corozal', 'Sampués', 'San Marcos'],
  Tolima: ['Ibagué', 'Espinal', 'Melgar', 'Honda', 'Chaparral', 'Líbano'],
  'Valle del Cauca': [
    'Cali',
    'Palmira',
    'Buenaventura',
    'Tuluá',
    'Cartago',
    'Buga',
    'Jamundí',
    'Yumbo',
    'Candelaria',
  ],
};

export const CIUDADES_INTERNACIONALES = {
  Ecuador: {
    Pichincha: ['Quito', 'Cayambe'],
    Guayas: ['Guayaquil', 'Samborondón', 'Durán'],
    Azuay: ['Cuenca'],
  },
  Panamá: {
    Panamá: ['Ciudad de Panamá', 'San Miguelito'],
    Chiriquí: ['David'],
    Colón: ['Colón'],
  },
  Perú: {
    Lima: ['Lima', 'Callao', 'Miraflores'],
    Arequipa: ['Arequipa'],
  },
  México: {
    'Ciudad de México': ['Ciudad de México'],
    Jalisco: ['Guadalajara', 'Zapopan'],
    'Nuevo León': ['Monterrey', 'San Pedro Garza García'],
  },
  'Estados Unidos': {
    Florida: ['Miami', 'Orlando', 'Tampa'],
    'New York': ['New York City'],
    Texas: ['Houston', 'Dallas', 'Austin'],
  },
  España: {
    Madrid: ['Madrid', 'Alcobendas'],
    Cataluña: ['Barcelona', 'Hospitalet'],
  },
};

export function obtenerDepartamentosPorPais(pais = 'Colombia') {
  if (pais === 'Colombia') {
    return Object.keys(DEPARTAMENTOS_MUNICIPIOS);
  }
  const mapaExt = CIUDADES_INTERNACIONALES[pais];
  return mapaExt ? Object.keys(mapaExt) : ['General'];
}

export function obtenerMunicipiosPorDepartamento(pais = 'Colombia', departamento = '') {
  if (!departamento) return [];
  if (pais === 'Colombia') {
    return DEPARTAMENTOS_MUNICIPIOS[departamento] || [];
  }
  const mapaExt = CIUDADES_INTERNACIONALES[pais];
  return mapaExt && mapaExt[departamento] ? mapaExt[departamento] : [];
}

export function inferirDepartamentoDeMunicipio(municipio = '') {
  const limpio = String(municipio || '').trim().toLowerCase();
  if (!limpio) return 'Antioquia';
  for (const [depto, muns] of Object.entries(DEPARTAMENTOS_MUNICIPIOS)) {
    if (muns.some((m) => m.toLowerCase() === limpio)) {
      return depto;
    }
  }
  return 'Antioquia';
}

export const TIPOS_DOCUMENTO = [
  { codigo: 'NIT', label: 'NIT — Número de Identificación Tributaria' },
  { codigo: 'CC', label: 'CC — Cédula de Ciudadanía' },
  { codigo: 'CE', label: 'CE — Cédula de Extranjería' },
  { codigo: 'RUT', label: 'RUT — Registro Único Tributario' },
  { codigo: 'PAS', label: 'PAS — Pasaporte' },
];

export const TIPOS_CLIENTE = [
  'Persona Jurídica (Empresa)',
  'Persona Natural',
  'Entidad Pública / Institucional',
  'Agencia / Aliado Comercial',
];

export const SECTORES_COMERCIALES = [
  'Comercio y Retail',
  'Salud y Farmacéutica',
  'Construcción e Inmobiliaria',
  'Educación y Academia',
  'Gastronomía y Eventos',
  'Corporativo y Servicios',
  'Industria y Manufactura',
];

export const CATALOGO_PRODUCTOS = [
  'Pendón publicitario',
  'Banner roll-up',
  'Valla publicitaria',
  'Vinilo adhesivo',
  'Vinilo para vitrina',
  'Papelería corporativa',
  'Volantes promocionales',
  'Tarjetas de presentación',
  'Plegables informativos',
  'Catálogo de productos',
  'Cajas para empaque',
  'Agendas institucionales',
  'Menús plastificados',
  'Stickers promocionales',
  'Etiquetas adhesivas',
  'Bolsas de papel impresas',
  'Carnés estudiantiles',
  'Backing corporativo',
  'Señalética en acrílico / PVC',
];

export const CATALOGO_MATERIALES = [
  'Lona banner 13 oz',
  'Lona mate',
  'Lona y estructura Roll-Up',
  'Vinilo adhesivo brillante',
  'Vinilo adhesivo mate',
  'Vinilo microperforado',
  'Papel propalcote 150g',
  'Papel propalcote 300g',
  'Papel bond 90g',
  'Papel couché plastificado',
  'Papel kraft',
  'Papel adhesivo',
  'Cartulina 300g',
  'PVC rígido / Carné',
  'Acrílico cristal 3mm',
];

export const CATALOGO_DIMENSIONES = [
  '0.80 x 2.00 m (Estándar Pendón / Roll-Up)',
  '1.00 x 1.50 m (Pendón mediano)',
  '2.40 x 1.80 m (Vitrina / Backing)',
  '6.00 x 3.00 m (Valla gran formato)',
  '9 x 5 cm (Tarjeta de presentación)',
  '10 x 15 cm / Media carta (Volante)',
  '21.5 x 28 cm / Carta (Papelería / Catálogo)',
  '28 x 63 cm abierto (Plegable tríptico)',
  '5 x 5 cm (Sticker / Etiqueta)',
  'Medida personalizada',
];

export const CATALOGO_ACABADOS = [
  'Ojales metálicos y refuerzo perimetral',
  'Tubo y cordón para colgar',
  'Estructura retráctil en aluminio (Roll-Up)',
  'Laminado mate protector',
  'Laminado brillante UV',
  'Troquelado / Corte de contorno',
  'Plegado y grafado',
  'Argollado / Encuadernación rústica',
  'Refilado y empaque termoencogible',
];

export const PRIORIDADES = ['Alta', 'Media', 'Baja'];

export const METODOS_ENTREGA = [
  'Domicilio',
  'Instalación en sitio',
  'Recoge en taller',
  'Transportadora nacional',
];

// Catálogos de Postventa: estrictamente divididos en 3 secciones independientes
export const SECCIONES_POSTVENTA = [
  {
    id: 'Satisfacción',
    titulo: 'Calificación de satisfacción',
    subtitulo: 'Evaluación del cliente posterior a la entrega del pedido',
  },
  {
    id: 'PQRSF',
    titulo: 'Gestión de PQRSF',
    subtitulo: 'Peticiones, quejas, reclamos, sugerencias y felicitaciones',
  },
  {
    id: 'Garantía',
    titulo: 'Gestión de garantías',
    subtitulo: 'Evaluación técnica por daños, defectos de material, impresión o especificaciones',
  },
];

export const TIPOS_PQRSF = [
  'Petición',
  'Queja',
  'Reclamo',
  'Sugerencia',
  'Felicitación',
];

export const MOTIVOS_PQRSF_POR_TIPO = {
  Petición: [
    'Copia de factura o soporte de entrega',
    'Certificado de calidad de materiales',
    'Duplicado de arte final aprobado',
    'Cotización de reimpresión adicional',
    'Información sobre tiempos de despacho',
  ],
  Queja: [
    'Demora en la atención o respuesta comercial',
    'Retraso en la entrega acordada',
    'Inconformidad con el trato del personal de entrega',
    'Falta de notificación en cambios de cronograma',
  ],
  Reclamo: [
    'Faltante en la cantidad de unidades entregadas',
    'Diferencia en facturación o cobro',
    'Entrega en dirección o sucursal incorrecta',
    'Empaque deteriorado al momento de recepción',
  ],
  Sugerencia: [
    'Mejora en el empaque y protección de piezas',
    'Ampliación de catálogo de materiales ecológicos',
    'Notificaciones automáticas de ruta de entrega',
    'Opciones adicionales de acabado gráfico',
  ],
  Felicitación: [
    'Excelente calidad de impresión y fidelidad de color',
    'Cumplimiento sobresaliente en tiempos de entrega',
    'Excelente asesoría de diseño y atención comercial',
    'Instalación impecable en punto de venta',
  ],
};

export const MOTIVOS_GARANTIA = [
  'Daños físicos durante transporte o manipulación',
  'Defectos del material o sustrato (desprendimiento, rasgado, burbujas)',
  'Problemas de impresión (banding, color corrido, baja resolución)',
  'Incumplimiento de las especificaciones acordadas (medidas, gramaje, acabados)',
  'Falla prematura en estructura o herrajes (Roll-Up, ojales, bastidor)',
];

export const DICTAMENES_GARANTIA = [
  'Pendiente de evaluación',
  'Procedente (Aplica garantía total)',
  'Procedente parcial (Ajuste o reposición parcial)',
  'No procedente (No aplica garantía)',
];

export const ACCIONES_GARANTIA = [
  'En espera de dictamen técnico',
  'Reimpresión total sin costo',
  'Reimpresión parcial de unidades afectadas',
  'Reposición o cambio de material / estructura',
  'Corrección de acabados o reinstalación en sitio',
  'Nota crédito / Compensación comercial',
  'Cierre sin reposición (daño atribuible a manipulación externa o fuera de cobertura)',
];

export const ESTADOS_CASO_POSTVENTA = [
  'Abierto',
  'En revisión',
  'En trámite',
  'Resuelto',
  'Cerrado',
];

// Clasifica un caso de postventa en una de las 3 secciones independientes.
// Compatible con registros antiguos que solo tenían "tipo" (Reclamo, Ajuste, Reimpresión, Garantía, Comentario).
export function categoriaCaso(caso = {}) {
  if (caso.categoria === 'Satisfacción' || caso.categoria === 'PQRSF' || caso.categoria === 'Garantía') {
    return caso.categoria;
  }
  if (caso.tipo === 'Garantía') return 'Garantía';
  if (caso.tipo === 'Satisfacción') return 'Satisfacción';
  return 'PQRSF';
}

// Tipo PQRSF de un caso. Los tipos antiguos se mapean al tipo PQRSF equivalente.
export function subtipoPqrsf(caso = {}) {
  const valor = caso.subtipo || caso.tipo;
  if (TIPOS_PQRSF.includes(valor)) return valor;
  if (valor === 'Comentario') return 'Sugerencia';
  return 'Reclamo'; // Ajuste y Reimpresión son reclamos por no conformidad
}

// Límite de evidencias adjuntas por caso (se guardan con el caso)
export const MAX_EVIDENCIAS = 5;
export const MAX_TAMANO_EVIDENCIA_MB = 1;

export const ASPECTOS_SATISFACCION = [
  'Fidelidad de color y nitidez de impresión',
  'Calidad del material y acabados finales',
  'Cumplimiento de la fecha de entrega acordada',
  'Atención comercial y acompañamiento en diseño',
  'Estado del empaque y presentación al recibir',
];

// Responsables por defecto (coinciden con los usuarios internos del sistema).
// En la interfaz se priorizan los usuarios activos registrados en el módulo de Usuarios.
export const RESPONSABLES_POSTVENTA = [
  'Sofía Herrera',
  'Carlos Gómez',
  'María López',
  'Pedro Morales',
  'Ana Martínez',
  'Laura Sánchez',
];

export const CARGOS_POR_ROL = {
  recepcion: [
    'Ejecutiva Comercial',
    'Asesor Comercial y Recepción',
    'Coordinador de Cuentas Corporativas',
  ],
  coordinador: [
    'Coordinador de Producción',
    'Jefe de Planta y Tráfico Gráfico',
    'Supervisor de Operaciones',
  ],
  disenador: [
    'Diseñador Gráfico Senior',
    'Diseñador de Preprensa y Arte Final',
    'Creativo Publicitario',
  ],
  operario: [
    'Operario de Impresión Gran Formato',
    'Operario de Corte, Troquelado y Acabados',
    'Instalador y Operario de Planta',
  ],
  postventa: [
    'Analista de Atención al Cliente y Postventa',
    'Coordinador de Garantías y Calidad',
    'Especialista de Servicio al Cliente y Entregas',
  ],
  gerente: [
    'Gerente General',
    'Director Administrativo y Financiero',
    'Director de Operaciones',
  ],
  cliente: [
    'Representante de Compras / Mercadeo',
    'Director de Marca (Cliente)',
    'Coordinador Administrativo (Cliente)',
  ],
};

export const ACTIVIDADES_TALLER_POR_ETAPA = {
  Diseño: [
    'Revisión de requerimientos y preprensa',
    'Ajuste de perfiles de color CMYK y sangrado',
    'Montaje de arte final para gran formato',
    'Vectorización y preparación de líneas de troquel',
  ],
  Impresión: [
    'Impresión gran formato en plotter ecosolvente',
    'Impresión digital láser en propalcote / couché',
    'Impresión de vinilo adhesivo en alta resolución',
    'Verificación de secado y control de color',
  ],
  Acabados: [
    'Laminado mate / brillante en frío o calor',
    'Refilado perimetral, termosellado y ojales metálicos',
    'Troquelado, grafado y plegado de piezas',
    'Armado de estructura Roll-Up y control de tensión',
  ],
  Despacho: [
    'Control de calidad final y conteo de unidades',
    'Empaque protector y rotulado de despacho',
    'Alistamiento para ruta de entrega o instalación',
  ],
};
