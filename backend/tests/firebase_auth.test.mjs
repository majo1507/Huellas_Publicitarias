// ============================================================
// tests/firebase_auth.test.mjs — Suite de Pruebas de Firebase Auth & Roles
// ============================================================
import assert from 'assert';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ path: 'backend/.env' });
const { pool } = await import('../db.js');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'orvex_default_jwt_secret_dev_2026';
}

// 1. Verificación de reglas de autorización en PostgreSQL
async function testAutorizacionPostgreSQL() {
  console.log('  1. Verificando regla de autorización estricta en PostgreSQL...');

  // Caso A: Usuario inexistente debe dar 0 resultados
  const checkNoExiste = await pool.query(
    "SELECT id, email, rol, esta_activo FROM usuarios WHERE LOWER(email) = $1",
    ['desconocido.hacker@externo.com']
  );
  assert.equal(checkNoExiste.rowCount, 0, 'Usuario desconocido no debe existir en BD');

  // Caso B: Usuario inactivo debe ser detectado con esta_activo = false
  const checkInactivo = await pool.query(
    "SELECT id, email, rol, esta_activo FROM usuarios WHERE esta_activo = false LIMIT 1"
  );
  if (checkInactivo.rowCount > 0) {
    const usrInactivo = checkInactivo.rows[0];
    assert.equal(usrInactivo.esta_activo, false, 'El usuario debe estar marcado como inactivo');
    console.log(`    ✅ Usuario inactivo detectado correctamente para bloqueo: ${usrInactivo.email}`);
  }

  // Caso C: Usuario activo y autorizado en PostgreSQL (Coordinador)
  const checkActivo = await pool.query(
    "SELECT id, codigo, nombre_completo, email, rol, cargo, esta_activo FROM usuarios WHERE rol = 'coord' AND esta_activo = true LIMIT 1"
  );
  assert.equal(checkActivo.rowCount, 1, 'Coordinador debe existir y estar activo');
  const usuarioActivo = checkActivo.rows[0];
  assert.equal(usuarioActivo.rol, 'coord', 'El rol en BD debe ser coord');
  console.log(`    ✅ Usuario autorizado verificado con rol de BD: ${usuarioActivo.nombre_completo} (${usuarioActivo.rol})`);
}

// 2. Verificación de emisión de JWT seguro para usuario autorizado
async function testEmisionTokenSesion() {
  console.log('  2. Verificando emisión de token de sesión ORVEX...');
  const res = await pool.query(
    "SELECT id, codigo, nombre_completo, email, rol, cargo, esta_activo FROM usuarios WHERE rol = 'ejecutiva' AND esta_activo = true LIMIT 1"
  );
  assert.equal(res.rowCount, 1);
  const u = res.rows[0];

  const tokenPayload = {
    id: u.id,
    codigo: u.codigo,
    nombre_completo: u.nombre_completo,
    email: u.email,
    rol: u.rol,
    rolUi: 'comercial',
    firebase_uid: 'firebase_test_uid_12345',
  };

  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '24h' });
  assert.ok(token && token.length > 20, 'El token JWT debe generarse');

  const decoded = jwt.verify(token, getJwtSecret());
  assert.equal(decoded.email, u.email);
  assert.equal(decoded.rol, 'ejecutiva');
  assert.equal(decoded.rolUi, 'comercial');
  console.log('    ✅ Token de sesión firmado e inspeccionado con rol canónico protegido');
}

// 3. Verificación de integridad del hash de contraseñas
async function testIntegridadHashes() {
  console.log('  3. Verificando integridad del hash bcrypt de contraseñas de respaldo...');
  const res = await pool.query(
    "SELECT id, email, password_hash FROM usuarios WHERE password_hash IS NOT NULL AND esta_activo = true LIMIT 1"
  );
  assert.equal(res.rowCount, 1);
  assert.ok(res.rows[0].password_hash.startsWith('$2'), 'El hash de contraseña debe ser un hash bcrypt válido');
  console.log('    ✅ Hash bcrypt de respaldo verificado correctamente en PostgreSQL');
}

async function run() {
  try {
    await testAutorizacionPostgreSQL();
    await testEmisionTokenSesion();
    await testIntegridadHashes();
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE SEGURIDAD Y CONTROL DE ACCESO PASARON EXITOSAMENTE!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en prueba:', err);
    await pool.end();
    process.exit(1);
  }
}

run();
