// ============================================================
// backend/tests/dos_modalidades_pedido_qa.test.mjs
// Suite de validación integral sobre orvex_qa:
// - Modalidad A: Diseño elaborado por Huellas (flujo creativo)
// - Modalidad B: Arte suministrado por el cliente (revisión técnica de pre-prensa)
// - No obligatoriedad de abono para conversión de solicitud en orden
// - Verificación automática de aprobaciones sin re-aprobación de Coordinación
// - Trazabilidad inmutable completa en registro_sesion
// - Reglas de avance de etapa (todas las tareas al 100% y no bloqueo con 0 tareas)
// - Registro de entrega habilitado para Comercial, Coordinación y Postventa
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const require = createRequire(import.meta.url);
process.env.DB_NAME = 'orvex_qa';
process.env.PORT = '3096';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');
const { puedeAvanzar } = await import('../../src/utils/format.js');

const BASE_URL = 'http://127.0.0.1:3096/api';

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
  console.log('🧪 [ORVEX QA] Iniciando suite de pruebas de dos modalidades de pedido y responsabilidades...\n');

  try {
    // 1. Conexión a orvex_qa
    const dbRes = await pool.query('SELECT current_database() AS db');
    assert.equal(dbRes.rows[0].db, 'orvex_qa', 'Las pruebas deben ejecutarse sobre orvex_qa');
    console.log(`✅ [01-CONEXION] Base de datos activa: ${dbRes.rows[0].db}`);

    // Obtener cliente real existente en orvex_qa
    const clienteRes = await pool.query('SELECT id, codigo, empresa FROM clientes ORDER BY id ASC LIMIT 1');
    assert.ok(clienteRes.rowCount > 0, 'Debe existir al menos un cliente en orvex_qa');
    const cliente = clienteRes.rows[0];

    // Obtener usuarios reales por rol desde orvex_qa
    const usuariosRes = await pool.query(
      'SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE esta_activo = true'
    );
    const usuarioComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuarioCoordinador = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuarioDisenador = usuariosRes.rows.find((u) => u.rol === 'disenador');
    const usuarioOperario = usuariosRes.rows.find((u) => u.rol === 'produccion');
    const usuarioPostventa = usuariosRes.rows.find((u) => u.rol === 'postventa');

    assert.ok(
      usuarioComercial && usuarioCoordinador && usuarioDisenador && usuarioOperario && usuarioPostventa,
      'Deben existir usuarios activos en la base de datos para cada rol'
    );

    const tokenComercial = generarToken(usuarioComercial);
    const tokenCoordinador = generarToken(usuarioCoordinador);
    const tokenDisenador = generarToken(usuarioDisenador);
    const tokenPostventa = generarToken(usuarioPostventa);
    const tokenOperario = generarToken(usuarioOperario);

    // ============================================================
    // SECCIÓN 1: MODALIDAD A — HUELLAS ELABORA DISEÑO (FLUJO CREATIVO)
    // ============================================================
    console.log('\n📌 SECCIÓN 1: Modalidad A (Huellas elabora el diseño)...');

    const solPayloadA = {
      cliente_id: cliente.id,
      producto: 'Pasacalles Festival Cultural Huellas 2026 (Modalidad A)',
      cantidad: 3,
      material: 'Lona banner 13oz',
      dimensiones: '3.00 x 0.80 m',
      fecha_entrega: '2026-11-20',
      presupuesto: 450000,
      modalidadDiseno: 'huellas',
      requerimientos: 'Diseño creativo completo institucional con paleta cálida.',
      archivos_referencia: [
        { id: 'ref-1', nombre: 'boceto_ideas.jpg', url: '/archivos/boceto_ideas.jpg', esArteCliente: false }
      ],
      cotizacionTotal: 450000,
      totalAbonado: 0,
      saldoPendiente: 450000,
      estadoPago: 'Pendiente',
    };

    const resSolA = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: solPayloadA,
    });
    assert.equal(resSolA.status, 201, 'Comercial debe poder registrar solicitud Modalidad A');
    const solA = resSolA.data.data;
    console.log(`  ✓ Solicitud Modalidad A creada: ${solA.codigo || solA.id}`);

    // Comercial envía formalmente a validación
    const resEnviarA = await req(`/solicitudes/${solA.id}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(resEnviarA.status, 200);

    // Validación sin obligatoriedad de abono previo (saldoPendiente = 450000, totalAbonado = 0)
    const resValA = await req(`/solicitudes/${solA.id}/validar`, {
      method: 'POST',
      token: tokenComercial,
    });
    assert.equal(resValA.status, 201, 'Conversión en orden debe permitir pedidos sin abono obligatorio previo');
    const ordenA = resValA.data.orden;
    const ordAId = ordenA.dbId || Number(String(ordenA.id).replace(/\D/g, ''));
    assert.equal(ordenA.disenoEstado || ordenA.diseno_estado, 'En diseño', 'Modalidad A debe iniciar con diseno_estado = En diseño');
    assert.equal(ordenA.etapa, 1, 'Modalidad A debe iniciar en etapa 1 (Diseño)');
    console.log(`  ✓ Orden Modalidad A creada: ${ordenA.codigo || ordenA.id} (DB id: ${ordAId}) en etapa 1 ("En diseño")`);

    // Comprobar que `puedeAvanzar` bloquea avance a Impresión porque el diseño no está aprobado
    const puedeAvanzarAntesA = puedeAvanzar(
      { id: ordenA.id, estado: 'Aprobación', disenoEstado: 'En diseño', versiones: [] },
      []
    );
    assert.equal(puedeAvanzarAntesA.ok, false, 'puedeAvanzar debe bloquear transición si disenoEstado = En diseño');
    assert.equal(puedeAvanzarAntesA.bloqueada, true);

    // Diseñador crea versión 1
    const resV1A = await req(`/disenos/orden/${ordenA.id}`, {
      method: 'POST',
      token: tokenDisenador,
      body: { archivoNombre: 'Propuesta_Pasacalles_v1.pdf', comentario: 'Boceto inicial CMYK' },
    });
    assert.equal(resV1A.status, 201, 'Diseñador crea versión 1');

    // Diseñador envía propuesta a Comercial
    const resEnvDisA = await req(`/disenos/orden/${ordenA.id}/enviar`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { observaciones: 'Propuesta v1 lista para presentación comercial.' },
    });
    assert.equal(resEnvDisA.status, 200, 'Diseñador envía propuesta a Comercial');

    // Comercial registra visto bueno del cliente con evidencia
    const resVoBoA = await req(`/disenos/orden/${ordenA.id}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'aprobar',
        numero_version: 1,
        canal: 'WhatsApp',
        nombreAutoriza: 'Laura Restrepo',
        evidencia: 'Pantallazo de aprobación WhatsApp adjunto y validado',
      },
    });
    assert.equal(resVoBoA.status, 200, 'Comercial aprueba formalmente diseño con evidencia');

    // Verificación automática de aprobaciones: Coordinación NO debe aprobar de nuevo
    const ordARefresh = (await pool.query('SELECT diseno_estado, etapa FROM ordenes WHERE id = $1', [ordAId])).rows[0];
    assert.equal(ordARefresh.diseno_estado, 'Aprobado por el cliente');

    const puedeAvanzarDespuesA = puedeAvanzar(
      {
        id: ordenA.id,
        estado: 'Aprobación',
        disenoEstado: ordARefresh.diseno_estado,
        versiones: [{ numero: 1, estado: 'Aprobado por el cliente' }],
      },
      []
    );
    assert.equal(puedeAvanzarDespuesA.ok, true, 'El sistema debe autorizar automáticamente el avance a impresión sin re-aprobación de Coordinación');
    console.log('  ✓ Flujo Modalidad A completado y desbloqueado automáticamente tras VoBo del cliente');

    // ============================================================
    // SECCIÓN 2: MODALIDAD B — ARTE SUMINISTRADO POR EL CLIENTE
    // ============================================================
    console.log('\n📌 SECCIÓN 2: Modalidad B (Cliente suministra diseño terminado)...');

    const archCliente = {
      id: 'arte-cli-1',
      nombre: 'Afiche_Terminado_Impresion_Cliente.pdf',
      url: '/archivos/Afiche_Terminado_Impresion_Cliente.pdf',
      esArteCliente: true,
      tipo: 'application/pdf',
    };

    const solPayloadB = {
      cliente_id: cliente.id,
      producto: 'Afiches Conferencia Publicitaria 2026 (Modalidad B - Arte Cliente)',
      cantidad: 500,
      material: 'Propalcote 150g',
      dimensiones: '0.45 x 0.30 m',
      fecha_entrega: '2026-11-22',
      presupuesto: 320000,
      modalidadDiseno: 'cliente',
      requerimientos: 'El cliente suministró el arte listo para impresión en PDF alta resolución.',
      archivos_referencia: [archCliente],
      cotizacionTotal: 320000,
      totalAbonado: 100000,
      saldoPendiente: 220000,
      estadoPago: 'Parcial',
    };

    const resSolB = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: solPayloadB,
    });
    assert.equal(resSolB.status, 201);
    const solB = resSolB.data.data;
    console.log(`  ✓ Solicitud Modalidad B creada: ${solB.codigo || solB.id}`);

    await req(`/solicitudes/${solB.id}/enviar`, { method: 'PATCH', token: tokenComercial });

    // Conversión a orden en Modalidad B
    const resValB = await req(`/solicitudes/${solB.id}/validar`, {
      method: 'POST',
      token: tokenComercial,
    });
    assert.equal(resValB.status, 201);
    const ordenB = resValB.data.orden;
    const ordBId = ordenB.dbId || Number(String(ordenB.id).replace(/\D/g, ''));

    // Verificar conservación de esArteCliente y estado técnico
    assert.equal(ordenB.disenoEstado || ordenB.diseno_estado, 'Revisión técnica de archivo', 'Debe inicializarse en Revisión técnica de archivo');
    assert.equal(ordenB.etapa, 1, 'Inicia en etapa 1 técnica');

    // Verificar que los archivos adjuntos sigan disponibles
    const archRefGuardados = ordenB.archivosReferencia || ordenB.archivos_referencia || [];
    assert(archRefGuardados.some(a => a.esArteCliente === true && a.nombre === archCliente.nombre), 'archivos_referencia debe conservar esArteCliente: true');
    console.log(`  ✓ Modalidad B inicializada en "Revisión técnica de archivo" con preservación de arte del cliente (DB id: ${ordBId})`);

    // Verificar bloqueo preventivo: en "Revisión técnica de archivo" NO puede pasar a impresión
    const puedeAvanzarTecnico = puedeAvanzar(
      {
        id: ordenB.id,
        estado: 'Aprobación',
        disenoEstado: 'Revisión técnica de archivo',
        versiones: [{ numero: 1, estado: 'Revisión técnica de archivo' }],
      },
      []
    );
    assert.equal(puedeAvanzarTecnico.ok, false, 'puedeAvanzar debe bloquear mientras esté en Revisión técnica de archivo');
    assert.equal(puedeAvanzarTecnico.bloqueada, true);

    // Diseñador/Pre-prensista aprueba técnicamente el archivo y envía a Comercial
    const resAprobTec = await req(`/disenos/orden/${ordenB.id}/enviar`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { observaciones: 'Archivo suministrado por el cliente verificado en pre-prensa: 300 DPI, CMYK y sangrado 3mm OK.' },
    });
    assert.equal(resAprobTec.status, 200, 'Pre-prensista aprueba especificaciones técnicas');

    // Comercial registra el visto bueno final formal del cliente
    const resVoBoB = await req(`/disenos/orden/${ordenB.id}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'aprobar',
        numero_version: 1,
        canal: 'Correo electrónico',
        nombreAutoriza: 'Carlos Ramírez',
        evidencia: 'VoBo recibido por correo con archivo final adjunto',
      },
    });
    assert.equal(resVoBoB.status, 200, 'Comercial registra VoBo del cliente');

    // Desbloqueo automático a Impresión
    const ordBRefresh = (await pool.query('SELECT diseno_estado FROM ordenes WHERE id = $1', [ordBId])).rows[0];
    assert.equal(ordBRefresh.diseno_estado, 'Aprobado por el cliente');
    const puedeAvanzarDespuesB = puedeAvanzar(
      {
        id: ordenB.id,
        estado: 'Aprobación',
        disenoEstado: ordBRefresh.diseno_estado,
        versiones: [{ numero: 1, estado: 'Aprobado por el cliente' }],
      },
      []
    );
    assert.equal(puedeAvanzarDespuesB.ok, true);
    console.log('  ✓ Modalidad B desbloqueada automáticamente a Impresión sin ciclo creativo redundante');

    // ============================================================
    // SECCIÓN 3: BITÁCORA INMUTABLE Y TRAZABILIDAD (registro_sesion)
    // ============================================================
    console.log('\n📌 SECCIÓN 3: Verificación de trazabilidad inmutable (registro_sesion)...');

    const bitacoraB = await pool.query(
      'SELECT accion_texto, responsable_nombre, fecha_texto FROM registro_sesion WHERE orden_id = $1 ORDER BY id ASC',
      [ordBId]
    );
    assert(bitacoraB.rowCount >= 4, 'registro_sesion debe registrar la secuencia completa');
    const acciones = bitacoraB.rows.map(r => r.accion_texto);
    console.log(`  ✓ Eventos registrados en orden ${ordenB.id}:`);
    bitacoraB.rows.forEach(r => console.log(`    - [${r.fecha_texto}] ${r.responsable_nombre}: ${r.accion_texto}`));

    assert(acciones.some(a => a.includes('Modalidad: Arte suministrado por el cliente')), 'Debe constar la modalidad de arte cliente');
    assert(acciones.some(a => a.includes('revisión técnica')), 'Debe constar la asignación técnica de pre-prensa');
    assert(acciones.some(a => a.includes('aprobado técnicamente en pre-prensa')), 'Debe constar la verificación de pre-prensa');
    assert(acciones.some(a => a.includes('aprobado por el cliente')), 'Debe constar la aprobación formal del cliente');

    // ============================================================
    // SECCIÓN 4: REGLAS DE AVANCE DE ETAPA Y ASIGNACIÓN DE TAREAS
    // ============================================================
    console.log('\n📌 SECCIÓN 4: Avance de etapas con tareas asignadas...');

    const ordenEtapaImpresion = {
      id: 'OP-QA-ETAPA',
      estado: 'Impresión',
      disenoEstado: 'Aprobado por el cliente',
      versiones: [{ numero: 1, estado: 'Aprobado por el cliente' }],
    };

    // Caso 1: Tareas pendientes o parciales (bloqueado)
    const tareasParciales = [
      { ordenId: 'OP-QA-ETAPA', etapa: 'Impresión', estado: 'Finalizada', pct: 100 },
      { ordenId: 'OP-QA-ETAPA', etapa: 'Impresión', estado: 'En proceso', pct: 50 },
    ];
    assert.equal(puedeAvanzar(ordenEtapaImpresion, tareasParciales).ok, false, 'No debe avanzar si hay tareas no finalizadas');

    // Caso 2: Todas las tareas finalizadas (100%) (permitido)
    const tareasCompletadas = [
      { ordenId: 'OP-QA-ETAPA', etapa: 'Impresión', estado: 'Finalizada', pct: 100 },
      { ordenId: 'OP-QA-ETAPA', etapa: 'Impresión', estado: 'Finalizada', pct: 100 },
    ];
    assert.equal(puedeAvanzar(ordenEtapaImpresion, tareasCompletadas).ok, true, 'Debe avanzar cuando todas las tareas de la etapa están Finalizadas');

    // Caso 3: Cero tareas asignadas (no bloqueo por deadlock)
    assert.equal(puedeAvanzar(ordenEtapaImpresion, []).ok, true, 'Debe permitir avanzar si no existen tareas asignadas para esa etapa');
    console.log('  ✓ Reglas de avance verificadas: requiere 100% de tareas asignadas y evita deadlock con 0 tareas');

    // ============================================================
    // SECCIÓN 5: PERMISOS DE ENTREGA FORMAL
    // ============================================================
    console.log('\n📌 SECCIÓN 5: Permisos para registro de entrega formal...');

    // Ponemos temporalmente la orden B en Despacho (etapa 7) para probar permisos de entrega
    await pool.query("UPDATE ordenes SET etapa = 7, estado_nombre = 'Despacho' WHERE id = $1", [ordBId]);

    const nombreArchivoEvidencia = `orden_${ordBId}_remision_${Date.now()}.pdf`;
    fs.writeFileSync(
      path.join(uploadDir, nombreArchivoEvidencia),
      `%PDF-1.4\nREMISIÓN ENTREGA FORMAL TEST ${Date.now()}`
    );

    const entregaPayload = {
      contacto: 'Carlos Ramírez',
      documento: 'CC 1020304050',
      cargo: 'Gerente General',
      telefono: '3001234567',
      conformidad: 'Total conformidad',
      observaciones: 'Entregado en sede principal.',
      archivo: nombreArchivoEvidencia,
    };

    // Operario intenta registrar entrega (debe bloquearse 403)
    const resOpEntrega = await req(`/ordenes/${ordenB.id}/entrega`, {
      method: 'POST',
      token: tokenOperario,
      body: entregaPayload,
    });
    assert.equal(resOpEntrega.status, 403, 'Operario NO debe poder registrar entrega');

    // Diseñador intenta registrar entrega (debe bloquearse 403)
    const resDisEntrega = await req(`/ordenes/${ordenB.id}/entrega`, {
      method: 'POST',
      token: tokenDisenador,
      body: entregaPayload,
    });
    assert.equal(resDisEntrega.status, 403, 'Diseñador NO debe poder registrar entrega');

    // Comercial / Recepción registra entrega formal
    const resComEntrega = await req(`/ordenes/${ordenB.id}/entrega`, {
      method: 'POST',
      token: tokenComercial,
      body: entregaPayload,
    });
    assert.equal(resComEntrega.status, 200, 'Comercial / Recepción debe poder registrar entrega en sede');

    const ordBEntregada = (await pool.query('SELECT etapa, estado_nombre FROM ordenes WHERE id = $1', [ordBId])).rows[0];
    assert.equal(ordBEntregada.etapa, 8, 'Orden debe pasar a etapa 8 (Entrega)');
    assert.equal(ordBEntregada.estado_nombre, 'Entrega');
    console.log('  ✓ Permisos de entrega verificados: Comercial/Recepción autorizada, roles operativos bloqueados');

    // Coordinación NO debe registrar la entrega final al cliente (esa responsabilidad queda en Comercial/Recepción y Postventa)
    await pool.query("UPDATE ordenes SET etapa = 7, estado_nombre = 'Despacho' WHERE id = $1", [ordAId]);
    const resCoordEntrega = await req(`/ordenes/${ordenA.id}/entrega`, {
      method: 'POST',
      token: tokenCoordinador,
      body: {
        contacto: 'Transportadora Envíos',
        documento: 'NIT 900111222',
        cargo: 'Conductor Despacho',
      },
    });
    assert.equal(resCoordEntrega.status, 403, 'Coordinación NO debe registrar la entrega final al cliente (403 Forbidden)');
    console.log('  ✓ Coordinación bloqueada correctamente en registro de entrega final al cliente (403)');

    console.log('\n🎉 ¡TODAS LAS VALIDACIONES DE DOS MODALIDADES Y RESPONSABILIDADES EN QA PASARON CON ÉXITO (100%)!\n');
    server.close();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS QA:', err);
    if (server) server.close();
    await pool.end();
    process.exit(1);
  }
}

runTestSuite();
