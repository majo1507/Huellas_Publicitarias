-- ============================================================
-- 004_fecha_envio_disenos.sql
-- Migración ADITIVA e IDEMPOTENTE:
-- Registro persistente de fecha y hora exacta de envío de
-- versiones de diseño para aprobación del cliente.
-- NO contiene DROP ni DELETE.
-- ============================================================

ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS fecha_envio_texto VARCHAR(20) DEFAULT NULL;
ALTER TABLE archivos_arte ADD COLUMN IF NOT EXISTS hora_envio_texto VARCHAR(10) DEFAULT NULL;

-- Backfill histórico para versiones enviadas previamente basándose en registro_sesion
UPDATE archivos_arte a
SET fecha_envio_texto = r.fecha_texto,
    hora_envio_texto = r.hora_texto,
    fecha_envio = r.created_at
FROM registro_sesion r
WHERE a.orden_id = r.orden_id
  AND (
    (r.accion_texto ILIKE '%versión ' || a.numero_version || '%)%')
    OR (a.numero_version = 1 AND r.accion_texto ILIKE '%enviado%' AND r.accion_texto NOT ILIKE '%versión %')
  )
  AND a.fecha_envio IS NULL;

-- Para versiones en estado pendiente/aprobado/rechazado que no cruzaron con registro_sesion
UPDATE archivos_arte
SET fecha_envio = COALESCE(fecha_envio, created_at),
    fecha_envio_texto = COALESCE(fecha_envio_texto, fecha_texto, to_char(timezone('America/Bogota', COALESCE(fecha_envio, created_at)), 'DD/MM/YYYY')),
    hora_envio_texto = COALESCE(hora_envio_texto, to_char(timezone('America/Bogota', COALESCE(fecha_envio, created_at)), 'HH24:MI'), '10:00')
WHERE estado_aprobacion IN ('pendiente', 'aprobado', 'rechazado')
  AND (fecha_envio IS NULL OR fecha_envio_texto IS NULL OR hora_envio_texto IS NULL);
