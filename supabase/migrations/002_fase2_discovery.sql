-- ============================================================
-- Fase 2 — IA de Descubrimiento
-- Tablas: jobs, proceso
-- ============================================================

-- jobs: pipeline asíncrono de procesamiento documental
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('clasificar_documento','resumir_documento','discovery_procesos')),
  estado        text not null default 'pendiente' check (estado in ('pendiente','procesando','listo','error')),
  payload       jsonb not null default '{}',
  resultado     jsonb,
  error_mensaje text,
  intentos      int not null default 0,
  max_intentos  int not null default 3,
  documento_id  uuid references public.documento(id) on delete cascade,
  proyecto_id   uuid references public.proyecto(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- proceso: inventario de procesos detectados / propuestos por IA
create table if not exists public.proceso (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyecto(id) on delete cascade,
  padre_id            uuid references public.proceso(id) on delete set null,
  documento_origen_id uuid references public.documento(id) on delete set null,
  nombre              text not null,
  descripcion         text,
  nivel               int not null default 0 check (nivel between 0 and 4),
  tipo                text not null default 'proceso' check (tipo in ('macroproceso','proceso','subproceso','actividad','tarea')),
  origen              text not null default 'manual' check (origen in ('detectado','propuesta_ia','manual')),
  estado_oferta       text not null default 'propuesto' check (estado_oferta in ('propuesto','aceptado','rechazado')),
  roles_involucrados  text[],
  riesgos_detectados  text[],
  orden               int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Agregar campos a documento para Fase 2
alter table public.documento
  add column if not exists clasificacion       jsonb,
  add column if not exists resumen_ejecutivo   text,
  add column if not exists estado_procesamiento text not null default 'pendiente'
    check (estado_procesamiento in ('pendiente','procesando','listo','error'));

-- Índices
create index if not exists jobs_estado_idx on public.jobs(estado);
create index if not exists jobs_documento_id_idx on public.jobs(documento_id);
create index if not exists proceso_proyecto_id_idx on public.proceso(proyecto_id);
create index if not exists proceso_padre_id_idx on public.proceso(padre_id);
create index if not exists proceso_estado_oferta_idx on public.proceso(estado_oferta);

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_updated_at on public.jobs;
create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists proceso_updated_at on public.proceso;
create trigger proceso_updated_at
  before update on public.proceso
  for each row execute function public.set_updated_at();

-- RLS
alter table public.jobs enable row level security;
alter table public.proceso enable row level security;

-- Jobs: solo super_admin y consultores del proyecto pueden ver/crear
create policy "jobs_select" on public.jobs for select
  using (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor')
    )
  );

create policy "jobs_insert" on public.jobs for insert
  with check (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor')
    )
  );

-- Proceso: visible a todos los miembros del proyecto
create policy "proceso_select" on public.proceso for select
  using (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and (
        u.rol = 'super_admin'
        or exists (
          select 1 from public.usuario_proyecto up
          where up.usuario_id = auth.uid()
          and up.proyecto_id = proceso.proyecto_id
        )
      )
    )
  );

create policy "proceso_insert" on public.proceso for insert
  with check (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor')
    )
  );

create policy "proceso_update" on public.proceso for update
  using (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor')
    )
  );

-- GRANT service_role
grant all on public.jobs to service_role;
grant all on public.proceso to service_role;
