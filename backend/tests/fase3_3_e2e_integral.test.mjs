// ============================================================
// backend/tests/fase3_3_e2e_integral.test.mjs
// Suite de Validación Integral de Principio a Fin — Fase 3.3
// ORVEX — Huellas Publicidad
// ============================================================
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

process.env.PORT = '3094';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');

const BASE = 'http://127.0.0.1:3094/api';
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

function crearArchivoPdfValido(nombre) {
  const ruta = path.join(uploadDir, nombre);
  const nonce = `${Date.now()}_${Math.random()}_${nombre}`;
  const contenido = Buffer.concat([
    Buffer.from(`%PDF-1.4\n%âãÏÓ\n% UniqueNonce: ${nonce}\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`),
    Buffer.from('xref\n0 2\n0000000000 65535 f \n0000000018 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n70\n%%EOF'),
  ]);
  fs.writeFileSync(ruta, contenido);
  return ruta;
}

async function runFase33Tests() {
  console.log('🧪 [FASE 3.3] INICIANDO VALIDACIÓN INTEGRAL DEL SISTEMA ORVEX (E2E)...');
  console.log(`🚀 Conectado al servidor en ${BASE} con PostgreSQL (orvex_test)\n`);

  const archivosLimpieza = [];

  try {
    // ------------------------------------------------------------
    // 0. Preparar tokens para los 7 roles del sistema
    // ------------------------------------------------------------
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

    // Cliente Alpina de prueba
    const { rows: clientesExistentes } = await pool.query("SELECT * FROM clientes WHERE empresa ILIKE '%alpina%' LIMIT 1");
    const clienteExistente = clientesExistentes[0] || (await pool.query('SELECT * FROM clientes LIMIT 1')).rows[0];
    const tokenCliente = generarToken({ id: clienteExistente.id, email: clienteExistente.email || 'cliente@test.com', rol: 'cliente', nombre_completo: clienteExistente.contacto_principal || 'Cliente Test' });

    console.log('📌 0. Autenticación y tokens verificados para los 7 roles.');

    // ------------------------------------------------------------
    // 1. FLUJO COMERCIAL: Registrar clientes, crear solicitudes y enviarlas
    // ------------------------------------------------------------
    console.log('\n📌 1. Validación de Flujo Comercial...');
    const codCliTest = `CLI-F33-${Date.now().toString().slice(-4)}`;
    const resCliIncompleto = await req('/clientes', {
      method: 'POST',
      token: tokenComercial,
      body: { empresa: 'Incompleto Sin NIT' },
    });
    assert.equal(resCliIncompleto.status, 400, 'Crear cliente sin campos requeridos debe retornar 400');
    console.log('    ✓ Validación de datos obligatorios en cliente comprobada (HTTP 400).');

    const resCliNoAutorizado = await req('/clientes', {
      method: 'POST',
      token: tokenOperario,
      body: { codigo: codCliTest, empresa: 'Cliente Hack', nit: '900.999.888-1' },
    });
    assert.equal(resCliNoAutorizado.status, 403, 'Operario no puede registrar clientes (HTTP 403)');
    console.log('    ✓ Bloqueo RBAC a Operario en clientes comprobado (HTTP 403).');

    const resCliValido = await req('/clientes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        codigo: codCliTest,
        empresa: `Corporación E2E Fase 3.3 ${Date.now()}`,
        nit: `901.${Date.now().toString().slice(-6)}-1`,
        contacto: 'Alejandro Morales',
        telefono: '312 999 8877',
        correo: 'alejandro.morales@e2e-f33.com',
        direccion: 'Av. El Dorado # 68C-20',
        ciudad: 'Bogotá',
      },
    });
    assert.equal(resCliValido.status, 201, 'Comercial debe crear cliente nuevo exitosamente');
    const nuevoCliente = resCliValido.data.data;
    console.log(`    ✓ Cliente creado exitosamente: ${nuevoCliente.id} (${nuevoCliente.empresa}).`);

    // Bloqueo a Coordinador creando solicitudes en borrador (exclusivo Comercial)
    const resSolCoordBloqueado = await req('/solicitudes', {
      method: 'POST',
      token: tokenCoord,
      body: { clienteId: nuevoCliente.id, producto: 'Pendón Prohibido' },
    });
    assert.equal(resSolCoordBloqueado.status, 403, 'Coordinador no puede crear solicitudes en borrador (HTTP 403)');
    console.log('    ✓ Bloqueo RBAC a Coordinación en creación de solicitudes comprobado (HTTP 403).');

    // Creación exitosa por Comercial
    const codSolTest = `SOL-F33-${Date.now().toString().slice(-4)}`;
    const resSolCrear = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        codigo: codSolTest,
        clienteId: nuevoCliente.id,
        producto: 'Valla Perimetral E2E F33',
        cantidad: 2,
        dimensiones: '6.00 x 3.00 m',
        material: 'Lona Banner 13oz',
        prioridad: 'Alta',
        metodoEntrega: 'Instalación en sitio',
        acabados: 'Refuerzo perimetral y ojales cada 30cm',
        fechaEntrega: '2026-11-20',
        presupuesto: 1850000,
        requerimientos: 'Impresión resistente a intemperie con tintas UV',
        observaciones: 'Acceso por rampa sur',
      },
    });
    assert.equal(resSolCrear.status, 201, 'Comercial crea solicitud en borrador');
    const nuevaSol = resSolCrear.data.data;
    assert.equal(nuevaSol.estado, 'Pendiente', 'Estado inicial debe ser Pendiente');
    console.log(`    ✓ Solicitud comercial creada: ${nuevaSol.id} en estado ${nuevaSol.estado}.`);

    // Envío a validación técnica
    const resSolEnviar = await req(`/solicitudes/${nuevaSol.id}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(resSolEnviar.status, 200, 'Comercial envía solicitud a validación');
    assert.equal(resSolEnviar.data.data.estado, 'En validación');
    console.log(`    ✓ Solicitud ${nuevaSol.id} enviada formalmente a validación técnica (HTTP 200).`);

    // ------------------------------------------------------------
    // 2. FLUJO COORDINACIÓN: Devolver, rechazar y convertir en OP
    // ------------------------------------------------------------
    console.log('\n📌 2. Validación de Flujo Coordinación & Validación Técnica...');
    // Devolución con motivo
    const resSolDevolver = await req(`/solicitudes/${nuevaSol.id}/devolver`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { motivo: 'Favor confirmar si incluye estructura metálica o solo lona tensada.' },
    });
    assert.equal(resSolDevolver.status, 200, 'Coordinador devuelve solicitud');
    assert.equal(resSolDevolver.data.data.estado, 'Devuelta para corrección');
    console.log('    ✓ Devolución con observaciones técnicas verificada (HTTP 200).');

    // Comercial la reenvía corregida a validación
    const resSolReenviar = await req(`/solicitudes/${nuevaSol.id}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(resSolReenviar.status, 200, 'Comercial reenvía solicitud corregida');
    assert.equal(resSolReenviar.data.data.estado, 'En validación');
    console.log('    ✓ Reenvío a validación verificado.');

    // Comercial intenta validarla (bloqueo HTTP 403)
    const resValidarComercial = await req(`/solicitudes/${nuevaSol.id}/validar`, {
      method: 'POST',
      token: tokenComercial,
    });
    assert.equal(resValidarComercial.status, 403, 'Comercial no puede aprobar solicitudes (HTTP 403)');
    console.log('    ✓ Bloqueo RBAC a Comercial en validación de solicitudes verificado (HTTP 403).');

    // Coordinador valida y genera la Orden de Producción formal (HU-06)
    const resValidarCoord = await req(`/solicitudes/${nuevaSol.id}/validar`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(resValidarCoord.status, 201, 'Coordinador valida y convierte solicitud a orden (HTTP 201)');
    const ordenGenerada = resValidarCoord.data.orden;
    assert.ok(ordenGenerada && ordenGenerada.id, 'Debe retornar la orden completa');
    assert.equal(resValidarCoord.data.data.estado, 'Aprobada');
    console.log(`    ✓ Orden generada transaccionalmente: ${ordenGenerada.id} en etapa "${ordenGenerada.estado}".`);

    // INTEGRIDAD: Intentar validar la misma solicitud por segunda vez -> 409 Conflict (Una solicitud no puede generar dos órdenes)
    const resDuplicadaSol = await req(`/solicitudes/${nuevaSol.id}/validar`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(resDuplicadaSol.status, 409, 'Revalidación duplicada debe retornar 409 Conflict');
    console.log('    ✓ Integridad confirmada: Una solicitud no puede generar órdenes duplicadas (HTTP 409).');

    // ------------------------------------------------------------
    // 3. FLUJO DISEÑO: Asignación, versiones y propuestas
    // ------------------------------------------------------------
    console.log('\n📌 3. Validación de Flujo Diseño & Gestión de Propuestas...');
    // Coordinador asigna diseñador a la orden
    const resAsignarDiseno = await req(`/ordenes/${ordenGenerada.id}/asignacion`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { disenador_id: uDisenador.id },
    });
    assert.equal(resAsignarDiseno.status, 200, 'Asignación de diseñador exitosa');
    console.log(`    ✓ Diseñador asignado a orden ${ordenGenerada.id}.`);

    // Diseñador registra versión 1
    const fileArteV1 = `arte_v1_${Date.now()}.pdf`;
    crearArchivoPdfValido(fileArteV1);
    archivosLimpieza.push(path.join(uploadDir, fileArteV1));

    const resCrearV1 = await req(`/disenos/orden/${ordenGenerada.id}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        numero_version: 1,
        ruta_archivo: `uploads/${fileArteV1}`,
        archivo_nombre: fileArteV1,
        comentario: 'Propuesta inicial de valla con paleta corporativa',
      },
    });
    assert.equal(resCrearV1.status, 201, 'Diseñador crea versión 1');
    const v1Arte = resCrearV1.data.data;
    console.log(`    ✓ Versión 1 registrada: ${v1Arte.archivoNombre} (Estado: ${v1Arte.estado}).`);

    // Diseñador envía propuesta a revisión
    const resEnviarDiseno = await req(`/disenos/orden/${ordenGenerada.id}/enviar`, {
      method: 'PATCH',
      token: tokenDisenador,
    });
    assert.equal(resEnviarDiseno.status, 200, 'Diseñador envía propuesta a revisión');
    console.log('    ✓ Propuesta enviada formalmente al cliente/coordinación.');

    // Cliente rechaza versión 1 solicitando ajustes tipográficos
    const resRechazarV1 = await req(`/disenos/orden/${ordenGenerada.id}/aprobacion`, {
      method: 'PATCH',
      token: tokenCliente,
      body: {
        estado_aprobacion: 'rechazado',
        comentario: 'Aumentar tamaño del imagotipo y ajustar contraste de texto legal',
      },
    });
    assert.equal(resRechazarV1.status, 200, 'Cliente rechaza versión 1 con observaciones');
    console.log('    ✓ Rechazo formal de versión 1 registrado con observaciones.');

    // Diseñador registra versión 2 con los ajustes requeridos
    const fileArteV2 = `arte_v2_${Date.now()}.pdf`;
    crearArchivoPdfValido(fileArteV2);
    archivosLimpieza.push(path.join(uploadDir, fileArteV2));

    const resCrearV2 = await req(`/disenos/orden/${ordenGenerada.id}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        numero_version: 2,
        ruta_archivo: `uploads/${fileArteV2}`,
        archivoNombre: fileArteV2,
        comentario: 'Ajuste de imagotipo (+25%) y contraste reforzado según feedback',
      },
    });
    assert.equal(resCrearV2.status, 201, 'Diseñador crea versión 2');
    console.log('    ✓ Versión 2 registrada con ajustes implementados.');

    // ------------------------------------------------------------
    // 4. FLUJO APROBACIONES & CANDADO DE CALIDAD: Bloqueo sin arte
    // ------------------------------------------------------------
    console.log('\n📌 4. Validación de Candados de Calidad y Aprobación Formal...');
    // Intento de avance a Impresión cuando v2 aún está pendiente/sin aprobar formalmente -> 400 Bad Request
    const resAvanceBloqueado = await req(`/ordenes/${ordenGenerada.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceBloqueado.status, 400, 'Debe bloquear paso a impresión sin aprobación formal');
    assert.equal(resAvanceBloqueado.data.bloqueada, true, 'Orden debe marcarse como bloqueada por candado');
    console.log('    ✓ Candado de calidad verificado: Avance a Impresión estrictamente bloqueado (HTTP 400).');

    // Aprobación formal de v2 con evidencia auténtica
    const fileSoporteAprob = `soporte_aprobacion_${Date.now()}.pdf`;
    crearArchivoPdfValido(fileSoporteAprob);
    archivosLimpieza.push(path.join(uploadDir, fileSoporteAprob));

    const resAprobarV2 = await req(`/disenos/orden/${ordenGenerada.id}/aprobacion`, {
      method: 'PATCH',
      token: tokenCliente,
      body: {
        estado_aprobacion: 'aprobado',
        tipo_aprobacion: 'externa',
        soporte_evidencia: fileSoporteAprob,
        soporte_tipo: 'aprobacion_diseno',
        comentario: 'Aprobación formal con acta física firmada por el cliente',
      },
    });
    assert.equal(resAprobarV2.status, 200, 'Aprobación formal de versión 2 exitosa');
    console.log('    ✓ Aprobación formal de diseño v2 registrada con soporte físico verificado.');

    // Con diseño aprobado: Coordinador avanza exitosamente a Impresión (etapa 4 en BD / etapa 3 UI)
    const resAvanceExitoso = await req(`/ordenes/${ordenGenerada.id}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceExitoso.status, 200, 'Avance a Impresión exitoso tras aprobación');
    console.log('    ✓ Orden avanzada formalmente a Impresión tras liberar el candado.');

    // ------------------------------------------------------------
    // 5. FLUJO PRODUCCIÓN / TALLER: Tareas, avance, pausa y aislamiento
    // ------------------------------------------------------------
    console.log('\n📌 5. Validación de Flujo Producción & Actividades de Taller...');
    // Coordinador asigna tarea al Operario Pedro Morales
    const resCrearTarea = await req('/tareas', {
      method: 'POST',
      token: tokenCoord,
      body: {
        orden_id: ordenGenerada.id,
        titulo: 'Impresión UV en Gran Formato F33',
        responsable: uOperario.nombre_completo,
        owner_id: uOperario.id,
        etapa: 'Impresión',
        prioridad: 'Alta',
      },
    });
    assert.equal(resCrearTarea.status, 201, 'Coordinador asigna tarea de taller');
    const tareaProd = resCrearTarea.data.data;
    console.log(`    ✓ Tarea asignada a operario: ${tareaProd.id} (${tareaProd.titulo}).`);

    // Operario inicia tarea
    const resIniciarTarea = await req(`/tareas/${tareaProd.id}/accion`, {
      method: 'PATCH',
      token: tokenOperario,
      body: { accion: 'iniciar' },
    });
    assert.equal(resIniciarTarea.status, 200, 'Operario inicia tarea');
    assert.equal(resIniciarTarea.data.data.estado, 'En proceso');
    console.log('    ✓ Tarea iniciada por operario (En proceso).');

    // Operario registra notas/novedades
    const resNotaTarea = await req(`/tareas/${tareaProd.id}/notas`, {
      method: 'POST',
      token: tokenOperario,
      body: { texto: 'Iniciando calibración de cabezales y prueba de color a 720 dpi.' },
    });
    assert.equal(resNotaTarea.status, 201, 'Nota agregada (HTTP 201)');
    console.log('    ✓ Novedad operativa registrada en bitácora.');

    // Operario pausa tarea
    const resPausarTarea = await req(`/tareas/${tareaProd.id}/accion`, {
      method: 'PATCH',
      token: tokenOperario,
      body: { accion: 'pausar' },
    });
    assert.equal(resPausarTarea.status, 200, 'Operario pausa tarea');
    assert.equal(resPausarTarea.data.data.estado, 'Pausada');
    console.log('    ✓ Pausa temporal de actividad registrada.');

    // Aislamiento operativo: Diseñador intenta alterar el avance de la tarea del operario -> 403 Forbidden
    const resAislamientoBloqueado = await req(`/tareas/${tareaProd.id}/avance`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { porcentaje: 80, estado: 'En proceso' },
    });
    assert.equal(resAislamientoBloqueado.status, 403, 'Aislamiento de tareas operativas debe retornar 403');
    console.log('    ✓ Aislamiento de tareas comprobado: Diseñador no puede alterar tareas de operarios (HTTP 403).');

    // Operario intentando cambiar etapa global de la orden -> 403 Forbidden
    const resOperarioCambioEtapa = await req(`/ordenes/${ordenGenerada.id}/etapa`, {
      method: 'PATCH',
      token: tokenOperario,
      body: { etapa: 5, estado: 'Acabados' },
    });
    assert.equal(resOperarioCambioEtapa.status, 403, 'Operario no puede cambiar etapa global de la orden (HTTP 403)');
    console.log('    ✓ Bloqueo RBAC a Operario en transición global de etapa comprobado (HTTP 403).');

    // Operario reanuda y completa tarea al 100%
    const resCompletarTarea = await req(`/tareas/${tareaProd.id}/avance`, {
      method: 'PATCH',
      token: tokenOperario,
      body: { porcentaje: 100, estado: 'Finalizada' },
    });
    assert.equal(resCompletarTarea.status, 200, 'Tarea finalizada al 100%');
    assert.equal(resCompletarTarea.data.data.estado, 'Finalizada');
    console.log('    ✓ Tarea operativa completada al 100% por el operario.');

    // ------------------------------------------------------------
    // 6. FLUJO INVENTARIO: Reservas, existencias y control de consumos
    // ------------------------------------------------------------
    console.log('\n📌 6. Validación de Flujo Inventario, Reservas y Consumos...');
    const resInvList = await req('/inventario', { token: tokenCoord });
    assert.equal(resInvList.status, 200, 'Consulta de catálogo de inventario');
    const materialLona = resInvList.data.data.find((m) => m.nombre.toLowerCase().includes('lona')) || resInvList.data.data[0];
    const stockReservadoPrevio = materialLona.stockReservado;
    console.log(`    ✓ Material seleccionado: ${materialLona.nombre} (Stock actual: ${materialLona.stockActual}, Reservado: ${stockReservadoPrevio}).`);

    // Reserva formal de material
    const resReserva = await req('/inventario/reservar', {
      method: 'POST',
      token: tokenCoord,
      body: {
        orden_id: ordenGenerada.id,
        material_id: materialLona.dbId,
        cantidad_requerida: 5,
      },
    });
    assert.equal(resReserva.status, 201, 'Reserva de material exitosa');
    console.log('    ✓ Reserva de 5 unidades registrada en inventario.');

    // Liberación formal de reserva
    const resLiberar = await req(`/inventario/liberar/${ordenGenerada.id}`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(resLiberar.status, 200, 'Liberación de reservas');
    assert.equal(resLiberar.data.liberadas, 1, 'Debe liberar 1 registro de reserva');
    console.log('    ✓ Liberación de reserva verificada.');

    // ------------------------------------------------------------
    // 7. FLUJO DESPACHO & ENTREGA FORMAL
    // ------------------------------------------------------------
    console.log('\n📌 7. Validación de Flujo Despacho & Entrega Formal...');
    // Coordinador avanza orden a Acabados (etapa 5), Despacho (etapa 6) y Entrega (etapa 7)
    await req(`/ordenes/${ordenGenerada.id}/etapa`, { method: 'PATCH', token: tokenCoord, body: { etapa: 5, estado: 'Acabados' } });
    await req(`/ordenes/${ordenGenerada.id}/etapa`, { method: 'PATCH', token: tokenCoord, body: { etapa: 6, estado: 'Despacho' } });
    await req(`/ordenes/${ordenGenerada.id}/etapa`, { method: 'PATCH', token: tokenCoord, body: { etapa: 7, estado: 'Entrega' } });

    // Intento no autorizado: Operario y Comercial intentando registrar entrega -> 403 Forbidden
    const resEntregaOperario = await req(`/ordenes/${ordenGenerada.id}/entrega`, {
      method: 'POST',
      token: tokenOperario,
      body: { destinatario: 'Recepción Alpina' },
    });
    assert.equal(resEntregaOperario.status, 403, 'Operario no puede registrar entrega formal (HTTP 403)');
    console.log('    ✓ Bloqueo RBAC a Operario en entrega formal verificado (HTTP 403).');

    // Coordinador registra entrega formal con evidencia válida
    const fileRemisionF33 = `remision_entrega_${Date.now()}.pdf`;
    crearArchivoPdfValido(fileRemisionF33);
    archivosLimpieza.push(path.join(uploadDir, fileRemisionF33));

    const resEntregaFormal = await req(`/ordenes/${ordenGenerada.id}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Alejandro Morales - Jefe de Almacén',
        documento: 'CC 79.450.812',
        cargo: 'Jefe de Almacén',
        conformidad: 'Conforme',
        observaciones: 'Entregado a conformidad en portería principal',
        evidencia: fileRemisionF33,
        evidencia_tipo: 'entrega_formal',
      },
    });
    assert.equal(resEntregaFormal.status, 200, 'Entrega formal registrada');
    assert.equal(resEntregaFormal.data.data.estado, 'Entrega');
    console.log('    ✓ Entrega formal documentada con destinatario, cédula y acta digital verificada.');

    // ------------------------------------------------------------
    // 8. FLUJO POSTVENTA, GARANTÍA Y REIMPRESIÓN TRAZABLE
    // ------------------------------------------------------------
    console.log('\n📌 8. Validación de Postventa, Garantía y Reimpresión Trazable...');
    // Radicación de caso de garantía postventa
    const resCrearCaso = await req('/postventa', {
      method: 'POST',
      token: tokenPostventa,
      body: {
        orden_id: ordenGenerada.id,
        tipo: 'Garantía',
        categoria: 'Garantía',
        subtipo: 'Garantía',
        motivo: 'Falla menor en ojal lateral derecho durante montaje',
        descripcion: 'Cliente reporta rasgadura parcial en el ojal inferior derecho.',
        prioridad: 'Alta',
      },
    });
    assert.equal(resCrearCaso.status, 201, 'Caso de garantía radicado exitosamente');
    const casoPostventa = resCrearCaso.data.data;
    console.log(`    ✓ Caso de garantía radicado: ${casoPostventa.id} (${casoPostventa.motivo}).`);

    // INTEGRIDAD: Intento de cerrar la orden original con caso de postventa abierto -> 409 Conflict
    const resCierreConCasoAbierto = await req(`/ordenes/${ordenGenerada.id}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Intento de cierre prematuro' },
    });
    assert.equal(resCierreConCasoAbierto.status, 409, 'Debe bloquear cierre de orden con caso pendiente');
    assert.match(resCierreConCasoAbierto.data.error, /caso\(s\) de postventa sin resolver/i);
    console.log('    ✓ Integridad confirmada: Bloqueo de cierre formal de orden con postventa abierta (HTTP 409).');

    // Emisión de orden de reposición / reimpresión por garantía
    const resClonarReimpresion = await req(`/ordenes/${ordenGenerada.id}/clonar`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        motivo: 'Reposición por garantía aprobada caso postventa',
        caso_id: casoPostventa.uuid || casoPostventa.id,
      },
    });
    assert.equal(resClonarReimpresion.status, 201, 'Orden de reimpresión autorizada y generada');
    const ordenReimpresion = resClonarReimpresion.data.data;
    assert.equal(ordenReimpresion.presupuesto, 0, 'Reimpresión por garantía debe tener presupuesto $0 COP');
    console.log(`    ✓ Orden de reposición autorizada: ${ordenReimpresion.id} (Costo: $0 COP, Vinculada a OP origen y caso).`);

    // Prevención de duplicidad: intentar autorizar una segunda reimpresión para el mismo caso -> 409 Conflict
    const resReimpresionDuplicada = await req(`/ordenes/${ordenGenerada.id}/clonar`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        motivo: 'Intento de duplicidad de reposición',
        caso_id: casoPostventa.uuid || casoPostventa.id,
      },
    });
    assert.equal(resReimpresionDuplicada.status, 409, 'Duplicidad de reimpresión debe retornar 409 Conflict');
    console.log('    ✓ Integridad confirmada: Bloqueo de reposición duplicada para el mismo caso (HTTP 409).');

    // Resolución formal del caso de postventa
    const resResolverCaso = await req(`/postventa/${casoPostventa.id}/resolver`, {
      method: 'PATCH',
      token: tokenPostventa,
      body: {
        dictamenGarantia: 'Aprobada',
        justificacionDictamen: 'Defecto de confección en termosellado cubierto por póliza de garantía',
        accionCorrectiva: 'Se emitió OP de reposición con refuerzo triple en esquinas',
        solucion: 'Reposición entregada satisfactoriamente al cliente',
      },
    });
    assert.equal(resResolverCaso.status, 200, 'Caso de garantía resuelto formalmente');
    console.log('    ✓ Caso de garantía resuelto formalmente con dictamen técnico.');

    // INTEGRIDAD: Intento de cerrar la orden original mientras la reposición esté en proceso -> 409 Conflict
    const resCierreConReposicionPendiente = await req(`/ordenes/${ordenGenerada.id}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Intento de cierre con reposición en proceso' },
    });
    assert.equal(resCierreConReposicionPendiente.status, 409, 'Debe bloquear cierre si la reposición no se ha entregado');
    assert.match(resCierreConReposicionPendiente.data.error, /reposición por garantía .* pendientes de entrega formal/i);
    console.log('    ✓ Integridad confirmada: Bloqueo de cierre con reposición de garantía pendiente (HTTP 409).');

    // Entrega formal de la orden de reposición
    const fileRemisionReposicion = `remision_reposicion_${Date.now()}.pdf`;
    crearArchivoPdfValido(fileRemisionReposicion);
    archivosLimpieza.push(path.join(uploadDir, fileRemisionReposicion));

    const resEntregaReposicion = await req(`/ordenes/${ordenReimpresion.id}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Alejandro Morales - Recepción',
        documento: 'CC 79.450.812',
        cargo: 'Jefe de Almacén',
        conformidad: 'Conforme',
        observaciones: 'Reposición por garantía entregada e instalada a total satisfacción',
        evidencia: fileRemisionReposicion,
        evidencia_tipo: 'entrega_formal',
      },
    });
    assert.equal(resEntregaReposicion.status, 200, 'Entrega de reposición exitosa');
    console.log(`    ✓ Reposición ${ordenReimpresion.id} entregada formalmente.`);

    // Cierre formal de la orden original tras resolver el caso y entregar la reposición
    const resCierreExitoso = await req(`/ordenes/${ordenGenerada.id}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Cierre formal definitivo tras resolución de garantía y satisfacción' },
    });
    assert.equal(resCierreExitoso.status, 200, 'Cierre de orden completado exitosamente');
    console.log(`    ✓ Orden original ${ordenGenerada.id} cerrada formalmente (HTTP 200).`);

    // ------------------------------------------------------------
    // 9. FLUJO GERENCIA, DESACOPLAMIENTO & SEGREGACIÓN FINANCIERA
    // ------------------------------------------------------------
    console.log('\n📌 9. Validación de Gerencia, Desacoplamiento & Segregación Financiera...');
    // Consultar Dashboard de Gerencia
    const resDash = await req('/dashboard', { token: tokenGerente });
    assert.equal(resDash.status, 200, 'Consulta de dashboard de gerencia');
    assert.ok(resDash.data.resumen, 'Métricas ejecutivas presentes');
    console.log('    ✓ Dashboard ejecutivo consultado con métricas reales de PostgreSQL.');

    // Consultar Usuarios
    const resUsuarios = await req('/usuarios', { token: tokenGerente });
    assert.equal(resUsuarios.status, 200, 'Consulta de catálogo de usuarios');
    assert.ok(resUsuarios.data.data.length >= 7, 'Deben existir todos los usuarios de la organización');
    console.log('    ✓ Directorio de usuarios y roles consultado por Gerencia.');

    // Consultar Auditoría / Historial cronológico inmutable
    const resHistorial = await req(`/ordenes/${ordenGenerada.id}/historial`, { token: tokenGerente });
    assert.equal(resHistorial.status, 200, 'Historial de auditoría accesible');
    assert.ok(resHistorial.data.data.length >= 5, 'Deben registrarse todos los eventos de auditoría');
    console.log(`    ✓ Trazabilidad inmutable verificada: ${resHistorial.data.data.length} eventos de auditoría registrados.`);

    // Desacoplamiento de operaciones de taller: Gerencia intentando cambiar etapa de orden -> 403 Forbidden
    const resGerenteEtapaBloqueado = await req(`/ordenes/${ordenGenerada.id}/etapa`, {
      method: 'PATCH',
      token: tokenGerente,
      body: { etapa: 3, estado: 'Aprobación' },
    });
    assert.equal(resGerenteEtapaBloqueado.status, 403, 'Gerencia no puede ejecutar transiciones de taller (HTTP 403)');
    console.log('    ✓ Desacoplamiento de Gerencia confirmado: Bloqueo en operaciones rutinarias de taller (HTTP 403).');

    // Desacoplamiento de entrega: Gerencia intentando registrar entrega -> 403 Forbidden
    const resGerenteEntregaBloqueado = await req(`/ordenes/${ordenGenerada.id}/entrega`, {
      method: 'POST',
      token: tokenGerente,
      body: { destinatario: 'Cliente' },
    });
    assert.equal(resGerenteEntregaBloqueado.status, 403, 'Gerencia no puede registrar remisiones de entrega (HTTP 403)');
    console.log('    ✓ Desacoplamiento de Gerencia confirmado: Bloqueo en entrega formal (HTTP 403).');

    // Segregación financiera: costo interno no debe exponerse a Diseñador, Operario ni Cliente
    const resDetalleDisenador = await req(`/ordenes/${ordenGenerada.id}`, { token: tokenDisenador });
    assert.equal(resDetalleDisenador.status, 200);
    assert.equal(resDetalleDisenador.data.data.costoInterno, undefined, 'costoInterno debe omitirse para Diseñador');

    const resDetalleOperario = await req(`/ordenes/${ordenGenerada.id}`, { token: tokenOperario });
    assert.equal(resDetalleOperario.status, 200);
    assert.equal(resDetalleOperario.data.data.costoInterno, undefined, 'costoInterno debe omitirse para Operario');

    const resDetalleCliente = await req(`/ordenes/${ordenGenerada.id}`, { token: tokenCliente });
    assert.equal(resDetalleCliente.status, 200);
    assert.equal(resDetalleCliente.data.data.costoInterno, undefined, 'costoInterno debe omitirse para Cliente');
    console.log('    ✓ Segregación financiera estricta confirmada: Costos internos ocultos a roles no autorizados.');

    console.log('\n════════════════════════════════════════════════════════════════════');
    console.log('🎉 VALIDACIÓN INTEGRAL E2E DE LA FASE 3.3 COMPLETADA CON ÉXITO (100% OK)');
    console.log('════════════════════════════════════════════════════════════════════');
  } finally {
    // Limpieza de archivos de prueba físicos en uploads
    for (const f of archivosLimpieza) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
    server.close(async () => {
      try {
        await pool.end();
      } catch {}
      process.exit(0);
    });
  }
}

runFase33Tests().catch(async (err) => {
  console.error('\n❌ ERROR EN VALIDACIÓN INTEGRAL FASE 3.3:', err);
  server.close(async () => {
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  });
});
