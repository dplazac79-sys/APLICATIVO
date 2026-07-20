-- Migración 057: retención automática para las 3 tablas que crecen sin
-- límite y sin ningún mecanismo de limpieza (hallazgo de auditoría
-- analítica de BD) — mismo problema que ya se había resuelto para
-- login_intento_ip (limpieza probabilística en código), pero jobs/
-- audit_log/uso_ia no tenían nada. Se usa pg_cron (ya disponible en
-- Supabase) para una limpieza diaria centralizada en la BD, en vez de
-- añadir lógica de limpieza a cada endpoint que escribe estas tablas.
--
-- Períodos:
--   jobs      → 90 días, solo estados terminales (listo/error). Son
--               transitorios: su resultado real ya vive en la tabla que
--               procesan (documento.analisis_ia, artefacto.contenido,
--               etc.) — el job en sí es solo un registro de tracking.
--               Nunca se borran jobs en 'pendiente'/'procesando' sin
--               importar su antigüedad (evita borrar algo en curso).
--   audit_log → 2 años. Es el rastro de auditoría/compliance de la
--               plataforma — retención larga a propósito.
--   uso_ia    → 2 años. Historial de uso/costo de IA por proyecto —
--               igual de sensible para trazabilidad de facturación.
create extension if not exists pg_cron;

create or replace function public.limpiar_datos_antiguos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from jobs
  where estado in ('listo', 'error')
    and created_at < now() - interval '90 days';

  delete from audit_log
  where created_at < now() - interval '2 years';

  delete from uso_ia
  where created_at < now() - interval '2 years';
end;
$$;

revoke all on function public.limpiar_datos_antiguos() from public;

-- Corre diario a las 04:00 UTC (madrugada en Chile, fuera de horario de uso).
-- unschedule primero para que el script sea re-corrible sin error de
-- nombre duplicado si ya existía de un intento anterior.
select cron.unschedule(jobid) from cron.job where jobname = 'limpiar-datos-antiguos-diario';

select cron.schedule(
  'limpiar-datos-antiguos-diario',
  '0 4 * * *',
  $$select public.limpiar_datos_antiguos()$$
);
