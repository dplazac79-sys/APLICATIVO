-- Sprint 5: Rate limiting de IA por proyecto/cliente

create table uso_ia (
  id            uuid primary key default uuid_generate_v4(),
  proyecto_id   uuid not null references proyecto(id) on delete cascade,
  usuario_id    uuid not null references usuario(id) on delete cascade,
  tipo          text not null,  -- 'clasificar' | 'resumir' | 'discovery' | 'embedding'
  tokens_input  integer not null default 0,
  tokens_output integer not null default 0,
  costo_usd     numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);

-- Índices para consultas de límite (por proyecto y mes)
create index uso_ia_proyecto_mes on uso_ia (proyecto_id, created_at);
create index uso_ia_usuario_idx  on uso_ia (usuario_id);

-- Vista mensual por proyecto (para dashboard y límites)
create view uso_ia_mes_actual as
select
  proyecto_id,
  count(*) filter (where tipo = 'clasificar')  as clasificaciones,
  count(*) filter (where tipo = 'resumir')     as resumenes,
  count(*) filter (where tipo = 'discovery')   as discoveries,
  count(*) filter (where tipo = 'embedding')   as embeddings,
  sum(tokens_input + tokens_output)            as tokens_totales,
  sum(costo_usd)                               as costo_total_usd
from uso_ia
where created_at >= date_trunc('month', now())
group by proyecto_id;

-- RLS
alter table uso_ia enable row level security;

create policy "usuarios ven uso de sus proyectos" on uso_ia
  for select using (
    proyecto_id in (
      select proyecto_id from usuario_proyecto where usuario_id = auth.uid()
    )
  );

create policy "solo service_role inserta" on uso_ia
  for insert with check (auth.role() = 'service_role');

-- Grants
grant select on uso_ia to authenticated;
grant select on uso_ia_mes_actual to authenticated;
