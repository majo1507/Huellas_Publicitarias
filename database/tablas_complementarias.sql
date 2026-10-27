-- ============================================================
-- HUELLAS PUBLICITARIAS — 10 TABLAS COMPLEMENTARIAS
-- Base de datos: sistema_empresarial (PostgreSQL 13+)
--
-- Requiere que ya existan las 5 tablas base:
--   1. usuarios (id UUID PK, rol, ...)
--   2. clientes (id UUID PK, ejecutiva_id FK a usuarios, ...)
--   3. ordenes (id SERIAL PK, cliente_id FK, ejecutiva_id FK, ...)
--   4. archivos_arte (id UUID PK, orden_id FK a ordenes, ...)
--   5. postventa (id UUID PK, orden_id FK a ordenes, ...)
-- ============================================================

-- Tipos ENUM complementarios (crear solo si no existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud') THEN
    CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'cotizada', 'aprobada', 'rechazada', 'convertida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimiento_inv') THEN
    CREATE TYPE tipo_movimiento_inv AS ENUM ('entrada', 'salida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_contacto_tipo') THEN
    CREATE TYPE canal_contacto_tipo AS ENUM ('wa', 'mail', 'call');
  END IF;
END $$;

-- Función genérica para updated_at (por si no existe)
CREATE OR REPLACE FUNCTION actualizar_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. TABLA ETAPAS_PRODUCCION (Catálogo fijo 0 al 8)
-- ============================================================
CREATE TABLE IF NOT EXISTS etapas_produccion (
  id           INT          PRIMARY KEY,
  nombre_etapa VARCHAR(100) NOT NULL UNIQUE,

  CONSTRAINT chk_etapa_rango CHECK (id BETWEEN 0 AND 8)
);

INSERT INTO etapas_produccion (id, nombre_etapa) VALUES
  (0, 'Solicitud Recibida'),
  (1, 'Diseño en Proceso'),
  (2, 'En Aprobación de Cliente'),
  (3, 'Preprensa / Archivos Finales'),
  (4, 'En Impresión'),
  (5, 'Confección y Acabados'),
  (6, 'Control de Calidad'),
  (7, 'En Instalación / Despacho'),
  (8, 'Entregada / Finalizada')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. TABLA INVENTARIO (Catálogo de materiales y stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventario (
  id              SERIAL PRIMARY KEY,
  nombre_material VARCHAR(200)  NOT NULL UNIQUE,
  stock_actual    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  stock_minimo    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_inv_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT chk_inv_stock_minimo CHECK (stock_minimo >= 0)
);

DROP TRIGGER IF EXISTS trg_inventario_updated_at ON inventario;
CREATE TRIGGER trg_inventario_updated_at
BEFORE UPDATE ON inventario
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 3. TABLA SOLICITUDES (Cotizaciones previas a orden formal)
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID             NOT NULL,
  ejecutiva_id UUID             NOT NULL,
  descripcion  TEXT             NOT NULL,
  estado       estado_solicitud NOT NULL DEFAULT 'pendiente',
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sol_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_sol_ejecutiva
    FOREIGN KEY (ejecutiva_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sol_cliente   ON solicitudes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_sol_ejecutiva ON solicitudes (ejecutiva_id);
CREATE INDEX IF NOT EXISTS idx_sol_estado    ON solicitudes (estado);

DROP TRIGGER IF EXISTS trg_solicitudes_updated_at ON solicitudes;
CREATE TRIGGER trg_solicitudes_updated_at
BEFORE UPDATE ON solicitudes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 4. TABLA MOVIMIENTOS_INVENTARIO (Trazabilidad entradas/salidas)
-- ============================================================
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id            INT                 NOT NULL,
  orden_id               INT                 DEFAULT NULL,
  usuario_responsable_id UUID                NOT NULL,
  cantidad               NUMERIC(12,2)       NOT NULL,
  tipo                   tipo_movimiento_inv NOT NULL,
  created_at             TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_mov_cantidad CHECK (cantidad > 0),

  CONSTRAINT fk_mov_material
    FOREIGN KEY (material_id) REFERENCES inventario(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_mov_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_mov_usuario
    FOREIGN KEY (usuario_responsable_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_mov_material_fecha ON movimientos_inventario (material_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mov_orden          ON movimientos_inventario (orden_id);
CREATE INDEX IF NOT EXISTS idx_mov_usuario        ON movimientos_inventario (usuario_responsable_id);

-- ============================================================
-- 5. TABLA CANALES_CONTACTO (Hilos de chat / comunicación)
-- ============================================================
CREATE TABLE IF NOT EXISTS canales_contacto (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal                  canal_contacto_tipo NOT NULL,
  cliente_id             UUID                NOT NULL,
  orden_id               INT                 DEFAULT NULL,
  usuario_responsable_id UUID                DEFAULT NULL,
  created_at             TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_canal_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_canal_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_canal_usuario
    FOREIGN KEY (usuario_responsable_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_canal_cliente ON canales_contacto (cliente_id);
CREATE INDEX IF NOT EXISTS idx_canal_orden   ON canales_contacto (orden_id);
CREATE INDEX IF NOT EXISTS idx_canal_usuario ON canales_contacto (usuario_responsable_id);

-- ============================================================
-- 6. TABLA MENSAJES_ENTRANTES (Burbujas de texto)
-- ============================================================
CREATE TABLE IF NOT EXISTS mensajes_entrantes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id     UUID         NOT NULL,
  remitente    VARCHAR(150) NOT NULL,
  texto        TEXT         NOT NULL,
  marca_tiempo TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_msg_canal
    FOREIGN KEY (canal_id) REFERENCES canales_contacto(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_msg_canal_tiempo ON mensajes_entrantes (canal_id, marca_tiempo);

-- ============================================================
-- 7. TABLA TAREAS (Sub-actividades de las órdenes)
-- ============================================================
CREATE TABLE IF NOT EXISTS tareas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id     INT          NOT NULL,
  owner_id     UUID         DEFAULT NULL,
  titulo       VARCHAR(255) NOT NULL,
  porcentaje   NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  dependencias JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_tarea_porcentaje   CHECK (porcentaje BETWEEN 0 AND 100),
  CONSTRAINT chk_tarea_dependencias CHECK (jsonb_typeof(dependencias) = 'array'),

  CONSTRAINT fk_tarea_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_tarea_owner
    FOREIGN KEY (owner_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tarea_orden ON tareas (orden_id);
CREATE INDEX IF NOT EXISTS idx_tarea_owner ON tareas (owner_id);

DROP TRIGGER IF EXISTS trg_tareas_updated_at ON tareas;
CREATE TRIGGER trg_tareas_updated_at
BEFORE UPDATE ON tareas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 8. TABLA REGISTRO_SESION (Historial inmutable de auditoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS registro_sesion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id               INT         NOT NULL,
  usuario_responsable_id UUID        NOT NULL,
  accion_texto           TEXT        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_reg_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,

  CONSTRAINT fk_reg_usuario
    FOREIGN KEY (usuario_responsable_id) REFERENCES usuarios(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reg_orden_fecha ON registro_sesion (orden_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reg_usuario     ON registro_sesion (usuario_responsable_id);

-- Inmutabilidad en PostgreSQL
CREATE OR REPLACE FUNCTION bloquear_modificacion_registro()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'registro_sesion es inmutable: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registro_sesion_inmutable ON registro_sesion;
CREATE TRIGGER trg_registro_sesion_inmutable
BEFORE UPDATE OR DELETE ON registro_sesion
FOR EACH ROW
EXECUTE FUNCTION bloquear_modificacion_registro();

DROP TRIGGER IF EXISTS trg_registro_sesion_no_truncate ON registro_sesion;
CREATE TRIGGER trg_registro_sesion_no_truncate
BEFORE TRUNCATE ON registro_sesion
FOR EACH STATEMENT
EXECUTE FUNCTION bloquear_modificacion_registro();

-- ============================================================
-- 9. TABLA MONTHLY_COMMISSIONS (Finanzas y comisiones)
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id          UUID          NOT NULL,
  month_reference  DATE          NOT NULL,
  total_commission NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_mc_exec_mes UNIQUE (exec_id, month_reference),
  CONSTRAINT chk_mc_dia_uno CHECK (EXTRACT(DAY FROM month_reference) = 1),
  CONSTRAINT chk_mc_total   CHECK (total_commission >= 0),

  CONSTRAINT fk_mc_exec
    FOREIGN KEY (exec_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

DROP TRIGGER IF EXISTS trg_monthly_commissions_updated_at ON monthly_commissions;
CREATE TRIGGER trg_monthly_commissions_updated_at
BEFORE UPDATE ON monthly_commissions
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 10. TABLA COMMISSION_DETAILS (Detalle financiero por orden)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_details (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID          NOT NULL,
  order_id      INT           NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_cd_comision_orden UNIQUE (commission_id, order_id),
  CONSTRAINT chk_cd_amount CHECK (amount >= 0),

  CONSTRAINT fk_cd_commission
    FOREIGN KEY (commission_id) REFERENCES monthly_commissions(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_cd_order
    FOREIGN KEY (order_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cd_order ON commission_details (order_id);
