// ============================================================
// data/preciosDemo.js — Tarifas Centralizadas de Simulación ORVEX
// Huellas Publicidad S.A.S.
//
// NOTA IMPORTANTE:
// Estos valores son DATOS DE DEMOSTRACIÓN para pruebas y simulación.
// NO constituyen las tarifas finales ni costos reales de Huellas Publicidad.
// Son configurables y centralizados en este módulo.
// ============================================================

export const ES_MODO_SIMULACION = true;
export const AVISO_DATOS_DEMO =
  'DATOS DE DEMOSTRACIÓN · Tarifas de simulación activa para cálculo dinámico en ORVEX. La parametrización final de precios oficiales será suministrada por Huellas Publicidad.';

// 1. Precios Base por Producto (Modalidad Fija o Base Técnica por m² o Unidad)
export const PRECIOS_PRODUCTOS_DEMO = {
  'Pendón publicitario': { tipo: 'area_m2', baseUnitario: 35000, desc: 'Impresión gran formato por m²' },
  'Banner roll-up': { tipo: 'fijo_con_estructura', baseUnitario: 110000, desc: 'Estructura retráctil 85x200cm + impresión' },
  'Valla publicitaria': { tipo: 'area_m2', baseUnitario: 28000, desc: 'Lona banner gran formato por m²' },
  'Vinilo adhesivo': { tipo: 'area_m2', baseUnitario: 38000, desc: 'Vinilo blanco brillante/mate por m²' },
  'Vinilo para vitrina': { tipo: 'area_m2', baseUnitario: 42000, desc: 'Vinilo transparente o microperforado por m²' },
  'Papelería corporativa': { tipo: 'unidad', baseUnitario: 450, desc: 'Papelería por unidad/pliego' },
  'Volantes promocionales': { tipo: 'unidad', baseUnitario: 220, desc: 'Volante media carta propalcote 150g' },
  'Tarjetas de presentación': { tipo: 'unidad', baseUnitario: 120, desc: 'Tarjeta 9x5 cm propalcote 300g plastificada' },
  'Plegables informativos': { tipo: 'unidad', baseUnitario: 650, desc: 'Plegable tríptico propalcote 150g' },
  'Catálogo de productos': { tipo: 'unidad', baseUnitario: 12500, desc: 'Catálogo encuadernado 16 páginas' },
  'Cajas para empaque': { tipo: 'unidad', baseUnitario: 4200, desc: 'Caja plegadiza impresa y troquelada' },
  'Agendas institucionales': { tipo: 'unidad', baseUnitario: 24000, desc: 'Agenda anillada tapa dura' },
  'Menús plastificados': { tipo: 'unidad', baseUnitario: 8500, desc: 'Menú plastificado alta resistencia' },
  'Stickers promocionales': { tipo: 'unidad', baseUnitario: 180, desc: 'Sticker troquelado 5x5 cm' },
  'Etiquetas adhesivas': { tipo: 'unidad', baseUnitario: 95, desc: 'Etiqueta adhesiva en rollo' },
  'Bolsas de papel impresas': { tipo: 'unidad', baseUnitario: 2800, desc: 'Bolsa kraft mediana serigrafiada' },
  'Carnés estudiantiles': { tipo: 'unidad', baseUnitario: 5500, desc: 'Carné PVC con laminado de seguridad' },
  'Backing corporativo': { tipo: 'area_m2', baseUnitario: 65000, desc: 'Estructura araña + lona backlight por m²' },
  'Señalética en acrílico / PVC': { tipo: 'area_m2', baseUnitario: 95000, desc: 'Acrílico 3mm cortado láser + vinilo por m²' },
};

// 2. Costo / Ajuste Adicional por Sustrato / Material Técnico (por m² o unidad)
export const PRECIOS_MATERIALES_DEMO = {
  'Lona banner 13 oz': { recargoM2: 0, unidad: 'm²', nombre: 'Lona banner estándar 13 oz' },
  'Lona mate': { recargoM2: 4500, unidad: 'm²', nombre: 'Lona mate antirreflejo' },
  'Lona y estructura Roll-Up': { recargoM2: 0, unidad: 'und', recargoFijo: 45000, nombre: 'Estructura Roll-Up aluminio' },
  'Vinilo adhesivo brillante': { recargoM2: 2500, unidad: 'm²', nombre: 'Vinilo monomérico brillante' },
  'Vinilo adhesivo mate': { recargoM2: 3000, unidad: 'm²', nombre: 'Vinilo monomérico mate' },
  'Vinilo microperforado': { recargoM2: 12000, unidad: 'm²', nombre: 'Vinilo microperforado para vidrios' },
  'Papel propalcote 150g': { recargoM2: 1500, unidad: 'und', nombre: 'Propalcote 150g' },
  'Papel propalcote 300g': { recargoM2: 3000, unidad: 'und', nombre: 'Propalcote 300g alta densidad' },
  'Papel bond 90g': { recargoM2: 0, unidad: 'und', nombre: 'Papel bond 90g corporativo' },
  'Papel couché plastificado': { recargoM2: 4000, unidad: 'und', nombre: 'Couché plastificado térmico' },
  'Papel kraft': { recargoM2: 1800, unidad: 'und', nombre: 'Papel kraft ecológico' },
  'Papel adhesivo': { recargoM2: 2200, unidad: 'und', nombre: 'Papel adhesivo semibrillante' },
  'Cartulina 300g': { recargoM2: 2800, unidad: 'und', nombre: 'Cartulina Bristol 300g' },
  'PVC rígido / Carné': { recargoM2: 0, unidad: 'und', recargoFijo: 1500, nombre: 'Lámina PVC calibre carné' },
  'Acrílico cristal 3mm': { recargoM2: 55000, unidad: 'm²', nombre: 'Lámina acrílico cristal 3mm' },
};

// 3. Precios de Acabados Técnicos
export const PRECIOS_ACABADOS_DEMO = {
  'Ojales metálicos y refuerzo perimetral': { tipo: 'perimetro_m', precioPorMetro: 3500, nombre: 'Ojales cada 30cm + refuerzo perimetral' },
  'Tubo y cordón para colgar': { tipo: 'fijo_unidad', precioFijo: 6000, nombre: 'Tubo de aluminio superior e inferior + cordón' },
  'Estructura retráctil en aluminio (Roll-Up)': { tipo: 'fijo_unidad', precioFijo: 55000, nombre: 'Estructura Roll-Up de lujo con estuche' },
  'Laminado mate protector': { tipo: 'area_m2', precioPorM2: 8500, nombre: 'Laminado mate en frío protección UV' },
  'Laminado brillante UV': { tipo: 'area_m2', precioPorM2: 9000, nombre: 'Barniz brillante UV total' },
  'Troquelado / Corte de contorno': { tipo: 'fijo_unidad', precioFijo: 2500, nombre: 'Corte de silueta computarizado' },
  'Plegado y grafado': { tipo: 'fijo_unidad', precioFijo: 150, nombre: 'Grafado a 2 o 3 cuerpos' },
  'Argollado / Encuadernación rústica': { tipo: 'fijo_unidad', precioFijo: 4500, nombre: 'Anillado doble O metálico' },
  'Refilado y empaque termoencogible': { tipo: 'fijo_unidad', precioFijo: 1200, nombre: 'Refilado a sangre y termorretraído' },
  'Corte y empaque estándar': { tipo: 'gratuito', precioFijo: 0, nombre: 'Corte recto y empaque básico de taller' },
};

// 4. Servicios Adicionales Configurables
export const SERVICIOS_ADICIONALES_DEMO = [
  { id: 'srv_diseno', nombre: 'Diseño gráfico profesional', tarifa: 45000, desc: 'Diseño desde cero por equipo de Huellas' },
  { id: 'srv_instalacion', nombre: 'Instalación en sitio (Bogotá)', tarifa: 75000, desc: 'Cuadrilla técnica de montaje e instalación' },
  { id: 'srv_transporte', nombre: 'Transporte y flete especial', tarifa: 30000, desc: 'Entrega en vehículo propio de Huellas' },
  { id: 'srv_montaje_altura', nombre: 'Montaje en altura / Andamio', tarifa: 120000, desc: 'Trabajo en alturas con arnés certificado' },
];

// 5. Parámetros Tributarios y Desperdicio Técnico
export const IVA_DEFAULT = 0.19; // 19% IVA Colombia
export const FACTOR_DESPERDICIO_DEFAULT = 0.08; // 8% de merma técnica estándar de corte en lonas y vinilos
