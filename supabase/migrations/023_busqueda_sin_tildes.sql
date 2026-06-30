-- Habilitar extensión unaccent para búsquedas insensibles a tildes/acentos
create extension if not exists unaccent;

-- Función de búsqueda de documentos por nombre sin importar tildes ni mayúsculas
create or replace function buscar_documentos_por_nombre(
  termino text,
  filtro_proyecto_id uuid default null,
  limite int default 20
)
returns table (
  id uuid,
  proyecto_id uuid,
  nombre_archivo text,
  resumen_ejecutivo text,
  clasificacion jsonb,
  estado_procesamiento text,
  subido_por uuid
)
language sql
stable
as $$
  select
    d.id,
    d.proyecto_id,
    d.nombre_archivo,
    d.resumen_ejecutivo,
    d.clasificacion,
    d.estado_procesamiento,
    d.subido_por
  from documento d
  where
    unaccent(lower(d.nombre_archivo)) like '%' || unaccent(lower(termino)) || '%'
    and (filtro_proyecto_id is null or d.proyecto_id = filtro_proyecto_id)
  order by d.created_at desc
  limit limite;
$$;
