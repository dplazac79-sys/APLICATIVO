-- Migración 012: Fase 6 — Automation Studio + Knowledge Graph Corporativo

-- ── TABLA: kg_industria_snapshot ─────────────────────────────────────────────
-- Snapshot agregado por industria, reconstruido al cerrar proyectos
create table public.kg_industria_snapshot (
  id                  uuid primary key default gen_random_uuid(),
  industria           text not null unique,
  procesos_frecuentes jsonb not null default '[]'::jsonb,
  riesgos_frecuentes  jsonb not null default '[]'::jsonb,
  kpis_frecuentes     jsonb not null default '[]'::jsonb,
  automatizaciones    jsonb not null default '[]'::jsonb,
  proyectos_cerrados  integer not null default 0,
  updated_at          timestamptz not null default now()
);

create index kg_industria_idx on public.kg_industria_snapshot (industria);

-- ── TABLA: kg_recomendacion_automatizacion ────────────────────────────────────
create table public.kg_recomendacion (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyecto(id) on delete cascade,
  proceso_id          uuid references public.proceso(id) on delete set null,
  simulacion_id       uuid references public.simulacion(id) on delete set null,
  artefacto_tobe_id   uuid references public.artefacto(id) on delete set null,
  tipo_automatizacion text not null
    check (tipo_automatizacion in ('RPA','integracion','ia_generativa','workflow','hibrida')),
  herramientas        text[] not null default '{}',
  justificacion       text not null,
  score_impacto       integer check (score_impacto between 1 and 5),
  score_esfuerzo      integer check (score_esfuerzo between 1 and 5),
  prioridad           numeric generated always as
    (case when score_esfuerzo > 0 then score_impacto::numeric / score_esfuerzo else 0 end)
    stored,
  estado              text not null default 'sugerida'
    check (estado in ('sugerida','aprobada','descartada')),
  roadmap_id          uuid,  -- FK agregada después
  creado_por          uuid references public.usuario(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index kg_rec_proyecto_idx   on public.kg_recomendacion (proyecto_id);
create index kg_rec_proceso_idx    on public.kg_recomendacion (proceso_id);
create index kg_rec_estado_idx     on public.kg_recomendacion (estado);

create trigger kg_rec_updated_at
  before update on public.kg_recomendacion
  for each row execute function public.set_updated_at();

-- ── TABLA: kg_roadmap ─────────────────────────────────────────────────────────
create table public.kg_roadmap (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyecto(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  estado        text not null default 'borrador'
    check (estado in ('borrador','aprobado','exportado')),
  entregable_id uuid references public.entregable(id) on delete set null,
  creado_por    uuid references public.usuario(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index kg_roadmap_proyecto_idx on public.kg_roadmap (proyecto_id);

create trigger kg_roadmap_updated_at
  before update on public.kg_roadmap
  for each row execute function public.set_updated_at();

-- FK circular: kg_recomendacion.roadmap_id → kg_roadmap
alter table public.kg_recomendacion
  add constraint kg_rec_roadmap_fk
  foreign key (roadmap_id) references public.kg_roadmap(id) on delete set null;

-- ── TABLA: kg_job_cierre ──────────────────────────────────────────────────────
-- Registro del job de cierre de proyecto (extracción de patrones)
create table public.kg_job_cierre (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyecto(id) on delete cascade,
  estado        text not null default 'pendiente'
    check (estado in ('pendiente','procesando','completado','error')),
  resultado     jsonb,
  error_msg     text,
  iniciado_en   timestamptz,
  completado_en timestamptz,
  created_at    timestamptz not null default now()
);

create index kg_job_proyecto_idx on public.kg_job_cierre (proyecto_id);
create index kg_job_estado_idx   on public.kg_job_cierre (estado);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.kg_industria_snapshot enable row level security;
alter table public.kg_recomendacion      enable row level security;
alter table public.kg_roadmap            enable row level security;
alter table public.kg_job_cierre         enable row level security;

-- kg_industria_snapshot: lectura para todos los autenticados, escritura service_role
create policy "kg_snapshot_read" on public.kg_industria_snapshot for select
  using (auth.role() = 'authenticated');

create policy "kg_snapshot_write" on public.kg_industria_snapshot for all
  using (auth.role() = 'service_role');

-- kg_recomendacion: staff ve las de sus proyectos
create policy "kg_rec_select" on public.kg_recomendacion for select
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kg_recomendacion.proyecto_id
               and up.usuario_id = auth.uid()));

create policy "kg_rec_insert" on public.kg_recomendacion for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kg_rec_update" on public.kg_recomendacion for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kg_rec_delete" on public.kg_recomendacion for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- kg_roadmap: mismo acceso que recomendaciones
create policy "kg_roadmap_select" on public.kg_roadmap for select
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kg_roadmap.proyecto_id
               and up.usuario_id = auth.uid()));

create policy "kg_roadmap_insert" on public.kg_roadmap for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kg_roadmap_update" on public.kg_roadmap for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kg_roadmap_delete" on public.kg_roadmap for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- kg_job_cierre: solo super_admin y service_role
create policy "kg_job_select" on public.kg_job_cierre for select
  using (get_user_rol() = 'super_admin' or auth.role() = 'service_role');

create policy "kg_job_write" on public.kg_job_cierre for all
  using (auth.role() = 'service_role');

-- Analytics view: solo super_admin (lectura cross-proyecto)
create policy "kg_snapshot_admin" on public.kg_industria_snapshot for select
  using (get_user_rol() = 'super_admin' or auth.role() = 'authenticated');

-- ── GRANTS ────────────────────────────────────────────────────────────────────
grant select on public.kg_industria_snapshot to authenticated;
grant select, insert, update, delete on public.kg_recomendacion to authenticated;
grant select, insert, update, delete on public.kg_roadmap         to authenticated;
grant select on public.kg_job_cierre to authenticated;
