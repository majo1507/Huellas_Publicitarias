import assert from 'node:assert/strict';

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

export function validarDimensiones(texto) {
  if (!texto || typeof texto !== 'string') return false;
  const str = texto.trim();
  if (!str) return false;

  if (str.toLowerCase() === 'medida personalizada') return false;

  if (CATALOGO_PRESETS.some((p) => p.toLowerCase() === str.toLowerCase())) {
    return true;
  }

  // Rechazar signos negativos
  if (/(?:^|\s)-|\b-\d/.test(str)) {
    return false;
  }

  const UNIDADES = '(?:cm|m|mm|mts?|cms?|metros?|pulgadas?|in|pulgs?)';
  const NUM = '(\\d+(?:[.,]\\d+)?)';

  // 2D: num [unidad?] x num [unidad?] [descriptor/sufijo?]
  const PATRON_2D = new RegExp(
    `^${NUM}\\s*${UNIDADES}?\\s*[xX×]\\s*${NUM}\\s*${UNIDADES}?(?:\\s+(?:abierto|cerrado|aprox))?(?:\\s*(?:\\/|\\().*)?$`,
    'i'
  );

  // 3D: num [unidad?] x num [unidad?] x num [unidad?] [descriptor/sufijo?]
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

const tests = [
  // Deberían ser VÁLIDOS
  ['9 x 5 cm', true],
  ['1.20 x 2.00 m', true],
  ['6 x 3 m', true],
  ['2m x 1m', true],
  ['85cm x 200cm', true],
  ['1.5 x 2.5 m', true],
  ['21.5 x 28 cm', true],
  ['20 x 15 x 10 cm', true],
  ['20cm x 15cm x 10cm', true],
  ['0.80 x 2.00 m (Estándar Pendón / Roll-Up)', true],
  ['9 x 5 cm (Tarjeta de presentación)', true],
  ['28 x 63 cm abierto (Plegable tríptico)', true],
  ['10 x 15 cm / Media carta (Volante)', true],
  ['1 x 1', true],
  ['3x1m', true],
  ['1.20 x 2.20 m', true],
  ['1,5 x 2,0 m', true],

  // Deberían ser INVÁLIDOS
  ['juju', false],
  ['juju...', false],
  ['grande', false],
  ['Medida personalizada', false],
  ['', false],
  ['   ', false],
  ['0 x 0 m', false],
  ['0 x 5 cm', false],
  ['1.20 x 0 m', false],
  ['0.00 x 2.00 m', false],
  ['-1.20 x 2.00 m', false],
  ['9 x -5 cm', false],
  ['-3 x -4', false],
  ['1.20 x', false],
  ['x 2.00 m', false],
  ['5 cm', false],
  ['10 m', false],
  ['abc x def', false],
  ['1.20 x abc', false],
  ['juju x jaja', false],
  ['1.20 x 2.00 x', false],
  ['.. x 2', false],
];

console.log('🧪 Ejecutando pruebas unitarias de validación de dimensiones...');
for (const [input, expected] of tests) {
  const actual = validarDimensiones(input);
  assert.equal(actual, expected, `Fallo en '${input}': se esperaba ${expected}, se obtuvo ${actual}`);
}
console.log(`✅ ${tests.length} casos probados exitosamente (100% OK).`);
