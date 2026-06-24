-- 021: Campos de resumen ejecutivo del proyecto
alter table proyecto
  add column if not exists objetivos text,
  add column if not exists n_procesos_estimados integer,
  add column if not exists alcance_incluye text,
  add column if not exists alcance_excluye text,
  add column if not exists contexto text;
