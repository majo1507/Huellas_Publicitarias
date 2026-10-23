-- ============================================================
-- HUELLAS PUBLICITARIAS — DDL PostgreSQL
-- Base de datos: sistema_empresarial
-- ============================================================

-- Habilitar extensión para generación de UUIDs (en PostgreSQL 13+ gen_random_uuid() viene nativo)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Eliminar tablas si ya existen (orden inverso a dependencias)
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
