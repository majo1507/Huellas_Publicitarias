// ============================================================
// utils/validacionesDimensiones.js — Validación de dimensiones técnicas en ORVEX
// Huellas Publicidad
// ============================================================

const CATALOGO_PRESETS = [
  '0.80 x 2.00 m (Estándar Pendón / Roll-Up)',
  '1.00 x 1.50 m (Pendón mediano)',
  '2.40 x 1.80 m (Vitrina / Backing)',
  '6.00 x 3.00 m (Valla gran formato)',
  '9 x 5 cm (Tarjeta de presentación)',
  '10 x 15 cm / Media carta (Volante)',
  '21.5 x 28 cm / Carta (Papelería / Catálogo)',
  '28 x 63 cm abierto (Plegable tríptico)',
  '5 x 5 cm (Sticker / Etiqueta)',
];

const MENSAJE_ERROR_DIMENSIONES =
  'Formato de dimensiones inválido. Ingresa medidas numéricas válidas (ej: 9 x 5 cm, 1.20 x 2.00 m o 6 x 3 m).';

/**
 * Valida si un texto corresponde a una dimensión técnica válida.
 * Acepta:
 * - Opciones predefinidas del catálogo
 * - Formatos 2D numéricos: ancho x alto con o sin unidades (ej: "9 x 5 cm", "1.20 x 2.00 m", "6 x 3 m", "2m x 1m")
 * - Formatos 3D numéricos: ancho x alto x profundidad (ej: "20 x 15 x 10 cm", "20cm x 15cm x 10cm")
 *
 * Rechaza:
 * - Cadenas sin formato numérico ("juju", "grande", "pequeño")
 * - Valores negativos ("-1.20 x 2.00 m", "9 x -5 cm")
 * - Cero ("0 x 0 m", "0 x 5 cm", "1.20 x 0 m")
 * - Dimensiones incompletas ("1.20 x", "x 2.00 m", "5 cm")
 * - Formatos malformados o texto no numérico
 *
 * @param {string} texto
 * @returns {boolean}
 */
function validarDimensiones(texto) {
  if (!texto || typeof texto !== 'string') return false;
  const str = texto.trim();
  if (!str) return false;

  // 'Medida personalizada' sin especificar el valor real es inválido
  if (str.toLowerCase() === 'medida personalizada') return false;

  // Presets predefinidos del catálogo
  if (CATALOGO_PRESETS.some((p) => p.toLowerCase() === str.toLowerCase())) {
    return true;
  }

  // Rechazar números o signos negativos
  if (/(?:^|\s)-|\b-\d/.test(str)) {
    return false;
  }

  const UNIDADES = '(?:cm|m|mm|mts?|cms?|metros?|pulgadas?|in|pulgs?)';
  const NUM = '(\\d+(?:[.,]\\d+)?)';

  // 2D: num [unidad?] x num [unidad?] [sufijo/descripción?]
  const PATRON_2D = new RegExp(
    `^${NUM}\\s*${UNIDADES}?\\s*[xX×]\\s*${NUM}\\s*${UNIDADES}?(?:\\s+(?:abierto|cerrado|aprox))?(?:\\s*(?:\\/|\\().*)?$`,
    'i'
  );

  // 3D: num [unidad?] x num [unidad?] x num [unidad?] [sufijo/descripción?]
  const PATRON_3D = new RegExp(
    `^${NUM}\\s*${UNIDADES}?\\s*[xX×]\\s*${NUM}\\s*${UNIDADES}?\\s*[xX×]\\s*${NUM}\\s*${UNIDADES}?(?:\\s*(?:\\/|\\().*)?$`,
    'i'
  );

  let match = str.match(PATRON_2D);
  if (match) {
    const n1 = parseFloat(match[1].replace(',', '.'));
    const n2 = parseFloat(match[2].replace(',', '.'));
    if (isNaN(n1) || isNaN(n2)) return false;
    if (n1 <= 0 || n2 <= 0) return false;
    return true;
  }

  match = str.match(PATRON_3D);
  if (match) {
    const n1 = parseFloat(match[1].replace(',', '.'));
    const n2 = parseFloat(match[2].replace(',', '.'));
    const n3 = parseFloat(match[3].replace(',', '.'));
    if (isNaN(n1) || isNaN(n2) || isNaN(n3)) return false;
    if (n1 <= 0 || n2 <= 0 || n3 <= 0) return false;
    return true;
  }

  return false;
}

module.exports = {
  validarDimensiones,
  MENSAJE_ERROR_DIMENSIONES,
  CATALOGO_PRESETS,
};
