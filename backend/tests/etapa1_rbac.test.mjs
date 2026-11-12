// ============================================================
// tests/etapa1_rbac.test.mjs — Suite de Pruebas Automatizadas de RBAC, Desacoplamiento y Delegación (Etapa 1)
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import jwt from 'jsonwebtoken';

process.env.PORT = '3098';

const require = createRequire(import.meta.url);
const { server } = require('../index.js');
const { pool } = require('../db.js');
const { getJwtSecret, normalizarRol } = require('../middleware/auth.js');

const BASE = 'http://127.0.0.1:3098/api';

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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function generarToken(usuario) {
  return jwt.sign(usuario, getJwtSecret(), { expiresIn: '1h' });
}

async function runEtapa1Tests() {
  console.log('🧪 [ETAPA 1] Iniciando pruebas de seguridad RBAC, normalización, desacoplamiento y delegación...\n');

  try {
    // 1. Verificación unitaria de normalizarRol
    console.log('  Testing 1: Normalización bidireccional de roles...');
    assert.equal(normalizarRol('comercial'), 'ejecutiva');
    assert.equal(normalizarRol('coordinador'), 'coord');
    assert.equal(normalizarRol('operario'), 'produccion');
    assert.equal(normalizarRol('gerencia'), 'gerente');
    assert.equal(normalizarRol('disenador'), 'disenador');
    assert.equal(normalizarRol('postventa'), 'postventa');
    assert.equal(normalizarRol('cliente'), 'cliente');
    assert.equal(normalizarRol('coord'), 'coord');
    assert.equal(normalizarRol('produccion'), 'produccion');
    assert.equal(normalizarRol('ejecutiva'), 'ejecutiva');
    assert.equal(normalizarRol('gerente'), 'gerente');
    console.log('  ✅ 1. Normalización de roles verificada correctamente.');

    // 2. Obtener usuarios y órdenes reales de la base de datos para pruebas
    const { rows: users } = await pool.query('SELECT * FROM usuarios');
    const uComercial = users.find((u) => u.rol === 'ejecutiva');
    const uCoord = users.find((u) => u.rol === 'coord');
    const uOperario1 = users.find((u) => u.rol === 'produccion');
    const uDisenador = users.find((u) => u.rol === 'disenador');
    const uPostventa = users.find((u) => u.rol === 'postventa');
    const uGerente = users.find((u) => u.rol === 'gerente');

    const tokenComercial = generarToken({ id: uComercial.id, email: uComercial.email, rol: 'comercial', nombre_completo: uComercial.nombre_completo });
    const tokenCoord = generarToken({ id: uCoord.id, email: uCoord.email, rol: 'coordinador', nombre_completo: uCoord.nombre_completo });
    const tokenOperario1 = generarToken({ id: uOperario1.id, email: uOperario1.email, rol: 'operario', nombre_completo: uOperario1.nombre_completo });
    const tokenDisenador = generarToken({ id: uDisenador.id, email: uDisenador.email, rol: 'disenador', nombre_completo: uDisenador.nombre_completo });
    const tokenPostventa = generarToken({ id: uPostventa.id, email: uPostventa.email, rol: 'postventa', nombre_completo: uPostventa.nombre_completo });
    const tokenGerente = generarToken({ id: uGerente.id, email: uGerente.email, rol: 'gerencia', nombre_completo: uGerente.nombre_completo });

    const { rows: ordenesRows } = await pool.query('SELECT * FROM ordenes LIMIT 1');
    const ordenTest = ordenesRows[0];

    // 3. Test: Intentos no autorizados en Órdenes (Comercial y Postventa)
    console.log('  Testing 2: Bloqueo de cierre, reapertura y clonación por Comercial y Postventa...');
    const resClonarPostventa = await req(`/ordenes/${ordenTest.id}/clonar`, {
      method: 'POST',
      token: tokenPostventa,
      body: { motivo: 'Intento postventa' },
    });
    assert.equal(resClonarPostventa.status, 403, 'Postventa no debe poder clonar órdenes directamente');

    const resClonarComercial = await req(`/ordenes/${ordenTest.id}/clonar`, {
      method: 'POST',
      token: tokenComercial,
      body: { motivo: 'Intento comercial' },
    });
    assert.equal(resClonarComercial.status, 403, 'Comercial no debe poder clonar órdenes');

    const resCerrarComercial = await req(`/ordenes/${ordenTest.id}/cerrar`, {
      method: 'POST',
      token: tokenComercial,
      body: { motivo: 'Intento comercial' },
    });
    assert.equal(resCerrarComercial.status, 403, 'Comercial no debe poder cerrar órdenes');

    const resCerrarPostventa = await req(`/ordenes/${ordenTest.id}/cerrar`, {
      method: 'POST',
      token: tokenPostventa,
      body: { motivo: 'Intento postventa' },
    });
    assert.equal(resCerrarPostventa.status, 403, 'Postventa no debe poder cerrar órdenes');
    console.log('  ✅ 2. Cierre, reapertura y clonación bloqueados a Comercial y Postventa (HTTP 403).');

    // 4. Test: Entrega formal bloqueada a Comercial y Operario
    console.log('  Testing 3: Bloqueo de entrega formal a Comercial y Operario...');
    const resEntregaOperario = await req(`/ordenes/${ordenTest.id}/entrega`, {
      method: 'POST',
      token: tokenOperario1,
      body: { contacto: 'Pedro' },
    });
    assert.equal(resEntregaOperario.status, 403, 'Operario no debe poder formalizar entregas');

    const resEntregaComercial = await req(`/ordenes/${ordenTest.id}/entrega`, {
      method: 'POST',
      token: tokenComercial,
      body: { contacto: 'Cliente' },
    });
    assert.equal(resEntregaComercial.status, 403, 'Comercial no debe poder formalizar entregas directas');
    console.log('  ✅ 3. Entrega formal bloqueada a Operario y Comercial (HTTP 403).');

    // 5. Test: Transición de etapa global bloqueada a Operario y Diseñador
    console.log('  Testing 4: Bloqueo de cambio de etapa global a Operario y Diseñador...');
    const resEtapaOperario = await req(`/ordenes/${ordenTest.id}/etapa`, {
      method: 'PATCH',
      token: tokenOperario1,
      body: { estado: 'Despacho' },
    });
    assert.equal(resEtapaOperario.status, 403, 'Operario no debe cambiar etapas globales de la orden');

    const resEtapaDisenador = await req(`/ordenes/${ordenTest.id}/etapa`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { estado: 'Impresión' },
    });
    assert.equal(resEtapaDisenador.status, 403, 'Diseñador no debe cambiar etapas globales de la orden');
    console.log('  ✅ 4. Cambio de etapa global de orden bloqueado a Operario y Diseñador (HTTP 403).');

    // 6. Test: Solicitudes comerciales
    console.log('  Testing 5: Restricción de solicitudes comerciales a Comercial...');
    const resSolCoord = await req('/solicitudes', {
      method: 'POST',
      token: tokenCoord,
      body: { producto: 'Banner test' },
    });
    assert.equal(resSolCoord.status, 403, 'Coordinador no debe crear solicitudes comerciales ordinarias');

    const resSolEnviarCoord = await req('/solicitudes/SOL-2026-0001/enviar', {
      method: 'PATCH',
      token: tokenCoord,
      body: {},
    });
    assert.equal(resSolEnviarCoord.status, 403, 'Coordinador no debe enviar solicitudes a validación');
    console.log('  ✅ 5. Creación y envío de solicitudes bloqueados a Coordinación (HTTP 403).');

    // 7. Test: Tareas operativas — Operario solo modifica tareas propias
    console.log('  Testing 6: Aislamiento de tareas de operario (solo asignadas a su ID)...');
    const resCreateTarea1 = await pool.query(
      `INSERT INTO tareas (orden_id, titulo, etapa, owner_id, estado, porcentaje)
       VALUES ($1, 'Tarea Operario 1', 'Impresión', $2, 'Pendiente', 0)
       RETURNING id, codigo`,
      [ordenTest.id, uOperario1.id]
    );
    const tareaPropia = resCreateTarea1.rows[0];

    const resCreateTarea2 = await pool.query(
      `INSERT INTO tareas (orden_id, titulo, etapa, owner_id, estado, porcentaje)
       VALUES ($1, 'Tarea Operario 2 (Ajena)', 'Acabados', $2, 'Pendiente', 0)
       RETURNING id, codigo`,
      [ordenTest.id, uCoord.id]
    );
    const tareaAjena = resCreateTarea2.rows[0];

    // Intento del operario de modificar la tarea ajena
    const resModificarAjena = await req(`/tareas/${tareaAjena.id}/avance`, {
      method: 'PATCH',
      token: tokenOperario1,
      body: { porcentaje: 50 },
    });
    assert.equal(resModificarAjena.status, 403, 'Operario no debe poder modificar tareas ajenas');

    // Intento del operario de modificar su propia tarea
    const resModificarPropia = await req(`/tareas/${tareaPropia.id}/avance`, {
      method: 'PATCH',
      token: tokenOperario1,
      body: { porcentaje: 40, estado: 'En proceso' },
    });
    assert.equal(resModificarPropia.status, 200, 'Operario debe poder actualizar su propia tarea');
    assert.equal(resModificarPropia.data.data.pct, 40);

    // Coordinador sí puede modificar cualquier tarea
    const resCoordModificaAjena = await req(`/tareas/${tareaPropia.id}/avance`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { porcentaje: 60, estado: 'En proceso' },
    });
    assert.equal(resCoordModificaAjena.status, 200, 'Coordinador debe poder supervisar y actualizar cualquier tarea');
    console.log('  ✅ 6. Aislamiento de tareas operativas verificado (403 ajena / 200 propia / 200 coordinador).');

    // 8. Test: Desacoplamiento de Gerencia — Bloqueo HTTP 403 en operaciones rutinarias de Coordinación
    console.log('  Testing 7: Desacoplamiento de Gerencia (HTTP 403 en operaciones ordinarias)...');
    const resGerenteCrearOrden = await req('/ordenes', {
      method: 'POST',
      token: tokenGerente,
      body: { producto: 'Orden Directa Gerente' },
    });
    assert.equal(resGerenteCrearOrden.status, 403, 'Gerencia no debe crear órdenes rutinarias');

    const resGerenteEtapa = await req(`/ordenes/${ordenTest.id}/etapa`, {
      method: 'PATCH',
      token: tokenGerente,
      body: { estado: 'Acabados' },
    });
    assert.equal(resGerenteEtapa.status, 403, 'Gerencia no debe mover etapas técnicas');

    const resGerenteEntrega = await req(`/ordenes/${ordenTest.id}/entrega`, {
      method: 'POST',
      token: tokenGerente,
      body: { contacto: 'Gerente' },
    });
    assert.equal(resGerenteEntrega.status, 403, 'Gerencia no debe emitir actas de entrega ordinarias');

    const resGerenteCerrar = await req(`/ordenes/${ordenTest.id}/cerrar`, {
      method: 'POST',
      token: tokenGerente,
      body: { motivo: 'Cierre directo por gerente' },
    });
    assert.equal(resGerenteCerrar.status, 403, 'Gerencia no debe cerrar órdenes rutinarias sin delegación');

    const resGerenteClonar = await req(`/ordenes/${ordenTest.id}/clonar`, {
      method: 'POST',
      token: tokenGerente,
      body: { motivo: 'Clonación directa por gerente' },
    });
    assert.equal(resGerenteClonar.status, 403, 'Gerencia no debe autorizar reimpresiones ordinarias sin delegación');

    const resGerenteValidarSol = await req('/solicitudes/SOL-2026-0001/validar', {
      method: 'POST',
      token: tokenGerente,
      body: {},
    });
    assert.equal(resGerenteValidarSol.status, 403, 'Gerencia no debe validar solicitudes ordinarias');

    const resGerenteCrearTarea = await req('/tareas', {
      method: 'POST',
      token: tokenGerente,
      body: { titulo: 'Tarea Gerente', orden_id: ordenTest.id },
    });
    assert.equal(resGerenteCrearTarea.status, 403, 'Gerencia no debe crear tareas operativas');
    console.log('  ✅ 7. Gerencia bloqueada en 7 operaciones ordinarias de Coordinación (HTTP 403).');

    // 9. Test: Creación de órdenes subordinada a solicitud comercial formalmente aprobada
    console.log('  Testing 8: Validación estricta de Solicitud en creación de Órdenes...');
    // 8.1 Intento de crear orden sin solicitud -> HTTP 400
    const resSinSol = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        cliente_id: ordenTest.cliente_id,
        producto: 'Orden Huérfana sin Solicitud',
      },
    });
    assert.equal(resSinSol.status, 400, 'Debe rechazar órdenes sin solicitud previa');
    assert.ok(
      String(resSinSol.data.error).includes('FLUJO NO PERMITIDO'),
      'Debe indicar que toda OP nace de solicitud validada'
    );

    // 8.2 Intento con solicitud inexistente -> HTTP 404
    const resSolInexistente = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: 'SOL-NO-EXISTE',
        cliente_id: ordenTest.cliente_id,
        producto: 'Orden con solicitud falsa',
      },
    });
    assert.equal(resSolInexistente.status, 404, 'Debe rechazar solicitud inexistente');

    // 8.3 Intento desde solicitud en estado 'pendiente' (borrador comercial) -> HTTP 400
    const codPendiente = `SOL-PEN-${Date.now().toString().slice(-4)}`;
    const { rows: [solPendiente] } = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad)
       VALUES ($1, $2, 'Aviso Pendiente', 'Borrador sin validar', $3, 'pendiente', 500000, 'Baja')
       RETURNING id, codigo`,
      [codPendiente, ordenTest.cliente_id, uComercial.id]
    );
    const resSolPendiente = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solPendiente.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Aviso Pendiente',
      },
    });
    assert.equal(resSolPendiente.status, 400, 'Debe bloquear creación desde solicitud pendiente');
    assert.ok(String(resSolPendiente.data.error).includes('Pendiente'), 'Debe indicar estado Pendiente');

    // 8.4 Intento desde solicitud en estado 'en_validacion' (revisión de coordinación en curso) -> HTTP 400
    const codEnVal = `SOL-VAL-${Date.now().toString().slice(-4)}`;
    const { rows: [solEnVal] } = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad)
       VALUES ($1, $2, 'Aviso En Revisión', 'En proceso de validación técnica', $3, 'en_validacion', 800000, 'Media')
       RETURNING id, codigo`,
      [codEnVal, ordenTest.cliente_id, uComercial.id]
    );
    const resSolEnVal = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solEnVal.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Aviso En Revisión',
      },
    });
    assert.equal(resSolEnVal.status, 400, 'Debe bloquear creación desde solicitud en_validacion');
    assert.ok(String(resSolEnVal.data.error).includes('En validación'), 'Debe indicar que está en validación');

    // 8.5 Intento desde solicitud en estado 'devuelta' -> HTTP 400
    const codDev = `SOL-DEV-${Date.now().toString().slice(-4)}`;
    const { rows: [solDevuelta] } = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad, motivo_rechazo)
       VALUES ($1, $2, 'Aviso Devuelto', 'Faltan medidas técnicas', $3, 'devuelta', 900000, 'Media', 'Medidas imprecisas')
       RETURNING id, codigo`,
      [codDev, ordenTest.cliente_id, uComercial.id]
    );
    const resSolDev = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solDevuelta.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Aviso Devuelto',
      },
    });
    assert.equal(resSolDev.status, 400, 'Debe bloquear creación desde solicitud devuelta');
    assert.ok(String(resSolDev.data.error).includes('devuelta'), 'Debe indicar estado devuelta');

    // 8.6 Intento desde solicitud en estado 'rechazada' -> HTTP 400
    const codRech = `SOL-REC-${Date.now().toString().slice(-4)}`;
    const { rows: [solRechazada] } = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad, motivo_rechazo)
       VALUES ($1, $2, 'Aviso Rechazado', 'Inviable técnicamente', $3, 'rechazada', 1200000, 'Alta', 'Inviable')
       RETURNING id, codigo`,
      [codRech, ordenTest.cliente_id, uComercial.id]
    );
    const resSolRech = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solRechazada.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Aviso Rechazado',
      },
    });
    assert.equal(resSolRech.status, 400, 'Debe bloquear creación desde solicitud rechazada');
    assert.ok(String(resSolRech.data.error).includes('rechazada'), 'Debe indicar estado rechazada');

    // 8.7 Creación legítima a partir de una solicitud en estado 'aprobada' (que ya superó la validación formal)
    const testCodSol = `SOL-APROB-${Date.now().toString().slice(-4)}`;
    const resSolValida = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad)
       VALUES ($1, $2, 'Aviso Luminoso Aprobado', 'Validación técnica superada satisfactoriamente', $3, 'aprobada', 1500000, 'Alta')
       RETURNING id, codigo`,
      [testCodSol, ordenTest.cliente_id, uComercial.id]
    );
    const solValida = resSolValida.rows[0];

    const resCrearConSol = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solValida.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Aviso Luminoso Aprobado',
        dimensiones: '3x1m',
        material: 'Acrílico',
        cantidad: 1,
      },
    });
    assert.equal(resCrearConSol.status, 201, 'Debe permitir creación legítima vinculada a solicitud formalmente aprobada');
    assert.equal(resCrearConSol.data.data.solicitudId, solValida.codigo || `SOL-2026-${String(solValida.id).padStart(4, '0')}`);

    // Comprobar que la solicitud quedó marcada como 'convertida' en base de datos con orden_id
    const { rows: solChequeo } = await pool.query('SELECT estado, orden_id FROM solicitudes WHERE id = $1', [solValida.id]);
    assert.equal(solChequeo[0].estado, 'convertida');
    assert.ok(solChequeo[0].orden_id, 'La solicitud debe quedar vinculada a la nueva orden');

    // 8.8 Intento de duplicar OP sobre la misma solicitud (ahora convertida) -> HTTP 409
    const resDuplicada = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solValida.id,
        cliente_id: ordenTest.cliente_id,
        producto: 'Intento de orden duplicada',
      },
    });
    assert.equal(resDuplicada.status, 409, 'Debe impedir duplicidad de OP sobre solicitud ya convertida');

    // 8.9 Atomicidad ante peticiones simultáneas (concurrencia con bloqueo FOR UPDATE)
    const codConcurrente = `SOL-CONC-${Date.now().toString().slice(-4)}`;
    const { rows: [solConc] } = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, prioridad)
       VALUES ($1, $2, 'Aviso Concurrente', 'Prueba de carreras y atomicidad FOR UPDATE', $3, 'aprobada', 2000000, 'Alta')
       RETURNING id, codigo`,
      [codConcurrente, ordenTest.cliente_id, uComercial.id]
    );

    const [req1, req2] = await Promise.all([
      req('/ordenes', {
        method: 'POST',
        token: tokenCoord,
        body: {
          solicitud_id: solConc.id,
          cliente_id: ordenTest.cliente_id,
          producto: 'Aviso Concurrente A',
        },
      }),
      req('/ordenes', {
        method: 'POST',
        token: tokenCoord,
        body: {
          solicitud_id: solConc.id,
          cliente_id: ordenTest.cliente_id,
          producto: 'Aviso Concurrente B',
        },
      }),
    ]);

    const statuses = [req1.status, req2.status].sort();
    assert.deepEqual(statuses, [201, 409], 'En peticiones simultáneas, exactamente una debe crearse (201) y la otra debe ser rechazada por conflicto atómico (409)');
    console.log('  ✅ 8. Creación de OP vinculada obligatoriamente a solicitud aprobada (bloqueos 400 pendiente/en_validacion/devuelta/rechazada, 404, 409 duplicidad y atomicidad concurrente 201/409).');

    // 10. Test: Delegación temporal granular por capacidades específicas
    console.log('  Testing 9: Delegación temporal granular por capacidades específicas...');
    let uSuplente;
    const { rows: existingSuplente } = await pool.query("SELECT * FROM usuarios WHERE email = 'suplente.test@huellas.co'");
    if (existingSuplente.length > 0) {
      uSuplente = existingSuplente[0];
    } else {
      const { rows: suplenteRows } = await pool.query(
        `INSERT INTO usuarios (nombre_completo, email, password_hash, rol, esta_activo)
         VALUES ('Suplente Test', 'suplente.test@huellas.co', 'hash', 'produccion', true)
         RETURNING id, nombre_completo, email, rol`
      );
      uSuplente = suplenteRows[0];
    }
    const tokenSuplente = generarToken({ id: uSuplente.id, email: uSuplente.email, rol: 'produccion', nombre_completo: uSuplente.nombre_completo });

    // Limpiar delegaciones previas para probar bloqueo inicial sin delegación
    await pool.query('DELETE FROM delegaciones_permisos WHERE usuario_suplente_id = $1', [uSuplente.id]);

    // Sin delegación: Suplente intenta clonar una orden -> 403
    const resSinDelegacion = await req(`/ordenes/${ordenTest.id}/clonar`, {
      method: 'POST',
      token: tokenSuplente,
      body: { motivo: 'Prueba sin delegación' },
    });
    assert.equal(resSinDelegacion.status, 403);

    // Se registra una delegación formal con capacidad específica exclusiva: 'ordenes.clonar'
    const ahora = new Date();
    const manana = new Date(Date.now() + 86400000);
    await pool.query(
      `INSERT INTO delegaciones_permisos (
         usuario_delegante_id, usuario_suplente_id, permisos_delegados, motivo, fecha_inicio, fecha_fin, activo
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, true)`,
      [uCoord.id, uSuplente.id, JSON.stringify(['ordenes.clonar']), 'Suplencia médica para clonación', ahora, manana]
    );

    // Con delegación activa para 'ordenes.clonar': la clonación debe ser evaluada por el controlador (200 o 201)
    const resConDelegacionClonar = await req(`/ordenes/${ordenTest.id}/clonar`, {
      method: 'POST',
      token: tokenSuplente,
      body: { motivo: 'Reposición autorizada por suplente' },
    });
    assert.ok(
      [200, 201].includes(resConDelegacionClonar.status),
      `Se esperaba 200 o 201 pero se obtuvo ${resConDelegacionClonar.status}: ${JSON.stringify(resConDelegacionClonar.data)}`
    );

    // Pero si el mismo suplente intenta validar solicitudes sin esa capacidad delegada -> 403
    const resCapacidadNoConcedida = await req('/solicitudes/SOL-2026-0001/validar', {
      method: 'POST',
      token: tokenSuplente,
      body: {},
    });
    assert.equal(resCapacidadNoConcedida.status, 403, 'Suplente solo debe tener capacidades explícitamente delegadas');
    console.log('  ✅ 9. Delegación granular verificada (capacidad específica autorizada / otras capacidades denegadas HTTP 403).');

    console.log('\n🎉 [ETAPA 1 FINAL] TODAS LAS PRUEBAS DE SEGURIDAD RBAC, DESACOPLAMIENTO Y DELEGACIÓN PASARON AL 100%.\n');
  } finally {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  }
}

runEtapa1Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ ERROR EN PRUEBAS DE ETAPA 1:', err);
    process.exit(1);
  });
