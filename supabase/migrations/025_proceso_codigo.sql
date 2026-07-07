-- Agrega campo codigo al proceso (SC01, CS02, etc.)
ALTER TABLE proceso ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Auto-poblar codigo para procesos existentes desde nombre del documento origen
UPDATE proceso p
SET codigo = upper(regexp_replace(d.nombre_archivo, '\.[^.]+$', ''))
FROM documento d
WHERE p.documento_origen_id = d.id
  AND p.codigo IS NULL
  AND d.nombre_archivo ~ '^[A-Za-z]{1,4}[0-9]{1,3}';

-- Para macroprocesos sin documento, derivar código de las iniciales del nombre
UPDATE proceso p
SET codigo = (
  SELECT string_agg(upper(left(word, 1)), '')
  FROM unnest(string_to_array(p.nombre, ' ')) AS word
  WHERE length(word) > 2
)
WHERE p.codigo IS NULL AND p.nivel = 0;

-- Índice para búsqueda
CREATE INDEX IF NOT EXISTS idx_proceso_codigo ON proceso(codigo) WHERE codigo IS NOT NULL;
