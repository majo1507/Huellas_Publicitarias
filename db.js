// ============================================================
// db.js — Conexión y Pool de PostgreSQL con 'pg'
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'sistema_empresarial',
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
});

// Manejo de errores en clientes inactivos del pool
pool.on('error', (err) => {
  console.error('⚠️  Error inesperado en cliente inactivo de PostgreSQL:', err.message);
});

/**
 * Función para probar la conexión con la base de datos de manera segura
 * sin exponer credenciales en consola.
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() AS current_time, current_database() AS db_name, current_user AS db_user');
    const { current_time, db_name, db_user } = res.rows[0];
    console.log(`✅  Conectado exitosamente a PostgreSQL:`);
    console.log(`    - Base de datos : ${db_name}`);
    console.log(`    - Usuario       : ${db_user}`);
    console.log(`    - Servidor      : ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
    console.log(`    - Hora del motor: ${current_time}`);
    return true;
  } catch (error) {
    console.error('❌  No se pudo conectar a PostgreSQL:');
    if (error.code === '28P01') {
      console.error('    Razón: Autenticación fallida. Revisa DB_USER y DB_PASSWORD en tu archivo .env');
    } else if (error.code === '3D000') {
      console.error(`    Razón: La base de datos "${process.env.DB_NAME}" no existe.`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('    Razón: Conexión rechazada. Asegúrate de que el servicio de PostgreSQL esté activo y el puerto sea correcto.');
    } else {
      console.error(`    Detalle: ${error.message} (Código: ${error.code || 'N/A'})`);
    }
    return false;
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
};
