// ============================================================
// database/migrate.js — Ejecutor de migración de esquema DDL
// ============================================================
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigration() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  console.log(`⏳  Leyendo esquema DDL desde: ${schemaPath}`);

  if (!fs.existsSync(schemaPath)) {
    console.error('❌  El archivo schema.sql no existe.');
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = await pool.connect();

  try {
    console.log('⏳  Ejecutando script DDL en PostgreSQL...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅  Esquema ejecutado correctamente.');

    // Verificar las tablas creadas
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📋  Tablas disponibles en "sistema_empresarial":');
    res.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. public.${row.table_name}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌  Error durante la migración:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
