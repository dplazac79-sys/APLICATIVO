-- Migración 055: conecta es_transicion_valida() (definida en 008, nunca
-- usada) como trigger — hallazgo de auditoría analítica de BD.
--
-- La máquina de estados de workflow_estado solo se validaba en JS
-- (TRANSICIONES_VALIDAS en src/types/database.ts, aplicada en
-- src/app/api/procesos/[id]/workflow/route.ts PATCH) — coincide
-- exactamente con las transiciones que ya codifica esta función SQL, pero
-- a nivel de base de datos no había ningún guardrail: un UPDATE directo vía
-- PostgREST/service_role podía saltar cualquier estado sin restricción.
create or replace function public.validar_transicion_workflow()
returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado
     and not public.es_transicion_valida(old.estado, new.estado) then
    raise exception 'Transición de workflow inválida: % → %', old.estado, new.estado;
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_estado_validar_transicion on workflow_estado;
create trigger workflow_estado_validar_transicion
  before update on workflow_estado
  for each row
  execute function public.validar_transicion_workflow();
