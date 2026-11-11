-- ============================================================
-- Reversión de 007_codigos_solicitudes_legado.sql para orvex_test.
-- Devuelve a NULL solo el código asignado a la única solicitud heredada
-- que no tenía código (verificado el 2026-11-08). Si el código ya no
-- coincide (por ejemplo, alguien lo editó), no modifica nada.
-- ============================================================
UPDATE solicitudes
SET codigo = NULL
WHERE id = 'c23cfdb8-03f5-40d4-b75e-5c460e8e418e'
  AND codigo = 'SOL-2026-0241';
