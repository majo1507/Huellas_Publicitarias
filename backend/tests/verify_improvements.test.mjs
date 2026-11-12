// ============================================================
// tests/verify_improvements.test.mjs
// Verificación integral de mejoras funcionales de ORVEX
// ============================================================
import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ path: 'backend/.env' });

const BASE_URL = 'http://localhost:3000';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'orvex_default_jwt_secret_dev_2026';
}

const USUARIOS = {
  gerente: { id: 'f4d13c8d-1716-4365-badd-6b61ecc62c71', nombre: 'Andrés Torres', email: 'guidohernandezhdz@gmail.com', rolBd: 'gerente', rolUi: 'gerencia' },
  ejecutiva: { id: '625af3ff-ffd4-4956-a6fd-096e54fde577', nombre: 'Ana Martínez', email: 'jhonavila1038800612@gmail.com', rolBd: 'ejecutiva', rolUi: 'comercial' },
  coord: { id: '19495805-a026-49d4-ba6e-c53a680c9ac1', nombre: 'Carlos Ruiz', email: 'jhon.avilahe@amigo.edu.co', rolBd: 'coord', rolUi: 'coordinador' },
  disenador: { id: '0043ff39-4324-4643-9848-419a3dc46dd6', nombre: 'María López', email: 'nicoohdz418@gmail.com', rolBd: 'disenador', rolUi: 'disenador' },
  produccion: { id: '72de06fe-56e7-45a2-bfba-7c7e6f992152', nombre: 'Juan Pérez', email: 'andresvarrera10@gmail.com', rolBd: 'produccion', rolUi: 'operario' },
  postventa: { id: 'd03da3c6-f08b-43dc-a3ba-a1d4ab5d91e4', nombre: 'Sofía Herrera', email: 'Victoriavi324@gmail.com', rolBd: 'postventa', rolUi: 'postventa' },
};

function token(rol) {
  const u = USUARIOS[rol];
  return jwt.sign(
    {
      id: u.id,
      nombre_completo: u.nombre,
      email: u.email,
      rol: u.rolBd,
      rolUi: u.rolUi,
      rol_normalizado: u.rolBd,
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('🧪 Iniciando verificación integral de mejoras funcionales de ORVEX...\n');
  let pasaron = 0;
  let total = 0;

  async function test(nombre, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${nombre}`);
      pasaron++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${nombre}:`, err.message);
    }
  }

  // --- SECCIÓN 1: PORTAL PÚBLICO DE ATENCIÓN ---
  console.log('--- 1. Portal Público de Atención al Cliente (/api/portal) ---');

  await test('Portal: Radicar PQRSF pública genera radicado y almacena en postventa', async () => {
    const res = await fetch(`${BASE_URL}/api/portal/pqrsf/radicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_contacto: 'Cliente Prueba Portal',
        telefono: '3116088542',
        email: 'cliente.portal@ejemplo.com',
        tipo: 'Reclamo',
        descripcion: 'Consulta de prueba sobre tiempo de entrega mediante el portal público.',
      }),
    });
    assert.ok(res.status === 200 || res.status === 201, `Esperado 200 o 201, obtenido ${res.status}`);
    const data = await res.json();
    assert.ok(data.radicado, 'Debe retornar un código de radicado único');
    assert.match(data.radicado, /^RAD-\d{4}-\d{4}$/, 'Formato de radicado debe ser RAD-YYYY-XXXX');

    // Consultar el radicado generado inmediatamente
    const resConsulta = await fetch(`${BASE_URL}/api/portal/pqrsf/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        radicado: data.radicado,
        email: 'cliente.portal@ejemplo.com',
      }),
    });
    assert.strictEqual(resConsulta.status, 200, `Consulta de radicado debe retornar 200, obtenido ${resConsulta.status}`);
    const info = await resConsulta.json();
    assert.strictEqual(info.caso.radicado, data.radicado);
    assert.ok(info.caso.estado, 'Debe indicar el estado del caso');
  });

  await test('Portal: Consulta de pedido con orden inexistente devuelve 404', async () => {
    const res = await fetch(`${BASE_URL}/api/portal/pedidos/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo_orden: 'ORD-99999-INEXISTENTE',
        verificacion: '3000000000',
      }),
    });
    assert.strictEqual(res.status, 404, `Esperado 404 para orden inexistente, obtenido ${res.status}`);
  });

  // --- SECCIÓN 2: INTEGRIDAD REFERENCIAL Y CRUD SEGURO ---
  console.log('\n--- 2. Integridad Referencial y Eliminación Segura ---');

  await test('Clientes: Archivar y Restaurar cliente con token autorizado (Comercial / Gerencia)', async () => {
    const tComercial = token('ejecutiva');
    // Obtenemos lista de clientes
    const resList = await fetch(`${BASE_URL}/api/clientes`, {
      headers: { Authorization: `Bearer ${tComercial}` },
    });
    const { data: clientes } = await resList.json();
    if (clientes && clientes.length > 0) {
      const cli = clientes[0];
      // Archivar
      const resArch = await fetch(`${BASE_URL}/api/clientes/${cli.id}/archivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tComercial}` },
      });
      assert.strictEqual(resArch.status, 200, 'Archivar cliente debe retornar 200');

      // Restaurar
      const resRest = await fetch(`${BASE_URL}/api/clientes/${cli.id}/restaurar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tComercial}` },
      });
      assert.strictEqual(resRest.status, 200, 'Restaurar cliente debe retornar 200');
    }
  });

  await test('Inventario: Archivar y Restaurar material con token autorizado', async () => {
    const tCoord = token('coord');
    const resList = await fetch(`${BASE_URL}/api/inventario`, {
      headers: { Authorization: `Bearer ${tCoord}` },
    });
    const { data: materiales } = await resList.json();
    if (materiales && materiales.length > 0) {
      const mat = materiales[0];
      const resArch = await fetch(`${BASE_URL}/api/inventario/${mat.id}/archivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tCoord}` },
      });
      assert.strictEqual(resArch.status, 200, 'Archivar material debe retornar 200');

      const resRest = await fetch(`${BASE_URL}/api/inventario/${mat.id}/restaurar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tCoord}` },
      });
      assert.strictEqual(resRest.status, 200, 'Restaurar material debe retornar 200');
    }
  });

  await test('Inventario: Bloqueo de eliminación física de material con existencias', async () => {
    const tCoord = token('coord');
    const resList = await fetch(`${BASE_URL}/api/inventario`, {
      headers: { Authorization: `Bearer ${tCoord}` },
    });
    const { data: materiales } = await resList.json();
    const matConStock = materiales?.find((m) => Number(m.stockActual || m.stock || 0) > 0);
    if (matConStock) {
      const resDel = await fetch(`${BASE_URL}/api/inventario/${matConStock.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tCoord}` },
      });
      assert.strictEqual(resDel.status, 400, 'Debe rechazar con 400 por existencia de stock');
      const errData = await resDel.json();
      assert.ok(errData.error.includes('stock') || errData.error.includes('Archivar'), 'El error debe indicar la imposibilidad y sugerir archivar');
    }
  });

  await test('Proveedores: Archivar y Restaurar proveedor con token de Coordinación', async () => {
    const tCoord = token('coord');
    const resList = await fetch(`${BASE_URL}/api/inventario/proveedores`, {
      headers: { Authorization: `Bearer ${tCoord}` },
    });
    const { data: proveedores } = await resList.json();
    if (proveedores && proveedores.length > 0) {
      const prov = proveedores[0];
      const resArch = await fetch(`${BASE_URL}/api/inventario/proveedores/${prov.id}/archivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tCoord}` },
      });
      assert.strictEqual(resArch.status, 200, 'Archivar proveedor debe retornar 200');

      const resRest = await fetch(`${BASE_URL}/api/inventario/proveedores/${prov.id}/restaurar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tCoord}` },
      });
      assert.strictEqual(resRest.status, 200, 'Restaurar proveedor debe retornar 200');
    }
  });

  // --- SECCIÓN 3: POSTVENTA Y CICLO DE VIDA DE CASOS ---
  console.log('\n--- 3. Rediseño y Módulo de Postventa ---');

  await test('Postventa: Listado de casos accesible por roles autorizados', async () => {
    const tPost = token('postventa');
    const res = await fetch(`${BASE_URL}/api/postventa`, {
      headers: { Authorization: `Bearer ${tPost}` },
    });
    assert.strictEqual(res.status, 200, 'Postventa debe poder consultar casos');
    const { data: casos } = await res.json();
    assert.ok(Array.isArray(casos), 'Debe retornar un array de casos');
  });

  await test('Postventa: Archivar y Restaurar caso con token de Postventa', async () => {
    const tPost = token('postventa');
    const resList = await fetch(`${BASE_URL}/api/postventa`, {
      headers: { Authorization: `Bearer ${tPost}` },
    });
    const { data: casos } = await resList.json();
    if (casos && casos.length > 0) {
      const caso = casos[0];
      const resArch = await fetch(`${BASE_URL}/api/postventa/${caso.id}/archivar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tPost}` },
      });
      assert.strictEqual(resArch.status, 200, 'Archivar caso postventa debe retornar 200');

      const resRest = await fetch(`${BASE_URL}/api/postventa/${caso.id}/restaurar`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tPost}` },
      });
      assert.strictEqual(resRest.status, 200, 'Restaurar caso postventa debe retornar 200');
    }
  });

  // --- SECCIÓN 4: AUDITORÍA DE SEGURIDAD Y PERMISOS DE ROLES ---
  console.log('\n--- 4. Matriz de Autorización por Rol (RBAC) ---');

  await test('Seguridad: GET /api/clientes restringido a roles autorizados (403 para diseñador y operario)', async () => {
    const resDis = await fetch(`${BASE_URL}/api/clientes`, { headers: { Authorization: `Bearer ${token('disenador')}` } });
    assert.strictEqual(resDis.status, 403, 'Diseñador no debe acceder a clientes (403)');

    const resProd = await fetch(`${BASE_URL}/api/clientes`, { headers: { Authorization: `Bearer ${token('produccion')}` } });
    assert.strictEqual(resProd.status, 403, 'Operario no debe acceder a clientes (403)');

    const resGer = await fetch(`${BASE_URL}/api/clientes`, { headers: { Authorization: `Bearer ${token('gerente')}` } });
    assert.strictEqual(resGer.status, 200, 'Gerente debe acceder a clientes (200)');

    const resCom = await fetch(`${BASE_URL}/api/clientes`, { headers: { Authorization: `Bearer ${token('ejecutiva')}` } });
    assert.strictEqual(resCom.status, 200, 'Comercial debe acceder a clientes (200)');
  });

  await test('Seguridad: GET /api/dashboard métricas ejecutivas restringidas a Gerencia', async () => {
    const resGer = await fetch(`${BASE_URL}/api/dashboard`, { headers: { Authorization: `Bearer ${token('gerente')}` } });
    assert.strictEqual(resGer.status, 200, 'Gerente debe acceder al dashboard ejecutivo (200)');

    const resDis = await fetch(`${BASE_URL}/api/dashboard`, { headers: { Authorization: `Bearer ${token('disenador')}` } });
    assert.strictEqual(resDis.status, 403, 'Diseñador no debe acceder a métricas gerenciales (403)');
  });

  console.log(`\n===================================================`);
  console.log(`Resultados: ${pasaron} de ${total} pruebas superadas (${Math.round((pasaron / total) * 100)}%).`);
  console.log(`===================================================\n`);
}

runTests().catch(console.error);
