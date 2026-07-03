-- Añadir campos faltantes en glosario_roles_analisis
alter table public.glosario_roles_analisis
  add column if not exists score_cobertura_organizacional int default 0,
  add column if not exists alertas_criticas jsonb default '[]'::jsonb,
  add column if not exists plan_accion_30_dias jsonb default '[]'::jsonb;
