// ============================================================
// data/preciosDemo.js — Catálogo de tarifas del cotizador ORVEX
// Huellas Publicidad S.A.S.
//
// ESTADO: SIN CONFIGURAR.
// Las tarifas ficticias de demostración fueron eliminadas. Mientras Huellas Publicidad
// no suministre sus tarifas oficiales, los catálogos permanecen vacíos y el cotizador
// NO genera valores: indica "precio sin configurar" y el valor cotizado se ingresa manualmente.
//
// Para configurar las tarifas oficiales, complete los catálogos siguiendo estas estructuras:
//   PRECIOS_PRODUCTOS_DEMO['Nombre producto'] = { tipo: 'area_m2' | 'unidad' | 'fijo_con_estructura', baseUnitario, desc }
//   PRECIOS_MATERIALES_DEMO['Nombre material'] = { recargoM2, recargoFijo?, unidad, nombre }
//   PRECIOS_ACABADOS_DEMO['Nombre acabado'] = { tipo: 'perimetro_m' | 'fijo_unidad' | 'area_m2' | 'gratuito', precioPorMetro | precioFijo | precioPorM2, nombre }
//   SERVICIOS_ADICIONALES_DEMO.push({ id, nombre, tarifa, desc })
// ============================================================

export const ES_MODO_SIMULACION = false;
export const AVISO_DATOS_DEMO =
  'Tarifas sin configurar · El cotizador no genera valores hasta que se carguen las tarifas oficiales de Huellas Publicidad. Ingresa el valor cotizado manualmente.';

// 1. Precios base por producto (sin configurar)
export const PRECIOS_PRODUCTOS_DEMO = {};

// 2. Recargo por sustrato / material técnico (sin configurar)
export const PRECIOS_MATERIALES_DEMO = {};

// 3. Precios de acabados técnicos (sin configurar)
export const PRECIOS_ACABADOS_DEMO = {};

// 4. Servicios adicionales configurables (sin configurar)
export const SERVICIOS_ADICIONALES_DEMO = [];

// 5. Parámetros tributarios y técnicos
export const IVA_DEFAULT = 0.19; // 19% IVA Colombia (tarifa legal general)
export const FACTOR_DESPERDICIO_DEFAULT = 0; // merma técnica sin configurar (0 = no se aplica)
