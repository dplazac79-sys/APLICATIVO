-- ============================================================
-- Chunking semántico de documentos para RAG de precisión
-- Cada documento se divide en secciones con embedding propio
-- ============================================================

create table if not exists public.documento_chunk (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documento(id) on delete cascade,
  proyecto_id  uuid not null references public.proyecto(id) on delete cascade,
  indice       int  not null,              -- orden del chunk dentro del documento
  titulo       text,                        -- título de sección detectado (si aplica)
  texto        text not null,              -- contenido del chunk (~500 tokens)
  embedding    vector(1024),               -- voyage-3
  tokens_est   int,                        -- estimación de tokens
  created_at   timestamptz default now()
);

-- Índice coseno para búsqueda semántica por chunk
create index if not exists chunk_embedding_idx
  on public.documento_chunk using hnsw (embedding vector_cosine_ops);

create index if not exists chunk_documento_idx
  on public.documento_chunk (documento_id);

create index if not exists chunk_proyecto_idx
  on public.documento_chunk (proyecto_id);

-- RLS: misma política que documento
alter table public.documento_chunk enable row level security;

create policy "admin_all_chunks" on public.documento_chunk
  using (true) with check (true);

-- Búsqueda semántica por chunk — retorna chunk + metadata del documento padre
create or replace function public.buscar_chunks_semantico(
  query_embedding vector(1024),
  filtro_proyecto_id uuid default null,
  limite int default 8
)
returns table (
  chunk_id     uuid,
  documento_id uuid,
  proyecto_id  uuid,
  nombre_archivo text,
  indice       int,
  titulo       text,
  texto        text,
  similitud    float
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.documento_id,
    c.proyecto_id,
    d.nombre_archivo,
    c.indice,
    c.titulo,
    c.texto,
    1 - (c.embedding <=> query_embedding) as similitud
  from public.documento_chunk c
  join public.documento d on d.id = c.documento_id
  where c.embedding is not null
    and (filtro_proyecto_id is null or c.proyecto_id = filtro_proyecto_id)
  order by c.embedding <=> query_embedding
  limit limite;
$$;
