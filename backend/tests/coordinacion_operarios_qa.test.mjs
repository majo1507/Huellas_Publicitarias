// ============================================================
// backend/tests/coordinacion_operarios_qa.test.mjs
// Suite de validación integral: Coordinación y Operarios en ORVEX
// - Aislamiento estricto de actividades por operario (403 Forbidden)
// - Validación de dependencias técnicas entre actividades (409 Conflict)
// - Bloqueo de finalización por incidencias técnicas activas (409 Conflict)
// - Resolución auditada de incidencias
// - Regla de no-avance prematuro (cuando 1 de varias tareas finaliza)
// - Avance automático integral de etapa (Impresión -> Acabados -> Despacho)
// - Habilitación / asignación automática de tareas de la siguiente etapa
// - Trazabilidad inmutable completa en registro_sesion
// - Restricción de permisos del rol Coordinador (sin validar solicitudes comerciales)
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  console.log('🧪 [ORVEX QA] Iniciando suite integral de Coordinación y Operarios...\n');

  let testOrderId = null;
  let testTask1Id = null;
  let testTask2Id = null;

  try {
    // 1. Conexión a orvex_qa
    const dbRes = await pool.query('SELECT current_database() AS db');
    assert.equal(dbRes.rows[0].db, 'orvex_qa', 'Las pruebas deben ejecutarse sobre orvex_qa');
    console.log(`✅ [01-CONEXION] Base de datos activa: ${dbRes.rows[0].db}`);

    // 2. Obtener usuarios de prueba de orvex_qa
    const usuariosRes = await pool.query(
      'SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE esta_activo = true'
    );
    const usuarioCoordinador = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuarioComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const operarios = usuariosRes.rows.filter((u) => u.rol === 'produccion');
    assert.ok(usuarioCoordinador, 'Debe existir un usuario coordinador (coord) en orvex_qa');
    assert.ok(usuarioComercial, 'Debe existir un usuario comercial (ejecutiva) en orvex_qa');
    assert.ok(operarios.length >= 2, 'Deben existir al menos 2 operarios (produccion) en orvex_qa');

    const operario1 = operarios[0]; // Juan Pérez
    const operario2 = operarios[1]; // Pedro Ramírez

    const tokenCoord = generarToken({
      id: usuarioCoordinador.id,
      nombre_completo: usuarioCoordinador.nombre_completo,
      rol: usuarioCoordinador.rol,
      email: usuarioCoordinador.email,
    });
    const tokenOp1 = generarToken({
      id: operario1.id,
      nombre_completo: operario1.nombre_completo,
      rol: operario1.rol,
      email: operario1.email,
    });
    const tokenOp2 = generarToken({
      id: operario2.id,
      nombre_completo: operario2.nombre_completo,
      rol: operario2.rol,
      email: operario2.email,
    });

    console.log(`✅ [02-AUTH] Usuarios configurados:`);
    console.log(`   - Coordinador: ${usuarioCoordinador.nombre_completo} (${usuarioCoordinador.email})`);
    console.log(`   - Operario 1: ${operario1.nombre_completo} (${operario1.email})`);
    console.log(`   - Operario 2: ${operario2.nombre_completo} (${operario2.email})`);

    // 3. Verificación de permisos y menú de Coordinación (Regla de negocio)
    const menuCoordPages = ROLES.coordinador.menu.map((item) => item.page);
    assert.deepEqual(
      menuCoordPages,
      ['inicio', 'pedidos', 'tareas', 'inventario'],
      'El menú del Coordinador debe contener los 4 módulos optimizados (Panel de producción, Programación de órdenes, Asignación de actividades, Inventario y materiales)'
    );
    assert.ok(
      !ROLES.coordinador.menu.some((item) => item.page === 'solicitudes'),
      'El menú del Coordinador NO debe incluir validación de solicitudes'
    );
    assert.ok(
      !ROLES.coordinador.menu.some((item) => item.page === 'produccion'),
      'El menú del Coordinador NO debe duplicar el Tablero de producción operativo'
    );
    assert.ok(
      !ROLES.coordinador.menu.some((item) => item.page === 'entregas'),
      'El menú del Coordinador NO debe incluir registro de entregas finales al cliente'
    );
    assert.ok(
      !PAGINAS_AUTORIZADAS_POR_ROL.coordinador.includes('solicitudes'),
      'Páginas autorizadas del Coordinador no deben incluir solicitudes'
    );
    assert.ok(
      !PAGINAS_AUTORIZADAS_POR_ROL.coordinador.includes('aprobacion'),
      'Páginas autorizadas del Coordinador no deben incluir aprobacion'
    );
    assert.ok(
      !PAGINAS_AUTORIZADAS_POR_ROL.coordinador.includes('produccion'),
      'Páginas autorizadas del Coordinador no deben incluir produccion'
    );
    assert.ok(
      !PAGINAS_AUTORIZADAS_POR_ROL.coordinador.includes('entregas'),
      'Páginas autorizadas del Coordinador no deben incluir entregas'
    );
    console.log(`✅ [03-ROLES] Menú y rutas de Coordinación optimizados (sin solicitudes, aprobación, tablero manual ni entregas)`);

    // 4. Crear orden de prueba en etapa 'Impresión' (etapa 4)
    const clienteRes = await pool.query('SELECT id FROM clientes ORDER BY id ASC LIMIT 1');
    const clienteId = clienteRes.rows[0].id;

    const insertOrdRes = await pool.query(
      `INSERT INTO ordenes (
        codigo, cliente_id, ejecutiva_id, producto, estado_nombre, etapa, porcentaje_avance,
        fecha_entrega, costo_interno, presupuesto,
        material, dimensiones, acabados, cantidad, prioridad
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      ) RETURNING id, codigo`,
      [
        `OP-TEST-QA-${Date.now().toString().slice(-4)}`,
        clienteId,
        usuarioComercial.id,
        'Pendón Roll-up Premium para Feria',
        'Impresión',
        4,
        60,
        '2026-10-20',
        50000,
        120000,
        'Banner 13oz Mate',
        '200x85 cm',
        'Bolsillo superior e inferior con varilla',
        1,
        'Alta',
      ]
    );
    testOrderId = insertOrdRes.rows[0].id;
    const testOrderCodigo = insertOrdRes.rows[0].codigo;
    console.log(`✅ [04-ORDEN] Orden de prueba creada: ID ${testOrderId} (${testOrderCodigo}) en etapa Impresión`);

    // 4.1 Coordinación planifica la orden (prioridad, fecha comprometida, personal asignado, presupuesto y costo interno)
    const planRes = await req(`/ordenes/${testOrderId}/asignacion`, {
      method: 'PATCH',
      token: tokenCoord,
      body: {
        prioridad: 'Alta',
        fechaEntrega: '2026-10-25',
        disenador: 'María López',
        responsable: operario1.nombre_completo,
        presupuesto: 150000,
        costoInterno: 65000,
      },
    });
    assert.equal(planRes.status, 200, 'Coordinador debe poder planificar prioridad, fechas, equipo y costos de la orden');
    assert.equal(planRes.data.data.prioridad, 'Alta', 'La prioridad de la orden debe actualizarse');
    assert.equal(Number(planRes.data.data.presupuesto), 150000, 'El presupuesto debe actualizarse');
    assert.equal(Number(planRes.data.data.costoInterno), 65000, 'El costo interno debe actualizarse');
    console.log(`✅ [04.1-PLANIFICACION] Coordinación actualizó prioridad, fecha comprometida, equipo y costos de la orden`);

    // 4.2 Restricciones de responsabilidades prohibidas para Coordinación (403 Forbidden)
    const manualStageRes = await req(`/ordenes/${testOrderId}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 'Acabados' },
    });
    assert.equal(manualStageRes.status, 403, 'Coordinación NO debe avanzar manualmente órdenes de producción (403)');

    const coordEntregaRes = await req(`/ordenes/${testOrderId}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: { contacto: 'Cliente Test', conformidad: 'Conforme' },
    });
    assert.equal(coordEntregaRes.status, 403, 'Coordinación NO debe registrar entregas finales al cliente (403)');

    const coordValidarSolRes = await req('/solicitudes/1/validar', {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(coordValidarSolRes.status, 403, 'Coordinación NO debe validar solicitudes comerciales (403)');

    const coordAprobarDisenoRes = await req(`/disenos/orden/${testOrderId}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { accion: 'aprobar' },
    });
    assert.equal(coordAprobarDisenoRes.status, 403, 'Coordinación NO debe aprobar diseños comerciales (403)');
    console.log(`✅ [04.2-RESTRICCIONES-COORD] Coordinación bloqueada en avance manual, entregas finales, solicitudes y aprobación de diseños (403)`);

    // 5. Coordinador crea 2 tareas de taller en Impresión:
    // Tarea 1 asignada a Operario 1
    const t1Res = await req('/actividades', {
      method: 'POST',
      token: tokenCoord,
      body: {
        ordenId: testOrderId,
        actividad: 'Impresión Gran Formato Roll-up',
        descripcion: 'Impresión a 1440dpi en Banner Mate',
        instrucciones: 'Alinear cabezales y verificar perfil de color CMYK',
        etapa: 'Impresión',
        responsable: operario1.nombre_completo,
        owner_id: operario1.id,
        prioridad: 'Alta',
        fechaLimite: '2026-10-15',
      },
    });
    assert.equal(t1Res.status, 201, 'Coordinador debe poder crear Tarea 1');
    testTask1Id = t1Res.data.data.id;

    // Tarea 2 asignada a Operario 1 con dependencia de Tarea 1
    const t2Res = await req('/actividades', {
      method: 'POST',
      token: tokenCoord,
      body: {
        ordenId: testOrderId,
        actividad: 'Control y corte perimetral de lona',
        descripcion: 'Corte recto y verificación de medidas 200x85 cm',
        instrucciones: 'Dejar secar tinta 15 minutos antes de cortar',
        etapa: 'Impresión',
        responsable: operario1.nombre_completo,
        owner_id: operario1.id,
        prioridad: 'Alta',
        fechaLimite: '2026-10-15',
        dependencias: [testTask1Id],
      },
    });
    assert.equal(t2Res.status, 201, 'Coordinador debe poder crear Tarea 2');
    testTask2Id = t2Res.data.data.id;
    console.log(`✅ [05-TAREAS] Tarea 1 (${testTask1Id}) y Tarea 2 (${testTask2Id}) creadas con dependencia`);

    // 6. Prueba de aislamiento estricto (Operario 2 no puede modificar Tarea 1 de Operario 1)
    const op2StartAttempt = await req(`/actividades/${testTask1Id}/accion`, {
      method: 'PATCH',
      token: tokenOp2,
      body: { accion: 'iniciar' },
    });
    assert.equal(op2StartAttempt.status, 403, 'Operario 2 debe recibir 403 al intentar iniciar tarea de Operario 1');
    assert.match(op2StartAttempt.data.error, /Solo puedes modificar o reportar avance sobre las tareas asignadas/i);

    const op2ProgAttempt = await req(`/actividades/${testTask1Id}/avance`, {
      method: 'PATCH',
      token: tokenOp2,
      body: { estado: 'En proceso', pct: 40 },
    });
    assert.equal(op2ProgAttempt.status, 403, 'Operario 2 debe recibir 403 al intentar reportar avance de Operario 1');

    const op2NoteAttempt = await req(`/actividades/${testTask1Id}/notas`, {
      method: 'POST',
      token: tokenOp2,
      body: { tipo: 'notas', texto: 'Nota no autorizada de otro operario' },
    });
    assert.equal(op2NoteAttempt.status, 403, 'Operario 2 debe recibir 403 al intentar agregar notas a tarea ajena');
    console.log(`✅ [06-AISLAMIENTO] Operario ajeno rechazado estrictamente con HTTP 403 Forbidden`);

    // 7. Prueba de validación de dependencias (Operario 1 intenta iniciar Tarea 2 con Tarea 1 pendiente)
    const t2StartBlockAttempt = await req(`/actividades/${testTask2Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'iniciar' },
    });
    assert.equal(t2StartBlockAttempt.status, 409, 'Debe recibir 409 al intentar iniciar tarea con dependencia pendiente');
    assert.match(t2StartBlockAttempt.data.error, /depende de/i);
    console.log(`✅ [07-DEPENDENCIAS] Inicio bloqueado por dependencia pendiente con HTTP 409`);

    // 8. Operario 1 inicia Tarea 1 y reporta avance
    const t1StartRes = await req(`/actividades/${testTask1Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'iniciar' },
    });
    assert.equal(t1StartRes.status, 200, 'Operario 1 debe poder iniciar su tarea asignada');
    assert.equal(t1StartRes.data.data.estado, 'En proceso');

    const t1AdvRes = await req(`/actividades/${testTask1Id}/avance`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { estado: 'En proceso', pct: 60 },
    });
    assert.equal(t1AdvRes.status, 200, 'Operario 1 debe poder actualizar porcentaje a 60%');
    assert.equal(t1AdvRes.data.data.porcentaje, 60);
    console.log(`✅ [08-EJECUCION] Operario 1 inició Tarea 1 y avanzó al 60%`);

    // 9. Operario 1 reporta incidencia técnica
    const incRes = await req(`/actividades/${testTask1Id}/notas`, {
      method: 'POST',
      token: tokenOp1,
      body: {
        tipo: 'incidencias',
        texto: 'Cabezal negro presenta líneas por suciedad de polvo en sustrato',
      },
    });
    assert.equal(incRes.status, 201, 'Operario 1 debe poder reportar incidencia técnica');
    assert.ok(incRes.data.data.incidencias.length > 0, 'La tarea debe tener incidencias registradas');
    assert.equal(incRes.data.data.incidencias[0].resuelto, false, 'La incidencia debe crearse con resuelto=false');
    console.log(`✅ [09-INCIDENCIA] Incidencia técnica reportada correctamente (resuelto=false)`);

    // 10. Bloqueo de finalización por incidencia técnica activa
    const t1FinalizeBlockAttempt = await req(`/actividades/${testTask1Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'finalizar' },
    });
    assert.equal(t1FinalizeBlockAttempt.status, 409, 'Debe recibir 409 si intenta finalizar con incidencia activa');
    assert.match(t1FinalizeBlockAttempt.data.error, /incidencia.*activa.*sin resolver/i);
    console.log(`✅ [10-BLOQUEO-INCIDENCIA] Finalización bloqueada con HTTP 409 por incidencia activa`);

    // 11. Resolver incidencia técnica
    const resolveRes = await req(`/actividades/${testTask1Id}/resolver-incidencia`, {
      method: 'PATCH',
      token: tokenOp1,
      body: {
        index: 0,
        solucion: 'Limpieza profunda con solvente eco y purga de cabezal. Test de inyectores 100% limpio.',
      },
    });
    if (resolveRes.status !== 200) {
      console.error('❌ Detalle error resolver incidencia:', resolveRes.data);
    }
    assert.equal(resolveRes.status, 200, 'Operario debe poder resolver incidencia');
    assert.equal(resolveRes.data.data.incidencias[0].resuelto, true);
    assert.ok(resolveRes.data.data.incidencias[0].solucion);
    console.log(`✅ [11-RESOLVER-INCIDENCIA] Incidencia técnica resuelta satisfactoriamente`);

    // 12. Finalizar Tarea 1 -> Verificar que la etapa NO avance prematuramente
    const t1FinalizeRes = await req(`/actividades/${testTask1Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'finalizar' },
    });
    assert.equal(t1FinalizeRes.status, 200, 'Tarea 1 debe finalizar correctamente al estar resuelta la incidencia');
    assert.equal(Boolean(t1FinalizeRes.data.avanceAutomatico), false, 'No debe haber avance automático porque Tarea 2 sigue pendiente');

    const checkOrdAfterT1 = await pool.query('SELECT etapa, estado_nombre FROM ordenes WHERE id = $1', [testOrderId]);
    assert.equal(checkOrdAfterT1.rows[0].etapa, 4, 'La orden debe permanecer en etapa 4 (Impresión)');
    assert.equal(checkOrdAfterT1.rows[0].estado_nombre, 'Impresión');
    console.log(`✅ [12-NO-AVANCE-PREMATURO] Tarea 1 finalizada, la orden PERMANECE en Impresión (Tarea 2 pendiente)`);

    // 13. Iniciar y Finalizar Tarea 2 -> Debe disparar AVANCE AUTOMÁTICO a 'Acabados' (etapa 5)
    const t2StartRes = await req(`/actividades/${testTask2Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'iniciar' },
    });
    assert.equal(t2StartRes.status, 200, 'Tarea 2 ahora puede iniciar porque Tarea 1 está Finalizada');

    const t2FinalizeRes = await req(`/actividades/${testTask2Id}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'finalizar' },
    });
    assert.equal(t2FinalizeRes.status, 200, 'Tarea 2 finalizada');
    assert.ok(t2FinalizeRes.data.avanceAutomatico, 'Debe retornar avanceAutomatico con datos');
    assert.equal(t2FinalizeRes.data.avanceAutomatico.etapaSiguiente, 'Acabados');

    const checkOrdAfterT2 = await pool.query(
      'SELECT etapa, estado_nombre, porcentaje_avance FROM ordenes WHERE id = $1',
      [testOrderId]
    );
    assert.equal(checkOrdAfterT2.rows[0].etapa, 5, 'La orden debe haber avanzado automáticamente a etapa 5');
    assert.equal(checkOrdAfterT2.rows[0].estado_nombre, 'Acabados');
    assert.equal(Number(checkOrdAfterT2.rows[0].porcentaje_avance), 62.5);
    console.log(`✅ [13-AVANCE-AUTOMATICO-1] Orden avanzó automáticamente a 'Acabados' (etapa 5, 62.5%)`);

    // 14. Verificar que se habilitó / asignó tarea para la etapa Acabados
    const tareasAcabados = await pool.query(
      'SELECT id, titulo, etapa, responsable_nombre, estado, porcentaje FROM tareas WHERE orden_id = $1 AND etapa = $2',
      [testOrderId, 'Acabados']
    );
    assert.ok(tareasAcabados.rowCount > 0, 'Debe haberse generado automáticamente una tarea para Acabados');
    const tareaAcabadosId = tareasAcabados.rows[0].id;
    console.log(`✅ [14-TAREA-SIGUIENTE] Actividad de acabados creada: "${tareasAcabados.rows[0].titulo}" asignada a ${tareasAcabados.rows[0].responsable_nombre}`);

    // 15. Coordinador asigna la tarea de Acabados a Operario 1 y el Operario 1 la finaliza -> Avanza AUTOMÁTICAMENTE a 'Despacho' (etapa 7)
    const asigAcabadosRes = await req(`/actividades/${tareaAcabadosId}/asignar`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { responsable: operario1.nombre_completo },
    });
    assert.equal(asigAcabadosRes.status, 200, 'Coordinador asigna actividad de Acabados al Operario 1');

    const acabadosFinalizeRes = await req(`/actividades/${tareaAcabadosId}/accion`, {
      method: 'PATCH',
      token: tokenOp1,
      body: { accion: 'finalizar' },
    });
    assert.equal(acabadosFinalizeRes.status, 200, 'Tarea de Acabados finalizada por Operario 1');
    assert.ok(acabadosFinalizeRes.data.avanceAutomatico);
    assert.equal(acabadosFinalizeRes.data.avanceAutomatico.etapaSiguiente, 'Despacho');

    const checkOrdDespacho = await pool.query(
      'SELECT etapa, estado_nombre, porcentaje_avance FROM ordenes WHERE id = $1',
      [testOrderId]
    );
    assert.equal(checkOrdDespacho.rows[0].etapa, 7, 'La orden debe haber avanzado a etapa 7 (Despacho)');
    assert.equal(checkOrdDespacho.rows[0].estado_nombre, 'Despacho');
    assert.equal(Number(checkOrdDespacho.rows[0].porcentaje_avance), 87.5);
    console.log(`✅ [15-AVANCE-AUTOMATICO-2] Orden avanzó automáticamente a 'Despacho' (etapa 7, 87.5%)`);

    // 16. Verificación de trazabilidad inmutable en registro_sesion
    const logsRes = await pool.query(
      'SELECT accion_texto, estado_anterior, nuevo_estado, motivo FROM registro_sesion WHERE orden_id = $1 ORDER BY created_at ASC',
      [testOrderId]
    );
    assert.ok(logsRes.rowCount >= 4, 'Deben existir múltiples registros de auditoría en registro_sesion');

    const transicionImpresionAcabados = logsRes.rows.find(
      (l) => l.estado_anterior === 'Impresión' && l.nuevo_estado === 'Acabados'
    );
    assert.ok(transicionImpresionAcabados, 'Debe registrar la transición automática Impresión -> Acabados');
    assert.match(transicionImpresionAcabados.accion_texto, /todas las actividades obligatorias/i);

    const transicionAcabadosDespacho = logsRes.rows.find(
      (l) => l.estado_anterior === 'Acabados' && l.nuevo_estado === 'Despacho'
    );
    assert.ok(transicionAcabadosDespacho, 'Debe registrar la transición automática Acabados -> Despacho');

    const tieneLogIncidencia = logsRes.rows.some((l) => l.accion_texto.includes('Incidencia reportada'));
    const tieneLogResolucion = logsRes.rows.some((l) => l.accion_texto.includes('Incidencia técnica resuelta'));
    assert.ok(tieneLogIncidencia, 'Debe auditar el registro de incidencias técnicas');
    assert.ok(tieneLogResolucion, 'Debe auditar la resolución de incidencias');
    console.log(`✅ [16-TRAZABILIDAD] registro_sesion contiene el registro inmutable de todas las acciones y transiciones automáticas`);

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE COORDINACIÓN Y OPERARIOS PASARON EXITOSAMENTE!');
  } finally {
    server.close();
    await pool.end();
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS:', err);
  process.exit(1);
});
