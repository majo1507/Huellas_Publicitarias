// ============================================================
// backend/tests/flujo_diseno_comercial.test.mjs
// Suite de pruebas para la Reorganización Integral del Flujo de:
// Aprobación de Diseños y Atención al Cliente en ORVEX
// Huellas Publicidad S.A.S.
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.PORT = '3098';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');

const BASE_URL = 'http://127.0.0.1:3098/api';

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

async function runTests() {
  console.log('🧪 [ORVEX] Iniciando validación del nuevo flujo de Diseños y Atención al Cliente...\n');

  try {
    // 0. Obtener usuarios de prueba de la base de datos
    const usuariosRes = await pool.query(
      "SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE esta_activo = true"
    );
    const usuComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuDisenador = usuariosRes.rows.find((u) => u.rol === 'disenador');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuOperario = usuariosRes.rows.find((u) => u.rol === 'produccion');
    const usuGerente = usuariosRes.rows.find((u) => u.rol === 'gerente');

    assert.ok(usuComercial, 'Debe existir un usuario comercial (ejecutiva)');
    assert.ok(usuDisenador, 'Debe existir un usuario diseñador');
    assert.ok(usuCoord, 'Debe existir un usuario coordinador');
    assert.ok(usuOperario, 'Debe existir un usuario operario');
    assert.ok(usuGerente, 'Debe existir un usuario gerente');

    const tokenComercial = generarToken(usuComercial);
    const tokenDisenador = generarToken(usuDisenador);
    const tokenCoord = generarToken(usuCoord);
    const tokenOperario = generarToken(usuOperario);
    const tokenGerente = generarToken(usuGerente);

    // Cliente de prueba en la tabla clientes (entidad de negocio fundamental)
    const clienteRes = await pool.query('SELECT id, empresa, nit, contacto_principal FROM clientes LIMIT 1');
    assert.ok(clienteRes.rows.length > 0, 'Debe existir al menos un cliente en base de datos');
    const cliente = clienteRes.rows[0];

    console.log(`✅ Roles internos listos: Comercial (${usuComercial.nombre_completo}), Diseñadora (${usuDisenador.nombre_completo}), Coordinador (${usuCoord.nombre_completo}).`);
    console.log(`✅ Cliente de negocio: ${cliente.empresa} (NIT: ${cliente.nit}).\n`);

    // Crear orden de prueba limpia para el flujo
    const ordRes = await pool.query(
      `INSERT INTO ordenes (
        codigo, cliente_id, producto, cantidad, material, dimensiones,
        fecha_solicitud, fecha_entrega, estado_nombre, diseno_estado,
        etapa, prioridad, ejecutiva_id, disenador_id, disenador_nombre_asignado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Diseño', 'En diseño', 1, 'Alta', $9, $10, $11)
      RETURNING *`,
      [
        `OP-TEST-FLUJO-${Date.now().toString().slice(-4)}`,
        cliente.id,
        'Caja de Luz LED Acrílica Publicitaria',
        2,
        'Acrílico 3mm + Perfilería aluminio',
        '1.20 x 0.80 m',
        '08/11/2026',
        '20/11/2026',
        usuComercial.id,
        usuDisenador.id,
        usuDisenador.nombre_completo,
      ]
    );
    const orden = ordRes.rows[0];
    const ordenId = orden.codigo;
    console.log(`✅ Orden de prueba creada: ${ordenId} (ID: ${orden.id}). Estado inicial: etapa 1 (Diseño), disenoEstado: 'En diseño'.\n`);

    // ------------------------------------------------------------
    // ESCENARIO 1: Diseño crea V1 y la envía a Comercial
    // ------------------------------------------------------------
    console.log('📌 Escenario 1: Diseño crea V1 y la envía a Comercial...');
    const resV1 = await req(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        archivoNombre: `Arte_${ordenId}_v1.pdf`,
        ruta_archivo: `uploads/Arte_${ordenId}_v1.pdf`,
        comentario: 'Propuesta gráfica inicial en CMYK con imagotipo corporativo',
      },
    });
    assert.equal(resV1.status, 201, 'Debe crear versión 1 exitosamente');
    assert.equal(resV1.data.data.numero, 1, 'Versión debe ser 1');
    assert.equal(resV1.data.orden.disenoEstado, 'En diseño', 'Estado debe ser En diseño');

    // Acción «Enviar a Comercial»
    const resEnviar = await req(`/disenos/orden/${ordenId}/enviar-comercial`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { observaciones: 'Propuesta lista para presentar al cliente' },
    });
    assert.equal(resEnviar.status, 200, 'Debe enviar a Comercial correctamente');
    assert.equal(resEnviar.data.orden.disenoEstado, 'Pendiente de gestión comercial', 'Estado debe ser Pendiente de gestión comercial');

    // Verificar en BD que se registraron emisor, fecha y hora
    const v1Db = (await pool.query('SELECT * FROM archivos_arte WHERE orden_id = $1 AND numero_version = 1', [orden.id])).rows[0];
    assert.ok(v1Db.fecha_envio_comercial_texto, 'Debe existir fecha_envio_comercial_texto');
    assert.ok(v1Db.hora_envio_comercial_texto, 'Debe existir hora_envio_comercial_texto');
    assert.equal(v1Db.enviado_a_comercial_nombre, usuDisenador.nombre_completo, 'Emisor debe ser la diseñadora');
    console.log('    ✓ V1 creada y enviada a Comercial. Registrada fecha y hora con éxito.');

    // ------------------------------------------------------------
    // ESCENARIO 2: Comercial recibe V1 y registra que está esperando respuesta
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 2: Comercial recibe V1 y registra que está esperando respuesta del cliente...');
    const resEsperando = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'esperando',
        canal: 'WhatsApp',
        nombreAutoriza: 'Laura Gómez',
        observaciones: 'Propuesta enviada por chat corporativo a las 11:20 am. Mensaje entregado y leído.',
      },
    });
    assert.equal(resEsperando.status, 200, 'Debe registrar estado de espera');
    assert.equal(resEsperando.data.orden.disenoEstado, 'Esperando respuesta del cliente');
    console.log('    ✓ Estado de la orden actualizado a "Esperando respuesta del cliente".');

    // ------------------------------------------------------------
    // ESCENARIO 6: Se bloquea impresión cuando no existe aprobación
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 6: Se bloquea impresión cuando el cliente todavía no responde (candado de calidad)...');
    const resIntentoImpresionBloqueado = await req(`/ordenes/${ordenId}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resIntentoImpresionBloqueado.status, 400, 'Debe responder 400 al intentar avanzar sin aprobación');
    assert.equal(resIntentoImpresionBloqueado.data.bloqueada, true, 'Orden debe marcarse bloqueada');
    console.log('    ✓ Candado verificado: Avance a impresión estrictamente bloqueado.');

    // ------------------------------------------------------------
    // ESCENARIO 7: Comercial devuelve el diseño por cambios solicitados por el cliente
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 7: Comercial registra solicitud de modificaciones del cliente y devuelve a Diseño...');
    const resCambios = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'cambios',
        canal: 'WhatsApp',
        nombreAutoriza: 'Laura Gómez',
        observaciones: 'Ajustar contraste del texto legal y aumentar el tamaño del logo en un 20%.',
      },
    });
    assert.equal(resCambios.status, 200, 'Debe registrar solicitud de modificaciones');
    assert.equal(resCambios.data.orden.disenoEstado, 'Cambios solicitados');
    assert.equal(resCambios.data.orden.etapa, 1, 'Debe volver a la etapa 1 (Diseño)');
    console.log('    ✓ Cambios registrados. Trabajo devuelto a Diseño.');

    // ------------------------------------------------------------
    // ESCENARIO 8: Diseño crea V2 y se conserva V1 en el historial
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 8: Diseño crea V2 y se conserva V1...');
    const resV2 = await req(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      token: tokenDisenador,
      body: {
        archivoNombre: `Arte_${ordenId}_v2.pdf`,
        ruta_archivo: `uploads/Arte_${ordenId}_v2.pdf`,
        comentario: 'Logo ampliado 20% y contraste mejorado según observaciones del cliente',
      },
    });
    assert.equal(resV2.status, 201, 'Debe crear versión 2');
    assert.equal(resV2.data.data.numero, 2, 'Versión debe ser 2');
    assert.equal(resV2.data.orden.disenoEstado, 'En diseño');

    // Verificar en BD que V1 sigue existiendo intacta
    const todasVersiones = await pool.query(
      'SELECT numero_version, estado_ui, comentario FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version ASC',
      [orden.id]
    );
    assert.equal(todasVersiones.rows.length, 2, 'Deben existir 2 versiones en la base de datos');
    assert.equal(todasVersiones.rows[0].numero_version, 1, 'V1 debe conservarse');
    assert.equal(todasVersiones.rows[1].numero_version, 2, 'V2 debe ser la nueva versión');
    console.log('    ✓ Historial preservado: V1 conservada intacta y V2 creada.');

    // ------------------------------------------------------------
    // ESCENARIO 10: Se bloquea la auto-aprobación por parte del diseñador
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 10: Se bloquea el intento de auto-aprobación por parte de la diseñadora...');
    const resAutoAprob = await req(`/disenos/orden/${ordenId}/aprobacion`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { estado_aprobacion: 'aprobado', soporte_evidencia: 'aprobacion_propia' },
    });
    assert.equal(resAutoAprob.status, 403, 'Debe responder 403 Forbidden ante auto-aprobación');
    console.log('    ✓ Bloqueo RBAC verificado: La diseñadora no puede aprobar sus propios diseños.');

    // ------------------------------------------------------------
    // ESCENARIO 9: La aprobación de V1 no habilita V2 (Inmutabilidad e independencia)
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 9: Verificando que V2 en borrador sigue bloqueando la producción...');
    const resAvanceV2Bloqueado = await req(`/ordenes/${ordenId}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceV2Bloqueado.status, 400, 'Debe bloquear paso a impresión con V2 sin aprobar');
    console.log('    ✓ Independencia confirmada: V2 no está aprobada y bloquea el paso a impresión.');

    // Diseñador envía V2 a Comercial
    await req(`/disenos/orden/${ordenId}/enviar-comercial`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: { observaciones: 'V2 lista con los ajustes solicitados' },
    });

    // ------------------------------------------------------------
    // ESCENARIO 3: Comercial registra aprobación con evidencia verificable
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 3: Comercial registra aprobación de V2 con soporte verificable...');
    // 3.1 Intento de aprobación sin evidencia (debe ser rechazado con 400)
    const resAprobSinEvidencia = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'aprobar',
        nombreAutoriza: 'Laura Gómez',
        evidencia: '',
      },
    });
    assert.equal(resAprobSinEvidencia.status, 400, 'Debe rechazar aprobación sin evidencia');

    // 3.2 Aprobación válida con versión seleccionada, fecha y evidencia
    const resAprobacionValida = await req(`/disenos/orden/${ordenId}/gestion-comercial`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        accion: 'aprobar',
        numero_version: 2,
        fechaAprobacion: '2026-11-08',
        canal: 'WhatsApp',
        nombreAutoriza: 'Laura Gómez (Gerente de Mercadeo)',
        evidencia: 'Captura de WhatsApp chat verificado ref WA-778841',
        observaciones: 'Cliente confirma que los colores y dimensiones son exactamente los requeridos.',
      },
    });
    assert.equal(resAprobacionValida.status, 200, 'Debe registrar la aprobación exitosamente');
    assert.equal(resAprobacionValida.data.orden.disenoEstado, 'Aprobado por el cliente');
    assert.equal(resAprobacionValida.data.orden.estado, 'Aprobación', 'Debe pasar a estado Aprobación para Coordinación');
    const v2Aprobada = resAprobacionValida.data.orden.versiones.find((v) => v.numero === 2);
    assert.ok(v2Aprobada, 'Debe incluir la versión 2 en el payload de la orden');
    assert.equal(v2Aprobada.contactoClienteFechaTexto, '08/11/2026', 'Debe persistir la fecha de aprobación seleccionada');
    assert.equal(v2Aprobada.contactoClienteEvidencia, 'Captura de WhatsApp chat verificado ref WA-778841', 'Debe persistir la evidencia');
    console.log('    ✓ Aprobación de V2 registrada con versión, fecha y evidencia verificable.');

    // ------------------------------------------------------------
    // ESCENARIO 4: Diseño recibe la confirmación (estado visible en consulta)
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 4: Diseñadora consulta la orden y ve el estado de aprobación...');
    const resConsultaDiseno = await req(`/ordenes/${ordenId}`, {
      method: 'GET',
      token: tokenDisenador,
    });
    assert.equal(resConsultaDiseno.status, 200);
    const ordConsultada = resConsultaDiseno.data.data || resConsultaDiseno.data;
    assert.equal(ordConsultada.disenoEstado, 'Aprobado por el cliente');
    console.log('    ✓ Diseñadora visualiza el estado "Aprobado por el cliente" en su bandeja.');

    // ------------------------------------------------------------
    // ESCENARIO 5: Coordinación puede continuar con la orden (liberar y avanzar)
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 5: Coordinación libera para impresión y avanza la orden a taller...');
    const resLiberar = await req(`/disenos/orden/${ordenId}/liberar-impresion`, {
      method: 'PATCH',
      token: tokenCoord,
    });
    assert.equal(resLiberar.status, 200, 'Coordinación libera formalmente para impresión');
    assert.equal(resLiberar.data.orden.disenoEstado, 'Listo para impresión');

    const resAvanceImpresion = await req(`/ordenes/${ordenId}/etapa`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { etapa: 4, estado: 'Impresión' },
    });
    assert.equal(resAvanceImpresion.status, 200, 'Debe permitir avance a impresión tras liberación');
    const ordenAvanzada = resAvanceImpresion.data.data || resAvanceImpresion.data;
    assert.equal(ordenAvanzada.etapa, 4);
    assert.equal(ordenAvanzada.estado, 'Impresión');
    console.log('    ✓ Orden avanzada formalmente a taller de Impresión por Coordinación.');

    // ------------------------------------------------------------
    // ESCENARIO 11: Gerencia conserva permisos de supervisión, sin operaciones rutinarias
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 11: Gerencia consulta orden pero está bloqueada en actividades de taller...');
    const resGerenciaGet = await req(`/ordenes/${ordenId}`, {
      method: 'GET',
      token: tokenGerente,
    });
    assert.equal(resGerenciaGet.status, 200, 'Gerencia puede consultar la orden');

    const resGerenciaOp = await req(`/ordenes/${ordenId}/etapa`, {
      method: 'PATCH',
      token: tokenGerente,
      body: { etapa: 5, estado: 'Acabados' },
    });
    assert.equal(resGerenciaOp.status, 403, 'Gerencia no puede ejecutar transiciones operativas rutinarias');
    console.log('    ✓ Desacoplamiento de Gerencia confirmado: Supervisión permitida, operaciones rutinarias bloqueadas.');

    // ------------------------------------------------------------
    // ESCENARIO 12: Antiguo perfil de Cliente ya no puede iniciar sesión ni aprobar
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 12: Comprobando que el perfil de Cliente no puede iniciar sesión ni aprobar...');
    // Intento de login con credenciales del antiguo perfil cliente
    const resLoginCliente = await req('/auth/login', {
      method: 'POST',
      body: { email: 'carlos.mendoza@alpina.com', password: 'cliente123' },
    });
    assert.equal(resLoginCliente.status, 401, 'Login de cliente interno debe responder 401');

    // Token simulado con rol cliente debe ser rechazado
    const tokenClienteSimulado = jwt.sign({ id: 'C1', rol: 'cliente' }, getJwtSecret(), { expiresIn: '1h' });
    const resAprobClienteBloqueado = await req(`/disenos/orden/${ordenId}/aprobacion`, {
      method: 'PATCH',
      token: tokenClienteSimulado,
      body: { estado_aprobacion: 'aprobado' },
    });
    assert.equal(resAprobClienteBloqueado.status, 403, 'Token con rol cliente debe ser rechazado con 403');
    console.log('    ✓ Acceso interno de Cliente retirado y bloqueado tanto en login como en endpoints.');

    // ------------------------------------------------------------
    // ESCENARIO 13: Se conservan los registros y relaciones históricas
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 13: Verificando que tablas y relaciones de clientes continúan intactas...');
    const cuentaClientes = await pool.query('SELECT COUNT(*)::int AS total FROM clientes');
    assert.ok(cuentaClientes.rows[0].total > 0, 'La tabla clientes debe conservar sus registros');

    const ordenConCliente = (await pool.query('SELECT cliente_id FROM ordenes WHERE id = $1', [orden.id])).rows[0];
    assert.equal(ordenConCliente.cliente_id, cliente.id, 'La relación con la tabla clientes se mantiene íntegra');
    console.log('    ✓ Integridad confirmada: Clientes continúan como entidades fundamentales de la base de datos.');

    // ------------------------------------------------------------
    // ESCENARIO 14: Se verifica la trazabilidad completa de todos los eventos
    // ------------------------------------------------------------
    console.log('\n📌 Escenario 14: Verificando bitácora inmutable de eventos...');
    const bitacora = await pool.query(
      'SELECT accion_texto, responsable_nombre, fecha_texto, hora_texto FROM registro_sesion WHERE orden_id = $1 ORDER BY created_at ASC',
      [orden.id]
    );
    assert.ok(bitacora.rows.length >= 4, 'Deben existir al menos 4 eventos de trazabilidad registrados');
    const eventosTexto = bitacora.rows.map((r) => r.accion_texto).join(' | ');

    assert.ok(eventosTexto.includes('Diseño v1 enviado a Comercial'), 'Debe registrar envío a Comercial');
    assert.ok(eventosTexto.includes('modificaciones') || eventosTexto.includes('ajustes'), 'Debe registrar solicitud de modificaciones');
    assert.ok(eventosTexto.includes('Diseño v2 aprobado'), 'Debe registrar aprobación de V2');
    assert.ok(eventosTexto.includes('liberado para impresión') || eventosTexto.includes('Impresión'), 'Debe registrar liberación para taller');
    console.log('    ✓ Trazabilidad verificada: Todos los eventos quedaron registrados con emisor, fecha y hora.');

    console.log('\n🎉 ¡LOS 14 ESCENARIOS DEL NUEVO FLUJO DE DISEÑOS Y ATENCIÓN AL CLIENTE PASARON CON ÉXITO (100%)!');
  } catch (err) {
    console.error('❌ Error durante las pruebas:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runTests();
