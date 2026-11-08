// ============================================================
// database/migrate-safe.js — Migración NO DESTRUCTIVA e IDEMPOTENTE
// ============================================================
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runSafeMigration() {
  const migrationsDir = path.join(__dirname, 'migrations');
  console.log(`⏳  [Migración Segura] Leyendo scripts aditivos desde: ${migrationsDir}`);

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌  El directorio de migraciones no existe.');
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();

  try {
    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDir, file);
      console.log(`⏳  Aplicando migración ${file}...`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`✅  ${file} aplicada con éxito.`);
    }

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
