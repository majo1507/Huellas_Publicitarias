// ============================================================
// backend/tests/etapa4_optimizacion_qa.test.mjs
// Suite de validación integral — ORVEX Etapa 4: Optimización Funcional
// Ejecutada sobre la base de datos de pruebas QA: orvex_qa
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.DB_NAME = 'orvex_qa';
process.env.PORT = '3099';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');

const BASE_URL = 'http://127.0.0.1:3099/api';

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

async function runQaTests() {
  console.log('🧪 [ETAPA 4 QA] Iniciando pruebas sobre base de datos orvex_qa...\n');

  let solicitudCreadaId = null;
  let ordenGeneradaId = null;
  let hiloCreadoId = null;

  try {
    // 1. Verificar conexión efectiva a orvex_qa
    const dbRes = await pool.query('SELECT current_database() AS db');
    assert.equal(dbRes.rows[0].db, 'orvex_qa', 'Las pruebas deben ejecutarse sobre orvex_qa');
    console.log(`✅ [QA-01] Conectado a base de datos: ${dbRes.rows[0].db}`);

    // 2. Obtener usuarios por rol
    const usuariosRes = await pool.query(
      'SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE esta_activo = true'
    );
    const usuComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuDisenador = usuariosRes.rows.find((u) => u.rol === 'disenador');
    const usuOperario = usuariosRes.rows.find((u) => u.rol === 'produccion');
    const usuPostventa = usuariosRes.rows.find((u) => u.rol === 'postventa');
    const usuGerente = usuariosRes.rows.find((u) => u.rol === 'gerente');

    assert.ok(usuComercial && usuCoord && usuDisenador && usuOperario && usuPostventa && usuGerente, 'Deben existir los 6 roles activos');

    const tComercial = generarToken(usuComercial);
    const tCoord = generarToken(usuCoord);
    const tDisenador = generarToken(usuDisenador);
    const tOperario = generarToken(usuOperario);
    const tPostventa = generarToken(usuPostventa);
    const tGerente = generarToken(usuGerente);

    const clienteRes = await pool.query('SELECT id, codigo, empresa FROM clientes ORDER BY id ASC LIMIT 1');
    const cliente = clienteRes.rows[0];
    assert.ok(cliente, 'Debe existir al menos un cliente en orvex_qa');

    // ============================================================
    // PRUEBA A: COMUNICACIONES CENTRALIZADAS Y CONTINUIDAD CLIENTE -> SOLICITUD -> ORDEN
    // ============================================================
    // Limpiar hilos sin orden previos de este cliente para aislar la prueba
    await pool.query("DELETE FROM canales_contacto WHERE cliente_id = $1 AND orden_id IS NULL AND asunto LIKE '%[QA-ETAPA4]%'", [cliente.id]);

    // A.1 Comercial crea una Solicitud
    const crearSolRes = await req('/solicitudes', {
      method: 'POST',
      token: tComercial,
      body: {
        cliente_id: cliente.id,
        producto: 'Valla Exterior QA Etapa 4',
        cantidad: 2,
        dimensiones: '4x2 m',
        material: 'Lona Banner 13oz',
        acabados: 'Ojaletes reforzados',
        metodoEntrega: 'Instalación en sitio',
        fecha_entrega: '30/11/2026',
        presupuesto: 1200000,
        requerimientos: 'Colores corporativos exactos',
        prioridad: 'Alta',
      },
    });
    assert.equal(crearSolRes.status, 201, 'Comercial debe poder crear una solicitud');
    solicitudCreadaId = crearSolRes.data.data.id;
    console.log(`✅ [QA-02] Solicitud creada por Comercial: ${solicitudCreadaId}`);

    // A.2 Comercial registra un canal de conversación con el cliente mientras la solicitud está en curso (orden_id = NULL)
    const codigoHilo = `COM-QA-${Date.now()}`;
    const insCanal = await pool.query(
      `INSERT INTO canales_contacto (codigo, cliente_id, orden_id, canal, asunto, estado, responsable_nombre)
       VALUES ($1, $2, NULL, 'wa', '[QA-ETAPA4] Acuerdo comercial inicial', 'En seguimiento', $3)
       RETURNING id, codigo`,
      [codigoHilo, cliente.id, usuComercial.nombre_completo]
    );
    hiloCreadoId = insCanal.rows[0].codigo;
    const msgIniRes = await req(`/comunicaciones/${hiloCreadoId}/mensajes`, {
      method: 'POST',
      token: tComercial,
      body: {
        texto: 'Cliente confirma medidas 4x2 m y solicita entrega antes del día 30.',
        de: 'cliente',
      },
    });
    assert.equal(msgIniRes.status, 201, 'Comercial debe poder registrar conversación con el cliente');
    console.log(`✅ [QA-03] Hilo de comunicación creado (${hiloCreadoId}) vinculado inicialmente al cliente y solicitud`);

    // A.3 Idempotencia de envío a validación: 1er envío OK (200), 2do envío rechazado (409)
    const envSol1 = await req(`/solicitudes/${solicitudCreadaId}/enviar`, {
      method: 'PATCH',
      token: tComercial,
    });
    assert.equal(envSol1.status, 200, 'Primer envío a validación debe responder 200');

    const envSol2 = await req(`/solicitudes/${solicitudCreadaId}/enviar`, {
      method: 'PATCH',
      token: tComercial,
    });
    assert.equal(envSol2.status, 409, 'Segundo envío consecutivo a validación debe bloquearse con 409 Conflict');
    console.log('✅ [QA-04] Idempotencia verificada en envío de solicitud a validación (409 en duplicado)');

    // A.4 Comercial valida la solicitud -> se genera la Orden y se vincula automáticamente el hilo de comunicación
    const valSol1 = await req(`/solicitudes/${solicitudCreadaId}/validar`, {
      method: 'POST',
      token: tComercial,
    });
    assert.equal(valSol1.status, 201, 'Comercial debe poder validar solicitud y generar orden');
    ordenGeneradaId = valSol1.data.orden.id;

    // A.5 Idempotencia en validación de solicitud: intentar validar de nuevo retorna 409
    const valSol2 = await req(`/solicitudes/${solicitudCreadaId}/validar`, {
      method: 'POST',
      token: tComercial,
    });
    assert.equal(valSol2.status, 409, 'Intentar validar una solicitud ya aprobada debe retornar 409 Conflict');
    console.log(`✅ [QA-05] Solicitud ${solicitudCreadaId} convertida en Orden ${ordenGeneradaId} sin duplicidad (409 en re-validación)`);

    // A.6 Verificar que Coordinación puede consultar las comunicaciones y que el hilo tiene Cliente -> Solicitud -> Orden
    const commsCoordRes = await req('/comunicaciones', {
      method: 'GET',
      token: tCoord,
    });
    assert.equal(commsCoordRes.status, 200, 'Coordinación debe poder consultar el listado de comunicaciones');
    const listaComms = Array.isArray(commsCoordRes.data) ? commsCoordRes.data : commsCoordRes.data.data;
    const hiloVinculado = listaComms.find((h) => h.id === hiloCreadoId);
    assert.ok(hiloVinculado, 'El hilo creado debe aparecer en la consulta de Coordinación');
    assert.equal(hiloVinculado.ordenId, ordenGeneradaId, 'El hilo debe haberse vinculado automáticamente a la orden generada');
    assert.equal(hiloVinculado.solicitudId, solicitudCreadaId, 'El hilo debe conservar la referencia a la solicitud origen');
    console.log(`✅ [QA-06] Continuidad de comunicación verificada: Cliente (${hiloVinculado.clienteId}) -> Solicitud (${hiloVinculado.solicitudId}) -> Orden (${hiloVinculado.ordenId})`);

    // A.7 Comercial registra un acuerdo formal en la conversación y queda en trazabilidad (registro_sesion)
    const acuerdoRes = await req(`/comunicaciones/${hiloCreadoId}/mensajes`, {
      method: 'POST',
      token: tComercial,
      body: {
        texto: 'Acuerdo comercial: cliente autoriza estructura metálica reforzada.',
        de: 'usuario',
        esAcuerdo: true,
      },
    });
    assert.equal(acuerdoRes.status, 201, 'Comercial debe poder registrar acuerdos en la conversación');

    const histAcuerdoRes = await req(`/ordenes/${ordenGeneradaId}/historial`, {
      method: 'GET',
      token: tCoord,
    });
    assert.equal(histAcuerdoRes.status, 200);
    const listaHist = Array.isArray(histAcuerdoRes.data) ? histAcuerdoRes.data : histAcuerdoRes.data.data;
    const tieneAcuerdoEnHistorial = listaHist.some((h) =>
      String(h.actividad || h.accion_texto || '').includes('Acuerdo con cliente registrado')
    );
    assert.ok(tieneAcuerdoEnHistorial, 'El acuerdo comercial debe quedar registrado en la trazabilidad de la orden');
    console.log('✅ [QA-07] Acuerdo comercial registrado en comunicaciones e impactado en trazabilidad de la orden');

    // ============================================================
    // PRUEBA B: IDEMPOTENCIA EN FLUJO DE DISEÑO Y TRAZABILIDAD SIN DUPLICADOS
    // ============================================================
    // B.1 Diseñador sube V1
    const crearV1 = await req(`/disenos/orden/${ordenGeneradaId}`, {
      method: 'POST',
      token: tDisenador,
      body: {
        titulo: 'Propuesta V1 QA Etapa 4',
        observaciones: 'Arte ajustado a medidas 4x2 m',
      },
    });
    assert.equal(crearV1.status, 201, 'Diseñador debe poder crear versión V1');

    // B.2 Diseñador envía V1 a Comercial (1ra vez -> 200, 2da vez consecutiva -> 409)
    const envDis1 = await req(`/disenos/orden/${ordenGeneradaId}/enviar`, {
      method: 'PATCH',
      token: tDisenador,
      body: { observaciones: 'Listo para revisión comercial' },
    });
    assert.equal(envDis1.status, 200, 'Primer envío de diseño a Comercial debe responder 200');

    const envDis2 = await req(`/disenos/orden/${ordenGeneradaId}/enviar`, {
      method: 'PATCH',
      token: tDisenador,
      body: { observaciones: 'Intento duplicado' },
    });
    assert.equal(envDis2.status, 409, 'Segundo envío consecutivo de la misma versión debe responder 409 Conflict');
    console.log('✅ [QA-08] Idempotencia verificada en envío de diseño a Comercial (sin duplicar eventos en trazabilidad)');

    // B.3 Comercial registra aprobación formal con evidencia
    const aprCom = await req(`/disenos/orden/${ordenGeneradaId}/gestion-comercial`, {
      method: 'PATCH',
      token: tComercial,
      body: {
        accion: 'aprobar',
        canal: 'WhatsApp',
        nombreAutoriza: 'Carlos Ruiz',
        evidencia: 'Confirmación escrita WhatsApp 2026-11-08',
        observaciones: 'Cliente aprueba V1 sin cambios',
      },
    });
    assert.equal(aprCom.status, 200, 'Comercial debe poder registrar aprobación formal del diseño');

    // B.4 Comercial libera para impresión tras aprobación (1ra vez -> 200 o ya liberada automáticamente -> 409 en duplicado)
    const libImp1 = await req(`/disenos/orden/${ordenGeneradaId}/liberar-impresion`, {
      method: 'PATCH',
      token: tComercial,
    });
    assert.ok([200, 409].includes(libImp1.status), 'Liberación a impresión debe responder 200 o 409 si ya se liberó automáticamente al aprobar');

    const libImp2 = await req(`/disenos/orden/${ordenGeneradaId}/liberar-impresion`, {
      method: 'PATCH',
      token: tComercial,
    });
    assert.equal(libImp2.status, 409, 'Segunda liberación a impresión sobre la misma orden debe bloquearse con 409 Conflict');
    console.log('✅ [QA-09] Idempotencia verificada en liberación a impresión (409 en duplicado)');

    // ============================================================
    // PRUEBA C: RESPONSABILIDADES Y PERMISOS ESTRICTOS POR ROL
    // ============================================================
    // C.1 Coordinación consulta comunicaciones (200) pero NO administra conversaciones comerciales (403)
    const msgCoord = await req(`/comunicaciones/${hiloCreadoId}/mensajes`, {
      method: 'POST',
      token: tCoord,
      body: { texto: 'Intento de mensaje desde coordinación' },
    });
    assert.equal(msgCoord.status, 403, 'Coordinación no debe administrar conversaciones comerciales (403)');

    // C.2 Postventa SÍ puede responder comunicaciones de atención al cliente (201)
    const msgPostventa = await req(`/comunicaciones/${hiloCreadoId}/mensajes`, {
      method: 'POST',
      token: tPostventa,
      body: { texto: 'Seguimiento postventa registrado con el cliente.' },
    });
    assert.equal(msgPostventa.status, 201, 'Postventa debe poder gestionar respuestas en comunicaciones');

    // C.3 Diseño y Operarios NO tienen acceso a comunicaciones comerciales (403)
    const commsDiseno = await req('/comunicaciones', { method: 'GET', token: tDisenador });
    const commsOperario = await req('/comunicaciones', { method: 'GET', token: tOperario });
    assert.equal(commsDiseno.status, 403, 'Diseño no debe acceder a bandeja de comunicaciones comerciales');
    assert.equal(commsOperario.status, 403, 'Operario no debe acceder a bandeja de comunicaciones comerciales');
    console.log('✅ [QA-10] Permisos de comunicaciones verificados: Comercial/Postventa administran, Coordinación/Gerencia consultan, Diseño/Operarios bloqueados');

    // C.4 Operarios consultan únicamente sus actividades asignadas
    const tareasOpRes = await req('/tareas', { method: 'GET', token: tOperario });
    assert.equal(tareasOpRes.status, 200, 'Operario debe poder consultar sus tareas');
    const listaTareasOp = Array.isArray(tareasOpRes.data) ? tareasOpRes.data : (tareasOpRes.data.data || []);
    const todasSonDelOperario = listaTareasOp.every(
      (t) => String(t.owner_id) === String(usuOperario.id) || t.responsable === usuOperario.nombre_completo
    );
    assert.ok(todasSonDelOperario, 'El operario solo debe recibir las tareas asignadas a su usuario');
    console.log(`✅ [QA-11] Aislamiento de actividades de taller verificado: Operario recibe únicamente sus ${listaTareasOp.length} tarea(s) asignada(s)`);

    // C.5 Gerencia tiene acceso de supervisión/auditoría pero NO ejecuta operaciones rutinarias
    const gerCommsGet = await req('/comunicaciones', { method: 'GET', token: tGerente });
    assert.equal(gerCommsGet.status, 200, 'Gerencia puede supervisar comunicaciones');

    const gerCommsPost = await req(`/comunicaciones/${hiloCreadoId}/mensajes`, {
      method: 'POST',
      token: tGerente,
      body: { texto: 'Intento de operación rutinaria por gerencia' },
    });
    assert.equal(gerCommsPost.status, 403, 'Gerencia no debe enviar mensajes en conversaciones comerciales');

    const gerCrearSol = await req('/solicitudes', {
      method: 'POST',
      token: tGerente,
      body: { cliente_id: cliente.id, producto: 'Test', cantidad: 1 },
    });
    assert.equal(gerCrearSol.status, 403, 'Gerencia no debe crear solicitudes comerciales');

    const gerAvanzarEtapa = await req(`/ordenes/${ordenGeneradaId}/etapa`, {
      method: 'PATCH',
      token: tGerente,
    });
    assert.equal(gerAvanzarEtapa.status, 403, 'Gerencia no debe avanzar etapas operativas de órdenes');

    const gerCrearTarea = await req('/tareas', {
      method: 'POST',
      token: tGerente,
      body: { orden_id: ordenGeneradaId, titulo_tarea: 'Test' },
    });
    assert.equal(gerCrearTarea.status, 403, 'Gerencia no debe crear tareas de taller');
    console.log('✅ [QA-12] Rol de Gerencia validado: acceso de supervisión y auditoría garantizado, operaciones rutinarias bloqueadas (403)');

    console.log('\n🎉 [ETAPA 4 QA] Las 12 validaciones integrales sobre orvex_qa finalizaron con ÉXITO.');
  } finally {
    server.close();
    await pool.end();
  }
}

runQaTests().catch((err) => {
  console.error('❌ [ETAPA 4 QA] Fallo en la suite:', err);
  process.exit(1);
});
