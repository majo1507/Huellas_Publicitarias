import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ROLES, normalizarRol, obtenerConfigRol } from '../../src/data/roles.js';

const require = createRequire(import.meta.url);
process.env.PORT = '3099';

const { server } = require('../index.js');
const pool = require('../database/connection.js');

const BASE = 'http://127.0.0.1:3099/api';

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

async function runTests() {
  console.log('🧪 Iniciando suite de pruebas integrales ORVEX (Backend + PostgreSQL)...\n');

  try {
    // 1. Health check
    const health = await req('/health');
    assert.equal(health.status, 200, 'Health check debe responder 200');
    assert.equal(health.data.database?.conectado, true, 'PostgreSQL debe estar conectado');
    console.log('  ✅ 1. Health check y conexión a PostgreSQL verificados.');

    // 2. Bloqueo sin autenticación (401)
    const noAuth = await req('/ordenes');
    assert.equal(noAuth.status, 401, 'Petición sin token debe responder 401');
    console.log('  ✅ 2. Protección JWT verificada (401 sin token).');

    // 3. Login inválido (401) y logins válidos por rol
    const badLogin = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'carlos.gomez@huellas.co', clave: 'wrong_password' },
    });
    assert.equal(badLogin.status, 401, 'Credenciales inválidas deben responder 401');

    const loginCoord = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'carlos.gomez@huellas.co', clave: 'coord123' },
    });
    assert.equal(loginCoord.status, 200);
    assert.equal(loginCoord.data.usuario.rol, 'coordinador');
    assert.equal(loginCoord.data.usuario.rolUi, 'coordinador');
    const tokenCoord = loginCoord.data.token;

    const loginComercial = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'ana.martinez@huellas.co', clave: 'comercial123' },
    });
    assert.equal(loginComercial.status, 200);
    assert.equal(loginComercial.data.usuario.rol, 'comercial');
    assert.equal(loginComercial.data.usuario.rolUi, 'comercial');
    const tokenComercial = loginComercial.data.token;

    const loginDisenador = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'maria.lopez@huellas.co', clave: 'diseno123' },
    });
    assert.equal(loginDisenador.status, 200);
    assert.equal(loginDisenador.data.usuario.rol, 'disenador');
    assert.equal(loginDisenador.data.usuario.rolUi, 'disenador');
    const tokenDisenador = loginDisenador.data.token;

    const loginOperario = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'pedro.morales@huellas.co', clave: 'taller123' },
    });
    assert.equal(loginOperario.status, 200);
    assert.equal(loginOperario.data.usuario.rol, 'operario');
    assert.equal(loginOperario.data.usuario.rolUi, 'operario');
    const tokenOperario = loginOperario.data.token;

    const loginPostventa = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'sofia.herrera@huellas.co', clave: 'post123' },
    });
    assert.equal(loginPostventa.status, 200);
    assert.equal(loginPostventa.data.usuario.rol, 'postventa');
    assert.equal(loginPostventa.data.usuario.rolUi, 'postventa');
    const tokenPostventa = loginPostventa.data.token;

    const loginGerencia = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'laura.sanchez@huellas.co', clave: 'gerencia123' },
    });
    assert.equal(loginGerencia.status, 200);
    assert.equal(loginGerencia.data.usuario.rol, 'gerencia');
    assert.equal(loginGerencia.data.usuario.rolUi, 'gerencia');
    const tokenGerencia = loginGerencia.data.token;

    const loginCliente = await req('/auth/login', {
      method: 'POST',
      body: { identificador: 'carlos.mendoza@alpina.com', clave: 'cliente123' },
    });
    assert.equal(loginCliente.status, 200);
    assert.equal(loginCliente.data.usuario.rol, 'cliente');
    assert.equal(loginCliente.data.usuario.rolUi, 'cliente');

    // Verificar compatibilidad de los 7 roles devueltos por el backend con ROLES del frontend y /auth/me
    const logins = [
      loginCoord,
      loginComercial,
      loginDisenador,
      loginOperario,
      loginPostventa,
      loginGerencia,
      loginCliente,
    ];
    for (const lg of logins) {
      const rKey = lg.data.usuario.rol;
      assert.ok(ROLES[rKey], `ROLES['${rKey}'] debe existir`);
      assert.ok(Array.isArray(ROLES[rKey].menu) && ROLES[rKey].menu.length > 0, `ROLES['${rKey}'].menu debe tener elementos`);
      assert.ok(ROLES[rKey].usuario, `ROLES['${rKey}'].usuario debe existir`);

      const perfilRes = await req('/auth/perfil', { token: lg.data.token });
      assert.equal(perfilRes.status, 200);
      assert.equal(perfilRes.data.perfil.rol, rKey, `/auth/perfil debe devolver rol canónico '${rKey}'`);
      assert.ok(ROLES[perfilRes.data.perfil.rol]?.menu, `ROLES[perfil.rol].menu debe estar definido`);
    }

    // Verificar también alias directos de BD (coord, ejecutiva, produccion, gerente) en ROLES y normalizarRol
    for (const alias of ['coord', 'ejecutiva', 'produccion', 'gerente', 'disenador', 'postventa', 'cliente']) {
      const norm = normalizarRol(alias);
      assert.ok(ROLES[norm]?.menu, `normalizarRol('${alias}') -> '${norm}' debe tener menu`);
      assert.ok(ROLES[alias]?.menu, `ROLES['${alias}'].menu debe existir vía alias getter`);
      assert.ok(obtenerConfigRol(alias)?.menu, `obtenerConfigRol('${alias}').menu debe existir`);
    }

    console.log('  ✅ 3. Login real con JWT y compatibilidad ROLES[role].menu verificada para los 7 perfiles.');

    // 4. Control de permisos por rol (403) y gestión de usuarios por Gerencia
    const forbiddenUserCreate = await req('/usuarios', {
      method: 'POST',
      token: tokenDisenador,
      body: { nombre: 'Intruso', correo: 'intruso@huellas.co', rol: 'Gerencia', cargo: 'Test' },
    });
    assert.equal(forbiddenUserCreate.status, 403, 'Diseñador no puede crear usuarios (403)');

    const forbiddenRegister = await req('/auth/register', {
      method: 'POST',
      token: tokenComercial,
      body: { nombre: 'Intruso 2', email: 'intruso2@huellas.co', rol: 'gerente' },
    });
    assert.equal(forbiddenRegister.status, 403, 'Comercial no puede usar /auth/register (403)');

    const uniqueEmail = `juli.soto.${Date.now()}@huellas.co`;
    const createdUser = await req('/usuarios', {
      method: 'POST',
      token: tokenGerencia,
      body: {
        nombre: 'Julián Soto Prueba',
        correo: uniqueEmail,
        cargo: 'Operario de corte',
        rol: 'Operario',
        password: 'testuser123',
      },
    });
    assert.equal(createdUser.status, 201, 'Gerencia puede crear usuario');
    const newUserId = createdUser.data.data.id;

    const updatedUser = await req(`/usuarios/${newUserId}`, {
      method: 'PATCH',
      token: tokenGerencia,
      body: { cargo: 'Líder de troquelado', rol: 'Postventa' },
    });
    assert.equal(updatedUser.status, 200);
    assert.equal(updatedUser.data.data.rol, 'Postventa');

    const deactivatedUser = await req(`/usuarios/${newUserId}/estado`, {
      method: 'PATCH',
      token: tokenGerencia,
      body: { estado: 'Inactivo' },
    });
    assert.equal(deactivatedUser.status, 200);
    assert.equal(deactivatedUser.data.data.estado, 'Inactivo');

    const loginInactive = await req('/auth/login', {
      method: 'POST',
      body: { identificador: uniqueEmail, clave: 'testuser123' },
    });
    assert.equal(loginInactive.status, 403, 'Usuario inactivo no puede iniciar sesión (403)');
    console.log('  ✅ 4. Autorización por rol (403), CRUD de usuarios y bloqueo de cuenta inactiva verificados.');

    // 5. Registro de nuevo cliente por Comercial -> Consulta -> Selección en nueva solicitud -> Validación -> Orden
    const uniqueNit = `901.${Date.now().toString().slice(-6)}-8`;
    const createdClient = await req('/clientes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        nombre: 'Editorial Aurora S.A.S.',
        nit: uniqueNit,
        contacto: 'Valeria Gómez',
        correo: 'valeria@editorialaurora.co',
        telefono: '310 456 7890',
        ciudad: 'Bogotá',
        direccion: 'Cra 15 # 93-40 Of. 302',
      },
    });
    assert.equal(createdClient.status, 201, 'Comercial registra nuevo cliente en PostgreSQL');
    const nuevoCliente = createdClient.data.data;
    assert.equal(nuevoCliente.nombre, 'Editorial Aurora S.A.S.');
    assert.equal(nuevoCliente.contacto, 'Valeria Gómez');
    assert.ok(nuevoCliente.id.startsWith('C'), 'El nuevo cliente recibe código secuencial C#');

    const clientesList = await req('/clientes', { token: tokenComercial });
    assert.equal(clientesList.status, 200);
    const encontradoEnLista = clientesList.data.data.find((c) => c.id === nuevoCliente.id);
    assert.ok(encontradoEnLista, 'El nuevo cliente debe aparecer en el listado GET /api/clientes');
    assert.equal(encontradoEnLista.nombre, 'Editorial Aurora S.A.S.');

    const createSol = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId: nuevoCliente.id,
        cliente: nuevoCliente.nombre,
        producto: 'Backing corporativo feria 3x2m',
        cantidad: 2,
        dimensiones: '3m x 2m',
        material: 'Lona mate con estructura spider',
        fechaEntrega: '28/10/2026',
        presupuesto: 950000,
        requerimientos: 'Colores institucionales Pantone.',
        observaciones: 'Urgente para evento corporativo.',
      },
    });
    assert.equal(createSol.status, 201, 'Comercial crea solicitud seleccionando el nuevo cliente');
    const solId = createSol.data.data.id;
    assert.equal(createSol.data.data.clienteId, nuevoCliente.id);
    assert.equal(createSol.data.data.cliente, 'Editorial Aurora S.A.S.');
    assert.equal(createSol.data.data.estado, 'Pendiente');

    const sendSol = await req(`/solicitudes/${solId}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(sendSol.status, 200);
    assert.equal(sendSol.data.data.estado, 'En validación');

    const returnSol = await req(`/solicitudes/${solId}/devolver`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { motivo: 'Confirmar si incluye maletín de transporte.' },
    });
    assert.equal(returnSol.status, 200);
    assert.equal(returnSol.data.data.estado, 'Devuelta para corrección');

    const resendSol = await req(`/solicitudes/${solId}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(resendSol.status, 200);
    assert.equal(resendSol.data.data.estado, 'En validación');

    const valSol = await req(`/solicitudes/${solId}/validar`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(valSol.status, 201, 'Coordinador valida solicitud y genera orden');
    assert.equal(valSol.data.data.estado, 'Aprobada');
    const ordenId = valSol.data.orden.id;
    assert.ok(ordenId.startsWith('OP-2026-'), 'Debe generar código OP-2026-XXXX');

    // Verificar prevención de orden duplicada
    const dupVal = await req(`/solicitudes/${solId}/validar`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(dupVal.status, 409, 'No debe permitir validar dos veces la misma solicitud');
    console.log(`  ✅ 5. Flujo de solicitud (${solId}) -> validación -> orden (${ordenId}) verificado.`);

    // 6. Candado de calidad: intentar pasar a Impresión sin diseño aprobado
    const blockedAdvance = await req(`/ordenes/${ordenId}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 'Impresión' },
    });
    assert.equal(blockedAdvance.status, 400, 'Debe bloquear paso a Impresión sin diseño aprobado');
    assert.equal(blockedAdvance.data.bloqueada, true);
    console.log('  ✅ 6. Candado de control de calidad verificado (bloquea Impresión sin diseño aprobado).');

    // 7. Ciclo de diseño: crear v1 -> enviar -> rechazar -> crear v2 -> enviar -> aprobar
    const v1 = await req(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        archivoNombre: `Backing_${ordenId}_v1.pdf`,
        observacionesDisenador: 'Propuesta inicial CMYK 150dpi',
      },
    });
    assert.equal(v1.status, 201);
    assert.equal(v1.data.data.numero, 1);

    const env1 = await req(`/disenos/orden/${ordenId}/enviar`, {
      method: 'PATCH',
      token: tokenDisenador,
    });
    assert.equal(env1.status, 200);
    assert.equal(env1.data.orden.estado, 'Aprobación');
    assert.equal(env1.data.orden.disenoEstado, 'Enviado');

    const rej1 = await req(`/disenos/orden/${ordenId}/aprobacion`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { estado: 'rechazado', comentario: 'Aumentar tamaño del isotipo central.' },
    });
    assert.equal(rej1.status, 200);
    assert.equal(rej1.data.orden.disenoEstado, 'Requiere cambios');
    assert.equal(rej1.data.orden.estado, 'Diseño');

    const v2 = await req(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        archivoNombre: `Backing_${ordenId}_v2.pdf`,
        observacionesDisenador: 'Isotipo aumentado un 25%',
      },
    });
    assert.equal(v2.status, 201);
    assert.equal(v2.data.data.numero, 2);

    await req(`/disenos/orden/${ordenId}/enviar`, {
      method: 'PATCH',
      token: tokenDisenador,
    });

    const apr2 = await req(`/disenos/orden/${ordenId}/aprobacion`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { estado: 'aprobado', comentario: 'Aprobado por Laura Gómez' },
    });
    assert.equal(apr2.status, 200);
    assert.equal(apr2.data.orden.disenoEstado, 'Aprobado');
    console.log('  ✅ 7. Versionado de diseño (v1 rechazada -> v2 aprobada) verificado en PostgreSQL.');

    // 8. Avance de etapas en taller (Impresión -> Acabados -> Despacho) y entrega formal
    for (const sigEtapa of ['Impresión', 'Acabados', 'Despacho']) {
      const adv = await req(`/ordenes/${ordenId}/etapa`, {
        method: 'PATCH',
        token: tokenCoord,
        body: { etapa: sigEtapa },
      });
      assert.equal(adv.status, 200, `Debe avanzar a ${sigEtapa}`);
      assert.equal(adv.data.data.estado, sigEtapa);
    }

    const entrega = await req(`/ordenes/${ordenId}/entrega`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        contacto: 'Laura Gómez',
        documento: '52.888.999',
        cargo: 'Jefe de Mercadeo',
        telefono: '300 111 2233',
        conformidad: 'Conforme',
        observaciones: 'Entregado e instalado en salón principal.',
        evidencia: { nombre: `Acta_${ordenId}.pdf`, tipo: 'application/pdf', tamano: '240 KB' },
      },
    });
    assert.equal(entrega.status, 200);
    assert.equal(entrega.data.data.estado, 'Entrega');
    assert.equal(entrega.data.data.entrega.documento, '52.888.999');
    console.log('  ✅ 8. Avance por etapas de taller y registro de entrega con evidencia verificados.');

    // 9. Actividades de taller
    const actAccion = await req('/actividades/T-001/accion', {
      method: 'PATCH',
      token: tokenOperario,
      body: { accion: 'iniciar' },
    });
    assert.equal(actAccion.status, 200);

    const actAvance = await req('/actividades/T-001/avance', {
      method: 'PATCH',
      token: tokenOperario,
      body: { estado: 'En proceso', pct: 80 },
    });
    assert.equal(actAvance.status, 200);
    assert.equal(actAvance.data.data.pct, 80);

    const actNota = await req('/actividades/T-001/notas', {
      method: 'POST',
      token: tokenOperario,
      body: { texto: 'Calibración de cabezal completada.', esIncidencia: false },
    });
    assert.equal(actNota.status, 201);
    assert.ok(actNota.data.data.notas.length >= 1);
    console.log('  ✅ 9. Gestión de actividades de taller (acciones, porcentaje y notas) verificada.');

    // 10. Postventa y validación estricta de cierre de orden (HU-18, HU-20)
    const nuevoCaso = await req('/casos', {
      method: 'POST',
      token: tokenPostventa,
      body: {
        ordenId,
        tipo: 'Ajuste',
        descripcion: 'Solicitan refuerzo adicional en tensor lateral.',
        responsable: 'Sofía Herrera',
      },
    });
    assert.equal(nuevoCaso.status, 201);
    const casoId = nuevoCaso.data.data.id;

    // Intentar cerrar orden con caso abierto -> debe bloquearse (400 o 409)
    const closeBlocked = await req(`/ordenes/${ordenId}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Intento de cierre con caso abierto' },
    });
    assert.ok([400, 409].includes(closeBlocked.status), 'No debe cerrar orden con caso postventa abierto');

    // Resolver y calificar caso
    const resolveCaso = await req(`/casos/${casoId}/resolver`, {
      method: 'PATCH',
      token: tokenPostventa,
      body: { solucion: 'Tensor lateral reemplazado en sitio sin costo.' },
    });
    assert.equal(resolveCaso.status, 200);
    assert.equal(resolveCaso.data.data.estado, 'Resuelto');

    const rateCaso = await req(`/casos/${casoId}/calificar`, {
      method: 'PATCH',
      token: tokenPostventa,
      body: { calificacion: 5 },
    });
    assert.equal(rateCaso.status, 200);
    assert.equal(rateCaso.data.data.calificacion, 5);

    // Ahora sí cerrar orden formalmente
    const closeOk = await req(`/ordenes/${ordenId}/cerrar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Entrega y postventa concluidas al 100%.' },
    });
    assert.equal(closeOk.status, 200);
    assert.equal(closeOk.data.data.estado, 'Cerrada');

    // Reabrir y clonar orden
    const reopenOk = await req(`/ordenes/${ordenId}/reabrir`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Solicitud de copia adicional.' },
    });
    assert.equal(reopenOk.status, 200);
    assert.equal(reopenOk.data.data.estado, 'Postventa');

    const cloneOk = await req(`/ordenes/${ordenId}/clonar`, {
      method: 'POST',
      token: tokenCoord,
      body: { motivo: 'Reimpresión para sucursal norte.' },
    });
    assert.equal(cloneOk.status, 201);
    assert.equal(cloneOk.data.data.esReimpresion, true);
    console.log('  ✅ 10. Postventa, bloqueo de cierre, resolución, reapertura y clonación verificados.');

    // 11. Comunicaciones y Dashboard
    const commMsg = await req('/comunicaciones/COM-001/mensajes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        de: 'usuario',
        texto: 'Confirmado Laura, el viernes a las 8:00 AM estará el instalador en sitio.',
        hora: '09:15',
      },
    });
    assert.equal(commMsg.status, 201);
    assert.equal(commMsg.data.data.estado, 'Respondida');

    const dash = await req('/dashboard', { token: tokenGerencia });
    assert.equal(dash.status, 200);
    assert.ok(Array.isArray(dash.data.embudo_produccion_kanban) && dash.data.resumen.total_ordenes > 0);
    console.log('  ✅ 11. Comunicaciones omnicanal y métricas de Dashboard verificadas.');

    // 12. Verificar persistencia real directamente en PostgreSQL
    const { rows: dbCheck } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM ordenes WHERE codigo = $1) AS orden_existe,
         (SELECT COUNT(*)::int FROM archivos_arte a JOIN ordenes o ON a.orden_id = o.id WHERE o.codigo = $1) AS versiones_count,
         (SELECT COUNT(*)::int FROM registro_sesion r JOIN ordenes o ON r.orden_id = o.id WHERE o.codigo = $1) AS eventos_count`,
      [ordenId]
    );
    assert.equal(dbCheck[0].orden_existe, 1);
    assert.equal(dbCheck[0].versiones_count, 2);
    assert.ok(dbCheck[0].eventos_count >= 10, 'El historial en PostgreSQL debe tener todos los eventos registrados');
    console.log(
      `  ✅ 12. Persistencia SQL comprobada en PostgreSQL (${ordenId}: ${dbCheck[0].versiones_count} versiones, ${dbCheck[0].eventos_count} eventos de auditoría).`
    );

    console.log('\n🎉 TODAS LAS PRUEBAS INTEGRALES PASARON EXITOSAMENTE.');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n❌ FALLÓ LA SUITE DE PRUEBAS:', err);
  process.exit(1);
});
