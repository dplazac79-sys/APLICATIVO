-- ============================================================
-- Migración: Voyage AI → embeddings locales (384 dims)
-- Modelo: all-MiniLM-L6-v2 via @xenova/transformers
-- ============================================================

-- Eliminar índice HNSW existente (no permite cambio de dimensión in-place)
drop index if exists public.documento_embedding_idx;

-- Eliminar función anterior ligada a vector(1024)
drop function if exists public.buscar_documentos_semantico(vector(1024), uuid, int);

-- Reemplazar columna: borrar y recrear con 384 dims
-- (los embeddings previos de Voyage son incompatibles de todos modos)
alter table public.documento drop column if exists embedding_ref;
alter table public.documento add column embedding_ref vector(384);

-- Índice HNSW para similitud coseno con nueva dimensión
create index documento_embedding_idx
  on public.documento using hnsw (embedding_ref vector_cosine_ops);

-- Función RPC actualizada para vector(384)
create or replace function public.buscar_documentos_semantico(
  query_embedding vector(384),
  filtro_proyecto_id uuid default null,
  limite int default 10
)
returns table (
  id uuid,
  proyecto_id uuid,
  nombre_archivo text,
  resumen_ejecutivo text,
  clasificacion jsonb,
  similitud float
)
language sql stable
as $$
  select
    d.id,
    d.proyecto_id,
    d.nombre_archivo,
    d.resumen_ejecutivo,
    d.clasificacion,
    1 - (d.embedding_ref <=> query_embedding) as similitud
  from public.documento d
  where d.embedding_ref is not null
    and (filtro_proyecto_id is null or d.proyecto_id = filtro_proyecto_id)
  order by d.embedding_ref <=> query_embedding
  limit limite;
$$;
