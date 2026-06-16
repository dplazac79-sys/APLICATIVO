-- ============================================================
-- Fase 2 — Buscador semántico (RAG sobre pgvector con Voyage AI)
-- ============================================================

-- Habilitar extensión pgvector (el nombre correcto es "vector", no "pgvector")
create extension if not exists "vector";

-- embedding_ref nunca se creó en la migración 001 (nombre de extensión incorrecto).
-- Voyage AI (voyage-3) genera vectores de 1024 dimensiones, no 1536.
alter table public.documento add column if not exists embedding_ref vector(1024);

-- Índice de similitud por coseno para búsquedas rápidas
create index if not exists documento_embedding_idx
  on public.documento using hnsw (embedding_ref vector_cosine_ops);

-- Función de búsqueda semántica: devuelve documentos ordenados por similitud
create or replace function public.buscar_documentos_semantico(
  query_embedding vector(1024),
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
