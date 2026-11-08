// ============================================================
// backend/tests/correccion_solicitudes.test.mjs
// Validación de la corrección y reenvío de solicitudes devueltas
// ORVEX — Huellas Publicidad
// ============================================================
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.PORT = '3095';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');

const BASE = 'http://127.0.0.1:3095/api';

function generarToken(usuario) {
  return jwt.sign(usuario, getJwtSecret(), { expiresIn: '1h' });
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

async function runTests() {
  console.log('🧪 Iniciando pruebas de corrección de solicitudes devueltas...\n');

  try {
    // 1. Obtener usuarios para las pruebas
    const usuariosRes = await pool.query(
      "SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE rol IN ('ejecutiva', 'coord', 'disenador') AND esta_activo = true"
    );
    const usuComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');
    const usuDisenador = usuariosRes.rows.find((u) => u.rol === 'disenador');

    assert.ok(usuComercial, 'Debe existir un usuario ejecutiva/comercial');
    assert.ok(usuCoord, 'Debe existir un usuario coordinador');
    assert.ok(usuDisenador, 'Debe existir un usuario diseñador');

    const tokenComercial = generarToken(usuComercial);
    const tokenCoord = generarToken(usuCoord);
    const tokenDisenador = generarToken(usuDisenador);

    // Obtener un cliente real
    const clienteRes = await pool.query('SELECT id, codigo FROM clientes LIMIT 1');
    assert.ok(clienteRes.rowCount > 0, 'Debe existir al menos un cliente');
    const cliente = clienteRes.rows[0];

    // 2. Crear una solicitud de prueba en estado pendiente
    console.log('1️⃣ Registrando solicitud inicial por Comercial...');
    const creacionRes = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId: cliente.id,
        producto: 'Pendón publicitario estándar',
        cantidad: 3,
        dimensiones: '1.00 x 1.50 m',
        material: 'Lona banner 13 oz',
        metodoEntrega: 'Domicilio',
        acabados: 'Ojales metálicos',
        fechaEntrega: '25/11/2026',
        presupuesto: 150000,
        requerimientos: 'Color corporativo azul',
        observaciones: 'Instalar en vitrina frontal',
      },
    });

    assert.equal(creacionRes.status, 201, 'La solicitud debe crearse con código 201');
    const solicitudCreada = creacionRes.data.data;
    const solId = solicitudCreada.id;
    const solCodigoOriginal = solicitudCreada.codigo;
    console.log(`   ✅ Solicitud creada: ${solId} (${solCodigoOriginal}), estado: ${solicitudCreada.estado}`);

    // 3. Enviar a validación
    console.log('2️⃣ Enviando solicitud a validación técnica...');
    const envioRes = await req(`/solicitudes/${solId}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(envioRes.status, 200, 'Debe enviarse con éxito');
    assert.equal(envioRes.data.data.estado, 'En validación');
    console.log('   ✅ Solicitud enviada a validación exitosamente.');

    // 4. Intentar corregir cuando está en "En validación" (Debe fallar: solo devueltas)
    console.log('3️⃣ Verificando restricción de estado: no permitir corrección si no está devuelta...');
    const intentoErroneoEstado = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        producto: 'Pendón modificado',
        cantidad: 5,
        dimensiones: '1.20 x 2.00 m',
        material: 'Lona mate',
        fechaEntrega: '26/11/2026',
        presupuesto: 200000,
      },
    });
    assert.equal(intentoErroneoEstado.status, 400, 'Debe responder 400 cuando el estado no es devuelta');
    console.log('   ✅ Restricción de estado validada (HTTP 400 al intentar corregir en estado no devuelta).');

    // 5. Coordinador devuelve la solicitud para corrección
    console.log('4️⃣ Coordinador devuelve la solicitud para corrección...');
    const devolucionRes = await req(`/solicitudes/${solId}/devolver`, {
      method: 'PATCH',
      token: tokenCoord,
      body: { motivo: 'El material debe ser lona microperforada por resistencia al viento.' },
    });
    assert.equal(devolucionRes.status, 200, 'Debe devolver la solicitud con éxito');
    assert.equal(devolucionRes.data.data.estado, 'Devuelta para corrección');
    assert.equal(devolucionRes.data.data.motivoRechazo, 'El material debe ser lona microperforada por resistencia al viento.');
    console.log('   ✅ Solicitud devuelta para corrección.');

    // 6. Verificar control de permisos (RBAC): Diseñador o Coordinador no pueden llamar a corregir
    console.log('5️⃣ Verificando RBAC: Diseñador o Coordinador reciben 403 al intentar corregir...');
    const intentoDisenador = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenDisenador,
      body: {
        producto: 'Hack',
        cantidad: 1,
        dimensiones: '1 x 1',
        material: 'Papel',
        fechaEntrega: '26/11/2026',
        presupuesto: 1000,
      },
    });
    assert.equal(intentoDisenador.status, 403, 'Diseñador debe recibir 403');

    const intentoCoord = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenCoord,
      body: {
        producto: 'Hack coord',
        cantidad: 1,
        dimensiones: '1 x 1',
        material: 'Papel',
        fechaEntrega: '26/11/2026',
        presupuesto: 1000,
      },
    });
    assert.equal(intentoCoord.status, 403, 'Coordinador debe recibir 403');
    console.log('   ✅ RBAC verificado (HTTP 403 para roles diferentes a Comercial).');

    // 7. Validaciones de campos obligatorios en backend
    console.log('6️⃣ Verificando validaciones de negocio en backend...');
    const valErrCantidad = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        producto: 'Pendón',
        cantidad: 0, // Invalido
        dimensiones: '1 x 1',
        material: 'Lona',
        fechaEntrega: '26/11/2026',
        presupuesto: 100000,
      },
    });
    assert.equal(valErrCantidad.status, 400, 'Cantidad 0 debe responder 400');

    const valErrPresupuesto = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        producto: 'Pendón',
        cantidad: 2,
        dimensiones: '1 x 1',
        material: 'Lona',
        fechaEntrega: '26/11/2026',
        presupuesto: -500, // Invalido
      },
    });
    assert.equal(valErrPresupuesto.status, 400, 'Presupuesto negativo debe responder 400');
    console.log('   ✅ Validaciones numéricas y de obligatoriedad verificadas (HTTP 400).');

    // 8. Corrección legítima por Comercial
    console.log('7️⃣ Ejecutando corrección legítima y reenvío por Comercial...');
    const correccionValida = await req(`/solicitudes/${solId}/corregir`, {
      method: 'PATCH',
      token: tokenComercial,
      body: {
        producto: 'Pendón publicitario microperforado',
        cantidad: 4,
        dimensiones: '1.20 x 2.20 m',
        material: 'Lona microperforada',
        acabados: 'Ojales reforzados y dobladillo perimetral',
        metodoEntrega: 'Instalación en sitio',
        fechaEntrega: '28/11/2026',
        presupuesto: 260000,
        requerimientos: 'Color corporativo azul pantone 286C con líneas de troquel',
        observaciones: 'Entregar en horario matutino en sede administrativa.',
      },
    });

    assert.equal(correccionValida.status, 200, 'La corrección debe responder 200');
    const solActualizada = correccionValida.data.data;

    // Verificaciones críticas de negocio:
    // a) Mismo código SOL-XXXX
    assert.equal(solActualizada.id, solId, 'El ID de la solicitud debe ser exactamente el mismo');
    assert.equal(solActualizada.codigo, solCodigoOriginal, 'El código SOL-XXXX original debe conservarse intacto');

    // b) Estado retornado a En validación
    assert.equal(solActualizada.estado, 'En validación', 'El estado debe cambiar a "En validación"');

    // c) Motivo de rechazo limpiado
    assert.equal(solActualizada.motivoRechazo, '', 'El motivo de rechazo debe limpiarse');

    // d) Datos actualizados
    assert.equal(solActualizada.producto, 'Pendón publicitario microperforado');
    assert.equal(solActualizada.cantidad, 4);
    assert.equal(solActualizada.dimensiones, '1.20 x 2.20 m');
    assert.equal(solActualizada.material, 'Lona microperforada');
    assert.equal(solActualizada.acabados, 'Ojales reforzados y dobladillo perimetral');
    assert.equal(solActualizada.metodoEntrega, 'Instalación en sitio');
    assert.equal(solActualizada.fechaEntrega, '28/11/2026');
    assert.equal(solActualizada.presupuesto, 260000);

    // e) Trazabilidad registrada en observaciones
    assert.ok(
      solActualizada.observaciones.includes(usuComercial.nombre_completo || usuComercial.email),
      'Las observaciones deben registrar el usuario que realizó la corrección'
    );
    assert.ok(
      solActualizada.observaciones.includes('Solicitud corregida y reenviada a validación'),
      'Debe incluir la leyenda de corrección y reenvío'
    );
    assert.ok(
      solActualizada.observaciones.includes('Lona microperforada'),
      'Debe registrar el cambio de material en la trazabilidad'
    );
    console.log('   ✅ Solicitud actualizada con éxito:');
    console.log(`      - Código conservado: ${solActualizada.codigo}`);
    console.log(`      - Nuevo estado: ${solActualizada.estado}`);
    console.log(`      - Material actualizado: ${solActualizada.material}`);
    console.log(`      - Trazabilidad registrada:\n${solActualizada.observaciones}\n`);

    // 9. Coordinación puede ahora validar la solicitud corregida y convertirla en Orden
    console.log('8️⃣ Verificando que Coordinación ahora puede validar la solicitud corregida...');
    const validacionFinal = await req(`/solicitudes/${solId}/validar`, {
      method: 'POST',
      token: tokenCoord,
    });
    assert.equal(validacionFinal.status, 201, 'Coordinación debe poder validar la solicitud corregida');
    assert.equal(validacionFinal.data.data.estado, 'Aprobada');
    assert.ok(validacionFinal.data.orden, 'Debe generar la orden de producción correspondiente');
    console.log(`   ✅ Solicitud validada exitosamente. Orden generada: ${validacionFinal.data.orden.id}`);

    console.log('\n🎉 TODAS LAS PRUEBAS DE CORRECCIÓN DE SOLICITUDES PASARON SATISFACTORIAMENTE (100%).\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runTests();
