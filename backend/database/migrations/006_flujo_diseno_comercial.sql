-- ============================================================
-- backend/database/migrations/006_flujo_diseno_comercial.sql
-- Migración aditiva e idempotente para el nuevo flujo de:
-- Diseño -> Comercial / Recepción -> Cliente -> Coordinación / Impresión
-- ORVEX — Huellas Publicidad S.A.S.
-- ============================================================

-- 1. Nuevas columnas en archivos_arte para trazabilidad de envío a Comercial y gestión con el cliente
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS enviado_a_comercial_por UUID REFERENCES usuarios(id) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS enviado_a_comercial_nombre VARCHAR(150) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS fecha_envio_comercial TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS fecha_envio_comercial_texto VARCHAR(20) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS hora_envio_comercial_texto VARCHAR(10) DEFAULT NULL;

ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS gestion_comercial_estado VARCHAR(50) DEFAULT 'en_diseno';
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_nombre VARCHAR(150) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_canal VARCHAR(50) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_fecha TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_fecha_texto VARCHAR(20) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_hora_texto VARCHAR(10) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_evidencia TEXT DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_observaciones TEXT DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_registrado_por UUID REFERENCES usuarios(id) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS contacto_cliente_registrado_por_nombre VARCHAR(150) DEFAULT NULL;

-- 2. Asegurar índices para consultas rápidas por orden y estado de gestión comercial
CREATE INDEX IF NOT EXISTS idx_arte_orden_version ON archivos_arte (orden_id, numero_version DESC);
CREATE INDEX IF NOT EXISTS idx_arte_gestion_comercial ON archivos_arte (gestion_comercial_estado);
