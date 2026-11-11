// ============================================================
// backend/tests/cotizacion_pagos.test.mjs
// Suite de pruebas para Cotización y Pagos en Solicitudes y Órdenes
// ORVEX — Huellas Publicidad
// ============================================================
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
process.env.PORT = '3096';

const { server } = require('../index.js');
const { pool } = require('../db.js');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../middleware/auth.js');

const BASE = 'http://127.0.0.1:3096/api';

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
  console.log('🧪 Iniciando pruebas de Cotización y Pagos en ORVEX...\n');

  try {
    // 1. Obtener usuarios de prueba
    const usuariosRes = await pool.query(
      "SELECT id, codigo, nombre_completo, email, rol FROM usuarios WHERE rol IN ('ejecutiva', 'coord', 'disenador') AND esta_activo = true"
    );
    const usuComercial = usuariosRes.rows.find((u) => u.rol === 'ejecutiva');
    const usuCoord = usuariosRes.rows.find((u) => u.rol === 'coord');

    assert.ok(usuComercial, 'Debe existir un usuario comercial/ejecutiva');
    assert.ok(usuCoord, 'Debe existir un usuario coordinador');

    const tokenComercial = generarToken(usuComercial);
    const tokenCoord = generarToken(usuCoord);

    // Obtener un cliente existente
    const clienteRes = await pool.query('SELECT id, empresa FROM clientes LIMIT 1');
    assert.ok(clienteRes.rows.length > 0, 'Debe existir al menos un cliente');
    const clienteId = clienteRes.rows[0].id;

    console.log('✅ Usuarios y cliente listos para pruebas.');

    // ------------------------------------------------------------
    // TEST 1: Rechazo de cotización total negativa
    // ------------------------------------------------------------
    console.log('\n--- TEST 1: Rechazo de cotización total negativa ---');
    const resNeg = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Avisos Acrílicos Negativos',
        cantidad: 2,
        dimensiones: '50 x 30 cm',
        cotizacionTotal: -50000,
      },
    });
    assert.equal(resNeg.status, 400, 'Debe responder 400 ante cotización negativa');
    const errorMsg1 = String(resNeg.data.error || resNeg.data.mensaje || '').toLowerCase();
    assert.ok(
      errorMsg1.includes('negativo') || errorMsg1.includes('cotización'),
      `El mensaje de error debe señalar cotización negativa: "${errorMsg1}"`
    );
    console.log('✅ TEST 1 superado: Cotización negativa rechazada correctamente.');

    // ------------------------------------------------------------
    // TEST 2: Rechazo de abonos con valor <= 0
    // ------------------------------------------------------------
    console.log('\n--- TEST 2: Rechazo de abonos con valor <= 0 ---');
    const resAbonoCero = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Pendón Roll Up',
        cantidad: 1,
        dimensiones: '200 x 80 cm',
        cotizacionTotal: 150000,
        tipoPago: 'parcial',
        pagos: [
          {
            valor: 0,
            metodoPago: 'Nequi',
            referencia: 'REF-0',
          },
        ],
      },
    });
    assert.equal(resAbonoCero.status, 400, 'Debe responder 400 ante abono con valor <= 0');
    console.log('✅ TEST 2 superado: Abono con valor <= 0 rechazado.');

    // ------------------------------------------------------------
    // TEST 3: Rechazo si total abonado supera la cotización
    // ------------------------------------------------------------
    console.log('\n--- TEST 3: Rechazo si total abonado supera la cotización ---');
    const resAbonoExcedido = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Caja de Luz LED',
        cantidad: 1,
        dimensiones: '120 x 80 cm',
        cotizacionTotal: 300000,
        tipoPago: 'parcial',
        pagos: [
          {
            valor: 350000,
            metodoPago: 'Efectivo',
            referencia: 'EF-01',
          },
        ],
      },
    });
    assert.equal(resAbonoExcedido.status, 400, 'Debe responder 400 si total abonado > cotizacion');
    const errorMsg3 = String(resAbonoExcedido.data.error || resAbonoExcedido.data.mensaje || '').toLowerCase();
    assert.ok(
      errorMsg3.includes('superar') || errorMsg3.includes('saldo') || errorMsg3.includes('cotización'),
      `El mensaje debe alertar sobre excedente en el abono: "${errorMsg3}"`
    );
    console.log('✅ TEST 3 superado: Abono superior al saldo rechazado.');

    // ------------------------------------------------------------
    // TEST 4: Registro exitoso en modo "sin_pago"
    // ------------------------------------------------------------
    console.log('\n--- TEST 4: Registro de solicitud "sin_pago" (Pendiente de pago) ---');
    const resSinPago = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Mural Vinilo Impreso',
        cantidad: 1,
        dimensiones: '3.00 x 2.40 m',
        material: 'Vinilo Adhesivo Mate',
        cotizacionTotal: 480000,
        tipoPago: 'sin_pago',
        pagos: [],
      },
    });
    assert.equal(resSinPago.status, 201, 'Debe responder 201 al crear solicitud sin abono');
    const solSinPago = resSinPago.data.data;
    assert.ok(solSinPago, 'Debe retornar la solicitud creada en data');
    assert.equal(Number(solSinPago.cotizacionTotal), 480000, 'cotizacionTotal debe ser 480000');
    assert.equal(solSinPago.tipoPago, 'sin_pago', 'tipoPago debe ser sin_pago');
    assert.equal(solSinPago.estadoPago, 'Pendiente de pago', 'estadoPago debe ser "Pendiente de pago"');
    assert.equal(Number(solSinPago.totalAbonado), 0, 'totalAbonado debe ser 0');
    assert.equal(Number(solSinPago.saldoPendiente), 480000, 'saldoPendiente debe ser 480000');
    assert.equal(solSinPago.pagos.length, 0, 'pagos debe ser lista vacía');
    console.log('✅ TEST 4 superado: Solicitud sin pago registrada con estado "Pendiente de pago".');

    // ------------------------------------------------------------
    // TEST 5: Registro exitoso con abono parcial y PAGOS MIXTOS
    // ------------------------------------------------------------
    console.log('\n--- TEST 5: Registro con pagos mixtos (Nequi + Efectivo -> Abono parcial) ---');
    const resMixto = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Letras 3D Acrílico Retroiluminadas',
        cantidad: 1,
        dimensiones: '2.50 x 0.80 m',
        material: 'Acrílico 3mm + Módulo LED',
        cotizacionTotal: 1500000,
        tipoPago: 'parcial',
        pagos: [
          {
            valor: 500000,
            metodoPago: 'Nequi',
            referencia: 'NQ-778899',
            soporte: 'Comprobante WhatsApp Nequi',
          },
          {
            valor: 250000,
            metodoPago: 'Efectivo',
            referencia: 'REC-CAJA-042',
            soporte: 'Recibo talonario No. 42',
          },
        ],
      },
    });
    assert.equal(resMixto.status, 201, 'Debe responder 201 al crear con pagos mixtos');
    const solMixta = resMixto.data.data;
    assert.equal(Number(solMixta.cotizacionTotal), 1500000, 'cotizacionTotal 1500000');
    assert.equal(solMixta.tipoPago, 'parcial', 'tipoPago parcial');
    assert.equal(solMixta.estadoPago, 'Abono parcial', 'estadoPago Abono parcial');
    assert.equal(Number(solMixta.totalAbonado), 750000, 'totalAbonado debe ser 750000');
    assert.equal(Number(solMixta.saldoPendiente), 750000, 'saldoPendiente debe ser 750000');
    assert.equal(solMixta.pagos.length, 2, 'Debe contener los 2 registros de abono');
    assert.ok(solMixta.pagos[0].tipoDocumento.includes('No constituye factura'), 'Debe contener advertencia fiscal');

    // Verificar persistencia relacional en pagos_registro
    const auditRes = await pool.query(
      'SELECT id, codigo, valor, metodo_pago, referencia, tipo_documento FROM pagos_registro WHERE solicitud_id = $1 ORDER BY created_at ASC',
      [solMixta.uuid]
    );
    assert.equal(auditRes.rows.length, 2, 'Deben haberse insertado 2 filas en pagos_registro');
    assert.equal(Number(auditRes.rows[0].valor), 500000, 'Primer abono en BD debe ser 500000');
    assert.equal(auditRes.rows[0].metodo_pago, 'Nequi', 'Método debe ser Nequi');
    assert.equal(Number(auditRes.rows[1].valor), 250000, 'Segundo abono en BD debe ser 250000');
    console.log('✅ TEST 5 superado: Pagos mixtos y tabla pagos_registro verificados.');

    // ------------------------------------------------------------
    // TEST 6: Registro exitoso con pago completo
    // ------------------------------------------------------------
    console.log('\n--- TEST 6: Registro con pago completo (Pagado) ---');
    const resCompleto = await req('/solicitudes', {
      method: 'POST',
      token: tokenComercial,
      body: {
        clienteId,
        producto: 'Señalización de Seguridad Industrial',
        cantidad: 10,
        dimensiones: '30 x 20 cm',
        cotizacionTotal: 280000,
        tipoPago: 'completo',
        pagos: [
          {
            valor: 280000,
            metodoPago: 'Transferencia bancaria',
            referencia: 'TR-BANC-99001',
            soporte: 'PDF Transferencia Bancolombia',
          },
        ],
      },
    });
    assert.equal(resCompleto.status, 201, 'Debe responder 201 en pago completo');
    const solCompleta = resCompleto.data.data;
    assert.equal(Number(solCompleta.cotizacionTotal), 280000);
    assert.equal(solCompleta.estadoPago, 'Pagado');
    assert.equal(Number(solCompleta.totalAbonado), 280000);
    assert.equal(Number(solCompleta.saldoPendiente), 0);
    console.log('✅ TEST 6 superado: Solicitud con pago completo registrada con estado "Pagado".');

    // ------------------------------------------------------------
    // TEST 7: Flujo Integral de Validación y Transferencia a Orden de Producción
    // ------------------------------------------------------------
    console.log('\n--- TEST 7: Flujo completo: Enviar a Coordinación -> Validar -> Transferencia a Orden ---');

    // 7.1 Enviar la solicitud mixta a coordinación
    const resEnviar = await req(`/solicitudes/${solMixta.id}/enviar`, {
      method: 'PATCH',
      token: tokenComercial,
    });
    assert.equal(resEnviar.status, 200, 'Debe enviarse correctamente a coordinación');
    assert.equal(resEnviar.data.data.estado, 'En validación');

    // 7.2 Coordinación valida y aprueba
    const resValidar = await req(`/solicitudes/${solMixta.id}/validar`, {
      method: 'POST',
      token: tokenCoord,
      body: {
        aprobado: true,
        observaciones: 'Aprobado con anticipo del 50%',
      },
    });
    assert.equal(resValidar.status, 201, 'Debe validar exitosamente la solicitud (201)');
    assert.equal(resValidar.data.data.estado, 'Aprobada');
    assert.ok(resValidar.data.orden, 'Debe retornar la orden creada');

    const ordenId = resValidar.data.orden.id;
    const ordenDbId = resValidar.data.orden.dbId;

    // 7.3 Consultar la orden creada mediante endpoint de ordenes
    const resOrden = await req(`/ordenes/${ordenId}`, {
      method: 'GET',
      token: tokenCoord,
    });
    assert.equal(resOrden.status, 200, 'Debe responder 200 al consultar la orden');
    const orden = resOrden.data.data || resOrden.data;

    // Verificar que los datos financieros se transfirieron íntegramente
    assert.equal(Number(orden.cotizacionTotal), 1500000, 'Orden debe heredar cotizacionTotal');
    assert.equal(orden.estadoPago, 'Abono parcial', 'Orden debe heredar estadoPago');
    assert.equal(Number(orden.totalAbonado), 750000, 'Orden debe heredar totalAbonado');
    assert.equal(Number(orden.saldoPendiente), 750000, 'Orden debe heredar saldoPendiente');
    assert.equal(orden.tipoPago, 'parcial', 'Orden debe heredar tipoPago');
    assert.equal(orden.pagos.length, 2, 'Orden debe heredar los 2 registros de abonos');

    // 7.4 Verificar que pagos_registro fue vinculado con orden_id
    const auditOrdenRes = await pool.query(
      'SELECT id, solicitud_id, orden_id, valor, metodo_pago FROM pagos_registro WHERE orden_id = $1',
      [ordenDbId]
    );
    assert.equal(auditOrdenRes.rows.length, 2, 'Los pagos_registro deben estar vinculados a la orden');
    assert.equal(auditOrdenRes.rows[0].solicitud_id, solMixta.uuid, 'Debe conservar el vínculo con la solicitud original');
    console.log('✅ TEST 7 superado: Datos financieros transferidos a la Orden y vinculados en auditoría.');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE COTIZACIÓN Y PAGOS PASARON CON ÉXITO!');
  } catch (err) {
    console.error('❌ Error durante las pruebas:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runTests();
