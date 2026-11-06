-- ============================================================
-- 001_integracion_orvex.sql
-- Migración 100% ADITIVA e IDEMPOTENTE para la integración ORVEX
-- NO contiene DROP, TRUNCATE ni DELETE.
-- Si las tablas base aún no existen (base de datos limpia), las crea.
-- Si ya existen (base de datos compartida), solo agrega columnas/valores nuevos.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tipos ENUM (creación segura y extensión aditiva)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
    CREATE TYPE rol_usuario AS ENUM ('ejecutiva', 'disenador', 'coord', 'produccion', 'gerente', 'postventa');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cliente') THEN
    CREATE TYPE estado_cliente AS ENUM ('Activo', 'En riesgo', 'Nuevo');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridad_orden') THEN
    CREATE TYPE prioridad_orden AS ENUM ('Alta', 'Media', 'Baja');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_aprobacion_arte') THEN
    CREATE TYPE estado_aprobacion_arte AS ENUM ('borrador', 'pendiente', 'aprobado', 'rechazado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_postventa') THEN
    CREATE TYPE tipo_postventa AS ENUM ('Ajuste', 'Garantía', 'Reclamo', 'Comentario', 'Reimpresión');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud') THEN
    CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'cotizada', 'aprobada', 'rechazada', 'convertida', 'en_validacion', 'devuelta');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimiento_inv') THEN
    CREATE TYPE tipo_movimiento_inv AS ENUM ('entrada', 'salida');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_contacto_tipo') THEN
    CREATE TYPE canal_contacto_tipo AS ENUM ('wa', 'mail', 'call');
  END IF;
END $$;

ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'postventa';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Reimpresión';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Petición';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Queja';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Sugerencia';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Felicitación';
ALTER TYPE tipo_postventa ADD VALUE IF NOT EXISTS 'Satisfacción';
ALTER TYPE estado_solicitud ADD VALUE IF NOT EXISTS 'en_validacion';
ALTER TYPE estado_solicitud ADD VALUE IF NOT EXISTS 'devuelta';

-- Función genérica para updated_at
CREATE OR REPLACE FUNCTION actualizar_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Creación de tablas base (solo si no existen)
CREATE TABLE IF NOT EXISTS usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) DEFAULT NULL,
  rol             rol_usuario  NOT NULL,
  esta_activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa            VARCHAR(200)   NOT NULL,
  nit                VARCHAR(30)    NOT NULL UNIQUE,
  contacto_principal VARCHAR(150)   NOT NULL,
  telefono           VARCHAR(30)    DEFAULT NULL,
  correo             VARCHAR(255)   DEFAULT NULL,
  ejecutiva_id       UUID           NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estado             estado_cliente NOT NULL DEFAULT 'Nuevo',
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ordenes (
  id                SERIAL PRIMARY KEY,
  cliente_id        UUID            NOT NULL REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  producto          VARCHAR(255)    NOT NULL,
  ejecutiva_id      UUID            NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  disenador_id      UUID            DEFAULT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  produccion_id     UUID            DEFAULT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  etapa             INT             NOT NULL DEFAULT 0 CHECK (etapa BETWEEN 0 AND 8),
  prioridad         prioridad_orden NOT NULL DEFAULT 'Media',
  porcentaje_avance NUMERIC(5,2)    NOT NULL DEFAULT 0.00,
  bloqueado         BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archivos_arte (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id          INT                    NOT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  numero_version    INT                    NOT NULL DEFAULT 1,
  ruta_archivo      VARCHAR(500)           DEFAULT NULL,
  creador_id        UUID                   NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  estado_aprobacion estado_aprobacion_arte NOT NULL DEFAULT 'borrador',
  decision_por      UUID                   DEFAULT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  comentario        TEXT                   DEFAULT NULL,
  created_at        TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_arte_version UNIQUE (orden_id, numero_version)
);

CREATE TABLE IF NOT EXISTS postventa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id          INT            NOT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ejecutiva_id      UUID           NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  tipo              tipo_postventa NOT NULL,
  nivel_conformidad INT            DEFAULT NULL CHECK (nivel_conformidad BETWEEN 1 AND 5),
  descripcion       TEXT           DEFAULT NULL,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS etapas_produccion (
  id           INT          PRIMARY KEY CHECK (id BETWEEN 0 AND 8),
  nombre_etapa VARCHAR(100) NOT NULL UNIQUE
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

CREATE TABLE IF NOT EXISTS inventario (
  id              SERIAL PRIMARY KEY,
  nombre_material VARCHAR(200)  NOT NULL UNIQUE,
  stock_actual    NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (stock_actual >= 0),
  stock_minimo    NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (stock_minimo >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID             NOT NULL REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ejecutiva_id UUID             NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  descripcion  TEXT             NOT NULL,
  estado       estado_solicitud NOT NULL DEFAULT 'pendiente',
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id            INT                 NOT NULL REFERENCES inventario(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  orden_id               INT                 DEFAULT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  usuario_responsable_id UUID                NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  cantidad               NUMERIC(12,2)       NOT NULL CHECK (cantidad > 0),
  tipo                   tipo_movimiento_inv NOT NULL,
  created_at             TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS canales_contacto (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal                  canal_contacto_tipo NOT NULL,
  cliente_id             UUID                NOT NULL REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  orden_id               INT                 DEFAULT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE SET NULL,
  usuario_responsable_id UUID                DEFAULT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at             TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mensajes_entrantes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id     UUID         NOT NULL REFERENCES canales_contacto(id) ON UPDATE CASCADE ON DELETE CASCADE,
  remitente    VARCHAR(150) NOT NULL,
  texto        TEXT         NOT NULL,
  marca_tiempo TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tareas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id     INT          NOT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE CASCADE,
  owner_id     UUID         DEFAULT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  titulo       VARCHAR(255) NOT NULL,
  porcentaje   NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (porcentaje BETWEEN 0 AND 100),
  dependencias JSONB        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dependencias) = 'array'),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registro_sesion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id               INT         NOT NULL REFERENCES ordenes(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  usuario_responsable_id UUID        NOT NULL REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  accion_texto           TEXT        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION bloquear_modificacion_registro()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'registro_sesion es inmutable: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_registro_sesion_inmutable') THEN
    CREATE TRIGGER trg_registro_sesion_inmutable
    BEFORE UPDATE OR DELETE ON registro_sesion
    FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion_registro();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_registro_sesion_no_truncate') THEN
    CREATE TRIGGER trg_registro_sesion_no_truncate
    BEFORE TRUNCATE ON registro_sesion
    FOR EACH STATEMENT EXECUTE FUNCTION bloquear_modificacion_registro();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS monthly_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exec_id          UUID          NOT NULL REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  month_reference  DATE          NOT NULL CHECK (EXTRACT(DAY FROM month_reference) = 1),
  total_commission NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_commission >= 0),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_mc_exec_mes UNIQUE (exec_id, month_reference)
);

CREATE TABLE IF NOT EXISTS commission_details (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID          NOT NULL REFERENCES monthly_commissions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  order_id      INT           NOT NULL REFERENCES ordenes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_cd_comision_orden UNIQUE (commission_id, order_id)
);

-- ============================================================
-- 3. COLUMNAS ADITIVAS PARA INTEGRACIÓN COMPLETA CON EL FRONTEND ORVEX
-- ============================================================

-- 3.1 Usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo  VARCHAR(150) DEFAULT NULL;

-- 3.2 Clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo    VARCHAR(20) UNIQUE DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) DEFAULT 'Cra 15 # 80-20';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ciudad    VARCHAR(100) DEFAULT 'Bogotá';

-- 3.3 Solicitudes
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS codigo          VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS producto        VARCHAR(255) DEFAULT NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS cantidad        INT DEFAULT 1;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS dimensiones     VARCHAR(120) DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS material        VARCHAR(150) DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_solicitud VARCHAR(30) DEFAULT NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_entrega   VARCHAR(30) DEFAULT NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS presupuesto     NUMERIC(14,2) DEFAULT 0;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS requerimientos  TEXT DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS observaciones   TEXT DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS motivo_rechazo  TEXT DEFAULT '';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS orden_id        INT DEFAULT NULL REFERENCES ordenes(id) ON DELETE SET NULL;

-- 3.4 Órdenes
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS codigo                    VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS solicitud_codigo          VARCHAR(30) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS cantidad                  INT DEFAULT 1;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS material                  VARCHAR(150) DEFAULT 'Lona';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS dimensiones               VARCHAR(120) DEFAULT 'Estándar';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS colores                   VARCHAR(200) DEFAULT 'Por definir en pre-prensa';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS acabados                  VARCHAR(200) DEFAULT 'Corte y empaque estándar';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_solicitud           VARCHAR(30) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_entrega             VARCHAR(30) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS estado_nombre             VARCHAR(50) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS diseno_estado             VARCHAR(50) DEFAULT 'Pendiente';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS responsable_nombre        VARCHAR(150) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS disenador_nombre_asignado VARCHAR(150) DEFAULT 'María López';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS presupuesto               NUMERIC(14,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS costo_interno             NUMERIC(14,2) DEFAULT 0;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS metodo_entrega            VARCHAR(100) DEFAULT 'Domicilio';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS requerimientos            TEXT DEFAULT '';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS observaciones             TEXT DEFAULT '';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS motivo_bloqueo            TEXT DEFAULT '';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS entrega_json              JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS cerrado_por               VARCHAR(150) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_cierre              VARCHAR(30) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS motivo_cierre             TEXT DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS reabierto_por             VARCHAR(150) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_reapertura          VARCHAR(30) DEFAULT NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS es_reimpresion            BOOLEAN DEFAULT FALSE;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS orden_original_codigo     VARCHAR(30) DEFAULT NULL;

-- 3.5 Archivos de arte
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS fecha_texto      VARCHAR(30) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS disenador_nombre VARCHAR(150) DEFAULT 'María López';
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS estado_ui        VARCHAR(40) DEFAULT 'En proceso';
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS archivo_nombre   VARCHAR(255) DEFAULT NULL;

-- 3.6 Registro de sesión (bitácora inmutable)
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS fecha_texto        VARCHAR(30) DEFAULT NULL;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS hora_texto         VARCHAR(20) DEFAULT NULL;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(150) DEFAULT NULL;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS estado_evento      VARCHAR(40) DEFAULT 'Completado';
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS interno            BOOLEAN DEFAULT FALSE;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS estado_anterior    VARCHAR(50) DEFAULT NULL;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS nuevo_estado       VARCHAR(50) DEFAULT NULL;
ALTER TABLE registro_sesion ADD COLUMN IF NOT EXISTS motivo             TEXT DEFAULT NULL;

-- 3.7 Tareas de taller
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS codigo             VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS etapa              VARCHAR(60) DEFAULT 'Impresión';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(150) DEFAULT 'Juan Pérez';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS prioridad          VARCHAR(30) DEFAULT 'Media';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_limite       VARCHAR(30) DEFAULT NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS estado             VARCHAR(40) DEFAULT 'Pendiente';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS notas              JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS incidencias        JSONB DEFAULT '[]'::jsonb;

-- 3.8 Postventa
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS codigo             VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS fecha_texto        VARCHAR(30) DEFAULT NULL;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(150) DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS estado             VARCHAR(40) DEFAULT 'Abierto';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS prioridad          VARCHAR(30) DEFAULT 'Media';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS solucion           TEXT DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS fecha_solucion     VARCHAR(30) DEFAULT NULL;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS resuelto_por       VARCHAR(150) DEFAULT NULL;

-- 3.9 Comunicaciones (canales_contacto y mensajes_entrantes)
ALTER TABLE canales_contacto ADD COLUMN IF NOT EXISTS codigo             VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE canales_contacto ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(150) DEFAULT 'Ana Martínez';
ALTER TABLE canales_contacto ADD COLUMN IF NOT EXISTS estado             VARCHAR(50) DEFAULT 'Pendiente de respuesta';
ALTER TABLE canales_contacto ADD COLUMN IF NOT EXISTS asunto             VARCHAR(255) DEFAULT '';

ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS de          VARCHAR(30) DEFAULT 'usuario';
ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS fecha_texto VARCHAR(30) DEFAULT NULL;
ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS hora_texto  VARCHAR(20) DEFAULT NULL;
ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS adjuntos    JSONB DEFAULT NULL;
ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS duracion    VARCHAR(30) DEFAULT NULL;
ALTER TABLE mensajes_entrantes ADD COLUMN IF NOT EXISTS resumen     TEXT DEFAULT NULL;

-- 3.10 Archivos de referencia en solicitudes y órdenes + Inventario y Proveedores enriquecidos
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS archivos_referencia JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ordenes     ADD COLUMN IF NOT EXISTS archivos_referencia JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS proveedores (
  id         SERIAL PRIMARY KEY,
  codigo     VARCHAR(30) UNIQUE DEFAULT NULL,
  nombre     VARCHAR(200) NOT NULL,
  nit        VARCHAR(40)  DEFAULT '',
  contacto   VARCHAR(150) DEFAULT '',
  telefono   VARCHAR(40)  DEFAULT '',
  correo     VARCHAR(255) DEFAULT '',
  ciudad     VARCHAR(100) DEFAULT 'Bogotá',
  productos  JSONB        DEFAULT '[]'::jsonb,
  estado     VARCHAR(40)  DEFAULT 'Activo',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inventario ADD COLUMN IF NOT EXISTS codigo              VARCHAR(30) UNIQUE DEFAULT NULL;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS descripcion         TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS categoria           VARCHAR(120) DEFAULT 'Insumos de impresión';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS unidad              VARCHAR(60)  DEFAULT 'Unidades';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS cantidad_utilizada  NUMERIC(12,2) DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS costo_unitario      NUMERIC(14,2) DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS proveedor_codigo    VARCHAR(30) DEFAULT '';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS proveedor_nombre    VARCHAR(200) DEFAULT 'Por definir';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS fecha_actualizacion VARCHAR(30) DEFAULT NULL;

ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS codigo             VARCHAR(30) DEFAULT NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS fecha_texto        VARCHAR(30) DEFAULT NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS hora_texto         VARCHAR(20) DEFAULT NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS costo_total        NUMERIC(14,2) DEFAULT 0;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS responsable_nombre VARCHAR(150) DEFAULT NULL;
ALTER TABLE movimientos_inventario ADD COLUMN IF NOT EXISTS observacion        TEXT DEFAULT '';

-- 3.11 Ampliación de Postventa (Satisfacción, PQRSF y Garantías) y Formularios Comerciales
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20)  DEFAULT 'NIT';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_cliente   VARCHAR(100) DEFAULT 'Persona Jurídica (Empresa)';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pais           VARCHAR(80)  DEFAULT 'Colombia';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS departamento   VARCHAR(100) DEFAULT 'Antioquia';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS municipio      VARCHAR(100) DEFAULT 'Medellín';

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS prioridad      VARCHAR(30)  DEFAULT 'Media';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS metodo_entrega VARCHAR(100) DEFAULT 'Domicilio';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS acabados       VARCHAR(255) DEFAULT 'Corte y empaque estándar';

ALTER TABLE postventa ADD COLUMN IF NOT EXISTS categoria              VARCHAR(40)  DEFAULT 'PQRSF';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS subtipo                VARCHAR(60)  DEFAULT 'Reclamo';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS motivo                 VARCHAR(255) DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS dictamen_garantia      VARCHAR(100) DEFAULT 'Pendiente de evaluación';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS justificacion_dictamen TEXT         DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS accion_correctiva      VARCHAR(150) DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS respuesta_cliente      TEXT         DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS seguimiento            TEXT         DEFAULT '';
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS evidencias             JSONB        DEFAULT '[]'::jsonb;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS historial              JSONB        DEFAULT '[]'::jsonb;
ALTER TABLE postventa ADD COLUMN IF NOT EXISTS aspectos_evaluados     JSONB        DEFAULT '[]'::jsonb;

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20)  DEFAULT 'NIT';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS pais           VARCHAR(80)  DEFAULT 'Colombia';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS departamento   VARCHAR(100) DEFAULT 'Antioquia';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS municipio      VARCHAR(100) DEFAULT 'Medellín';
