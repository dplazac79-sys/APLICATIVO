-- ============================================================
-- Grants base para el rol `authenticated`
-- Las políticas RLS solo filtran filas — sin GRANT a nivel de tabla,
-- Postgres rechaza el acceso por completo. Esto faltaba desde la
-- migración 001 (cliente, proyecto, documento, audit_log, usuario)
-- y se había estado "parchando" manualmente vía SQL Editor sin
-- quedar nunca registrado en el código.
-- ============================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;

-- Para que las tablas creadas en migraciones futuras hereden el grant automáticamente
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

-- ============================================================
-- usuario_proyecto tenía RLS habilitado desde la migración 001
-- pero NUNCA se le crearon políticas. Con RLS activo y cero
-- políticas, Postgres niega todo acceso por defecto — incluso al
-- propio usuario. Esto rompía en silencio cualquier política de
-- otra tabla que hiciera join contra usuario_proyecto sin pasar
-- por una función security definer (ej. "usuario_ve_sus_clientes").
-- ============================================================

create policy "super_admin_all_usuario_proyecto" on usuario_proyecto
  for all using (get_user_rol() = 'super_admin');

create policy "usuario_ve_sus_asignaciones" on usuario_proyecto
  for select using (usuario_id = auth.uid());

create policy "director_gestiona_asignaciones" on usuario_proyecto
  for all using (
    get_user_rol() = 'director_proyecto' and user_has_proyecto(proyecto_id)
  );
