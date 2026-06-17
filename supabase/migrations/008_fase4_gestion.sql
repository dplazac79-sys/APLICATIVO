-- ============================================================
-- Fase 4 — Gestión de Proyecto (M7 + M8)
-- ============================================================

-- ── Tipos ────────────────────────────────────────────────────

create type public.workflow_estado_tipo as enum (
  'Scheduled',
  'Assigned',
  'In Progress',
  'Pending Approval',
  'Approved',
  'Implemented',
  'Closed'
);

create type public.nivel_escalacion_tipo as enum ('N1','N2','N3','N4');

-- ── workflow_estado ──────────────────────────────────────────
-- Un registro por proceso (1:1). Se actualiza con cada transición.

create table public.workflow_estado (
  id                uuid primary key default gen_random_uuid(),
  proceso_id        uuid not null unique references public.proceso(id) on delete cascade,
  proyecto_id       uuid not null references public.proyecto(id) on delete cascade,
  estado            public.workflow_estado_tipo not null default 'Scheduled',
  nivel_escalacion  public.nivel_escalacion_tipo null,
  responsable_id    uuid null references public.usuario(id),
  fecha_cambio      timestamptz not null default now(),
  -- horas máximas en el estado actual antes de escalar al siguiente nivel
  umbral_horas_n1   int not null default 48,
  umbral_horas_n2   int not null default 96,
  umbral_horas_n3   int not null default 168,
  umbral_horas_n4   int not null default 336,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index workflow_estado_proyecto_idx on public.workflow_estado (proyecto_id);
create index workflow_estado_estado_idx   on public.workflow_estado (estado);

create trigger workflow_estado_updated_at
  before update on public.workflow_estado
  for each row execute function public.set_updated_at();

-- ── Función: transición válida de estado ─────────────────────
-- Devuelve TRUE si la transición origen→destino es válida según BPMN PMI.

create or replace function public.es_transicion_valida(
  origen public.workflow_estado_tipo,
  destino public.workflow_estado_tipo
) returns boolean language sql immutable as $$
  select (origen, destino) in (
    ('Scheduled',       'Assigned'),
    ('Assigned',        'In Progress'),
    ('Assigned',        'Scheduled'),        -- reasignación
    ('In Progress',     'Pending Approval'),
    ('In Progress',     'Assigned'),         -- devolver
    ('Pending Approval','Approved'),
    ('Pending Approval','In Progress'),      -- rechazar → reabrir
    ('Approved',        'Implemented'),
    ('Implemented',     'Closed'),
    ('Closed',          'Scheduled')         -- reapertura excepcional
  );
$$;

-- ── notificacion ─────────────────────────────────────────────

create table public.notificacion (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuario(id) on delete cascade,
  proyecto_id uuid null references public.proyecto(id) on delete cascade,
  proceso_id  uuid null references public.proceso(id) on delete cascade,
  tipo        text not null, -- 'transicion' | 'escalacion' | 'aprobacion' | 'alarma'
  titulo      text not null,
  cuerpo      text not null,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notificacion_usuario_leida_idx on public.notificacion (usuario_id, leida);

-- ── reunion ──────────────────────────────────────────────────

create table public.reunion (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references public.proyecto(id) on delete cascade,
  fecha           timestamptz not null,
  titulo          text not null,
  participantes   text[] not null default '{}',
  acuerdos        text null,
  compromisos     jsonb not null default '[]'::jsonb,
  created_by      uuid null references public.usuario(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index reunion_proyecto_idx on public.reunion (proyecto_id, fecha desc);

create trigger reunion_updated_at
  before update on public.reunion
  for each row execute function public.set_updated_at();

-- ── riesgo ───────────────────────────────────────────────────

create table public.riesgo (
  id              uuid primary key default gen_random_uuid(),
  proyecto_id     uuid not null references public.proyecto(id) on delete cascade,
  proceso_id      uuid null references public.proceso(id) on delete set null,
  descripcion     text not null,
  categoria       text not null default 'operacional',
  probabilidad    text not null default 'media',  -- alta | media | baja
  impacto         text not null default 'medio',  -- alto | medio | bajo
  nivel_riesgo    text not null default 'medio',  -- critico | alto | medio | bajo
  control         text null,
  responsable     text null,
  estado          text not null default 'activo', -- activo | mitigado | aceptado
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index riesgo_proyecto_idx on public.riesgo (proyecto_id);

create trigger riesgo_updated_at
  before update on public.riesgo
  for each row execute function public.set_updated_at();

-- ── kpi ──────────────────────────────────────────────────────

create table public.kpi (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyecto(id) on delete cascade,
  proceso_id  uuid null references public.proceso(id) on delete set null,
  nombre      text not null,
  descripcion text null,
  formula     text null,
  linea_base  text null,
  meta        text null,
  valor_actual text null,
  frecuencia  text not null default 'mensual',
  dueno       text null,
  historico   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index kpi_proyecto_idx on public.kpi (proyecto_id);

create trigger kpi_updated_at
  before update on public.kpi
  for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

alter table public.workflow_estado enable row level security;
alter table public.notificacion    enable row level security;
alter table public.reunion         enable row level security;
alter table public.riesgo          enable row level security;
alter table public.kpi             enable row level security;

-- workflow_estado: staff ve todo, cliente solo su proyecto
create policy "workflow_select_staff" on public.workflow_estado for select
  using (get_user_rol() in ('super_admin','director_proyecto','consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = workflow_estado.proyecto_id and up.usuario_id = auth.uid()));

create policy "workflow_insert_staff" on public.workflow_estado for insert
  with check (get_user_rol() in ('super_admin','director_proyecto','consultor'));

create policy "workflow_update_staff" on public.workflow_estado for update
  using (get_user_rol() in ('super_admin','director_proyecto','consultor'));

-- notificacion: cada usuario solo ve las suyas
create policy "notificacion_own" on public.notificacion for all
  using (usuario_id = auth.uid());

-- reunion, riesgo, kpi: staff gestión, cliente lectura
create policy "reunion_select" on public.reunion for select
  using (get_user_rol() in ('super_admin','director_proyecto','consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = reunion.proyecto_id and up.usuario_id = auth.uid()));

create policy "reunion_write" on public.reunion for all
  using (get_user_rol() in ('super_admin','director_proyecto','consultor'));

create policy "riesgo_select" on public.riesgo for select
  using (get_user_rol() in ('super_admin','director_proyecto','consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = riesgo.proyecto_id and up.usuario_id = auth.uid()));

create policy "riesgo_write" on public.riesgo for all
  using (get_user_rol() in ('super_admin','director_proyecto','consultor'));

create policy "kpi_select" on public.kpi for select
  using (get_user_rol() in ('super_admin','director_proyecto','consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kpi.proyecto_id and up.usuario_id = auth.uid()));

create policy "kpi_write" on public.kpi for all
  using (get_user_rol() in ('super_admin','director_proyecto','consultor'));
