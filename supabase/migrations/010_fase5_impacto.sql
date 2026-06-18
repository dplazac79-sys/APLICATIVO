-- Migración 010: Fase 5 — Simulación de Impacto (M6 — Horizonte de Impacto)
-- Entidades: entregable, simulacion

-- ── TABLA: entregable ──────────────────────────────────────────────────────
create table public.entregable (
  id            uuid primary key default uuid_generate_v4(),
  proyecto_id   uuid not null references public.proyecto(id) on delete cascade,
  artefacto_id  uuid references public.artefacto(id) on delete set null,
  simulacion_id uuid,  -- referencia a simulacion (FK agregada después de crear tabla)
  tipo          text not null,   -- artefacto | simulacion | reporte
  nombre        text not null,
  version       integer not null default 1,
  estado        text not null default 'borrador', -- borrador | aprobado | exportado
  url_export    text,
  contenido     jsonb,
  creado_por    uuid references public.usuario(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index entregable_proyecto_idx on public.entregable (proyecto_id, created_at desc);
create index entregable_artefacto_idx on public.entregable (artefacto_id);

create trigger entregable_updated_at
  before update on public.entregable
  for each row execute function set_updated_at();

-- ── TABLA: simulacion ─────────────────────────────────────────────────────
create table public.simulacion (
  id                   uuid primary key default uuid_generate_v4(),
  proyecto_id          uuid not null references public.proyecto(id) on delete cascade,
  nombre               text not null,
  tipo                 text not null check (tipo in ('operacional', 'financiera', 'organizacional')),
  escenario            text not null check (escenario in ('conservador', 'base', 'optimista', 'custom')),
  -- procesos de referencia (AS-IS y TO-BE)
  proceso_id           uuid references public.proceso(id) on delete set null,
  artefacto_asis_id    uuid references public.artefacto(id) on delete set null,
  artefacto_tobe_id    uuid references public.artefacto(id) on delete set null,
  -- datos del motor
  parametros           jsonb not null default '{}'::jsonb,
  resultados           jsonb,
  -- todos los escenarios calculados juntos
  resultados_todos     jsonb,  -- { conservador: {}, base: {}, optimista: {}, custom: {} }
  -- trazabilidad
  entregable_id        uuid references public.entregable(id) on delete set null,
  creado_por           uuid references public.usuario(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index simulacion_proyecto_idx on public.simulacion (proyecto_id, created_at desc);
create index simulacion_proceso_idx  on public.simulacion (proceso_id);

create trigger simulacion_updated_at
  before update on public.simulacion
  for each row execute function set_updated_at();

-- FK circular: entregable.simulacion_id → simulacion
alter table public.entregable
  add constraint entregable_simulacion_fk
  foreign key (simulacion_id) references public.simulacion(id) on delete set null;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.entregable  enable row level security;
alter table public.simulacion  enable row level security;

-- entregable: staff del proyecto ve todo, cliente ve los aprobados/exportados
create policy "entregable_select_staff" on public.entregable for select
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = entregable.proyecto_id and up.usuario_id = auth.uid()));

create policy "entregable_insert" on public.entregable for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "entregable_update" on public.entregable for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "entregable_delete" on public.entregable for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- simulacion: staff puede gestionar, cliente solo lectura en su proyecto
create policy "simulacion_select" on public.simulacion for select
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = simulacion.proyecto_id and up.usuario_id = auth.uid()));

create policy "simulacion_insert" on public.simulacion for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "simulacion_update" on public.simulacion for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "simulacion_delete" on public.simulacion for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- ── GRANTS ────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.entregable to authenticated;
grant select, insert, update, delete on public.simulacion  to authenticated;
