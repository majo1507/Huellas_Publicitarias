const path = require('path');
require(path.join(__dirname, '../node_modules/dotenv')).config({ path: path.join(__dirname, '../.env') });
const { pool } = require(path.join(__dirname, '../db'));

async function migrate() {
  console.log('--- Iniciando migración reversible de base de datos ORVEX ---');

  // 1. Tabla ordenes: agregar columnas para soft-delete / archivado y código de consulta seguro para portal
  await pool.query(`
    ALTER TABLE ordenes 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS codigo_consulta VARCHAR(64);
  `);
  console.log('✓ Tabla ordenes actualizada (archivado, codigo_consulta)');

  // 2. Tabla clientes: agregar archivado y codigo_consulta
  await pool.query(`
    ALTER TABLE clientes 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
  `);
  console.log('✓ Tabla clientes actualizada (archivado)');

  // 3. Tabla solicitudes: agregar archivado
  await pool.query(`
    ALTER TABLE solicitudes 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
  `);
  console.log('✓ Tabla solicitudes actualizada (archivado)');

  // 4. Tabla inventario: agregar archivado
  await pool.query(`
    ALTER TABLE inventario 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
  `);
  console.log('✓ Tabla inventario actualizada (archivado)');

  // 5. Tabla proveedores: agregar archivado y estado
  await pool.query(`
    ALTER TABLE proveedores 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'Activo';
  `);
  console.log('✓ Tabla proveedores actualizada (archivado, estado)');

  // 6. Tabla tareas: agregar archivado
  await pool.query(`
    ALTER TABLE tareas 
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
  `);
  console.log('✓ Tabla tareas actualizada (archivado)');

  // 7. Tabla postventa: soporte integral de PQRSF, Garantías, Satisfacción y portal público
  await pool.query(`
    ALTER TABLE postventa 
    ADD COLUMN IF NOT EXISTS radicado VARCHAR(50),
    ADD COLUMN IF NOT EXISTS canal VARCHAR(50) DEFAULT 'Portal Web',
    ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'PQRSF',
    ADD COLUMN IF NOT EXISTS subtipo VARCHAR(50) DEFAULT 'Petición',
    ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(150),
    ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50),
    ADD COLUMN IF NOT EXISTS dictamen_garantia VARCHAR(100),
    ADD COLUMN IF NOT EXISTS justificacion_dictamen TEXT,
    ADD COLUMN IF NOT EXISTS accion_correctiva TEXT,
    ADD COLUMN IF NOT EXISTS seguimiento TEXT,
    ADD COLUMN IF NOT EXISTS respuesta_cliente TEXT,
    ADD COLUMN IF NOT EXISTS fecha_solucion TIMESTAMP,
    ADD COLUMN IF NOT EXISTS evidencias JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS historial JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
  `);
  console.log('✓ Tabla postventa ampliada para soporte integral de PQRSF y Garantías');

  // 8. Crear tabla orden_etapa_historial para telemetría exacta de tiempos por etapa (Punto 2.3)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orden_etapa_historial (
      id SERIAL PRIMARY KEY,
      orden_id INT REFERENCES ordenes(id) ON DELETE CASCADE,
      etapa_anterior INT,
      etapa_nueva INT NOT NULL,
      etapa_nombre VARCHAR(100) NOT NULL,
      fecha_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_salida TIMESTAMP,
      tiempo_segundos INT,
      usuario_id VARCHAR(100),
      usuario_nombre VARCHAR(150),
      observaciones TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_oeh_orden_id ON orden_etapa_historial(orden_id);
    CREATE INDEX IF NOT EXISTS idx_oeh_etapa_nueva ON orden_etapa_historial(etapa_nueva);
  `);
  console.log('✓ Tabla orden_etapa_historial creada para medición de tiempos por etapa');

  console.log('--- Migración completada con éxito sin pérdida de información ---');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
