// ============================================================
// utils/cotizador.js — Motor de Cálculo Dinámico de Precios
// Huellas Publicidad S.A.S. — ORVEX
// ============================================================

import {
  PRECIOS_PRODUCTOS_DEMO,
  PRECIOS_MATERIALES_DEMO,
  PRECIOS_ACABADOS_DEMO,
  SERVICIOS_ADICIONALES_DEMO,
  IVA_DEFAULT,
  FACTOR_DESPERDICIO_DEFAULT,
} from '../data/preciosDemo.js';

/**
 * Normaliza y analiza un texto de dimensiones (ej. "0.80 x 2.00 m", "100 x 150 cm", "2.5 x 1.2")
 * extrayendo ancho y alto en metros, área en m² y perímetro en metros.
 */
export function parsearDimensiones(texto = '') {
  if (!texto || typeof texto !== 'string') {
    return { anchoM: 1, altoM: 1, areaM2: 1, perimetroM: 4, unidad: 'm', valido: false };
  }
  const str = texto.trim();
  const UNIDADES = '(?:cm|m|mm|mts?|cms?|metros?)';
  const NUM = '(\\d+(?:[.,]\\d+)?)';
  const PATRON_2D = new RegExp(`^${NUM}\\s*(${UNIDADES})?\\s*[xX×]\\s*${NUM}\\s*(${UNIDADES})?`, 'i');

  const match = str.match(PATRON_2D);
  if (!match) {
    return { anchoM: 1, altoM: 1, areaM2: 1, perimetroM: 4, unidad: 'm', valido: false };
  }

  let n1 = parseFloat(match[1].replace(',', '.'));
  let n2 = parseFloat(match[3].replace(',', '.'));
  const u1 = (match[2] || match[4] || '').toLowerCase();

  let factor = 1;
  if (u1.includes('cm')) factor = 0.01;
  else if (u1.includes('mm')) factor = 0.001;
  else if (n1 > 20 && n2 > 20 && !str.includes(' m')) factor = 0.01; // inferir cm si no especifica 'm'

  const anchoM = parseFloat((n1 * factor).toFixed(4));
  const altoM = parseFloat((n2 * factor).toFixed(4));
  const areaM2 = parseFloat((anchoM * altoM).toFixed(4));
  const perimetroM = parseFloat((2 * (anchoM + altoM)).toFixed(4));

  return { anchoM, altoM, areaM2, perimetroM, unidad: factor === 1 ? 'm' : 'cm', valido: true };
}

/**
 * Calcula en tiempo real el costo desglosado de una solicitud con base en el catálogo centralizado.
 */
export function calcularCotizacion({
  producto = '',
  material = '',
  dimensiones = '',
  cantidad = 1,
  acabados = [],
  servicios = [],
  incluirIva = false,
  descuentoPct = 0,
}) {
  const cant = Math.max(1, parseInt(cantidad, 10) || 1);
  const dim = parsearDimensiones(dimensiones);
  const items = [];

  // 1. Producto Base e Impresión
  const prodCfg = PRECIOS_PRODUCTOS_DEMO[producto] || {
    tipo: 'area_m2',
    baseUnitario: 35000,
    desc: 'Producto estándar',
  };
  const matCfg = PRECIOS_MATERIALES_DEMO[material] || {
    recargoM2: 0,
    nombre: material || 'Sustrato estándar',
  };

  let subtotalProducto = 0;

  if (prodCfg.tipo === 'area_m2') {
    const costoM2 = prodCfg.baseUnitario + (matCfg.recargoM2 || 0);
    const areaConMerma = dim.areaM2 * (1 + FACTOR_DESPERDICIO_DEFAULT);
    const precioUnitarioPieza = Math.round(costoM2 * areaConMerma);
    subtotalProducto = precioUnitarioPieza * cant;

    items.push({
      id: 'item_prod',
      tipo: 'producto',
      concepto: producto || 'Impresión gran formato',
      detalle: `${material || 'Sustrato'} (${dim.anchoM} x ${dim.altoM} m · ${dim.areaM2} m²/ud + 8% merma)`,
      cantidad: cant,
      unidadMedida: 'm²',
      medidaUnitaria: dim.areaM2,
      precioUnitario: precioUnitarioPieza,
      subtotal: subtotalProducto,
    });
  } else {
    // Tipo fijo / unidad
    const recargoFijo = matCfg.recargoFijo || 0;
    const precioUnitarioPieza = prodCfg.baseUnitario + recargoFijo;
    subtotalProducto = precioUnitarioPieza * cant;

    items.push({
      id: 'item_prod',
      tipo: 'producto',
      concepto: producto || 'Producto publicitario',
      detalle: `${material || 'Material estándar'} · Medida: ${dimensiones || 'Estándar'}`,
      cantidad: cant,
      unidadMedida: 'und',
      medidaUnitaria: 1,
      precioUnitario: precioUnitarioPieza,
      subtotal: subtotalProducto,
    });
  }

  // 2. Acabados Seleccionados
  const listaAcabados = Array.isArray(acabados) ? acabados : [acabados].filter(Boolean);
  listaAcabados.forEach((ac, idx) => {
    const acCfg = PRECIOS_ACABADOS_DEMO[ac];
    if (!acCfg || acCfg.tipo === 'gratuito') return;

    let subtotalAcabado = 0;
    let precioUnitarioAcabado = 0;
    let unidadLabel = 'und';

    if (acCfg.tipo === 'perimetro_m') {
      precioUnitarioAcabado = Math.round(acCfg.precioPorMetro * dim.perimetroM);
      subtotalAcabado = precioUnitarioAcabado * cant;
      unidadLabel = 'perímetro m';
    } else if (acCfg.tipo === 'area_m2') {
      precioUnitarioAcabado = Math.round(acCfg.precioPorM2 * dim.areaM2);
      subtotalAcabado = precioUnitarioAcabado * cant;
      unidadLabel = 'm²';
    } else {
      // fijo por unidad
      precioUnitarioAcabado = acCfg.precioFijo || 0;
      subtotalAcabado = precioUnitarioAcabado * cant;
    }

    if (subtotalAcabado > 0) {
      items.push({
        id: `item_acabado_${idx}`,
        tipo: 'acabado',
        concepto: ac,
        detalle: acCfg.nombre || ac,
        cantidad: cant,
        unidadMedida: unidadLabel,
        medidaUnitaria: acCfg.tipo === 'perimetro_m' ? dim.perimetroM : (acCfg.tipo === 'area_m2' ? dim.areaM2 : 1),
        precioUnitario: precioUnitarioAcabado,
        subtotal: subtotalAcabado,
      });
    }
  });

  // 3. Servicios Adicionales
  const listaServicios = Array.isArray(servicios) ? servicios : [servicios].filter(Boolean);
  listaServicios.forEach((srvId) => {
    const srv = SERVICIOS_ADICIONALES_DEMO.find((s) => s.id === srvId || s.nombre === srvId);
    if (srv) {
      items.push({
        id: `item_srv_${srv.id}`,
        tipo: 'servicio',
        concepto: srv.nombre,
        detalle: srv.desc,
        cantidad: 1,
        unidadMedida: 'servicio',
        medidaUnitaria: 1,
        precioUnitario: srv.tarifa,
        subtotal: srv.tarifa,
      });
    }
  });

  // 4. Subtotal Bruto
  const subtotalBruto = items.reduce((acc, it) => acc + it.subtotal, 0);

  // 5. Descuento Comercial
  const descPctNum = Math.min(100, Math.max(0, Number(descuentoPct) || 0));
  const descuentoMonto = Math.round(subtotalBruto * (descPctNum / 100));
  const subtotalNeto = Math.max(0, subtotalBruto - descuentoMonto);

  // 6. Impuestos (IVA 19%)
  const ivaMonto = incluirIva ? Math.round(subtotalNeto * IVA_DEFAULT) : 0;
  const total = subtotalNeto + ivaMonto;

  return {
    items,
    subtotalBruto,
    descuentoPct: descPctNum,
    descuentoMonto,
    subtotalNeto,
    ivaMonto,
    incluirIva: Boolean(incluirIva),
    total,
    dimensionesAnalizadas: dim,
  };
}

/**
 * Genera un texto resumen estructurado y legible del desglose para guardar en observaciones / histórico.
 */
export function formatearResumenCotizacion(calculo) {
  if (!calculo || !Array.isArray(calculo.items)) return '';
  const lineas = [
    '=== DESGLOSE DE COTIZACIÓN AUTOMÁTICA (SIMULACIÓN) ===',
    ...calculo.items.map(
      (it) =>
        `• ${it.concepto} (${it.detalle}): ${it.cantidad} ${it.unidadMedida} x $${it.precioUnitario.toLocaleString('es-CO')} = $${it.subtotal.toLocaleString('es-CO')}`
    ),
  ];
  if (calculo.descuentoMonto > 0) {
    lineas.push(`• Descuento comercial (${calculo.descuentoPct}%): -$${calculo.descuentoMonto.toLocaleString('es-CO')}`);
  }
  lineas.push(`• Subtotal Neto: $${calculo.subtotalNeto.toLocaleString('es-CO')}`);
  if (calculo.incluirIva) {
    lineas.push(`• IVA (19%): $${calculo.ivaMonto.toLocaleString('es-CO')}`);
  }
  lineas.push(`• TOTAL ESTIMADO: $${calculo.total.toLocaleString('es-CO')}`);
  lineas.push('======================================================');
  return lineas.join('\n');
}
