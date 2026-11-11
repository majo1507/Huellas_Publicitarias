// ============================================================
// backend/tests/fecha_envio_disenos.test.mjs
// Suite de pruebas automatizadas:
// Registro, persistencia, inmutabilidad y formato de fecha y
// hora de envío de versiones de diseño (America/Bogota).
// ============================================================

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.PORT = '3097';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');
const { formatearFechaBogota, formatearHoraBogota } = require('../utils/resolvers.js');

const BASE_URL = 'http://127.0.0.1:3097/api';

function generarToken(usuario) {
  return jwt.sign(usuario, getJwtSecret(), { expiresIn: '1h' });
}

async function pedir(endpoint, opciones = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const resp = await fetch(url, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, data };
}

async function runTests() {
  console.log('🧪 Iniciando pruebas de registro persistente de fecha y hora de envío de diseño...\n');

  try {
    // 1. Obtener usuarios diseñadora y coordinador
    console.log('1️⃣ Obteniendo usuarios de diseño y coordinación...');
    const usuariosRes = await pool.query(
      "SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE rol IN ('disenador', 'coord') AND esta_activo = true"
    );
    const usuDisenador = usuariosRes.rows.find((u) => u.rol === 'disenador');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');
    assert.ok(usuDisenador, 'Debe existir un usuario diseñador');
    assert.ok(usuCoord, 'Debe existir un usuario coordinador');

    const tokenDisenadora = generarToken(usuDisenador);
    const tokenCoord = generarToken(usuCoord);
    console.log(`   ✅ Diseñadora: ${usuDisenador.nombre_completo}, Coordinador: ${usuCoord.nombre_completo}\n`);

    // 2. Crear una orden de prueba limpia para verificar el ciclo de diseño
    console.log('2️⃣ Creando orden de prueba para ciclo de versiones...');
    const resOrden = await pool.query(`
      INSERT INTO ordenes (
        codigo, cliente_id, ejecutiva_id, disenador_id, producto, cantidad,
        material, dimensiones, acabados, fecha_solicitud, fecha_entrega,
        presupuesto, diseno_estado, estado_nombre, etapa
      ) VALUES (
        'OP-TEST-ENV-' || floor(random() * 8999 + 1000)::text,
        (SELECT id FROM clientes LIMIT 1),
        (SELECT id FROM usuarios WHERE rol = 'ejecutiva' LIMIT 1),
        $1,
        'Pendón con fecha de envío', 1, 'Lona banner 13oz', '1.00 x 2.00 m',
        'Ojales metálicos', '08/11/2026', '15/11/2026', 120000,
        'Pendiente', 'Diseño', 1
      ) RETURNING id, codigo
    `, [usuDisenador.id]);
    const testOrden = resOrden.rows[0];
    const ordenId = testOrden.id;
    const ordenCodigo = testOrden.codigo;
    console.log(`   ✅ Orden de prueba creada: ${ordenCodigo} (ID: ${ordenId})\n`);

    // 3. Crear versión 1 de diseño (en borrador / En proceso)
    console.log('3️⃣ Registrando versión 1 de diseño en borrador...');
    const resV1 = await pedir(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDisenadora}` },
      body: JSON.stringify({
        archivoNombre: `Arte_${ordenCodigo}_v1.pdf`,
        comentario: 'Propuesta inicial en borrador',
      }),
    });
    assert.equal(resV1.status, 201, `Error al crear v1: ${JSON.stringify(resV1.data)}`);

    // Comprobar que en BD fecha_envio es NULL antes de enviar
    const checkDbV1Pre = await pool.query(
      'SELECT fecha_envio, fecha_envio_texto, hora_envio_texto, estado_ui FROM archivos_arte WHERE orden_id = $1 AND numero_version = 1',
      [ordenId]
    );
    assert.equal(checkDbV1Pre.rows[0].fecha_envio, null, 'fecha_envio debe ser NULL antes del envío');
    assert.equal(checkDbV1Pre.rows[0].fecha_envio_texto, null, 'fecha_envio_texto debe ser NULL antes del envío');
    assert.equal(checkDbV1Pre.rows[0].hora_envio_texto, null, 'hora_envio_texto debe ser NULL antes del envío');
    console.log('   ✅ Verificado: fecha y hora de envío permanecen NULL en borrador.\n');

    // 4. Enviar versión 1 de diseño al cliente
    console.log('4️⃣ Enviando versión 1 de diseño para aprobación del cliente...');
    const timestampAntes = new Date();
    const resEnvio1 = await pedir(`/disenos/orden/${ordenId}/enviar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDisenadora}` },
      body: JSON.stringify({ observaciones: 'Propuesta lista para visto bueno.' }),
    });
    assert.equal(resEnvio1.status, 200, `Error en enviarDiseno: ${JSON.stringify(resEnvio1.data)}`);

    // Validar orden devuelta por el endpoint
    const ordenRetornada1 = resEnvio1.data.orden;
    assert.ok(ordenRetornada1, 'La respuesta incluye ordenCompleta');
    assert.ok(
      ['Pendiente de gestión comercial', 'Enviado'].includes(ordenRetornada1.disenoEstado),
      `Estado esperado de orden tras envío: Pendiente de gestión comercial o Enviado, recibido: ${ordenRetornada1.disenoEstado}`
    );
    const v1Ret = ordenRetornada1.versiones.find((v) => v.numero === 1);
    assert.ok(v1Ret, 'Versión 1 presente en orden');
    assert.ok(
      ['Pendiente de gestión comercial', 'Enviada'].includes(v1Ret.estado),
      `Estado esperado de versión: Pendiente de gestión comercial o Enviada, recibido: ${v1Ret.estado}`
    );
    assert.ok(v1Ret.fechaEnvio, 'v1.fechaEnvio debe contener ISO string');
    assert.ok(v1Ret.fechaEnvioTexto, 'v1.fechaEnvioTexto debe contener fecha formateada');
    assert.ok(v1Ret.horaEnvioTexto, 'v1.horaEnvioTexto debe contener hora formateada');
    assert.ok(v1Ret.fechaHoraEnvio, 'v1.fechaHoraEnvio debe contener fecha y hora concatenadas');

    console.log(`   ✅ Respuesta de endpoint contiene datos de envío:`);
    console.log(`      - fechaEnvioTexto : "${v1Ret.fechaEnvioTexto}"`);
    console.log(`      - horaEnvioTexto  : "${v1Ret.horaEnvioTexto}"`);
    console.log(`      - fechaHoraEnvio  : "${v1Ret.fechaHoraEnvio}"`);

    // 5. Verificar persistencia directa en PostgreSQL
    console.log('\n5️⃣ Verificando persistencia directa en base de datos PostgreSQL...');
    const checkDbV1Post = await pool.query(
      'SELECT fecha_envio, fecha_envio_texto, hora_envio_texto, estado_ui, comentario FROM archivos_arte WHERE orden_id = $1 AND numero_version = 1',
      [ordenId]
    );
    const rowV1 = checkDbV1Post.rows[0];
    assert.ok(rowV1.fecha_envio instanceof Date, 'fecha_envio debe persistir como timestamp');
    assert.equal(rowV1.fecha_envio_texto, v1Ret.fechaEnvioTexto);
    assert.equal(rowV1.hora_envio_texto, v1Ret.horaEnvioTexto);
    assert.ok(
      ['Pendiente de gestión comercial', 'Enviada'].includes(rowV1.estado_ui),
      `Estado UI esperado en BD: Pendiente de gestión comercial o Enviada, recibido: ${rowV1.estado_ui}`
    );

    // Verificar formato Colombia America/Bogota
    const fechaEsperadaBogota = formatearFechaBogota(timestampAntes);
    const horaEsperadaBogota = formatearHoraBogota(timestampAntes);
    assert.equal(rowV1.fecha_envio_texto, fechaEsperadaBogota, 'Fecha debe coincidir con formato America/Bogota');
    assert.equal(rowV1.hora_envio_texto, horaEsperadaBogota, 'Hora debe coincidir con formato America/Bogota');
    console.log(`   ✅ Persistencia en BD comprobada al 100% en zona horaria America/Bogota.\n`);

    // 6. Verificar inmutabilidad: no modificar la fecha original en consultas o actualizaciones posteriores
    console.log('6️⃣ Verificando inmutabilidad de la fecha de envío...');
    const fechaEnvioOriginal = rowV1.fecha_envio.toISOString();
    const fechaTextoOriginal = rowV1.fecha_envio_texto;
    const horaTextoOriginal = rowV1.hora_envio_texto;

    // Simular un intento de reenvío o actualización de observaciones
    await new Promise((r) => setTimeout(r, 1200));
    await pedir(`/disenos/orden/${ordenId}/enviar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenCoord}` },
      body: JSON.stringify({ observaciones: 'Observaciones añadidas con posterioridad.' }),
    });

    const checkDbInmutable = await pool.query(
      'SELECT fecha_envio, fecha_envio_texto, hora_envio_texto FROM archivos_arte WHERE orden_id = $1 AND numero_version = 1',
      [ordenId]
    );
    const rowInmutable = checkDbInmutable.rows[0];
    assert.equal(
      rowInmutable.fecha_envio.toISOString(),
      fechaEnvioOriginal,
      'fecha_envio no debe alterarse en consultas o actualizaciones posteriores'
    );
    assert.equal(rowInmutable.fecha_envio_texto, fechaTextoOriginal);
    assert.equal(rowInmutable.hora_envio_texto, horaTextoOriginal);
    console.log('   ✅ Inmutabilidad confirmada: fecha y hora original de envío permanecen intactas.\n');

    // 7. Verificar independencia entre versiones (v1 rechazada -> v2 creada y enviada)
    console.log('7️⃣ Verificando independencia por versión (v1 vs v2)...');
    // Coordinador rechaza v1
    await pedir(`/disenos/orden/${ordenId}/aprobacion`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenCoord}` },
      body: JSON.stringify({ estado: 'rechazado', comentario: 'Ajustar contraste de logo' }),
    });

    // Diseñadora crea v2
    await pedir(`/disenos/orden/${ordenId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenDisenadora}` },
      body: JSON.stringify({
        archivoNombre: `Arte_${ordenCodigo}_v2.pdf`,
        comentario: 'Contraste ajustado',
      }),
    });

    // Verificar que v2 inicia con fecha_envio NULL y v1 conserva sus datos
    const checkDbV2Pre = await pool.query(
      'SELECT numero_version, fecha_envio, fecha_envio_texto, hora_envio_texto FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version ASC',
      [ordenId]
    );
    assert.equal(checkDbV2Pre.rows[0].numero_version, 1);
    assert.equal(checkDbV2Pre.rows[0].fecha_envio_texto, fechaTextoOriginal);
    assert.equal(checkDbV2Pre.rows[1].numero_version, 2);
    assert.equal(checkDbV2Pre.rows[1].fecha_envio, null, 'v2 aún no ha sido enviada');
    console.log('   ✅ v2 en borrador tiene fechaEnvio NULL mientras v1 mantiene su registro original.');

    // Enviar v2
    const resEnvio2 = await pedir(`/disenos/orden/${ordenId}/enviar`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenDisenadora}` },
      body: JSON.stringify({ observaciones: 'V2 enviada al cliente.' }),
    });
    assert.equal(resEnvio2.status, 200);

    const checkDbV2Post = await pool.query(
      'SELECT numero_version, fecha_envio_texto, hora_envio_texto FROM archivos_arte WHERE orden_id = $1 ORDER BY numero_version ASC',
      [ordenId]
    );
    assert.equal(checkDbV2Post.rows[0].numero_version, 1);
    assert.equal(checkDbV2Post.rows[0].fecha_envio_texto, fechaTextoOriginal);
    assert.equal(checkDbV2Post.rows[1].numero_version, 2);
    assert.ok(checkDbV2Post.rows[1].fecha_envio_texto, 'v2 ahora tiene su propia fecha de envío');
    console.log('   ✅ v2 adquiere su propia marca temporal de envío independiente de v1.\n');

    // 8. Verificar endpoint GET /api/disenos/orden/:orden_id
    console.log('8️⃣ Verificando endpoint GET /api/disenos/orden/:orden_id...');
    const resListar = await pedir(`/disenos/orden/${ordenId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenDisenadora}` },
    });
    assert.equal(resListar.status, 200);
    assert.equal(resListar.data.total_versiones, 2);
    const dataV1 = resListar.data.data.find((v) => v.numero === 1 || v.numero_version === 1);
    const dataV2 = resListar.data.data.find((v) => v.numero === 2 || v.numero_version === 2);
    assert.equal(dataV1.fechaEnvioTexto, fechaTextoOriginal, 'GET /disenos retorna fechaEnvioTexto en v1');
    assert.equal(dataV1.horaEnvioTexto, horaTextoOriginal, 'GET /disenos retorna horaEnvioTexto en v1');
    assert.ok(dataV2.fechaEnvioTexto, 'GET /disenos retorna fechaEnvioTexto en v2');
    assert.ok(dataV2.horaEnvioTexto, 'GET /disenos retorna horaEnvioTexto en v2');
    console.log('   ✅ Endpoint de consulta de versiones entrega los campos de envío de cada versión.\n');

    console.log('🏁 Pruebas de trazabilidad completadas conservando registro inmutable.\n');

    console.log('🎉 TODAS LAS PRUEBAS DE FECHA Y HORA DE ENVÍO PASARON EXITOSAMENTE (100%).\n');
  } finally {
    if (server?.close) {
      await new Promise((r) => server.close(r));
    }
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('❌ Error ejecutando pruebas de fecha de envío:', err);
  process.exit(1);
});
