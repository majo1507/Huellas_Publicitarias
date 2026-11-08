-- ============================================================
-- 002_rbac_flujo_integral.sql
-- Migración ADITIVA e IDEMPOTENTE para RBAC, Delegación e Integridad de Flujo
-- NO contiene DROP ni DELETE.
-- ============================================================

-- 1. Tabla para delegaciones temporales por capacidades específicas
CREATE TABLE IF NOT EXISTS delegaciones_permisos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_delegante_id UUID NOT NULL REFERENCES usuarios(id),
  usuario_suplente_id  UUID NOT NULL REFERENCES usuarios(id),
  permisos_delegados   JSONB NOT NULL DEFAULT '[]'::jsonb,
  motivo               TEXT NOT NULL,
  fecha_inicio         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin            TIMESTAMP NOT NULL,
  activo               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delegaciones_suplente ON delegaciones_permisos (usuario_suplente_id, activo, fecha_inicio, fecha_fin);

-- 2. Trazabilidad única de órdenes de reimpresión por garantía
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS postventa_caso_origen_id UUID REFERENCES postventa(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orden_postventa_unica ON ordenes (postventa_caso_origen_id) WHERE postventa_caso_origen_id IS NOT NULL;

-- 3. Idempotencia en consumo real de inventario
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS consumo_inventario_descontado BOOLEAN DEFAULT false;

-- 4. Reservas dinámicas en inventario
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS stock_reservado NUMERIC(10,2) DEFAULT 0.00;

-- 5. Registro formal de déficits pendientes de abastecimiento
CREATE TABLE IF NOT EXISTS orden_material_deficit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id            INT NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  material_id         INT NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  cantidad_requerida  NUMERIC(10,2) NOT NULL,
  cantidad_disponible NUMERIC(10,2) NOT NULL,
  deficit_pendiente   NUMERIC(10,2) NOT NULL,
  resuelto            BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deficit_orden ON orden_material_deficit (orden_id, resuelto);
