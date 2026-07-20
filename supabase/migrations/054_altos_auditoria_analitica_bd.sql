-- Migración 054: corrige los hallazgos 🟠 Altos de la auditoría analítica
-- profunda de base de datos.

-- ────────────────────────────────────────────────────────────────────────
-- 1. get_user_rol() / user_has_proyecto() son SECURITY DEFINER sin
-- set search_path — usadas en absolutamente todas las políticas RLS del
-- sistema. Sin search_path fijo, resuelven nombres de tabla sin calificar
-- (usuario, usuario_proyecto) usando el search_path del que llama, no uno
-- fijo — el vector clásico de "search path hijacking" en funciones
-- SECURITY DEFINER de Postgres. registrar_intento_fallido_login (047) ya
-- usa el patrón correcto; se aplica acá también.
create or replace function get_user_rol()
returns rol_tipo as $$
  select rol from usuario where id = auth.uid();
$$ language sql security definer stable set search_path = public;

create or replace function user_has_proyecto(p_id uuid)
returns boolean as $$
  select exists (
    select 1 from usuario_proyecto
    where usuario_id = auth.uid() and proyecto_id = p_id
  ) or get_user_rol() = 'super_admin';
$$ language sql security definer stable set search_path = public;

-- ────────────────────────────────────────────────────────────────────────
-- 2. Bucket "documentos" nunca fue creado por ninguna migración (se creó
-- manualmente fuera de banda — ver comentarios en 045/046/048). Un deploy
-- desde cero contra un proyecto Supabase nuevo fallaría en la primera
-- subida de documento. Se agrega acá con la configuración final actual
-- (privado, 25MB, tipos MIME permitidos) para que el historial de
-- migraciones sea reproducible por sí solo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 26214400,
  array[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp'
  ]
)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────────────────
-- 3. Búsqueda de nombre de archivo (buscar_documentos_por_nombre, migración
-- 023) hace unaccent(lower(nombre_archivo)) LIKE '%...%' sin ningún índice
-- de soporte — sequential scan garantizado sobre toda la tabla documento a
-- medida que crece. pg_trgm + GIN sobre la misma expresión indexada permite
-- que el planner use el índice para patrones LIKE '%...%'.
create extension if not exists pg_trgm;

-- unaccent() está marcada STABLE (no IMMUTABLE) porque en teoría depende de
-- config de diccionario en runtime — Postgres rechaza funciones no-IMMUTABLE
-- en expresiones de índice (error 42P17). La forma con diccionario explícito
-- (unaccent('unaccent', texto)) falló acá porque el objeto TEXT SEARCH
-- DICTIONARY vive en el schema "extensions" de este proyecto, no resoluble
-- por nombre corto. Se usa en cambio el unaccent(text) de un solo argumento
-- — la misma llamada que ya usa sin problemas buscar_documentos_por_nombre
-- desde la migración 023 — envuelta en una función marcada IMMUTABLE
-- (Postgres no valida la marca en funciones SQL, confía en la declaración;
-- para este uso — mismo texto siempre produce el mismo resultado — es
-- seguro). Se actualiza también la función de búsqueda para usar el mismo
-- wrapper: si la expresión del índice y la del query no coinciden
-- exactamente, el planner nunca usa el índice.
-- set search_path incluye "extensions" — Supabase instala unaccent ahí por
-- defecto, no en public, y sin esto la función no encuentra unaccent() al
-- ejecutarse fuera del search_path interactivo del SQL Editor.
create or replace function inmutable_unaccent(text)
returns text as $$
  select unaccent($1)
$$ language sql immutable strict set search_path = public, extensions;

create index if not exists idx_documento_nombre_trgm
  on documento using gin (inmutable_unaccent(lower(nombre_archivo)) gin_trgm_ops);

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
    inmutable_unaccent(lower(d.nombre_archivo)) like '%' || inmutable_unaccent(lower(termino)) || '%'
    and (filtro_proyecto_id is null or d.proyecto_id = filtro_proyecto_id)
  order by d.created_at desc
  limit limite;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. Índices faltantes en columnas FK que se consultan constantemente
-- (incluyendo desde subconsultas EXISTS de las propias políticas RLS).
-- Postgres no indexa automáticamente las columnas con `references`.
create index if not exists idx_documento_subido_por on documento(subido_por);
create index if not exists idx_proceso_documento_origen on proceso(documento_origen_id);
create index if not exists idx_organigrama_cliente_proyecto on organigrama_cliente(proyecto_id);
create index if not exists idx_cv_persona_org_proyecto on cv_persona_org(proyecto_id);
create index if not exists idx_glosario_roles_analisis_proyecto on glosario_roles_analisis(proyecto_id);

-- ────────────────────────────────────────────────────────────────────────
-- 5. FKs faltantes: artefacto_historial.proceso_id y
-- proceso_historial.proyecto_id son uuid not null pero sin `references` —
-- permiten insertar (o dejar huérfana tras un borrado) una fila que apunta
-- a un proceso/proyecto inexistente, invisible para las políticas RLS que
-- asumen que esa relación siempre es válida.
--
-- artefacto_historial YA tiene filas huérfanas en producción (16 filas
-- referencian 5 proceso_id de los cuales solo 2 procesos existen hoy —
-- rastro de limpiezas de duplicados de Discovery de antes de esta FK
-- existir). Son snapshots históricos de auditoría, no se borran. Se agrega
-- la constraint como NOT VALID (mismo patrón ya usado en la migración 036):
-- no valida las filas existentes, pero previene NUEVOS huérfanos desde
-- ahora. Se puede validar más adelante si se decide limpiar/reasignar el
-- historial viejo.
alter table artefacto_historial
  add constraint artefacto_historial_proceso_id_fkey
  foreign key (proceso_id) references proceso(id) on delete cascade
  not valid;

alter table proceso_historial
  add constraint proceso_historial_proyecto_id_fkey
  foreign key (proyecto_id) references proyecto(id) on delete cascade;
