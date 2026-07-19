-- Migración 047: corrige una condición de carrera (TOCTOU) en el contador
-- de intentos fallidos de login.
--
-- Hallazgo de auditoría: /api/auth/login lee failed_attempts de
-- auth.users.raw_user_meta_data, calcula failed+1 en JavaScript, y recién
-- ahí escribe el objeto completo de vuelta. Si llegan varias requests de
-- login fallidas en paralelo para la MISMA cuenta (ej. un ataque de fuerza
-- bruta con varias conexiones simultáneas), todas leen el mismo valor
-- "viejo" de failed_attempts antes de que ninguna haya escrito todavía, y
-- el bloqueo a los 3 intentos se puede saltar — cada request pisa la
-- escritura de la anterior en vez de acumularse.
--
-- Esta función mueve el incremento a una sola transacción atómica en
-- Postgres: toma un advisory lock por usuario (serializa cualquier
-- request concurrente para la misma cuenta) y hace el UPDATE...RETURNING
-- en un solo paso, sin round-trip de lectura-cálculo-escritura desde
-- Node. security definer + revoke de PUBLIC porque necesita escribir en
-- auth.users, que normalmente ni siquiera el rol authenticated puede
-- tocar — solo se le da execute a service_role (el único que la llama,
-- desde el admin client del route de login).
create or replace function public.registrar_intento_fallido_login(
  p_user_id uuid,
  p_max_attempts int
)
returns table(failed_attempts int, locked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_failed int;
  v_locked boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  update auth.users
  set raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'failed_attempts', coalesce((raw_user_meta_data->>'failed_attempts')::int, 0) + 1,
    'locked', (coalesce((raw_user_meta_data->>'failed_attempts')::int, 0) + 1) >= p_max_attempts
  )
  where id = p_user_id
  returning
    (raw_user_meta_data->>'failed_attempts')::int,
    (raw_user_meta_data->>'locked')::boolean
  into v_failed, v_locked;

  return query select v_failed, v_locked;
end;
$$;

revoke all on function public.registrar_intento_fallido_login(uuid, int) from public;
grant execute on function public.registrar_intento_fallido_login(uuid, int) to service_role;
