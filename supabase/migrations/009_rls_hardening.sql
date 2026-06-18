-- Migración 009: RLS hardening — with check explícito en reunion/riesgo/kpi
-- y restricción de audit_log a service_role únicamente

-- ── audit_log: solo service_role puede insertar ───────────────────────────
drop policy if exists "service_role_insert_audit" on audit_log;

create policy "service_role_insert_audit" on audit_log
  for insert
  with check (auth.role() = 'service_role');

-- ── reunion: separar select / insert / update / delete ────────────────────
drop policy if exists "reunion_write" on public.reunion;

create policy "reunion_insert" on public.reunion
  for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "reunion_update" on public.reunion
  for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "reunion_delete" on public.reunion
  for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- ── riesgo: separar select / insert / update / delete ────────────────────
drop policy if exists "riesgo_write" on public.riesgo;

create policy "riesgo_insert" on public.riesgo
  for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "riesgo_update" on public.riesgo
  for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "riesgo_delete" on public.riesgo
  for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

-- ── kpi: separar select / insert / update / delete ───────────────────────
drop policy if exists "kpi_write" on public.kpi;

create policy "kpi_insert" on public.kpi
  for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kpi_update" on public.kpi
  for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));

create policy "kpi_delete" on public.kpi
  for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor'));
