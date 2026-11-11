-- ============================================================
-- 005_cotizacion_y_pagos.sql
-- Migración ADITIVA e IDEMPOTENTE:
-- Panel lateral de Cotización y Pagos en Solicitudes y Órdenes
-- NO contiene DROP ni DELETE.
-- ============================================================

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS cotizacion_total NUMERIC(14,2) DEFAULT 0;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(30) DEFAULT 'Pendiente de pago';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS total_abonado NUMERIC(14,2) DEFAULT 0;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(14,2) DEFAULT 0;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS tipo_pago VARCHAR(30) DEFAULT 'sin_pago';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS pagos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS cotizacion_total NUMERIC(14,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(30) DEFAULT 'Pendiente de pago';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS total_abonado NUMERIC(14,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(14,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tipo_pago VARCHAR(30) DEFAULT 'sin_pago';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS pagos JSONB DEFAULT '[]'::jsonb;

-- Tabla para persistencia y trazabilidad relacional de recibos de caja / comprobantes internos de pago
CREATE TABLE IF NOT EXISTS pagos_registro (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           VARCHAR(30) UNIQUE DEFAULT NULL,
  solicitud_id     UUID REFERENCES solicitudes(id) ON DELETE SET NULL,
  orden_id         INT REFERENCES ordenes(id) ON DELETE SET NULL,
  cliente_id       UUID REFERENCES clientes(id) ON DELETE RESTRICT,
  valor            NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  metodo_pago      VARCHAR(50) NOT NULL,
  referencia       VARCHAR(100) DEFAULT NULL,
  soporte_nota     TEXT DEFAULT NULL,
  fecha_pago       VARCHAR(30) NOT NULL,
  hora_pago        VARCHAR(10) NOT NULL,
  registrado_por   UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
  tipo_documento   VARCHAR(100) DEFAULT 'Recibo de caja interno (No constituye factura electrónica)',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_solicitud ON pagos_registro (solicitud_id);
CREATE INDEX IF NOT EXISTS idx_pagos_orden     ON pagos_registro (orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente   ON pagos_registro (cliente_id);

-- Backfill seguro para solicitudes existentes sin saldo calculado
UPDATE solicitudes
SET cotizacion_total = COALESCE(presupuesto, 0),
    saldo_pendiente = COALESCE(presupuesto, 0),
    total_abonado = 0,
    estado_pago = 'Pendiente de pago',
    tipo_pago = 'sin_pago',
    pagos = '[]'::jsonb
WHERE cotizacion_total IS NULL OR saldo_pendiente IS NULL;

-- Backfill seguro para órdenes existentes
UPDATE ordenes
SET cotizacion_total = COALESCE(presupuesto, 0),
    saldo_pendiente = COALESCE(presupuesto, 0),
    total_abonado = 0,
    estado_pago = 'Pendiente de pago',
    tipo_pago = 'sin_pago',
    pagos = '[]'::jsonb
WHERE cotizacion_total IS NULL OR saldo_pendiente IS NULL;
