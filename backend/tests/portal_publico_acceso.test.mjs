// ============================================================
// backend/tests/portal_publico_acceso.test.mjs
// Verificación de acceso universal al Portal Público (#/portal) y preservación de RBAC interno
// ============================================================
import assert from 'node:assert/strict';
import { PAGINAS_AUTORIZADAS_POR_ROL, ROLES, normalizarRol } from '../../src/data/roles.js';

console.log('🧪 Iniciando verificación de acceso al Portal Público de Clientes y protección de módulos internos...\n');

// 1. Verificación de que 'portal' está permitido para todos los roles en la matriz
console.log('--- 1. Matriz de Autorización por Rol para el Portal Público ---');
const todosLosRoles = ['comercial', 'coordinador', 'disenador', 'operario', 'postventa', 'gerencia', 'cliente'];

for (const rol of todosLosRoles) {
  const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rol];
  assert.ok(Array.isArray(permitidas), `La lista de páginas para ${rol} debe existir`);
  assert.ok(
    permitidas.includes('portal'),
    `El rol ${rol} debe tener autorización para el portal público ('portal')`
  );
  console.log(`  ✅ Rol [${rol.padEnd(12)}]: portal público autorizado.`);
}

// 2. Verificación de preservación de seguridad en módulos internos (Defensa de RBAC)
console.log('\n--- 2. Verificación de Protección Estricta de Módulos Internos ---');
// Operario solo debe tener acceso a 'inicio' y 'portal', NUNCA a módulos ejecutivos/financieros
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.operario.includes('reportes'), 'Operario no debe tener acceso a reportes');
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.operario.includes('inventario'), 'Operario no debe tener acceso a inventario');
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.operario.includes('pedidos'), 'Operario no debe tener acceso a gestión de pedidos');
console.log('  ✅ Restricciones de Operario preservadas (bloqueado de reportes, inventario, pedidos).');

// Diseñador solo debe tener 'inicio', 'disenos', 'aprobacion' y 'portal'
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.disenador.includes('reportes'), 'Diseñador no debe tener acceso a reportes');
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.disenador.includes('inventario'), 'Diseñador no debe tener acceso a inventario');
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.disenador.includes('solicitudes'), 'Diseñador no debe tener acceso a solicitudes');
console.log('  ✅ Restricciones de Diseñador preservadas (bloqueado de reportes, inventario, solicitudes).');

// Comercial no debe acceder a tareas de taller ni inventario
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.comercial.includes('tareas'), 'Comercial no debe tener acceso a tareas de taller');
assert.ok(!PAGINAS_AUTORIZADAS_POR_ROL.comercial.includes('inventario'), 'Comercial no debe tener acceso a inventario');
console.log('  ✅ Restricciones de Comercial preservadas (bloqueado de tareas, inventario).');

// 3. Simulación de la función de validación de rutas directas (sincronizarRutaDesdeHash)
console.log('\n--- 3. Simulación de Sincronización y Validación de Rutas Hash ---');

function simularAccesoHash(hashUrl, rolActivo) {
  const rawHash = hashUrl.replace(/^#\/?/, '').trim();
  const partes = rawHash.split('/');
  const targetPage = partes[0] || 'inicio';

  // Rutas públicas que no requieren autenticación ni están restringidas por rol
  if (targetPage === 'portal') {
    return { permitido: true, pagina: 'portal', motivo: 'Ruta pública' };
  }

  const rolNormal = normalizarRol(rolActivo);
  const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rolNormal] || ['inicio'];

  if (!permitidas.includes(targetPage)) {
    return {
      permitido: false,
      pagina: 'inicio',
      motivo: `Acceso denegado: el perfil ${rolNormal} no tiene autorización para acceder a "${targetPage}".`
    };
  }

  return { permitido: true, pagina: targetPage, motivo: 'Autorizado por rol' };
}

// Probar acceso a #/portal desde TODOS los perfiles (incluso tras haber tenido ese rol en sesión)
for (const rol of todosLosRoles) {
  const res = simularAccesoHash('#/portal', rol);
  assert.equal(res.permitido, true, `Acceso a #/portal debe ser permitido con rol ${rol}`);
  assert.equal(res.pagina, 'portal');
  console.log(`  ✅ Navegación a #/portal con rol residual [${rol.padEnd(12)}]: PERMITIDO sin restricciones.`);
}

// Probar que un usuario no autenticado (sin rol previo o rol null/undefined) puede abrir #/portal
const resSinRol = simularAccesoHash('#/portal', null);
assert.equal(resSinRol.permitido, true);
assert.equal(resSinRol.pagina, 'portal');
console.log('  ✅ Navegación directa anónima a #/portal: PERMITIDO.');

// Probar que los módulos internos protegidos siguen rechazando rutas no autorizadas
const intentoIlegalOperario = simularAccesoHash('#/reportes', 'operario');
assert.equal(intentoIlegalOperario.permitido, false, 'Operario no debe poder navegar a #/reportes');
assert.equal(intentoIlegalOperario.pagina, 'inicio', 'Debe redirigir a inicio');
console.log('  ✅ Intento no autorizado (Operario -> #/reportes): BLOQUEADO Y REDIRIGIDO.');

const intentoIlegalDisenador = simularAccesoHash('#/inventario', 'disenador');
assert.equal(intentoIlegalDisenador.permitido, false, 'Diseñador no debe poder navegar a #/inventario');
console.log('  ✅ Intento no autorizado (Diseñador -> #/inventario): BLOQUEADO Y REDIRIGIDO.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE ACCESO AL PORTAL PÚBLICO Y SEGURIDAD RBAC PASARON (100% OK)!');
