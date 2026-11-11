-- ============================================================
-- backend/database/migrations/007_codigos_solicitudes_legado.sql
-- Migración aditiva e idempotente: asigna un código SOL- a las
-- solicitudes heredadas que quedaron sin código (se mostraban con
-- su UUID interno en la interfaz). No modifica filas que ya tienen código.
-- ORVEX — Huellas Publicidad S.A.S.
-- ============================================================
WITH base AS (
  SELECT COALESCE(MAX((substring(codigo FROM '^SOL-2026-(\d+)$'))::int), 0) AS maximo
  FROM solicitudes
),
pendientes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n
  FROM solicitudes
  WHERE codigo IS NULL OR codigo = ''
)
UPDATE solicitudes s
SET codigo = 'SOL-2026-' || LPAD((base.maximo + p.n)::text, 4, '0')
FROM pendientes p, base
WHERE s.id = p.id;
