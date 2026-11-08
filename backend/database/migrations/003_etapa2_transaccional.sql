-- ============================================================
-- 003_etapa2_transaccional.sql
-- Migración ADITIVA e IDEMPOTENTE para Etapa 2:
-- Candados de Calidad, Aprobación Externa, Inventario Dinámico
-- y Flujo Controlado de Reimpresiones por Garantía.
-- NO contiene DROP ni DELETE.
-- ============================================================

-- 1. Soporte y Evidencia para Aprobaciones de Arte (Digital vs Externa)
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS tipo_aprobacion   VARCHAR(30)  DEFAULT 'digital';
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_evidencia TEXT         DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_tipo      VARCHAR(50)  DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_validado  BOOLEAN      DEFAULT FALSE;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_fecha     TIMESTAMPTZ  DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_por       UUID         REFERENCES usuarios(id) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS soporte_hash      VARCHAR(64)  DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS entrega_hash            VARCHAR(64)  DEFAULT NULL;

-- 2. Tabla para Reservas Dinámicas de Insumos por Orden
CREATE TABLE IF NOT EXISTS orden_material_reserva (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id            INT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  material_id         INT NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_reservada  NUMERIC(10,2) NOT NULL CHECK (cantidad_reservada >= 0),
  estado              VARCHAR(30) NOT NULL DEFAULT 'activa', -- 'activa', 'consumida', 'liberada'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reserva_orden ON orden_material_reserva (orden_id, estado);
CREATE INDEX IF NOT EXISTS idx_reserva_material ON orden_material_reserva (material_id, estado);

-- 3. Flujo Controlado de Reimpresión por Garantía en Postventa
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS solicitud_reimpresion    BOOLEAN     DEFAULT FALSE;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS reimpresion_autorizada   BOOLEAN     DEFAULT FALSE;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS reimpresion_autorizada_por UUID      REFERENCES usuarios(id) DEFAULT NULL;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS reimpresion_fecha        TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS reimpresion_orden_id     INT         REFERENCES ordenes(id) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_postventa_solicitud_reimp ON postventa (solicitud_reimpresion, reimpresion_autorizada);
