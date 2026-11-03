// ============================================================
// db.js — Configuración del Pool de Conexiones PostgreSQL ('pg')
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

// 1. Instancia del Pool con variables del entorno (.env)
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sistema_empresarial',
  password: String(process.env.DB_PASSWORD || ''),
  port: parseInt(process.env.DB_PORT || '5432', 10),
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
});

// Manejo de errores inesperados en clientes inactivos del pool
pool.on('error', (err) => {
  console.error('⚠️  Error inesperado en cliente inactivo de PostgreSQL:', err.message);
});

/**
 * Prueba rápida de conexión a la base de datos
 * Verifica autenticación, existencia de la base de datos y latencia inicial
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS current_time, current_database() AS db_name, current_user AS db_user');
    const { current_time, db_name, db_user } = res.rows[0];
    console.log(`✅  [PostgreSQL] Conexión establecida con éxito:`);
    console.log(`    - Base de datos : ${db_name}`);
    console.log(`    - Usuario       : ${db_user}`);
    console.log(`    - Servidor      : ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    console.log(`    - Timestamp BD  : ${current_time}`);
    return true;
  } catch (error) {
    console.error('❌  [PostgreSQL] Error de conexión:');
    if (error.code === '28P01') {
      console.error('    Razón: Autenticación fallida. Revisa DB_USER y DB_PASSWORD en tu archivo .env');
    } else if (error.code === '3D000') {
      console.error(`    Razón: La base de datos "${process.env.DB_NAME}" no existe.`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('    Razón: Conexión rechazada en el host/puerto especificado.');
    } else {
      console.error(`    Detalle: ${error.message} (Código: ${error.code || 'N/A'})`);
    }
    return false;
  }
}

// Ejecución de prueba rápida inmediata si se ejecuta directamente: node db.js
if (require.main === module) {
  testConnection().then(() => pool.end());
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
};
