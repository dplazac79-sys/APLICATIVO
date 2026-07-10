-- La columna documento.embedding_ref quedó en vector(384) desde la migración 006
-- (época del modelo local Xenova). El código actual (src/lib/ai/embeddings.ts) usa
-- Voyage AI (voyage-3), que produce vectores de 1024 dimensiones — cada escritura a
-- esta columna fallaba silenciosamente por incompatibilidad de esquema, sin contar
-- el problema adicional de la API key inválida (ver reporte de auditoría).

drop function if exists public.buscar_documentos_semantico(vector(384), uuid, int);

alter table public.documento drop column if exists embedding_ref;
alter table public.documento add column embedding_ref vector(1024);

drop index if exists idx_documento_embedding;
create index idx_documento_embedding
  on public.documento using hnsw (embedding_ref vector_cosine_ops);

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
  limit limite
$$;
