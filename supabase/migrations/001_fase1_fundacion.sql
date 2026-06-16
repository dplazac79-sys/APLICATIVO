-- APIP Fase 1: Fundación
-- Migraciones para: cliente, proyecto, usuario, rol, documento, audit_log

-- Extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- ROLES (enum)
-- ============================================================
create type rol_tipo as enum (
  'super_admin',
  'director_proyecto',
  'consultor',
  'sponsor_cliente',
  'usuario_cliente'
);

-- ============================================================
-- TABLA: cliente
-- ============================================================
create table cliente (
  id                       uuid primary key default uuid_generate_v4(),
  razon_social             text not null,
  rut                      text,
  industria                text,
  tamano                   text,           -- micro | pequeña | mediana | grande
  facturacion              numeric,
  dotacion                 integer,
  objetivos_estrategicos   text,
  riesgos_declarados       text,
  madurez_digital          text,           -- inicial | en desarrollo | avanzado
  inteligencia_industria   jsonb default '{}'::jsonb,
  activo                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- TABLA: proyecto
-- ============================================================
create table proyecto (
  id            uuid primary key default uuid_generate_v4(),
  cliente_id    uuid not null references cliente(id) on delete cascade,
  nombre        text not null,
  alcance       text,
  estado_general text not null default 'activo',  -- activo | pausado | cerrado
  fase_actual   integer not null default 1 check (fase_actual between 1 and 6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_proyecto_cliente_id on proyecto(cliente_id);

-- ============================================================
-- TABLA: usuario (extiende auth.users de Supabase)
-- ============================================================
create table usuario (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null unique,
  rol         rol_tipo not null default 'usuario_cliente',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- TABLA: usuario_proyecto (relación N:M — un usuario puede tener varios proyectos)
-- ============================================================
create table usuario_proyecto (
  usuario_id  uuid not null references usuario(id) on delete cascade,
  proyecto_id uuid not null references proyecto(id) on delete cascade,
  rol_override rol_tipo,   -- permite rol diferente al global para este proyecto
  primary key (usuario_id, proyecto_id)
);

create index idx_usuario_proyecto_proyecto on usuario_proyecto(proyecto_id);

-- ============================================================
-- TABLA: documento
-- ============================================================
create table documento (
  id                    uuid primary key default uuid_generate_v4(),
  proyecto_id           uuid not null references proyecto(id) on delete cascade,
  nombre_archivo        text not null,
  tipo                  text,             -- pdf | docx | xlsx | imagen | otro
  url_storage           text not null,
  estado_procesamiento  text not null default 'pendiente'
                          check (estado_procesamiento in ('pendiente','procesando','listo','error')),
  clasificacion         jsonb default '{}'::jsonb,
  resumen_ejecutivo     text,
  embedding_ref         vector(1536),
  subido_por            uuid references usuario(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_documento_proyecto_id on documento(proyecto_id);
create index idx_documento_estado on documento(estado_procesamiento);

-- ============================================================
-- TABLA: audit_log
-- ============================================================
create table audit_log (
  id          bigserial primary key,
  usuario_id  uuid references usuario(id),
  accion      text not null,         -- CREATE | UPDATE | DELETE | APPROVE | LOGIN
  entidad     text not null,         -- nombre de la tabla afectada
  entidad_id  uuid,
  detalle     jsonb default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);

create index idx_audit_log_usuario on audit_log(usuario_id);
create index idx_audit_log_entidad on audit_log(entidad, entidad_id);
create index idx_audit_log_created on audit_log(created_at desc);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_cliente_updated_at
  before update on cliente
  for each row execute function set_updated_at();

create trigger trg_proyecto_updated_at
  before update on proyecto
  for each row execute function set_updated_at();

create trigger trg_usuario_updated_at
  before update on usuario
  for each row execute function set_updated_at();

create trigger trg_documento_updated_at
  before update on documento
  for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Habilitar RLS
alter table cliente enable row level security;
alter table proyecto enable row level security;
alter table usuario enable row level security;
alter table usuario_proyecto enable row level security;
alter table documento enable row level security;
alter table audit_log enable row level security;

-- Función helper: obtiene el rol del usuario actual
create or replace function get_user_rol()
returns rol_tipo as $$
  select rol from usuario where id = auth.uid();
$$ language sql security definer stable;

-- Función helper: retorna true si el usuario tiene acceso al proyecto
create or replace function user_has_proyecto(p_id uuid)
returns boolean as $$
  select exists (
    select 1 from usuario_proyecto
    where usuario_id = auth.uid() and proyecto_id = p_id
  ) or get_user_rol() = 'super_admin';
$$ language sql security definer stable;

-- POLÍTICAS: cliente
create policy "super_admin_all_clientes" on cliente
  for all using (get_user_rol() = 'super_admin');

create policy "usuario_ve_sus_clientes" on cliente
  for select using (
    exists (
      select 1 from proyecto p
      join usuario_proyecto up on up.proyecto_id = p.id
      where p.cliente_id = cliente.id and up.usuario_id = auth.uid()
    )
  );

-- POLÍTICAS: proyecto
create policy "super_admin_all_proyectos" on proyecto
  for all using (get_user_rol() = 'super_admin');

create policy "usuario_ve_sus_proyectos" on proyecto
  for select using (user_has_proyecto(id));

create policy "director_gestiona_proyectos" on proyecto
  for all using (
    get_user_rol() in ('director_proyecto') and user_has_proyecto(id)
  );

-- POLÍTICAS: documento
create policy "super_admin_all_docs" on documento
  for all using (get_user_rol() = 'super_admin');

create policy "usuario_ve_docs_de_sus_proyectos" on documento
  for select using (user_has_proyecto(proyecto_id));

create policy "consultor_gestiona_docs" on documento
  for all using (
    get_user_rol() in ('director_proyecto', 'consultor') and user_has_proyecto(proyecto_id)
  );

-- POLÍTICAS: audit_log
create policy "super_admin_ve_todo_audit" on audit_log
  for select using (get_user_rol() = 'super_admin');

create policy "usuario_ve_su_audit" on audit_log
  for select using (usuario_id = auth.uid());

-- audit_log: solo insert desde funciones internas (service_role)
create policy "service_role_insert_audit" on audit_log
  for insert with check (true);
