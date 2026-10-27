-- ============================================================
-- HUELLAS PUBLICITARIAS — DDL PostgreSQL
-- Base de datos: sistema_empresarial
-- ============================================================

-- Habilitar extensión para generación de UUIDs (en PostgreSQL 13+ gen_random_uuid() viene nativo)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eliminar tablas si ya existen (orden inverso a dependencias)
DROP TABLE IF EXISTS commission_details CASCADE;
DROP TABLE IF EXISTS monthly_commissions CASCADE;
DROP TABLE IF EXISTS registro_sesion CASCADE;
DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS mensajes_entrantes CASCADE;
DROP TABLE IF EXISTS canales_contacto CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS etapas_produccion CASCADE;
DROP TABLE IF EXISTS postventa CASCADE;
DROP TABLE IF EXISTS archivos_arte CASCADE;
DROP TABLE IF EXISTS ordenes CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- Eliminar tipos ENUM si existen
DROP TYPE IF EXISTS rol_usuario CASCADE;
DROP TYPE IF EXISTS estado_cliente CASCADE;
DROP TYPE IF EXISTS prioridad_orden CASCADE;
DROP TYPE IF EXISTS estado_aprobacion_arte CASCADE;
DROP TYPE IF EXISTS tipo_postventa CASCADE;
DROP TYPE IF EXISTS estado_solicitud CASCADE;
DROP TYPE IF EXISTS tipo_movimiento_inv CASCADE;
DROP TYPE IF EXISTS canal_contacto_tipo CASCADE;

-- ============================================================
-- TIPOS ENUM
-- ============================================================
CREATE TYPE rol_usuario AS ENUM ('ejecutiva', 'disenador', 'coord', 'produccion', 'gerente');
CREATE TYPE estado_cliente AS ENUM ('Activo', 'En riesgo', 'Nuevo');
CREATE TYPE prioridad_orden AS ENUM ('Alta', 'Media', 'Baja');
CREATE TYPE estado_aprobacion_arte AS ENUM ('borrador', 'pendiente', 'aprobado', 'rechazado');
CREATE TYPE tipo_postventa AS ENUM ('Ajuste', 'Garantía', 'Reclamo', 'Comentario');

-- ============================================================
-- 1. TABLA USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) DEFAULT NULL,
  rol             rol_usuario  NOT NULL,
  esta_activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. TABLA CLIENTES
-- ============================================================
CREATE TABLE clientes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa            VARCHAR(200)   NOT NULL,
  nit                VARCHAR(30)    NOT NULL UNIQUE,
  contacto_principal VARCHAR(150)   NOT NULL,
  telefono           VARCHAR(30)    DEFAULT NULL,
  correo             VARCHAR(255)   DEFAULT NULL,
  ejecutiva_id       UUID           NOT NULL,
  estado             estado_cliente NOT NULL DEFAULT 'Nuevo',
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_clientes_ejecutiva
    FOREIGN KEY (ejecutiva_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_clientes_ejecutiva ON clientes (ejecutiva_id);

-- ============================================================
-- 3. TABLA ORDENES (Flujo productivo)
-- ============================================================
CREATE TABLE ordenes (
  id                SERIAL PRIMARY KEY,
  cliente_id        UUID           NOT NULL,
  producto          VARCHAR(255)   NOT NULL,
  ejecutiva_id      UUID           NOT NULL,
  disenador_id      UUID           DEFAULT NULL,
  produccion_id     UUID           DEFAULT NULL,
  etapa             INT            NOT NULL DEFAULT 0,
  prioridad         prioridad_orden NOT NULL DEFAULT 'Media',
  porcentaje_avance NUMERIC(5,2)   NOT NULL DEFAULT 0.00,
  bloqueado         BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_ordenes_etapa CHECK (etapa BETWEEN 0 AND 8),

  CONSTRAINT fk_ordenes_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_ordenes_ejecutiva
    FOREIGN KEY (ejecutiva_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_ordenes_disenador
    FOREIGN KEY (disenador_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_ordenes_produccion
    FOREIGN KEY (produccion_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_ordenes_cliente    ON ordenes (cliente_id);
CREATE INDEX idx_ordenes_ejecutiva  ON ordenes (ejecutiva_id);
CREATE INDEX idx_ordenes_disenador  ON ordenes (disenador_id);
CREATE INDEX idx_ordenes_produccion ON ordenes (produccion_id);
CREATE INDEX idx_ordenes_etapa      ON ordenes (etapa);

-- Función y trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ordenes_updated_at
BEFORE UPDATE ON ordenes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 4. TABLA ARCHIVOS DE ARTE (Versiones de diseño por orden)
-- ============================================================
CREATE TABLE archivos_arte (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id          INT                    NOT NULL,
  numero_version    INT                    NOT NULL DEFAULT 1,
  ruta_archivo      VARCHAR(500)           DEFAULT NULL,
  creador_id        UUID                   NOT NULL,
  estado_aprobacion estado_aprobacion_arte NOT NULL DEFAULT 'borrador',
  decision_por      UUID                   DEFAULT NULL,
  comentario        TEXT                   DEFAULT NULL,
  created_at        TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_arte_version UNIQUE (orden_id, numero_version),

  CONSTRAINT fk_arte_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_arte_creador
    FOREIGN KEY (creador_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_arte_decision
    FOREIGN KEY (decision_por) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX idx_arte_orden   ON archivos_arte (orden_id);
CREATE INDEX idx_arte_creador ON archivos_arte (creador_id);

-- ============================================================
-- 5. TABLA POSTVENTA
-- ============================================================
CREATE TABLE postventa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id          INT            NOT NULL,
  ejecutiva_id      UUID           NOT NULL,
  tipo              tipo_postventa NOT NULL,
  nivel_conformidad INT            DEFAULT NULL,
  descripcion       TEXT           DEFAULT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_pv_conformidad CHECK (nivel_conformidad BETWEEN 1 AND 5),

  CONSTRAINT fk_pv_orden
    FOREIGN KEY (orden_id) REFERENCES ordenes(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_pv_ejecutiva
    FOREIGN KEY (ejecutiva_id) REFERENCES usuarios(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX idx_pv_orden     ON postventa (orden_id);
CREATE INDEX idx_pv_ejecutiva ON postventa (ejecutiva_id);

-- ============================================================
-- ==== EXTENSIÓN: 10 TABLAS COMPLEMENTARIAS ====
-- ============================================================

-- Tipos ENUM de la extensión
CREATE TYPE estado_solicitud    AS ENUM ('pendiente', 'cotizada', 'aprobada', 'rechazada', 'convertida');
CREATE TYPE tipo_movimiento_inv AS ENUM ('entrada', 'salida');
CREATE TYPE canal_contacto_tipo AS ENUM ('wa', 'mail', 'call');

-- ============================================================
-- 6. TABLA ETAPAS_PRODUCCION (catálogo fijo 0..8)
-- ============================================================
CREATE TABLE etapas_produccion (
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
  (8, 'Entregada / Finalizada');

-- ============================================================
-- 7. TABLA INVENTARIO (catálogo de materiales)
-- ============================================================
CREATE TABLE inventario (
  id              SERIAL PRIMARY KEY,
  nombre_material VARCHAR(200)  NOT NULL UNIQUE,
  stock_actual    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  stock_minimo    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_inv_stock_actual CHECK (stock_actual >= 0),
  CONSTRAINT chk_inv_stock_minimo CHECK (stock_minimo >= 0)
);

CREATE TRIGGER trg_inventario_updated_at
BEFORE UPDATE ON inventario
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 8. TABLA SOLICITUDES (cotizaciones previas a la orden)
-- ============================================================
CREATE TABLE solicitudes (
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

CREATE INDEX idx_sol_cliente   ON solicitudes (cliente_id);
CREATE INDEX idx_sol_ejecutiva ON solicitudes (ejecutiva_id);
CREATE INDEX idx_sol_estado    ON solicitudes (estado);

CREATE TRIGGER trg_solicitudes_updated_at
BEFORE UPDATE ON solicitudes
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 9. TABLA MOVIMIENTOS_INVENTARIO (trazabilidad entradas/salidas)
-- ============================================================
CREATE TABLE movimientos_inventario (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id            INT                 NOT NULL,
  orden_id               INT                 DEFAULT NULL,  -- NULL en entradas (compras)
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

CREATE INDEX idx_mov_material_fecha ON movimientos_inventario (material_id, created_at);
CREATE INDEX idx_mov_orden          ON movimientos_inventario (orden_id);
CREATE INDEX idx_mov_usuario        ON movimientos_inventario (usuario_responsable_id);

-- ============================================================
-- 10. TABLA CANALES_CONTACTO (hilos de conversación)
-- ============================================================
CREATE TABLE canales_contacto (
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

CREATE INDEX idx_canal_cliente ON canales_contacto (cliente_id);
CREATE INDEX idx_canal_orden   ON canales_contacto (orden_id);
CREATE INDEX idx_canal_usuario ON canales_contacto (usuario_responsable_id);

-- ============================================================
-- 11. TABLA MENSAJES_ENTRANTES (burbujas de chat)
-- ============================================================
CREATE TABLE mensajes_entrantes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id     UUID         NOT NULL,
  remitente    VARCHAR(150) NOT NULL,
  texto        TEXT         NOT NULL,
  marca_tiempo TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_msg_canal
    FOREIGN KEY (canal_id) REFERENCES canales_contacto(id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_msg_canal_tiempo ON mensajes_entrantes (canal_id, marca_tiempo);

-- ============================================================
-- 12. TABLA TAREAS (sub-actividades de una orden)
-- ============================================================
CREATE TABLE tareas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id     INT          NOT NULL,
  owner_id     UUID         DEFAULT NULL,
  titulo       VARCHAR(255) NOT NULL,
  porcentaje   NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  dependencias JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- array de ids de tareas
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

CREATE INDEX idx_tarea_orden ON tareas (orden_id);
CREATE INDEX idx_tarea_owner ON tareas (owner_id);

CREATE TRIGGER trg_tareas_updated_at
BEFORE UPDATE ON tareas
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 13. TABLA REGISTRO_SESION (bitácora inmutable)
-- ============================================================
CREATE TABLE registro_sesion (
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

CREATE INDEX idx_reg_orden_fecha ON registro_sesion (orden_id, created_at);
CREATE INDEX idx_reg_usuario     ON registro_sesion (usuario_responsable_id);

-- Inmutabilidad: bloquear UPDATE, DELETE y TRUNCATE
CREATE OR REPLACE FUNCTION bloquear_modificacion_registro()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'registro_sesion es inmutable: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_registro_sesion_inmutable
BEFORE UPDATE OR DELETE ON registro_sesion
FOR EACH ROW
EXECUTE FUNCTION bloquear_modificacion_registro();

CREATE TRIGGER trg_registro_sesion_no_truncate
BEFORE TRUNCATE ON registro_sesion
FOR EACH STATEMENT
EXECUTE FUNCTION bloquear_modificacion_registro();

-- ============================================================
-- 14. TABLA MONTHLY_COMMISSIONS (comisión mensual por ejecutiva)
-- ============================================================
CREATE TABLE monthly_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id          UUID          NOT NULL,
  month_reference  DATE          NOT NULL,  -- siempre día 1 del mes
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

CREATE TRIGGER trg_monthly_commissions_updated_at
BEFORE UPDATE ON monthly_commissions
FOR EACH ROW
EXECUTE FUNCTION actualizar_timestamp_updated_at();

-- ============================================================
-- 15. TABLA COMMISSION_DETAILS (detalle por orden)
-- ============================================================
CREATE TABLE commission_details (
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

CREATE INDEX idx_cd_order ON commission_details (order_id);
