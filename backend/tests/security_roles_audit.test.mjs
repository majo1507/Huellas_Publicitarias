// ============================================================
// tests/security_roles_audit.test.mjs — Prueba de Seguridad y Autorización por Rol
// ============================================================
import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ path: 'backend/.env' });

function getJwtSecret() {
  return process.env.JWT_SECRET || 'orvex_default_jwt_secret_dev_2026';
}

const ROLES_TEST = [
  { rolUi: 'gerencia', rolBd: 'gerente', nombre: 'Andrés Torres', email: 'guidohernandezhdz@gmail.com', id: 'f4d13c8d-1716-4365-badd-6b61ecc62c71' },
  { rolUi: 'comercial', rolBd: 'ejecutiva', nombre: 'Ana Martínez', email: 'jhonavila1038800612@gmail.com', id: '625af3ff-ffd4-4956-a6fd-096e54fde577' },
  { rolUi: 'coordinador', rolBd: 'coord', nombre: 'Carlos Ruiz', email: 'jhon.avilahe@amigo.edu.co', id: '19495805-a026-49d4-ba6e-c53a680c9ac1' },
  { rolUi: 'disenador', rolBd: 'disenador', nombre: 'María López', email: 'nicoohdz418@gmail.com', id: '0043ff39-4324-4643-9848-419a3dc46dd6' },
  { rolUi: 'operario', rolBd: 'produccion', nombre: 'Juan Pérez', email: 'andresvarrera10@gmail.com', id: '72de06fe-56e7-45a2-bfba-7c7e6f992152' },
  { rolUi: 'postventa', rolBd: 'postventa', nombre: 'Sofía Herrera', email: 'Victoriavi324@gmail.com', id: 'd03da3c6-f08b-43dc-a3ba-a1d4ab5d91e4' },
];

function generarTokenParaRol(u) {
  return jwt.sign(
    {
      id: u.id,
      nombre_completo: u.nombre,
      email: u.email,
      rol: u.rolBd,
      rolUi: u.rolUi,
      rol_normalizado: u.rolBd,
    },
    getJwtSecret(),
    { expiresIn: '1h' }
  );
}

const ENDPOINTS = [
  {
    path: '/api/clientes',
    nombre: 'GET /api/clientes',
    esperados: {
      gerente: 200,
      ejecutiva: 200,
      coord: 200,
      postventa: 200,
      disenador: 403,
      produccion: 403,
    },
  },
  {
    path: '/api/solicitudes',
    nombre: 'GET /api/solicitudes',
    esperados: {
      gerente: 200,
      ejecutiva: 200,
      coord: 200,
      postventa: 403,
      disenador: 403,
      produccion: 403,
    },
  },
  {
    path: '/api/inventario',
    nombre: 'GET /api/inventario',
    esperados: {
      gerente: 200,
      coord: 200,
      produccion: 200,
      ejecutiva: 403,
      postventa: 403,
      disenador: 403,
    },
  },
  {
    path: '/api/inventario/proveedores',
    nombre: 'GET /api/inventario/proveedores',
    esperados: {
      gerente: 200,
      coord: 200,
      produccion: 403,
      ejecutiva: 403,
      postventa: 403,
      disenador: 403,
    },
  },
  {
    path: '/api/dashboard',
    nombre: 'GET /api/dashboard',
    esperados: {
      gerente: 200,
      coord: 200,
      ejecutiva: 403,
      postventa: 403,
      disenador: 403,
      produccion: 403,
    },
  },
];

async function run() {
  console.log('🧪 Ejecutando matriz de pruebas de seguridad y autorización por rol en ORVEX...\n');
  const tokens = {};
  for (const u of ROLES_TEST) {
    tokens[u.rolBd] = generarTokenParaRol(u);
  }

  const resultados = [];
  let fallos = 0;

  for (const ep of ENDPOINTS) {
    console.log(`📡 Probando ${ep.nombre}...`);
    for (const u of ROLES_TEST) {
      const token = tokens[u.rolBd];
      const res = await fetch(`http://localhost:3000${ep.path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const esperado = ep.esperados[u.rolBd];
      const obtenido = res.status;
      const ok = obtenido === esperado;

      if (!ok) fallos++;

      let detalleExtra = '';
      if (ep.path === '/api/dashboard' && obtenido === 200) {
        const body = await res.json();
        if (u.rolBd === 'gerente') {
          assert.ok(body.resumen?.total_presupuestado !== undefined, 'Gerencia debe tener métricas financieras');
          assert.ok(body.top_clientes_activos !== undefined, 'Gerencia debe tener top clientes');
          detalleExtra = ' (incluye financieros y ejecutivos)';
        } else if (u.rolBd === 'coord') {
          assert.equal(body.resumen?.total_presupuestado, undefined, 'Coordinación NO debe tener financieros');
          assert.equal(body.top_clientes_activos, undefined, 'Coordinación NO debe tener top clientes');
          detalleExtra = ' (solo indicadores operativos, financieros omitidos)';
        }
      }

      console.log(`   ${ok ? '✅' : '❌'} [${u.rolUi.padEnd(11)}] Esperado: ${esperado} | Obtenido: ${obtenido}${detalleExtra}`);

      resultados.push({
        endpoint: ep.nombre,
        rolUi: u.rolUi,
        rolBd: u.rolBd,
        statusEsperado: esperado,
        statusObtenido: obtenido,
        exito: ok,
      });
    }
    console.log('');
  }

  if (fallos > 0) {
    console.error(`❌ La auditoría finalizó con ${fallos} fallos.`);
    process.exit(1);
  } else {
    console.log('🎉 ¡TODAS LAS PRUEBAS DE ACCESO Y RESTRICCIÓN DE SEGURIDAD PASARON AL 100%!');
    process.exit(0);
  }
}

run();
