// ============================================================
// backend/tests/flujo_integral_presentacion.test.mjs
// Escenario integral de presentación — ORVEX · Huellas Publicidad
//
// Recorre el proceso completo con INICIO DE SESIÓN REAL de los seis roles internos:
// Solicitud con anticipo → Validación → Orden → Diseño (v1, cambios, v2) → Envío a Comercial
// → Aprobación externa con evidencia → Liberación a impresión → Taller (impresión, acabados,
// despacho) → Entrega formal → Postventa → Cierre.
// Comprueba además permisos por rol, atomicidad de pagos y trazabilidad (quién, qué, cuándo).
//
// ⚠️  Escribe datos: ejecútalo SOLO contra una base QA aislada, por ejemplo:
//     DB_NAME=orvex_qa node tests/flujo_integral_presentacion.test.mjs
// ============================================================
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BASE_PROTEGIDA = 'orvex_test';
if (!process.env.DB_NAME || process.env.DB_NAME === BASE_PROTEGIDA) {
  console.error(`❌ Esta prueba escribe datos. Define DB_NAME con una base QA aislada (no ${BASE_PROTEGIDA}).`);
  process.exit(1);
}

process.env.PORT = '3093';
const { server } = require('../index.js');
const { pool } = require('../db.js');

const BASE = 'http://127.0.0.1:3093/api';
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const archivosTemporales = [];

// Credenciales de prueba definidas en database/seed-safe.js
const CUENTAS = {
  comercial: { email: 'ana.martinez@huellas.co', password: 'comercial123' },
  coordinador: { email: 'carlos.gomez@huellas.co', password: 'coord123' },
  disenador: { email: 'maria.lopez@huellas.co', password: 'diseno123' },
  operario: { email: 'pedro.morales@huellas.co', password: 'taller123' },
  postventa: { email: 'sofia.herrera@huellas.co', password: 'post123' },
  gerencia: { email: 'laura.sanchez@huellas.co', password: 'gerencia123' },
};

async function req(ruta, { method = 'GET', token = '', body } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function crearPdf(nombre) {
  const ruta = path.join(uploadDir, nombre);
  const nonce = `${Date.now()}_${Math.random()}_${nombre}`;
  fs.writeFileSync(
    ruta,
    Buffer.from(`%PDF-1.4\n% ${nonce}\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`)
  );
  archivosTemporales.push(ruta);
  return nombre;
}

let pasos = 0;
function ok(texto) {
  pasos += 1;
  console.log(`  ✓ ${String(pasos).padStart(2, '0')} ${texto}`);
}

async function ejecutar() {
  console.log(`🧪 Escenario integral de presentación ORVEX sobre la base "${process.env.DB_NAME}"\n`);

  // ---------------------------------------------------------------- 1. Autenticación real
  const tk = {};
  const perfil = {};
  for (const [rol, cred] of Object.entries(CUENTAS)) {
    const r = await req('/auth/login', { method: 'POST', body: cred });
    assert.equal(r.status, 200, `Login real de ${rol} (${cred.email})`);
    assert.ok(r.data.token, `Token JWT de ${rol}`);
    tk[rol] = r.data.token;
    perfil[rol] = r.data.usuario;
  }
  ok('Los seis roles internos inician sesión con JWT real');

  const malaClave = await req('/auth/login', { method: 'POST', body: { email: CUENTAS.comercial.email, password: 'incorrecta' } });
  assert.equal(malaClave.status, 401, 'Credenciales incorrectas → 401');
  const sinToken = await req('/ordenes');
  assert.equal(sinToken.status, 401, 'Sin token → 401');
  ok('Credenciales erróneas y peticiones sin token se rechazan (401)');

  const clientes = await req('/clientes', { token: tk.comercial });
  assert.equal(clientes.status, 200);
  const cliente = (clientes.data.data || clientes.data)[0];
  assert.ok(cliente, 'Debe existir al menos un cliente');

  // ---------------------------------------------------------------- 2. Pagos: validación y atomicidad
  const conteo = async () => {
    const r = await pool.query('SELECT (SELECT COUNT(*) FROM solicitudes)::int AS s, (SELECT COUNT(*) FROM pagos_registro)::int AS p');
    return r.rows[0];
  };
  const antes = await conteo();
  const pagoInvalido = await req('/solicitudes', {
    method: 'POST',
    token: tk.comercial,
    body: {
      clienteId: cliente.id,
      producto: 'Prueba de atomicidad',
      cantidad: 1,
      dimensiones: '1 x 1 m',
      cotizacionTotal: 100000,
      tipoPago: 'parcial',
      pagos: [{ valor: 150000, metodoPago: 'Efectivo', referencia: 'X-1' }],
    },
  });
  assert.ok(pagoInvalido.status >= 400 && pagoInvalido.status < 500, 'Abono mayor que la cotización → 4xx');
  assert.deepEqual(await conteo(), antes, 'Un registro financiero fallido no deja solicitud ni pagos parciales');
  ok('Abono superior a la cotización se rechaza sin dejar datos financieros parciales');

  const solCoord = await req('/solicitudes', {
    method: 'POST',
    token: tk.coordinador,
    body: { clienteId: cliente.id, producto: 'X', cantidad: 1, cotizacionTotal: 1000 },
  });
  assert.equal(solCoord.status, 403, 'Coordinación no registra solicitudes');
  ok('Solo Comercial / Recepción registra solicitudes (Coordinación → 403)');

  // ---------------------------------------------------------------- 3. Solicitud con anticipo
  const sol = await req('/solicitudes', {
    method: 'POST',
    token: tk.comercial,
    body: {
      clienteId: cliente.id,
      producto: 'Valla publicitaria presentación',
      cantidad: 2,
      dimensiones: '3 x 2 m',
      material: 'Lona banner 13 oz',
      acabados: 'Ojales y refuerzo',
      prioridad: 'Alta',
      metodoEntrega: 'Domicilio',
      cotizacionTotal: 1200000,
      tipoPago: 'parcial',
      pagos: [{ valor: 600000, metodoPago: 'Transferencia bancaria', referencia: 'TR-PRES-001', soporte: 'Comprobante bancario' }],
    },
  });
  assert.equal(sol.status, 201, 'Solicitud con anticipo creada');
  const solicitud = sol.data.data;
  assert.match(solicitud.id, /^SOL-/, 'La solicitud usa código SOL-');
  assert.equal(Number(solicitud.totalAbonado), 600000);
  assert.equal(Number(solicitud.saldoPendiente), 600000);
  assert.equal(solicitud.estadoPago, 'Abono parcial');
  ok(`Comercial registra ${solicitud.id} con anticipo de $600.000 y saldo de $600.000`);

  const enviar = await req(`/solicitudes/${solicitud.id}/enviar`, { method: 'PATCH', token: tk.comercial });
  assert.equal(enviar.status, 200);
  assert.equal(enviar.data.data.estado, 'En validación');

  const validarGerencia = await req(`/solicitudes/${solicitud.id}/validar`, { method: 'POST', token: tk.gerencia, body: { aprobado: true } });
  assert.equal(validarGerencia.status, 403, 'Gerencia no valida solicitudes');

  const validar = await req(`/solicitudes/${solicitud.id}/validar`, {
    method: 'POST',
    token: tk.coordinador,
    body: { aprobado: true, observaciones: 'Viable técnicamente; anticipo del 50 %' },
  });
  assert.equal(validar.status, 201, 'Coordinación valida y genera la orden');
  const ordenId = validar.data.orden.id;
  assert.match(ordenId, /^O[PR]D?-/, 'La orden usa código de orden');
  ok(`Coordinación valida la solicitud y genera la orden ${ordenId} (Gerencia → 403)`);

  const ordenIni = (await req(`/ordenes/${ordenId}`, { token: tk.coordinador })).data;
  const orden0 = ordenIni.data || ordenIni;
  assert.equal(Number(orden0.totalAbonado), 600000, 'La orden hereda el anticipo');
  assert.equal(Number(orden0.saldoPendiente), 600000, 'La orden hereda el saldo');
  assert.equal(orden0.pagos.length, 1, 'La orden hereda el registro de pago');
  ok('La orden hereda cotización, anticipo, saldo y registro de pago de la solicitud');

  // ---------------------------------------------------------------- 4. Diseño y aprobación externa
  const asignar = await req(`/ordenes/${ordenId}/asignacion`, {
    method: 'PATCH',
    token: tk.coordinador,
    body: { disenador_id: perfil.disenador.id },
  });
  assert.equal(asignar.status, 200, 'Coordinación asigna diseñador');

  const v1 = await req(`/disenos/orden/${ordenId}`, {
    method: 'POST',
    token: tk.disenador,
    body: { numero_version: 1, archivo_nombre: crearPdf(`pres_v1_${Date.now()}.pdf`), comentario: 'Propuesta inicial' },
  });
  assert.equal(v1.status, 201, 'Diseñador crea v1');
  const env1 = await req(`/disenos/orden/${ordenId}/enviar-comercial`, { method: 'PATCH', token: tk.disenador });
  assert.equal(env1.status, 200, 'Diseñador envía v1 a Comercial');
  ok('Coordinación asigna diseñador; el diseñador crea la v1 y la envía a Comercial');

  const autoAprob = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
    method: 'PATCH',
    token: tk.disenador,
    body: { accion: 'aprobar', nombreAutoriza: 'Yo mismo', evidencia: 'x' },
  });
  assert.equal(autoAprob.status, 403, 'El diseñador no aprueba su propio diseño');
  ok('El diseñador no puede aprobar su propio diseño (403)');

  const cambios = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
    method: 'PATCH',
    token: tk.comercial,
    body: { accion: 'cambios', canal: 'WhatsApp', contacto: 'Laura Gómez', observaciones: 'Aumentar el logotipo un 20 %' },
  });
  assert.equal(cambios.status, 200, 'Comercial registra solicitud de cambios del cliente');
  ok('Comercial registra que el cliente pidió cambios; vuelve al diseñador');

  const v2 = await req(`/disenos/orden/${ordenId}`, {
    method: 'POST',
    token: tk.disenador,
    body: { numero_version: 2, archivo_nombre: crearPdf(`pres_v2_${Date.now()}.pdf`), comentario: 'Logotipo +20 %' },
  });
  assert.equal(v2.status, 201, 'Diseñador crea v2');

  const evidencia = crearPdf(`pres_aprobacion_${Date.now()}.pdf`);
  const aprobSinEnviar = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
    method: 'PATCH',
    token: tk.comercial,
    body: { accion: 'aprobar', canal: 'WhatsApp', nombreAutoriza: 'Laura Gómez', evidencia },
  });
  assert.equal(aprobSinEnviar.status, 409, 'No se aprueba una versión no enviada');
  ok('Comercial no puede aprobar la v2 antes de que el diseñador se la envíe (409)');

  const liberarAntes = await req(`/disenos/orden/${ordenId}/liberar-impresion`, { method: 'PATCH', token: tk.coordinador });
  assert.ok(liberarAntes.status >= 400, 'No se libera a impresión sin aprobación válida');
  const imprimirAntes = await req(`/ordenes/${ordenId}/etapa`, { method: 'PATCH', token: tk.coordinador, body: { etapa: 4, estado: 'Impresión' } });
  assert.equal(imprimirAntes.status, 400, 'Candado RF-07: no se imprime sin aprobación');
  ok('Sin aprobación válida no hay liberación ni paso a impresión (candado RF-07)');

  const env2 = await req(`/disenos/orden/${ordenId}/enviar-comercial`, { method: 'PATCH', token: tk.disenador });
  assert.equal(env2.status, 200, 'Diseñador envía v2');

  const aprobSinEvidencia = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
    method: 'PATCH',
    token: tk.comercial,
    body: { accion: 'aprobar', canal: 'WhatsApp', nombreAutoriza: 'Laura Gómez' },
  });
  assert.equal(aprobSinEvidencia.status, 400, 'La aprobación exige evidencia');

  const aprob = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
    method: 'PATCH',
    token: tk.comercial,
    body: { accion: 'aprobar', canal: 'WhatsApp', nombreAutoriza: 'Laura Gómez', evidencia, observaciones: 'Aprobado por WhatsApp con captura' },
  });
  assert.equal(aprob.status, 200, 'Comercial registra la aprobación externa con evidencia');
  const arte = await pool.query(
    `SELECT a.numero_version, a.contacto_cliente_nombre, a.contacto_cliente_canal, a.contacto_cliente_evidencia,
            a.contacto_cliente_registrado_por_nombre, a.fecha_envio_comercial
       FROM archivos_arte a JOIN ordenes o ON o.id = a.orden_id
      WHERE o.codigo = $1 AND a.estado_aprobacion = 'aprobado'`,
    [ordenId]
  );
  assert.equal(arte.rowCount, 1, 'Exactamente una versión aprobada');
  assert.equal(arte.rows[0].numero_version, 2, 'La versión aprobada es la v2 enviada');
  assert.equal(arte.rows[0].contacto_cliente_nombre, 'Laura Gómez');
  assert.equal(arte.rows[0].contacto_cliente_canal, 'WhatsApp');
  assert.equal(arte.rows[0].contacto_cliente_evidencia, evidencia);
  assert.ok(arte.rows[0].fecha_envio_comercial, 'Se conserva la fecha de envío a Comercial');
  ok('Aprobación externa de la v2: quién autorizó, canal, evidencia y registrador quedan persistidos');

  // ---------------------------------------------------------------- 5. Liberación e impresión
  const liberarOperario = await req(`/disenos/orden/${ordenId}/liberar-impresion`, { method: 'PATCH', token: tk.operario });
  assert.equal(liberarOperario.status, 403, 'Operario no libera a impresión');
  const liberarComercial = await req(`/disenos/orden/${ordenId}/liberar-impresion`, { method: 'PATCH', token: tk.comercial });
  assert.equal(liberarComercial.status, 403, 'Comercial no libera a impresión');
  const liberar = await req(`/disenos/orden/${ordenId}/liberar-impresion`, { method: 'PATCH', token: tk.coordinador });
  assert.equal(liberar.status, 200, 'Coordinación libera a impresión');
  ok('Solo Coordinación libera a impresión (Operario y Comercial → 403)');

  const etapaGerencia = await req(`/ordenes/${ordenId}/etapa`, { method: 'PATCH', token: tk.gerencia, body: { etapa: 4, estado: 'Impresión' } });
  assert.equal(etapaGerencia.status, 403, 'Gerencia no cambia etapas');
  const imprimir = await req(`/ordenes/${ordenId}/etapa`, { method: 'PATCH', token: tk.coordinador, body: { etapa: 4, estado: 'Impresión' } });
  assert.equal(imprimir.status, 200, 'Orden pasa a Impresión');
  ok('La orden pasa a Impresión (Gerencia no ejecuta acciones operativas → 403)');

  // ---------------------------------------------------------------- 6. Taller: impresión, acabados, despacho
  const etapasTaller = [
    { etapa: 'Impresión', titulo: 'Impresión gran formato' },
    { etapa: 'Acabados', titulo: 'Ojales y refuerzo perimetral' },
    { etapa: 'Despacho', titulo: 'Embalaje y despacho' },
  ];
  for (const [i, t] of etapasTaller.entries()) {
    if (i > 0) {
      const avance = await req(`/ordenes/${ordenId}/etapa`, {
        method: 'PATCH',
        token: tk.coordinador,
        body: { etapa: 4 + i, estado: t.etapa },
      });
      assert.equal(avance.status, 200, `Orden pasa a ${t.etapa}`);
    }
    const tarea = await req('/tareas', {
      method: 'POST',
      token: tk.coordinador,
      body: { orden_id: ordenId, titulo: t.titulo, responsable: perfil.operario.nombre, owner_id: perfil.operario.id, etapa: t.etapa, prioridad: 'Alta' },
    });
    assert.equal(tarea.status, 201, `Tarea de ${t.etapa} asignada`);
    const tareaId = tarea.data.data.id;
    const iniciar = await req(`/tareas/${tareaId}/accion`, { method: 'PATCH', token: tk.operario, body: { accion: 'iniciar' } });
    assert.equal(iniciar.status, 200, `Operario inicia ${t.etapa}`);
    const nota = await req(`/tareas/${tareaId}/notas`, { method: 'POST', token: tk.operario, body: { texto: `Avance de ${t.etapa} registrado en planta.` } });
    assert.equal(nota.status, 201);
    const fin = await req(`/tareas/${tareaId}/avance`, { method: 'PATCH', token: tk.operario, body: { porcentaje: 100, estado: 'Finalizada' } });
    assert.equal(fin.status, 200, `Operario finaliza ${t.etapa}`);
    assert.equal(fin.data.data.estado, 'Finalizada');
  }
  const etapaOperario = await req(`/ordenes/${ordenId}/etapa`, { method: 'PATCH', token: tk.operario, body: { etapa: 7, estado: 'Entrega' } });
  assert.equal(etapaOperario.status, 403, 'Operario no cambia la etapa global');
  ok('El operario registra inicio, notas y cierre de impresión, acabados y despacho (sin cambiar etapas → 403)');

  const aEntrega = await req(`/ordenes/${ordenId}/etapa`, { method: 'PATCH', token: tk.coordinador, body: { etapa: 7, estado: 'Entrega' } });
  assert.equal(aEntrega.status, 200, 'Orden pasa a Entrega');

  // ---------------------------------------------------------------- 7. Entrega
  const entregaSinEvidencia = await req(`/ordenes/${ordenId}/entrega`, {
    method: 'POST',
    token: tk.coordinador,
    body: { contacto: 'Laura Gómez', conformidad: 'Conforme' },
  });
  assert.ok(entregaSinEvidencia.status >= 400, 'La entrega formal exige evidencia');
  const entrega = await req(`/ordenes/${ordenId}/entrega`, {
    method: 'POST',
    token: tk.coordinador,
    body: {
      contacto: 'Laura Gómez',
      documento: 'CC 52.000.000',
      cargo: 'Jefe de mercadeo',
      conformidad: 'Conforme',
      observaciones: 'Instalada y recibida a satisfacción',
      evidencia: crearPdf(`pres_remision_${Date.now()}.pdf`),
      evidencia_tipo: 'entrega_formal',
    },
  });
  assert.equal(entrega.status, 200, 'Entrega formal registrada');
  ok('Entrega formal con evidencia registrada (sin evidencia se rechaza)');

  // ---------------------------------------------------------------- 8. Postventa y cierre
  const casoGerencia = await req('/postventa', {
    method: 'POST',
    token: tk.gerencia,
    body: { orden_id: ordenId, categoria: 'Reclamo', subtipo: 'Reclamo', motivo: 'x', descripcion: 'x' },
  });
  assert.equal(casoGerencia.status, 403, 'Gerencia no radica casos');

  const caso = await req('/postventa', {
    method: 'POST',
    token: tk.postventa,
    body: {
      orden_id: ordenId,
      categoria: 'Reclamo',
      subtipo: 'Reclamo',
      tipo: 'Reclamo',
      motivo: 'Diferencia de tono en una esquina',
      descripcion: 'El cliente reporta una leve diferencia de color en la esquina inferior.',
      prioridad: 'Media',
    },
  });
  assert.equal(caso.status, 201, 'Postventa radica el caso');
  const casoId = caso.data.data.id;
  assert.match(String(casoId), /^CAS-/, 'El caso usa código CAS-');
  ok(`Postventa radica ${casoId} sobre la orden entregada (Gerencia → 403)`);

  const cierrePrematuro = await req(`/ordenes/${ordenId}/cerrar`, { method: 'POST', token: tk.coordinador, body: { motivo: 'Cierre' } });
  assert.equal(cierrePrematuro.status, 409, 'No se cierra con caso abierto');

  const resolver = await req(`/postventa/${casoId}/resolver`, {
    method: 'PATCH',
    token: tk.postventa,
    body: { solucion: 'Se verificó el tono con el cliente; queda conforme', accionCorrectiva: 'Calibración de perfil ICC' },
  });
  assert.equal(resolver.status, 200, 'Postventa resuelve el caso');

  const cierre = await req(`/ordenes/${ordenId}/cerrar`, { method: 'POST', token: tk.coordinador, body: { motivo: 'Proceso completo y caso resuelto' } });
  assert.equal(cierre.status, 200, 'Orden cerrada');
  ok('El cierre se bloquea con el caso abierto y procede al resolverlo');

  // ---------------------------------------------------------------- 9. Trazabilidad y supervisión
  const hist = await req(`/ordenes/${ordenId}/historial`, { token: tk.gerencia });
  assert.equal(hist.status, 200, 'Gerencia consulta la trazabilidad');
  const eventos = hist.data.data || [];
  assert.ok(eventos.length >= 8, `Historial con eventos suficientes (${eventos.length})`);
  for (const e of eventos) {
    assert.ok(e.responsable || e.responsable_nombre || e.usuario, 'Cada evento identifica quién');
    assert.ok(e.fecha || e.fecha_texto || e.created_at, 'Cada evento identifica cuándo');
  }
  const textos = eventos.map((e) => `${e.actividad || e.accion_texto || ''}`.toLowerCase()).join(' | ');
  for (const clave of ['aprob', 'impres', 'entrega']) {
    assert.ok(textos.includes(clave), `El historial registra "${clave}"`);
  }
  ok(`Trazabilidad: ${eventos.length} eventos con responsable y fecha, incluida aprobación, impresión y entrega`);

  const final = (await req(`/ordenes/${ordenId}`, { token: tk.gerencia })).data;
  const ordenFinal = final.data || final;
  assert.ok(['Cerrada', 'Postventa'].includes(ordenFinal.estado) || ordenFinal.fechaCierre, 'Estado final de cierre');
  const dash = await req('/dashboard', { token: tk.gerencia });
  assert.equal(dash.status, 200, 'Gerencia consulta indicadores');
  ok(`Gerencia supervisa el resultado: orden en estado "${ordenFinal.estado}" e indicadores disponibles`);

  console.log(`\n🎉 ESCENARIO INTEGRAL COMPLETADO: ${pasos} verificaciones superadas.`);
}

ejecutar()
  .catch((err) => {
    console.error('\n❌ Falla en el escenario integral:', err.message);
    if (err.actual !== undefined) console.error('   obtenido:', err.actual, '| esperado:', err.expected);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const f of archivosTemporales) {
      try { fs.unlinkSync(f); } catch {}
    }
    server.close();
    await pool.end();
  });
