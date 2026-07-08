-- Backfill codigo field for existing processes that don't have it set.
-- Derives the code from metadata_ia->>'documento_referencia' (e.g. "SC01.pdf" → "SC01")
-- and fixes orden to be 1-indexed based on the SC number.

UPDATE proceso
SET
  codigo = UPPER(
    REGEXP_REPLACE(
      metadata_ia->>'documento_referencia',
      '\.[^.]+$', ''   -- strip extension
    )
  ),
  orden = COALESCE(
    (REGEXP_MATCH(metadata_ia->>'documento_referencia', '(\d+)'))[1]::integer,
    orden + 1
  )
WHERE
  codigo IS NULL
  AND metadata_ia->>'documento_referencia' IS NOT NULL
  AND metadata_ia->>'documento_referencia' != '';

-- For processes already with a codigo but wrong orden, also fix orden
UPDATE proceso
SET orden = (REGEXP_MATCH(codigo, '(\d+)'))[1]::integer
WHERE
  codigo IS NOT NULL
  AND (REGEXP_MATCH(codigo, '(\d+)'))[1] IS NOT NULL
  AND orden != (REGEXP_MATCH(codigo, '(\d+)'))[1]::integer;
