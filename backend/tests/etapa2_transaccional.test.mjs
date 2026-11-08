// ============================================================
// tests/etapa2_transaccional.test.mjs — Suite de Pruebas Automatizadas de Lógica Transaccional (Etapa 2)
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';

process.env.PORT = '3097';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { server } = require('../index.js');
const { pool } = require('../db.js');
const { getJwtSecret } = require('../middleware/auth.js');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const BASE = 'http://127.0.0.1:3097/api';

async function req(pathUrl, { method = 'GET', token = '', body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${pathUrl}`, {
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

async function runEtapa2Tests() {
  console.log('🧪 [ETAPA 2 COMPLEMENTARIA] Iniciando pruebas exhaustivas de Lógica Transaccional y Candados...\n');

  try {
    // 0. Obtener usuarios reales de prueba
    const { rows: users } = await pool.query('SELECT * FROM usuarios');
    const uComercial = users.find((u) => u.rol === 'ejecutiva');
    const uCoord = users.find((u) => u.rol === 'coord');
    const uOperario = users.find((u) => u.rol === 'produccion');
    const uDisenador = users.find((u) => u.rol === 'disenador');
    const uPostventa = users.find((u) => u.rol === 'postventa');
    const uGerente = users.find((u) => u.rol === 'gerente');

    const tokenComercial = generarToken({ id: uComercial.id, email: uComercial.email, rol: 'comercial', nombre_completo: uComercial.nombre_completo });
    const tokenCoord = generarToken({ id: uCoord.id, email: uCoord.email, rol: 'coordinador', nombre_completo: uCoord.nombre_completo });
    const tokenOperario = generarToken({ id: uOperario.id, email: uOperario.email, rol: 'operario', nombre_completo: uOperario.nombre_completo });
    const tokenDisenador = generarToken({ id: uDisenador.id, email: uDisenador.email, rol: 'disenador', nombre_completo: uDisenador.nombre_completo });
    const tokenPostventa = generarToken({ id: uPostventa.id, email: uPostventa.email, rol: 'postventa', nombre_completo: uPostventa.nombre_completo });
    const tokenGerente = generarToken({ id: uGerente.id, email: uGerente.email, rol: 'gerencia', nombre_completo: uGerente.nombre_completo });

    const { rows: clientes } = await pool.query('SELECT * FROM clientes LIMIT 1');
    const clienteTest = clientes[0];

    // ============================================================
    // 1. CANDADO DE CALIDAD, VALIDACIÓN DE ARCHIVO Y VERSIÓN VIGENTE (RF-07, T-06)
    // ============================================================
    console.log('  Testing 1: Candado de Aprobación de Diseño, Archivos Físicos y Versión Vigente...');

    // 1.1 Crear solicitud y orden limpia para el test
    const codSolCandado = `SOL-CANDADO-${Date.now()}`;
    const insSol = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto, observaciones)
       VALUES ($1, $2, 'Valla Publicitaria Candado Test', 'Descripción de prueba para candado', $3, 'aprobada', 1200000, 'Test Etapa 2')
       RETURNING *`,
      [codSolCandado, clienteTest.id, uComercial.id]
    );
    const solTest = insSol.rows[0];

    const resCrearOrden = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: {
        solicitud_id: solTest.id,
        cliente_id: clienteTest.id,
        producto: 'Valla Publicitaria Candado Test',
        cantidad: 1,
        etapa: 1,
      },
    });
    assert.equal(resCrearOrden.status, 201, 'Debe crear la OP desde solicitud aprobada');
    const ordenCandado = resCrearOrden.data.data;

    // 1.2 Intento de avance a Impresión (etapa 4) SIN ningún arte -> 400 Bad Request
    const resAvanceSinArte = await req(`/ordenes/${ordenCandado.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceSinArte.status, 400, 'Debe bloquear paso a impresión sin propuesta gráfica');
    assert.equal(resAvanceSinArte.data.bloqueada, true, 'Debe indicar que la orden está bloqueada por candado');
    console.log('    ✓ Bloqueo sin arte verificado (HTTP 400).');

    // 1.3 Subir versión 1 (rechazada) y versión 2 (pendiente)
    const insArte1 = await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 1, 'uploads/arte_v1.pdf', $2, 'rechazado', 'Rechazada', 'Diseñador Test', 'arte_v1.pdf')
       RETURNING *`,
      [ordenCandado.dbId, uDisenador.id]
    );
    const arteRow1 = insArte1.rows[0];

    const insArte2 = await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 2, 'uploads/arte_v2.pdf', $2, 'pendiente', 'Enviada', 'Diseñador Test', 'arte_v2.pdf')
       RETURNING *`,
      [ordenCandado.dbId, uDisenador.id]
    );
    const arteRow2 = insArte2.rows[0];

    // 1.4 Validación física de archivos: Evidencia con extensión no permitida (.exe) -> 400
    const resExtNoPermitida = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: 'malware_test.exe', soporte_tipo: 'documental' },
    });
    assert.equal(resExtNoPermitida.status, 400);
    assert.match(resExtNoPermitida.data.error, /Formato de archivo \.exe no admitido/i);
    console.log('    ✓ Rechazo de extensión no permitida verificado (HTTP 400).');

    // 1.5 Validación física de archivos: Archivo inexistente en disco -> 400
    const resArchivoInexistente = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: 'archivo_fantasma_no_existe_en_disco.pdf', soporte_tipo: 'documental' },
    });
    assert.equal(resArchivoInexistente.status, 400);
    assert.match(resArchivoInexistente.data.error, /no existe físicamente en el servidor/i);
    console.log('    ✓ Rechazo de archivo inexistente en disco verificado (HTTP 400).');

    // 1.5.1 Validación física: Extensión parcial o no exacta (.notpdf, .paid) -> 400
    const resExtParcial = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: 'prueba.notpdf', soporte_tipo: 'documental' },
    });
    assert.equal(resExtParcial.status, 400);
    assert.match(resExtParcial.data.error, /Formato de archivo \.notpdf no admitido/i);
    console.log('    ✓ Rechazo de extensión parcial (.notpdf) verificado (HTTP 400).');

    // 1.5.2 Validación física: Detección de binario ejecutable camuflado con extensión .pdf (Magic Number MZ) -> 400
    const fileExeDisguised = `camuflado_${Date.now()}.pdf`;
    const bufExe = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // 'MZ' header
    fs.writeFileSync(path.join(uploadDir, fileExeDisguised), bufExe);

    const resExeDisguised = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: fileExeDisguised, soporte_tipo: 'documental' },
    });
    assert.equal(resExeDisguised.status, 400);
    assert.match(resExeDisguised.data.error, /Archivo ejecutable camuflado detectado/i);
    console.log('    ✓ Detección y rechazo de ejecutable camuflado (MZ) verificado (HTTP 400).');

    // 1.5.3 Validación física: Archivo .pdf de texto plano sin firma válida (%PDF-) -> 400
    const fileNoSignature = `fake_pdf_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileNoSignature), 'CONTENIDO FALSO SIN CABECERA PDF');
    const resNoSig = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: fileNoSignature, soporte_tipo: 'documental' },
    });
    assert.equal(resNoSig.status, 400);
    assert.match(resNoSig.data.error, /%PDF- no encontrado/i);
    console.log('    ✓ Detección de archivo PDF sin firma auténtica verificada (HTTP 400).');

    // 1.6 Aprobación externa de versión antigua (v1) cuando existe v2 pendiente:
    // Creamos archivo físico real para v1 con firma válida y contenido único
    const fileV1Name = `soporte_aprobacion_v1_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileV1Name), `%PDF-1.4\nSOPORTE DE VERSION 1 - ${Date.now()}`);

    const resSoporteV1 = await req(`/disenos/${arteRow1.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: fileV1Name, soporte_tipo: 'acta_firmada' },
    });
    assert.equal(resSoporteV1.status, 200);

    // Verificar en BD que ordenes.diseno_estado NO pasó a 'Aprobado' porque v1 no es la versión vigente
    const ordenVerCheck = (await pool.query('SELECT diseno_estado FROM ordenes WHERE id = $1', [ordenCandado.dbId])).rows[0];
    assert.notEqual(ordenVerCheck.diseno_estado, 'Aprobado', 'Validar versión antigua NO debe poner la orden en Aprobado');

    // Comprobar que paso a taller sigue bloqueado (400) porque la vigente v2 sigue pendiente
    const resAvanceBloqueadoPorV2 = await req(`/ordenes/${ordenCandado.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceBloqueadoPorV2.status, 400, 'Taller debe seguir bloqueado si la versión vigente no está aprobada');
    console.log('    ✓ Protección contra aprobación de versión antigua comprobada (HTTP 400).');

    // 1.7 Validar soporte con archivo físico real para la versión vigente (v2) con firma válida y contenido único
    const fileV2Name = `soporte_aprobacion_v2_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileV2Name), `%PDF-1.4\nSOPORTE FISICO VALIDO VERSION 2 - ${Date.now()}`);

    const resSoporteV2 = await req(`/disenos/${arteRow2.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: fileV2Name, soporte_tipo: 'acta_firmada' },
    });
    assert.equal(resSoporteV2.status, 200);
    assert.equal(resSoporteV2.data.data.soporte_validado, true);

    const ordenVerCheckV2 = (await pool.query('SELECT diseno_estado FROM ordenes WHERE id = $1', [ordenCandado.dbId])).rows[0];
    assert.equal(ordenVerCheckV2.diseno_estado, 'Aprobado', 'Versión vigente validada pone orden en Aprobado');

    // 1.8 Con la versión vigente aprobada físicamente, avanzar a Impresión (etapa 4) procede
    const resAvanceLiberado = await req(`/ordenes/${ordenCandado.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceLiberado.status, 200, 'Debe liberar paso a taller tras validar versión vigente');
    assert.equal(resAvanceLiberado.data.data.etapa, 4);
    console.log('  ✅ 1. Candado de calidad, validación de archivos físicos y versiones comprobados al 100%.\n');

    // ============================================================
    // 2. SEGREGACIÓN FINANCIERA (DISEÑADORES, OPERARIOS Y CLIENTES - T-08)
    // ============================================================
    console.log('  Testing 2: Segregación Financiera para Diseñadores y Operarios (T-08)...');

    // 2.1 Diseñador NO debe ver costoInterno en detalle de orden
    const resOrdenDisenador = await req(`/ordenes/${ordenCandado.id}`, { method: 'GET', token: tokenDisenador });
    assert.equal(resOrdenDisenador.status, 200);
    assert.equal(resOrdenDisenador.data.data.costoInterno, undefined, 'Diseñador NO debe recibir costoInterno en detalle');

    // 2.2 Diseñador NO debe ver costoInterno en listado general de órdenes
    const resListarDisenador = await req('/ordenes', { method: 'GET', token: tokenDisenador });
    assert.equal(resListarDisenador.status, 200);
    for (const ord of resListarDisenador.data.data) {
      assert.equal(ord.costoInterno, undefined, 'Diseñador NO debe recibir costoInterno en listado');
    }

    // 2.3 Operario NO debe ver costoInterno
    const resOrdenOperario = await req(`/ordenes/${ordenCandado.id}`, { method: 'GET', token: tokenOperario });
    assert.equal(resOrdenOperario.status, 200);
    assert.equal(resOrdenOperario.data.data.costoInterno, undefined, 'Operario NO debe recibir costoInterno');

    // 2.4 Coordinación y Gerente SÍ ven costoInterno como número válido
    const resOrdenCoord = await req(`/ordenes/${ordenCandado.id}`, { method: 'GET', token: tokenCoord });
    assert.equal(resOrdenCoord.status, 200);
    assert.equal(typeof resOrdenCoord.data.data.costoInterno, 'number');

    const resOrdenGerente = await req(`/ordenes/${ordenCandado.id}`, { method: 'GET', token: tokenGerente });
    assert.equal(resOrdenGerente.status, 200);
    assert.equal(typeof resOrdenGerente.data.data.costoInterno, 'number');
    console.log('  ✅ 2. Segregación financiera para Diseñadores y Operarios comprobada al 100%.\n');

    // ============================================================
    // 3. INVENTARIO DINÁMICO: RESERVAS, CONCURRENCIA, DESCUENTO ATÓMICO E IDEMPOTENCIA
    // ============================================================
    console.log('  Testing 3: Inventario Dinámico, Concurrencia y Descuento Atómico...');

    const { rows: mats } = await pool.query('SELECT * FROM inventario ORDER BY id ASC LIMIT 1');
    const material = mats[0];
    const stockInicial = parseFloat(material.stock_actual);
    const reservadoInicial = parseFloat(material.stock_reservado || 0);
    const dispAntes = Math.max(0, stockInicial - reservadoInicial);

    // 3.1 Concurrencia: Dos reservas simultáneas que compiten por el disponible
    const cantCompA = Math.floor(dispAntes * 0.6);
    const cantCompB = Math.floor(dispAntes * 0.6);

    const [resInvA, resInvB] = await Promise.all([
      req('/inventario/reservar', { method: 'POST', token: tokenCoord, body: { orden_id: ordenCandado.dbId, material_id: material.id, cantidad_requerida: cantCompA } }),
      req('/inventario/reservar', { method: 'POST', token: tokenCoord, body: { orden_id: ordenCandado.dbId, material_id: material.id, cantidad_requerida: cantCompB } }),
    ]);
    assert.equal(resInvA.status, 201);
    assert.equal(resInvB.status, 201);

    const matPostReserva = (await pool.query('SELECT * FROM inventario WHERE id = $1', [material.id])).rows[0];
    assert.ok(
      parseFloat(matPostReserva.stock_reservado) <= parseFloat(matPostReserva.stock_actual),
      'Concurrencia: El stock reservado nunca debe exceder las existencias físicas'
    );
    console.log('    ✓ Concurrencia de reservas serializada sin sobrepasar stock físico.');

    // Liberar reservas para dejar inventario limpio
    await req(`/inventario/liberar/${ordenCandado.id}`, { method: 'POST', token: tokenCoord });

    // 3.2 Descuento e Idempotencia en Taller
    const stockAntesConsumo = parseFloat((await pool.query('SELECT stock_actual FROM inventario WHERE id = $1', [material.id])).rows[0].stock_actual);
    const cantConsumir = 2;

    // Descontar en transición a Acabados (etapa 5)
    const resConsumo1 = await req(`/ordenes/${ordenCandado.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 5, estado: 'Acabados', material_id: material.id, cantidad_insumo: cantConsumir },
    });
    assert.equal(resConsumo1.status, 200);

    const stockPostConsumo1 = parseFloat((await pool.query('SELECT stock_actual FROM inventario WHERE id = $1', [material.id])).rows[0].stock_actual);
    assert.equal(stockPostConsumo1, stockAntesConsumo - cantConsumir);

    // Reintento / Avance a Despacho (etapa 6): Idempotencia comprobada
    const resConsumo2 = await req(`/ordenes/${ordenCandado.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 6, estado: 'Despacho', material_id: material.id, cantidad_insumo: cantConsumir },
    });
    assert.equal(resConsumo2.status, 200);

    const stockPostConsumo2 = parseFloat((await pool.query('SELECT stock_actual FROM inventario WHERE id = $1', [material.id])).rows[0].stock_actual);
    assert.equal(stockPostConsumo2, stockPostConsumo1, 'Idempotencia: No debe descontar nuevamente en transiciones posteriores');
    console.log('  ✅ 3. Inventario dinámico, concurrencia e idempotencia comprobados al 100%.\n');

    // ============================================================
    // 4. CICLO DE VIDA DE POSTVENTA, REIMPRESIONES Y CIERRE DE ORDEN
    // ============================================================
    console.log('  Testing 4: Ciclo de Vida de Postventa, Reimpresiones por Garantía y Bloqueo de Cierre...');

    // 4.1 Crear caso de garantía sobre la ordenCandado
    const codCasoGarantia = `PV-TEST-${Date.now()}`;
    const insCaso = await pool.query(
      `INSERT INTO postventa (
        codigo, orden_id, tipo, categoria, motivo, prioridad, estado, ejecutiva_id
      ) VALUES ($1, $2, 'Garantía', 'Garantía', 'Falla de termosellado en costura', 'Alta', 'Abierto', $3)
      RETURNING *`,
      [codCasoGarantia, ordenCandado.dbId, uPostventa.id]
    );
    const casoGarantia = insCaso.rows[0];

    // 4.2 Postventa registra solicitud de reimpresión
    const resSolReimp = await req(`/postventa/${casoGarantia.id}/solicitar-reimpresion`, {
      method: 'PATCH',
      token: tokenPostventa,
      body: { motivo: 'Dictamen de garantía por defecto de fábrica' },
    });
    assert.equal(resSolReimp.status, 200);
    assert.equal(resSolReimp.data.data.solicitudReimpresion, true);

    // 4.3 Coordinación autoriza reimpresión -> Estado del caso DEBE SER 'En reposición' (NUNCA 'Resuelto')
    const resAutCoord = await req(`/postventa/${casoGarantia.id}/autorizar-reimpresion`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Garantía validada. Reposición en proceso.' },
    });
    assert.equal(resAutCoord.status, 201);
    assert.equal(resAutCoord.data.data.estado, 'En reposición', 'El caso DEBE permanecer En reposición durante toda la producción');
    const ordenReposicion = resAutCoord.data.orden;
    assert.equal(Number(ordenReposicion.presupuesto), 0, 'La nueva OP de garantía debe tener presupuesto de $0 COP');
    assert.equal(ordenReposicion.esReimpresion, true);
    assert.equal(ordenReposicion.ordenOriginalId, ordenCandado.codigo);
    console.log(`    ✓ Caso de postventa en estado "En reposición" con OP vinculada: ${ordenReposicion.id} ($0 COP).`);

    // 4.4 Intentar cerrar la orden original mientras la reposición esté pendiente -> DEBE BLOQUEARSE (HTTP 409)
    // Registramos la entrega formal inicial de ordenCandado para que alcance etapa 8 (Entrega)
    const fileEntregaOrig = `remision_inicial_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileEntregaOrig), `%PDF-1.4\nREMISIÓN INICIAL ORDEN ORIGINAL - ${Date.now()}`);
    const resEntregaOrig = await req(`/ordenes/${ordenCandado.id}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Cliente Inicial',
        documento: 'CC 10.000.111',
        evidencia: fileEntregaOrig,
      },
    });
    assert.equal(resEntregaOrig.status, 200, 'Entrega inicial de orden original debe ser 200');

    const resCierreBloqueado = await req(`/ordenes/${ordenCandado.id}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Intento de cierre con reposición en taller' },
    });
    assert.equal(resCierreBloqueado.status, 409, 'Debe impedir el cierre de la orden original mientras la reposición siga en taller');
    assert.match(resCierreBloqueado.data.error, /sin resolver o en reposición|orden\(es\) de reposición/i);
    console.log('    ✓ Bloqueo de cierre de orden original con reposición pendiente comprobado (HTTP 409).');

    // 4.5 Concurrencia de reimpresiones: Dos solicitudes simultáneas esperando un 201 y un 409
    const insSolConc = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Aviso Concurrencia', 'Prueba carreras reimpresión', $3, 'aprobada', 400000)
       RETURNING *`,
      [`SOL-CONC-${Date.now()}`, clienteTest.id, uComercial.id]
    );
    const ordConc = (await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: { solicitud_id: insSolConc.rows[0].id, cliente_id: clienteTest.id, producto: 'Aviso Concurrencia', cantidad: 1, etapa: 1 },
    })).data.data;

    const insCasoConc = await pool.query(
      `INSERT INTO postventa (
        codigo, orden_id, tipo, categoria, motivo, prioridad, estado, ejecutiva_id
      ) VALUES ($1, $2, 'Garantía', 'Garantía', 'Defecto concurrencia', 'Alta', 'Abierto', $3)
      RETURNING *`,
      [`PV-CONC-${Date.now()}`, ordConc.dbId, uPostventa.id]
    );
    const casoConc = insCasoConc.rows[0];

    const [autA, autB] = await Promise.all([
      req(`/postventa/${casoConc.id}/autorizar-reimpresion`, { method: 'POST', token: tokenCoord, body: { motivo: 'Intento simultáneo 1' } }),
      req(`/postventa/${casoConc.id}/autorizar-reimpresion`, { method: 'POST', token: tokenCoord, body: { motivo: 'Intento simultáneo 2' } }),
    ]);

    const statuses = [autA.status, autB.status].sort();
    assert.deepEqual(statuses, [201, 409], 'Concurrencia de reimpresión debe resultar exactamente en un 201 y un 409');
    console.log('    ✓ Concurrencia en reimpresión comprobada: [201, 409] sin errores 500.');

    // 4.6 Entrega formal de la orden de reposición con evidencia física real:
    // Debe resolver formalmente el caso de postventa
    const remisionRepoName = `remision_reposicion_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, remisionRepoName), `%PDF-1.4\nACTA DE ENTREGA FORMAL DE REPOSICION - ${Date.now()}`);

    const resEntregaRepo = await req(`/ordenes/${ordenReposicion.id}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Receptor Autorizado',
        documento: 'CC 80.999.000',
        cargo: 'Interventor',
        conformidad: 'Conforme con reposición',
        evidencia: remisionRepoName,
      },
    });
    assert.equal(resEntregaRepo.status, 200, 'Entrega de reposición debe ser exitosa');

    // Verificar en BD que el caso de postventa ahora SÍ transicionó a 'Resuelto'
    const casoVerFinal = (await pool.query('SELECT estado, solucion, fecha_solucion FROM postventa WHERE id = $1', [casoGarantia.id])).rows[0];
    assert.equal(casoVerFinal.estado, 'Resuelto', 'Caso de postventa debe resolverse ÚNICAMENTE tras la entrega formal');
    assert.ok(casoVerFinal.fecha_solucion !== null);
    console.log('    ✓ Caso de garantía resuelto formalmente solo tras entrega de la reposición.');

    // 4.7 Ahora que la reposición fue entregada y el caso está 'Resuelto', la orden original PUEDE cerrarse formalmente
    const resCierreOriginalExitoso = await req(`/ordenes/${ordenCandado.id}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Garantía subsanada y entregada a conformidad' },
    });
    assert.equal(resCierreOriginalExitoso.status, 200, 'Debe permitir cierre tras resolución legítima de la reposición');
    console.log('  ✅ 4. Ciclo de vida de postventa, reimpresiones y cierre formal comprobados al 100%.\n');

    // ============================================================
    // 5. ASOCIACIÓN ESTRICTA DE EVIDENCIAS Y PREVENCIÓN DE USURPACIÓN (SEGURIDAD ETAPA 2)
    // ============================================================
    console.log('  Testing 5: Asociación Segura de Evidencias y Prevención de Usurpación entre Órdenes...');

    // 5.1 Crear una Orden B independiente
    const codSolB = `SOL-TEST-B-${Date.now()}`;
    const insSolB = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Producto Orden B', 'Orden para pruebas de usurpación', $3, 'aprobada', 850000)
       RETURNING *`,
      [codSolB, clienteTest.id, uComercial.id]
    );
    const ordBRes = await req('/ordenes', {
      method: 'POST',
      token: tokenCoord,
      body: { solicitud_id: insSolB.rows[0].id, cliente_id: clienteTest.id, producto: 'Producto Orden B', cantidad: 1, etapa: 1 },
    });
    assert.equal(ordBRes.status, 201);
    const ordenB = ordBRes.data.data;

    // Crear un arte v1 para Orden B
    const insArteB = await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 1, 'uploads/arte_b_v1.pdf', $2, 'pendiente', 'Enviada', 'Diseñador Test', 'arte_b_v1.pdf')
       RETURNING *`,
      [ordenB.dbId, uDisenador.id]
    );
    const arteB1 = insArteB.rows[0];

    // 5.2 Orden B intenta usar un archivo con prefijo de otra orden (ej. orden_${ordenCandado.dbId}_...)
    const foreignPrefixFile = `orden_${ordenCandado.dbId}_${Date.now()}_soporte_intruso.pdf`;
    fs.writeFileSync(path.join(uploadDir, foreignPrefixFile), `%PDF-1.4\nEVIDENCIA DE OTRA ORDEN ${Date.now()}`);

    const resUsurparPrefijo = await req(`/disenos/${arteB1.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: foreignPrefixFile, soporte_tipo: 'acta_firmada' },
    });
    assert.equal(resUsurparPrefijo.status, 400);
    assert.match(resUsurparPrefijo.data.error, /corresponde a otra orden/i);
    console.log('    ✓ Usurpación por prefijo de otra orden bloqueada exitosamente (HTTP 400).');

    // 5.3 Orden B intenta reutilizar un soporte de diseño ya registrado formalmente en la Orden A (fileV2Name)
    const resReusoSoporteArte = await req(`/disenos/${arteB1.id}/soporte`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { soporte_evidencia: fileV2Name, soporte_tipo: 'acta_firmada' },
    });
    assert.equal(resReusoSoporteArte.status, 409, 'Reutilización de soporte ya registrado debe responder HTTP 409');
    assert.match(resReusoSoporteArte.data.error, /ya está vinculado formalmente a la orden/i);
    console.log('    ✓ Reutilización de soporte de diseño de otra orden bloqueada en BD (HTTP 409).');

    // 5.4 Orden B intenta usar como remisión de entrega un archivo ya registrado en la remisión de otra orden (remisionRepoName)
    const resReusoRemision = await req(`/ordenes/${ordenB.id}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Receptor Indebido',
        documento: 'CC 12.345.678',
        cargo: 'Recepción',
        evidencia: remisionRepoName,
      },
    });
    assert.equal(resReusoRemision.status, 409, 'Reutilización de remisión de entrega en otra orden debe responder HTTP 409');
    assert.match(resReusoRemision.data.error, /ya está registrado como remisión formal de entrega en la orden/i);
    console.log('    ✓ Reutilización de remisión de entrega de otra orden bloqueada en BD (HTTP 409).');

    // ============================================================
    // ESCENARIOS OBLIGATORIOS DE CONCURRENCIA Y SEPARACIÓN DE CONTEXTOS
    // ============================================================

    // 5.5 Escenario 1: Dos aprobaciones simultáneas con el mismo archivo en órdenes distintas -> Exactamente [200, 409]
    const sharedArteFile = `soporte_concurrente_arte_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, sharedArteFile), `%PDF-1.4\nSOPORTE ARTE CONCURRENTE ${Date.now()}`);

    const insSolC1 = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Prod Conc 1', 'Desc 1', $3, 'aprobada', 300000) RETURNING *`,
      [`SOL-C1-${Date.now()}`, clienteTest.id, uComercial.id]
    );
    const ordC1 = (await req('/ordenes', {
      method: 'POST', token: tokenCoord,
      body: { solicitud_id: insSolC1.rows[0].id, cliente_id: clienteTest.id, producto: 'Prod Conc 1', cantidad: 1, etapa: 1 },
    })).data.data;

    const insSolC2 = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Prod Conc 2', 'Desc 2', $3, 'aprobada', 350000) RETURNING *`,
      [`SOL-C2-${Date.now()}`, clienteTest.id, uComercial.id]
    );
    const ordC2 = (await req('/ordenes', {
      method: 'POST', token: tokenCoord,
      body: { solicitud_id: insSolC2.rows[0].id, cliente_id: clienteTest.id, producto: 'Prod Conc 2', cantidad: 1, etapa: 1 },
    })).data.data;

    const aC1 = (await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 1, 'uploads/ac1.pdf', $2, 'pendiente', 'Enviada', 'Diseñador', 'ac1.pdf') RETURNING *`,
      [ordC1.dbId, uDisenador.id]
    )).rows[0];

    const aC2 = (await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 1, 'uploads/ac2.pdf', $2, 'pendiente', 'Enviada', 'Diseñador', 'ac2.pdf') RETURNING *`,
      [ordC2.dbId, uDisenador.id]
    )).rows[0];

    const [autArte1, autArte2] = await Promise.all([
      req(`/disenos/${aC1.id}/soporte`, { method: 'PATCH', token: tokenCoord, body: { soporte_evidencia: sharedArteFile, soporte_tipo: 'acta_firmada' } }),
      req(`/disenos/${aC2.id}/soporte`, { method: 'PATCH', token: tokenCoord, body: { soporte_evidencia: sharedArteFile, soporte_tipo: 'acta_firmada' } }),
    ]);
    const statusesArte = [autArte1.status, autArte2.status].sort();
    assert.deepEqual(statusesArte, [200, 409], 'Carrera de dos aprobaciones con el mismo archivo debe resultar exactamente en [200, 409]');
    console.log('    ✓ Escenario 1 de concurrencia verificado: Exactamente [200, 409] en aprobaciones simultáneas de arte.');

    // 5.6 Escenario 2: Dos entregas simultáneas con el mismo archivo en órdenes distintas -> Exactamente [200, 409]
    const sharedEntregaFile = `remision_concurrente_entrega_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, sharedEntregaFile), `%PDF-1.4\nREMISIÓN ENTREGA CONCURRENTE ${Date.now()}`);

    const [ent1, ent2] = await Promise.all([
      req(`/ordenes/${ordC1.id}/entrega`, {
        method: 'POST', token: tokenCoord,
        body: { contacto: 'Receptor C1', documento: 'CC 11.222.333', evidencia: sharedEntregaFile },
      }),
      req(`/ordenes/${ordC2.id}/entrega`, {
        method: 'POST', token: tokenCoord,
        body: { contacto: 'Receptor C2', documento: 'CC 44.555.666', evidencia: sharedEntregaFile },
      }),
    ]);
    const statusesEntrega = [ent1.status, ent2.status].sort();
    assert.deepEqual(statusesEntrega, [200, 409], 'Carrera de dos entregas con el mismo archivo debe resultar exactamente en [200, 409]');
    console.log('    ✓ Escenario 2 de concurrencia verificado: Exactamente [200, 409] en entregas simultáneas.');

    // 5.7 Escenario 3: Aprobación de diseño simultánea con entrega formal en órdenes distintas -> Exactamente [200, 409]
    const sharedCrossFile = `soporte_cruzado_concurrente_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, sharedCrossFile), `%PDF-1.4\nSOPORTE CRUZADO CONCURRENTE ${Date.now()}`);

    const insSolC3 = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Prod Conc 3', 'Desc 3', $3, 'aprobada', 400000) RETURNING *`,
      [`SOL-C3-${Date.now()}`, clienteTest.id, uComercial.id]
    );
    const ordC3 = (await req('/ordenes', {
      method: 'POST', token: tokenCoord,
      body: { solicitud_id: insSolC3.rows[0].id, cliente_id: clienteTest.id, producto: 'Prod Conc 3', cantidad: 1, etapa: 1 },
    })).data.data;

    const insSolC4 = await pool.query(
      `INSERT INTO solicitudes (codigo, cliente_id, producto, descripcion, ejecutiva_id, estado, presupuesto)
       VALUES ($1, $2, 'Prod Conc 4', 'Desc 4', $3, 'aprobada', 450000) RETURNING *`,
      [`SOL-C4-${Date.now()}`, clienteTest.id, uComercial.id]
    );
    const ordC4 = (await req('/ordenes', {
      method: 'POST', token: tokenCoord,
      body: { solicitud_id: insSolC4.rows[0].id, cliente_id: clienteTest.id, producto: 'Prod Conc 4', cantidad: 1, etapa: 1 },
    })).data.data;

    const aC3 = (await pool.query(
      `INSERT INTO archivos_arte (orden_id, numero_version, ruta_archivo, creador_id, estado_aprobacion, estado_ui, disenador_nombre, archivo_nombre)
       VALUES ($1, 1, 'uploads/ac3.pdf', $2, 'pendiente', 'Enviada', 'Diseñador', 'ac3.pdf') RETURNING *`,
      [ordC3.dbId, uDisenador.id]
    )).rows[0];

    const [crossArte, crossEntrega] = await Promise.all([
      req(`/disenos/${aC3.id}/soporte`, { method: 'PATCH', token: tokenCoord, body: { soporte_evidencia: sharedCrossFile, soporte_tipo: 'acta_firmada' } }),
      req(`/ordenes/${ordC4.id}/entrega`, { method: 'POST', token: tokenCoord, body: { contacto: 'Receptor C4', documento: 'CC 77.888.999', evidencia: sharedCrossFile } }),
    ]);
    const statusesCross = [crossArte.status, crossEntrega.status].sort();
    assert.deepEqual(statusesCross, [200, 409], 'Carrera cruzada de arte y entrega con el mismo archivo debe resultar exactamente en [200, 409]');
    console.log('    ✓ Escenario 3 de concurrencia verificado: Exactamente [200, 409] en carrera cruzada de arte vs entrega.');

    // 5.8 Escenario 4: Reutilización de soporte de diseño como remisión de entrega dentro de la MISMA orden -> HTTP 409
    const fileMismaOrden = `arte_diseno_exclusivo_${ordC3.id}_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileMismaOrden), `%PDF-1.4\nARTE EXCLUSIVO ORDEN C3 ${Date.now()}`);

    const resArteMismaOrd = await req(`/disenos/${aC3.id}/soporte`, {
      method: 'PATCH', token: tokenCoord,
      body: { soporte_evidencia: fileMismaOrden, soporte_tipo: 'acta_firmada' },
    });
    assert.equal(resArteMismaOrd.status, 200, 'Asociación legítima como soporte de arte debe responder 200');

    // Intentar asociar el MISMO archivo como remisión de entrega de la MISMA orden C3 -> DEBE RECHAZARSE CON 409
    const resEntregaMismaOrd = await req(`/ordenes/${ordC3.id}/entrega`, {
      method: 'POST', token: tokenCoord,
      body: { contacto: 'Receptor Intento Mismo', documento: 'CC 99.000.111', evidencia: fileMismaOrden },
    });
    assert.equal(resEntregaMismaOrd.status, 409, 'Reutilización de arte como remisión en la misma orden DEBE responder HTTP 409');
    assert.match(resEntregaMismaOrd.data.error, /soporte de aprobación de diseño en esta misma orden/i);
    console.log('    ✓ Escenario 4 de separación de contextos verificado: HTTP 409 al reutilizar arte como entrega en la misma orden.');

    // 5.9 Comprobación de archivos distintos: garantizar que no se bloqueen innecesariamente entre sí -> Ambos 200
    const fileIndep1 = `independiente_1_${Date.now()}.pdf`;
    const fileIndep2 = `independiente_2_${Date.now()}.pdf`;
    fs.writeFileSync(path.join(uploadDir, fileIndep1), `%PDF-1.4\nARCHIVO INDEPENDIENTE 1 ${Date.now()}`);
    fs.writeFileSync(path.join(uploadDir, fileIndep2), `%PDF-1.4\nARCHIVO INDEPENDIENTE 2 ${Date.now()}`);

    const [indepRes1, indepRes2] = await Promise.all([
      req(`/ordenes/${ordC3.id}/entrega`, { method: 'POST', token: tokenCoord, body: { contacto: 'Receptor Indep 1', documento: 'CC 123', evidencia: fileIndep1 } }),
      req(`/ordenes/${ordC4.id}/entrega`, { method: 'POST', token: tokenCoord, body: { contacto: 'Receptor Indep 2', documento: 'CC 456', evidencia: fileIndep2 } }),
    ]);
    assert.equal(indepRes1.status, 200, 'Operación concurrente con archivo independiente 1 debe responder 200');
    assert.equal(indepRes2.status, 200, 'Operación concurrente con archivo independiente 2 debe responder 200');
    console.log('    ✓ Archivos distintos en operaciones concurrentes verificados: Ambos completan con HTTP 200 sin bloqueos mutuos.');

    console.log('  ✅ 5. Asociación segura de evidencias, serialización atómica (pg_advisory_xact_lock) y separación estricta de contextos comprobadas al 100%.\n');

    // ============================================================
    // RESUMEN FINAL
    // ============================================================
    console.log('════════════════════════════════════════════════════════════════════');
    console.log('🎉 TODAS LAS PRUEBAS DE LA ETAPA 2 COMPLEMENTARIA PASARON (100% ÉXITO)');
    console.log('════════════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ Error en pruebas de Etapa 2 Complementaria:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runEtapa2Tests();
