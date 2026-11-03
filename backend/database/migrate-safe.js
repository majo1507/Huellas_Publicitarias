// ============================================================
// database/migrate-safe.js — Migración NO DESTRUCTIVA e IDEMPOTENTE
// ============================================================
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runSafeMigration() {
  const migrationPath = path.join(__dirname, 'migrations', '001_integracion_orvex.sql');
  console.log(`⏳  [Migración Segura] Leyendo script aditivo: ${migrationPath}`);

  if (!fs.existsSync(migrationPath)) {
    console.error('❌  El archivo 001_integracion_orvex.sql no existe.');
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();

  try {
    console.log('⏳  Aplicando cambios aditivos e idempotentes en PostgreSQL (sin DROP ni TRUNCATE)...');
    await client.query(sql);
    console.log('✅  Migración aditiva completada con éxito.');

    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n📋  Tablas verificadas (${res.rowCount}):`);
    res.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. public.${row.table_name}`);
    });
  } catch (error) {
    console.error('❌  Error durante la migración segura:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSafeMigration();
}

module.exports = { runSafeMigration };
