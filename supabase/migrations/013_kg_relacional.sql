-- Nodos del knowledge graph (entidades únicas por industria)
create table public.kg_nodo (
  id        uuid primary key default gen_random_uuid(),
  industria text not null,
  tipo      text not null check (tipo in ('proceso','riesgo','kpi','automatizacion','herramienta','rol')),
  nombre    text not null,
  metadata  jsonb not null default '{}',
  frecuencia integer not null default 1,
  unique (industria, tipo, nombre)
);
create index kg_nodo_industria_idx on public.kg_nodo (industria);
create index kg_nodo_tipo_idx on public.kg_nodo (tipo);

-- Relaciones entre nodos
create table public.kg_relacion (
  id          uuid primary key default gen_random_uuid(),
  nodo_origen uuid not null references public.kg_nodo(id) on delete cascade,
  nodo_destino uuid not null references public.kg_nodo(id) on delete cascade,
  tipo_relacion text not null check (tipo_relacion in ('usa','genera','mitiga','requiere','produce','causa')),
  peso        numeric not null default 1.0,
  unique (nodo_origen, nodo_destino, tipo_relacion)
);
create index kg_relacion_origen_idx on public.kg_relacion (nodo_origen);
create index kg_relacion_destino_idx on public.kg_relacion (nodo_destino);

-- RLS
alter table public.kg_nodo    enable row level security;
alter table public.kg_relacion enable row level security;

create policy "kg_nodo_read"    on public.kg_nodo    for select using (auth.role() = 'authenticated');
create policy "kg_nodo_write"   on public.kg_nodo    for all    using (auth.role() = 'service_role');
create policy "kg_relacion_read" on public.kg_relacion for select using (auth.role() = 'authenticated');
create policy "kg_relacion_write" on public.kg_relacion for all  using (auth.role() = 'service_role');

grant select on public.kg_nodo     to authenticated;
grant select on public.kg_relacion to authenticated;
