-- ============================================================
-- Fase 3 — Artefactos Inteligentes (M4 + M5)
-- ============================================================

create type public.tipo_artefacto as enum (
  'sipoc',
  'as_is',
  'bpmn',
  'historias_usuario',
  'flujograma',
  'raci',
  'riesgo_control',
  'kpi_sla',
  'diagnostico',
  'to_be',
  'dashboard_brechas',
  'cierre_ejecutivo'
);

create type public.estado_validacion as enum (
  'pendiente',
  'validado',
  'publicado'
);

create table public.artefacto (
  id              uuid primary key default gen_random_uuid(),
  proceso_id      uuid not null references public.proceso(id) on delete cascade,
  proyecto_id     uuid not null references public.proyecto(id) on delete cascade,
  tipo            public.tipo_artefacto not null,
  contenido       jsonb not null default '{}'::jsonb,
  estado_validacion public.estado_validacion not null default 'pendiente',
  version         int not null default 1,
  generado_por_ia boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (proceso_id, tipo)
);

-- Índice para listar artefactos por proceso
create index artefacto_proceso_idx on public.artefacto (proceso_id);
-- Índice para listar artefactos visibles por proyecto (portal cliente)
create index artefacto_proyecto_estado_idx on public.artefacto (proyecto_id, estado_validacion);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger artefacto_updated_at
  before update on public.artefacto
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.artefacto enable row level security;

-- Super admin y equipo consultor: ven todos los artefactos del proyecto
create policy "artefacto_consultor_select" on public.artefacto
  for select using (
    get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
    or exists (
      select 1 from public.usuario_proyecto up
      where up.proyecto_id = artefacto.proyecto_id
        and up.usuario_id = auth.uid()
    )
  );

-- Solo artefactos publicados son visibles para sponsor/usuario_cliente
create policy "artefacto_cliente_select" on public.artefacto
  for select using (
    get_user_rol() in ('sponsor_cliente', 'usuario_cliente')
    and estado_validacion = 'publicado'
    and exists (
      select 1 from public.usuario_proyecto up
      where up.proyecto_id = artefacto.proyecto_id
        and up.usuario_id = auth.uid()
    )
  );

-- Solo consultor/director/super_admin pueden insertar y actualizar
create policy "artefacto_staff_insert" on public.artefacto
  for insert with check (
    get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
  );

create policy "artefacto_staff_update" on public.artefacto
  for update using (
    get_user_rol() in ('super_admin', 'director_proyecto', 'consultor')
  );
