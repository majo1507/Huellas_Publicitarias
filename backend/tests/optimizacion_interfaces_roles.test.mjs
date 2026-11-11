// ============================================================
// backend/tests/optimizacion_interfaces_roles.test.mjs
// Suite de validación para la Optimización de Interfaces y Paneles
// de los seis roles de ORVEX sobre la base de datos orvex_qa
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.DB_NAME = 'orvex_qa';
process.env.PORT = '3097';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');
const { ROLES, PAGINAS_AUTORIZADAS_POR_ROL } = await import('../../src/data/roles.js');

const BASE_URL = 'http://127.0.0.1:3097/api';

function generarToken(usuario) {
  return jwt.sign(usuario, getJwtSecret(), { expiresIn: '1h' });
}

async function req(endpoint, { method = 'GET', token = '', body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTestSuite() {
  console.log('🧪 [ORVEX] Iniciando pruebas de optimización de arquitectura de interfaces por rol...\n');

  try {
    // 1. Verificar conexión a orvex_qa
    const dbRes = await pool.query('SELECT current_database() AS db');
    assert.equal(dbRes.rows[0].db, 'orvex_qa', 'Las pruebas deben ejecutarse sobre orvex_qa');
    console.log(`✅ [TEST-01] Conexión activa a base de datos de pruebas: ${dbRes.rows[0].db}`);

    // ============================================================
    // SECCIÓN 1: VALIDACIÓN DE MENÚS Y PANELES POR ROL (FRONTEND CONFIG)
    // ============================================================
    console.log('\n📌 SECCIÓN 1: Validación de arquitectura de menús y paneles...');

    // A. Comercial / Recepción
    const menuComercial = ROLES.comercial.menu.map((m) => m.page);
    assert.deepEqual(
      menuComercial,
      ['inicio', 'clientes', 'nuevo', 'solicitudes', 'aprobacion_disenos', 'comunicaciones', 'pedidos'],
      'Comercial debe tener clientes, cotizaciones, solicitudes, gestión de diseños, comunicaciones y seguimiento de pedidos'
    );
    assert.ok(!menuComercial.includes('entregas'), 'Comercial no debe tener entregas como módulo operativo de taller');
    assert.ok(!menuComercial.includes('produccion'), 'Comercial no debe tener tablero de producción');
    assert.ok(!menuComercial.includes('tareas'), 'Comercial no debe tener tareas internas de taller');
    assert.ok(!menuComercial.includes('inventario'), 'Comercial no debe tener inventario de insumos');
    assert.ok(!menuComercial.includes('usuarios'), 'Comercial no debe tener administración de usuarios');
    console.log('  ✓ [COMERCIAL]: Menú centrado en clientes, solicitudes, comunicaciones y aprobaciones (sin módulos de taller).');

    // B. Coordinación de Producción
    const menuCoord = ROLES.coordinador.menu.map((m) => m.page);
    assert.deepEqual(
      menuCoord,
      ['inicio', 'pedidos', 'tareas', 'inventario'],
      'Coordinación debe concentrarse en planificación, programación de órdenes, asignación de actividades e inventario (sin tablero manual redundante ni entregas finales)'
    );
    assert.ok(!menuCoord.includes('produccion'), 'Coordinación NO debe tener el tablero manual de producción duplicado');
    assert.ok(!menuCoord.includes('entregas'), 'Coordinación NO debe registrar entregas finales al cliente');
    assert.ok(!menuCoord.includes('solicitudes'), 'Coordinación NO debe tener validación de solicitudes comerciales');
    assert.ok(!menuCoord.includes('comunicaciones'), 'Coordinación NO debe tener una bandeja general de comunicaciones en su menú');
    assert.ok(!menuCoord.includes('nuevo'), 'Coordinación no debe tener creación de cotizaciones');
    assert.ok(!menuCoord.includes('usuarios'), 'Coordinación no debe tener administración de usuarios');
    console.log('  ✓ [COORDINACIÓN]: Cabina de planificación, órdenes, actividades e inventario (sin tablero manual ni entregas finales).');

    // C. Diseñador Gráfico
    const menuDisenador = ROLES.disenador.menu.map((m) => m.page);
    assert.deepEqual(
      menuDisenador,
      ['inicio'],
      'El diseñador debe tener un único espacio de trabajo integrado en su menú (Mesa de diseño)'
    );
    assert.ok(!menuDisenador.includes('disenos'), 'No debe existir un segundo menú redundante para diseños');
    assert.ok(!menuDisenador.includes('pedidos'), 'El diseñador no debe tener panel de pedidos');
    assert.ok(!menuDisenador.includes('comercial'), 'El diseñador no debe tener módulos comerciales');
    console.log('  ✓ [DISEÑADOR]: Un único espacio de trabajo integrado para propuestas, versiones y ajustes.');

    // D. Operarios de Taller
    const menuOperario = ROLES.operario.menu.map((m) => m.page);
    assert.deepEqual(
      menuOperario,
      ['inicio'],
      'Operarios deben tener una interfaz sencilla y exclusiva de sus actividades asignadas'
    );
    assert.equal(ROLES.operario.buscador, false, 'Operarios no deben tener buscador global de órdenes');
    assert.equal(ROLES.operario.ordenPage, null, 'Operarios no deben navegar a expedientes generales');
    console.log('  ✓ [OPERARIOS]: Interfaz mínima enfocada 100% en sus actividades de estación de trabajo.');

    // E. Atención Postventa
    const menuPostventa = ROLES.postventa.menu.map((m) => m.page);
    assert.deepEqual(
      menuPostventa,
      ['inicio', 'comunicaciones', 'pedidos'],
      'Postventa debe conservar casos/garantías, comunicaciones con clientes y consulta de órdenes entregadas'
    );
    assert.ok(!menuPostventa.includes('solicitudes'), 'Postventa no debe crear solicitudes iniciales');
    assert.ok(!menuPostventa.includes('produccion'), 'Postventa no debe tener tablero de taller');
    assert.ok(!menuPostventa.includes('inventario'), 'Postventa no debe tener inventario');
    console.log('  ✓ [POSTVENTA]: Módulos conservados para gestión de casos, garantías y comunicaciones con clientes.');

    // F. Gerencia General
    const menuGerencia = ROLES.gerencia.menu.map((m) => m.page);
    assert.deepEqual(
      menuGerencia,
      ['inicio', 'pedidos', 'inventario', 'reportes'],
      'Gerencia debe ser exclusivamente supervisión, auditoría y análisis'
    );
    assert.ok(!menuGerencia.includes('usuarios'), 'Se retira la administración de usuarios del panel de Gerencia');
    assert.ok(!menuGerencia.includes('comunicaciones'), 'Gerencia no debe tener bandeja operativa de comunicaciones');
    assert.ok(!menuGerencia.includes('nuevo'), 'Gerencia no debe tener operaciones rutinarias de registro');
    assert.ok(!menuGerencia.includes('produccion'), 'Gerencia no debe tener tablero operativo de planta');
    console.log('  ✓ [GERENCIA]: Perfil ejecutivo y de auditoría consolidado (sin administración de usuarios ni rutinas).');

    // ============================================================
    // SECCIÓN 2: PROTECCIÓN DE RUTAS Y VALIDACIÓN DE URL DIRECTA (REGLA 5)
    // ============================================================
    console.log('\n📌 SECCIÓN 2: Validación de guardián de rutas y lista blanca por URL (Regla 5)...');

    // Comprobar que ningún rol puede exceder su lista blanca
    const todasLasPaginas = [
      'inicio', 'clientes', 'nuevo', 'solicitudes', 'aprobacion_disenos',
      'comunicaciones', 'pedidos', 'produccion', 'tareas', 'inventario',
      'entregas', 'disenos', 'reportes', 'usuarios', 'postventa',
    ];

    function validarAccesoUrl(rol, pagina) {
      const permitidas = PAGINAS_AUTORIZADAS_POR_ROL[rol] || ['inicio'];
      return permitidas.includes(pagina);
    }

    // Operario bloqueado en todo excepto inicio
    for (const pag of todasLasPaginas.filter((p) => p !== 'inicio')) {
      assert.equal(
        validarAccesoUrl('operario', pag),
        false,
        `Operario no debe poder acceder por URL a "${pag}"`
      );
    }
    console.log('  ✓ [URL GUARD - OPERARIO]: Bloqueo total verificado en 14 módulos no autorizados.');

    // Diseñador bloqueado en comercial, compras, inventario, usuarios, reportes
    assert.equal(validarAccesoUrl('disenador', 'usuarios'), false);
    assert.equal(validarAccesoUrl('disenador', 'inventario'), false);
    assert.equal(validarAccesoUrl('disenador', 'clientes'), false);
    assert.equal(validarAccesoUrl('disenador', 'nuevo'), false);
    assert.equal(validarAccesoUrl('disenador', 'comunicaciones'), false);
    console.log('  ✓ [URL GUARD - DISEÑADOR]: Bloqueo verificado en módulos comerciales y administrativos.');

    // Gerencia bloqueada en creación de solicitudes y bandeja de comunicaciones
    assert.equal(validarAccesoUrl('gerencia', 'nuevo'), false);
    assert.equal(validarAccesoUrl('gerencia', 'comunicaciones'), false);
    assert.equal(validarAccesoUrl('gerencia', 'produccion'), false);
    assert.equal(validarAccesoUrl('gerencia', 'tareas'), false);
    console.log('  ✓ [URL GUARD - GERENCIA]: Bloqueo verificado en módulos operativos de taller y mensajería.');

    // ============================================================
    // SECCIÓN 3: VERIFICACIÓN DE PERMISOS BACKEND EN orvex_qa
    // ============================================================
    console.log('\n📌 SECCIÓN 3: Verificación de permisos backend sobre orvex_qa...');

    const usuariosRes = await pool.query(
      'SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE esta_activo = true'
    );
    const usuComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuOperario = usuariosRes.rows.find((u) => u.rol === 'produccion');
    const usuGerente = usuariosRes.rows.find((u) => u.rol === 'gerente');

    const tGerente = generarToken(usuGerente);
    const tCoord = generarToken(usuCoord);
    const tOperario = generarToken(usuOperario);

    // Gerencia no puede ejecutar operaciones rutinarias
    const resGerCrearSol = await req('/solicitudes', { method: 'POST', token: tGerente, body: { producto: 'Test' } });
    assert.equal(resGerCrearSol.status, 403, 'Gerencia no puede crear solicitudes en backend (403)');

    const resGerMsg = await req('/comunicaciones/COM-1/mensajes', { method: 'POST', token: tGerente, body: { texto: 'Test' } });
    assert.equal(resGerMsg.status, 403, 'Gerencia no puede administrar conversaciones comerciales (403)');

    // Coordinación consulta comunicaciones pero no administra conversaciones comerciales
    const resCoordGetComms = await req('/comunicaciones', { method: 'GET', token: tCoord });
    assert.equal(resCoordGetComms.status, 200, 'Coordinación puede consultar comunicaciones (200)');
    const resCoordMsg = await req('/comunicaciones/COM-1/mensajes', { method: 'POST', token: tCoord, body: { texto: 'Test' } });
    assert.equal(resCoordMsg.status, 403, 'Coordinación no puede enviar mensajes a clientes (403)');

    // Operario recibe solo sus tareas asignadas
    const resOpTareas = await req('/tareas', { method: 'GET', token: tOperario });
    assert.equal(resOpTareas.status, 200);
    const tareasOp = Array.isArray(resOpTareas.data) ? resOpTareas.data : resOpTareas.data.data;
    assert.ok(
      tareasOp.every((t) => String(t.owner_id) === String(usuOperario.id) || t.responsable === usuOperario.nombre_completo),
      'Operario en backend solo recibe sus tareas de taller asignadas'
    );
    console.log('  ✓ [BACKEND]: Permisos verificados en backend orvex_qa para los roles analizados.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE OPTIMIZACIÓN DE INTERFACES Y ROLES PASARON CON ÉXITO (100%)!');
  } finally {
    server.close();
    await pool.end();
  }
}

runTestSuite().catch((err) => {
  console.error('❌ Fallo en la suite de pruebas:', err);
  process.exit(1);
});
