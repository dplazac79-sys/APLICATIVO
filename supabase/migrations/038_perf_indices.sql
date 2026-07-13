-- Migración 038: auditoría de performance — índice compuesto para el patrón
-- de query más caliente sobre documento (filtro por proyecto + orden por
-- fecha), que hasta ahora solo tenía índices de una sola columna.
--
-- src/app/(platform)/documentos/page.tsx hace:
--   .eq('proyecto_id', X).order('created_at', { ascending: false }).limit(100)
-- Con solo idx_documento_proyecto_id (proyecto_id), Postgres puede usar el
-- índice para el filtro pero igual necesita un sort en memoria separado
-- para el ORDER BY — a medida que un proyecto acumula documentos, ese sort
-- se vuelve el costo dominante de la query. Un índice compuesto
-- (proyecto_id, created_at desc) permite que el filtro y el orden se
-- resuelvan ambos directamente desde el índice, sin sort adicional.
create index if not exists idx_documento_proyecto_created
  on public.documento (proyecto_id, created_at desc);

-- Mismo patrón para proceso: src/app/(platform)/discovery/page.tsx hace
-- .eq('proyecto_id', X).order('nivel').order('orden') — proceso_proyecto_id_idx
-- (solo proyecto_id) cubre el filtro pero no el doble ORDER BY.
create index if not exists idx_proceso_proyecto_nivel_orden
  on public.proceso (proyecto_id, nivel, orden);
