// ============================================================
// backend/tests/run-all.mjs — Ejecuta todas las suites vigentes de ORVEX
//
// Las suites escriben datos: exige una base QA aislada en DB_NAME y se niega a
// ejecutarse sobre orvex_test o sobre la base configurada por defecto en .env.
//   PowerShell:  $env:DB_NAME='orvex_qa'; npm run test:all
//   Bash:        DB_NAME=orvex_qa npm run test:all
// ============================================================
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PROTEGIDAS = ['orvex_test', 'sistema_empresarial'];
const db = process.env.DB_NAME;

if (!db || PROTEGIDAS.includes(db)) {
  console.error(`❌ Define DB_NAME con una base QA aislada (no ${PROTEGIDAS.join(' ni ')}). Ejemplo: DB_NAME=orvex_qa`);
  process.exit(1);
}

const suites = [
  'test_dimensiones_unit.mjs',
  'etapa1_rbac.test.mjs',
  'etapa2_transaccional.test.mjs',
  'fase3_1_verificacion.test.mjs',
  'fase3_2_verificacion.test.mjs',
  'fase3_3_e2e_integral.test.mjs',
  'correccion_solicitudes.test.mjs',
  'cotizacion_pagos.test.mjs',
  'fecha_envio_disenos.test.mjs',
  'flujo_diseno_comercial.test.mjs',
  'flujo_integral_presentacion.test.mjs',
];

console.log(`🧪 Ejecutando ${suites.length} suites sobre la base "${db}"\n`);
const resultados = suites.map((s) => {
  const inicio = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, s)], { env: process.env, encoding: 'utf8', timeout: 180000 });
  const ok = r.status === 0;
  console.log(`${ok ? '✅' : '❌'} ${s.padEnd(40)} ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  if (!ok) {
    const salida = `${r.stdout || ''}\n${r.stderr || ''}`.split('\n').filter((l) => /❌|Assertion|Error/.test(l)).slice(0, 4);
    salida.forEach((l) => console.log(`     ${l.trim()}`));
  }
  return ok;
});

const fallidas = resultados.filter((ok) => !ok).length;
console.log(`\n${fallidas === 0 ? '🎉' : '⚠️ '} ${suites.length - fallidas}/${suites.length} suites superadas.`);
process.exit(fallidas === 0 ? 0 : 1);
