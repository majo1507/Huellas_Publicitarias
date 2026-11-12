// ============================================================
// backend/tests/fase3_2_verificacion.test.mjs
// Verificación integral de la Fase 3.2 Complementaria: Dashboard e Informes
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.PORT = '3095';

const { server } = require('../index.js');
const { pool } = require('../db.js');

const BASE = 'http://127.0.0.1:3095/api';

async function req(path, { method = 'GET', token = '', body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function parseFechaTexto(texto) {
  if (!texto) return null;
  if (texto instanceof Date) return texto;
  if (typeof texto === 'string' && texto.includes('/')) {
    const [dia, mes, anio] = texto.split('/').map(Number);
    return new Date(anio, mes - 1, dia);
  }
  return new Date(texto);
}

async function runFase32Tests() {
  console.log('🧪 [FASE 3.2 COMPLEMENTARIA] Iniciando pruebas de verificación de Dashboard de Gerencia e Informes...');
  console.log(`🚀 Conectando a servidor de prueba en ${BASE}...`);

  try {
    // ------------------------------------------------------------
    // 1. Verificación previa de Proveedores y Alias (/api/proveedores vs /api/inventario/proveedores)
    // ------------------------------------------------------------
    console.log('\n📌 1. Verificación de endpoints de proveedores...');
    const loginCoord = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'carlos.gomez@huellas.co', clave: 'coord123' },
    });
    assert.equal(loginCoord.status, 200, 'Login coordinador exitoso');
    const tokenCoord = loginCoord.data.token;

    const resInvProv = await req('/inventario/proveedores', { token: tokenCoord });
    assert.equal(resInvProv.status, 200, '/api/inventario/proveedores debe responder 200');
    assert.equal(resInvProv.data.total, 4, 'Deben existir 4 proveedores en PostgreSQL');

    const resProvAlias = await req('/proveedores', { token: tokenCoord });
    assert.equal(resProvAlias.status, 200, 'Alias /api/proveedores debe responder 200 sin 404');
    assert.equal(resProvAlias.data.total, 4, 'Alias /api/proveedores debe retornar los mismos 4 proveedores');
    console.log('  ✅ 1. Endpoints /api/inventario/proveedores y /api/proveedores verificados.');

    // ------------------------------------------------------------
    // 2. Dashboard de Gerencia con datos reales de PostgreSQL
    // ------------------------------------------------------------
    console.log('\n📌 2. Verificación de /api/dashboard para Gerencia...');
    const loginGerente = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'laura.sanchez@huellas.co', clave: 'gerencia123' },
    });
    assert.equal(loginGerente.status, 200, 'Login gerente exitoso');
    const tokenGerente = loginGerente.data.token;

    const dashRes = await req('/dashboard', { token: tokenGerente });
    assert.equal(dashRes.status, 200, 'GET /api/dashboard debe responder 200');

    const { resumen, comunicaciones, carga_usuarios, tiempos_promedio_etapa } = dashRes.data;

    // Verificar órdenes reales
    assert.ok(resumen.total_ordenes > 100, `total_ordenes debe ser real de PostgreSQL (${resumen.total_ordenes})`);
    assert.ok(resumen.activas > 0, `activas debe ser mayor a 0 (${resumen.activas})`);
    assert.ok(resumen.finalizadas > 0, `finalizadas debe ser mayor a 0 (${resumen.finalizadas})`);
    assert.equal(resumen.total_ordenes, resumen.activas + resumen.finalizadas, 'Total debe ser suma de activas y finalizadas');

    // 2.1 Eficiencia de diseño sobre diseños evaluados
    const diseno = resumen.eficiencia_diseno;
    assert.ok(diseno, 'eficiencia_diseno debe estar presente en resumen');
    
    // Validar contra consulta directa a PostgreSQL
    const dbDisenoRes = await pool.query(`
      SELECT
        COUNT(DISTINCT orden_id) FILTER (WHERE tiene_aprobado AND max_version = 1) AS aprobadas_v1,
        COUNT(DISTINCT orden_id) FILTER (WHERE tiene_aprobado) AS total_evaluadas,
        COUNT(DISTINCT orden_id) FILTER (WHERE NOT tiene_aprobado) AS total_pendientes
      FROM (
        SELECT
          a.orden_id,
          BOOL_OR(a.estado_aprobacion = 'aprobado') AS tiene_aprobado,
          MAX(a.numero_version) AS max_version
        FROM archivos_arte a
        INNER JOIN ordenes o ON o.id = a.orden_id
        GROUP BY a.orden_id
      ) sub
    `);
    const dbDiseno = dbDisenoRes.rows[0];
    const expAprobadasV1 = parseInt(dbDiseno.aprobadas_v1, 10);
    const expTotalEvaluadas = parseInt(dbDiseno.total_evaluadas, 10);
    const expTotalPendientes = parseInt(dbDiseno.total_pendientes, 10);
    const expPct = expTotalEvaluadas > 0 ? Math.round((expAprobadasV1 / expTotalEvaluadas) * 100) : 0;

    assert.equal(diseno.aprobadas_v1, expAprobadasV1, `aprobadas_v1 debe coincidir con BD (${expAprobadasV1})`);
    assert.equal(diseno.total_evaluadas, expTotalEvaluadas, `total_evaluadas debe coincidir con BD (${expTotalEvaluadas})`);
    assert.equal(diseno.total_pendientes, expTotalPendientes, `total_pendientes debe coincidir con BD (${expTotalPendientes})`);
    assert.equal(diseno.aprobados_primera_version_pct, expPct, `Porcentaje sobre evaluadas debe ser ${expPct}% (${diseno.aprobados_primera_version_pct}%)`);
    console.log(`  ✅ 2.1 Aprobación a 1ª versión verificada: ${expPct}% (${expAprobadasV1} de ${expTotalEvaluadas} evaluadas; ${expTotalPendientes} pendientes).`);

    // 2.2 Comunicaciones: distinción de conversaciones y mensajes
    assert.ok(comunicaciones, 'comunicaciones debe estar presente');
    const dbConvCount = await pool.query(`SELECT COUNT(*)::int AS total FROM canales_contacto`);
    const dbMsgCount = await pool.query(`SELECT COUNT(*)::int AS total FROM mensajes_entrantes`);
    const expTotalConv = dbConvCount.rows[0].total;
    const expTotalMsg = dbMsgCount.rows[0].total;

    assert.equal(comunicaciones.total_conversaciones, expTotalConv, `Total conversaciones debe coincidir con BD (${expTotalConv})`);
    assert.equal(comunicaciones.total_mensajes, expTotalMsg, `Total mensajes debe coincidir con BD (${expTotalMsg})`);

    const wa = comunicaciones.conversaciones_por_canal.find(c => c.label === 'WhatsApp');
    const mail = comunicaciones.conversaciones_por_canal.find(c => c.label === 'Correo');
    const call = comunicaciones.conversaciones_por_canal.find(c => c.label === 'Telefonía');
    assert.ok(wa && wa.value > 0, 'WhatsApp debe tener conversaciones registradas');
    assert.ok(mail && mail.value > 0, 'Correo debe tener conversaciones registradas');
    assert.ok(call && call.value > 0, 'Telefonía debe tener conversaciones registradas');
    console.log(`  ✅ 2.2 Comunicaciones verificadas: ${expTotalConv} conversaciones e hilos (${expTotalMsg} mensajes procesados).`);

    // 2.3 Sincronización temporal de órdenes retrasadas (criterio unificado con medianoche)
    const ordQuery = await pool.query(`SELECT fecha_entrega FROM ordenes WHERE etapa < 8;`);
    const hoyMidnight = new Date();
    hoyMidnight.setHours(0, 0, 0, 0);

    let retrasadasDirectoDB = 0;
    for (const row of ordQuery.rows) {
      if (row.fecha_entrega) {
        const f = parseFechaTexto(row.fecha_entrega);
        if (f) {
          f.setHours(0, 0, 0, 0);
          if (f < hoyMidnight) retrasadasDirectoDB++;
        }
      }
    }
    assert.equal(resumen.retrasadas, retrasadasDirectoDB, `Retrasadas backend (${resumen.retrasadas}) debe coincidir con cálculo normalizado (${retrasadasDirectoDB})`);
    console.log(`  ✅ 2.3 Sincronización de órdenes retrasadas verificada: ${resumen.retrasadas} órdenes identificadas con fecha actual del sistema.`);

    // 2.4 Cumplimiento de entregas unificado (denominador = total órdenes)
    const enPlazoEsperado = Math.max(0, resumen.total_ordenes - resumen.retrasadas);
    const pctEsperado = Math.round((enPlazoEsperado / resumen.total_ordenes) * 100);
    assert.equal(resumen.a_tiempo_pct, pctEsperado, `a_tiempo_pct (${resumen.a_tiempo_pct}) debe coincidir con cálculo sobre universo de órdenes (${pctEsperado})`);
    console.log(`  ✅ 2.4 Cumplimiento de entregas verificado: ${resumen.a_tiempo_pct}% (${enPlazoEsperado} de ${resumen.total_ordenes} en plazo).`);

    // ------------------------------------------------------------
    // 3. Segregación Financiera y Restricción de Dashboard
    // ------------------------------------------------------------
    console.log('\n📌 3. Verificando segregación financiera y restricción en /api/dashboard...');
    const loginDis = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'maria.lopez@huellas.co', clave: 'diseno123' },
    });
    assert.equal(loginDis.status, 200, 'Login diseñador exitoso');
    const tokenDis = loginDis.data.token;

    const dashDis = await req('/dashboard', { token: tokenDis });
    assert.equal(dashDis.status, 403, 'Diseñador bloqueado de dashboard gerencial (403)');

    const loginOp = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'pedro.morales@huellas.co', clave: 'taller123' },
    });
    assert.equal(loginOp.status, 200, 'Login operario exitoso');
    const tokenOp = loginOp.data.token;

    const dashOp = await req('/dashboard', { token: tokenOp });
    assert.equal(dashOp.status, 403, 'Operario bloqueado de dashboard gerencial (403)');

    const dashCoord = await req('/dashboard', { token: tokenCoord });
    assert.equal(dashCoord.status, 200, 'Coordinador accede a dashboard operativo');
    assert.equal(dashCoord.data.resumen.total_presupuestado, undefined, 'total_presupuestado DEBE ser undefined para coordinador');
    console.log('  ✅ 3. Segregación financiera comprobada: 403 a Diseñador/Operario y métricas financieras omitidas a Coordinador.');

    // ------------------------------------------------------------
    // 4. Verificación de Protección de Modo Demo ante Fallos del Dashboard
    // ------------------------------------------------------------
    console.log('\n📌 4. Verificando protección contra modo demo ante error de servidor...');
    const { api } = await import('../../src/services/api.js');

    // Comprobar que api.usarMock es falso inicialmente
    assert.equal(api.usarMock, false, 'Modo demo debe estar inactivo');

    // Simular llamada con error forzado en obtenerDashboard
    // Guardamos fetch global original
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Simulación de caída de base de datos' }),
      };
    };

    try {
      const resFallo = await api.obtenerDashboard();
      assert.equal(resFallo.ok, false, 'Debe retornar ok: false');
      assert.equal(resFallo.status, 500, 'Debe capturar status 500');
      assert.equal(api.usarMock, false, 'El error 500 en Dashboard NO debe activar el modo demo global');
      console.log('  ✅ 4. Protección contra modo demo verificada: error 500 no activó setModoDemoLocal(true).');
    } finally {
      globalThis.fetch = fetchOriginal;
    }

    console.log('\n============================================================');
    console.log('🎉 TODAS LAS VERIFICACIONES DE LA FASE 3.2 COMPLEMENTARIA PASARON (100% OK)');
    console.log('============================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runFase32Tests().catch(err => {
  console.error('❌ Error en pruebas de Fase 3.2 Complementaria:', err);
  process.exit(1);
});
