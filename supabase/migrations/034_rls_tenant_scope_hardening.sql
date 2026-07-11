-- Migración 034: RLS defensa-en-profundidad — acota entregable/simulacion/
-- reunion/riesgo/kpi/kg_recomendacion/kg_roadmap a la membresía real del
-- usuario en el proyecto, no solo a su rol.
--
-- Hallazgo de auditoría: las políticas de estas tablas (migraciones 008,
-- 010, 012) usan "get_user_rol() in ('super_admin','director_proyecto',
-- 'consultor')" como condición suficiente, tanto para SELECT como para
-- INSERT/UPDATE/DELETE. Como la condición no incluye el chequeo de
-- pertenencia a proyecto, CUALQUIER usuario con rol director_proyecto o
-- consultor —sin importar a qué proyecto esté asignado— pasa la policy
-- para leer o escribir filas de CUALQUIER proyecto de CUALQUIER cliente.
--
-- Hoy esto no se explota en producción porque todas las rutas de la app
-- usan el service_role client (bypasea RLS por completo) y el IDOR real
-- ya fue cerrado a nivel de aplicación con assertProyectoAccess. Esta
-- migración es defensa en profundidad: si alguna ruta futura usa el
-- cliente normal (RLS-respecting) en vez del admin client, esta capa
-- sigue bloqueando el acceso cross-tenant en vez de depender 100% del
-- código de la ruta para no tener el bug.
--
-- user_has_proyecto(p_id) ya existe desde la migración 001: retorna true
-- si el usuario es super_admin O si tiene una fila en usuario_proyecto
-- para ese proyecto. Se usa aquí en vez de reimplementar el exists(...).

-- ── entregable ──────────────────────────────────────────────────────────
drop policy if exists "entregable_select_staff" on public.entregable;
drop policy if exists "entregable_insert" on public.entregable;
drop policy if exists "entregable_update" on public.entregable;
drop policy if exists "entregable_delete" on public.entregable;

create policy "entregable_select" on public.entregable for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = entregable.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "entregable_insert" on public.entregable for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "entregable_update" on public.entregable for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "entregable_delete" on public.entregable for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── simulacion ──────────────────────────────────────────────────────────
drop policy if exists "simulacion_select" on public.simulacion;
drop policy if exists "simulacion_insert" on public.simulacion;
drop policy if exists "simulacion_update" on public.simulacion;
drop policy if exists "simulacion_delete" on public.simulacion;

create policy "simulacion_select" on public.simulacion for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = simulacion.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "simulacion_insert" on public.simulacion for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "simulacion_update" on public.simulacion for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "simulacion_delete" on public.simulacion for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── reunion ─────────────────────────────────────────────────────────────
drop policy if exists "reunion_select" on public.reunion;
drop policy if exists "reunion_write" on public.reunion;
drop policy if exists "reunion_insert" on public.reunion;
drop policy if exists "reunion_update" on public.reunion;
drop policy if exists "reunion_delete" on public.reunion;

create policy "reunion_select" on public.reunion for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = reunion.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "reunion_insert" on public.reunion for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "reunion_update" on public.reunion for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "reunion_delete" on public.reunion for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── riesgo ──────────────────────────────────────────────────────────────
drop policy if exists "riesgo_select" on public.riesgo;
drop policy if exists "riesgo_write" on public.riesgo;
drop policy if exists "riesgo_insert" on public.riesgo;
drop policy if exists "riesgo_update" on public.riesgo;
drop policy if exists "riesgo_delete" on public.riesgo;

create policy "riesgo_select" on public.riesgo for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = riesgo.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "riesgo_insert" on public.riesgo for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "riesgo_update" on public.riesgo for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "riesgo_delete" on public.riesgo for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── kpi ─────────────────────────────────────────────────────────────────
drop policy if exists "kpi_select" on public.kpi;
drop policy if exists "kpi_write" on public.kpi;
drop policy if exists "kpi_insert" on public.kpi;
drop policy if exists "kpi_update" on public.kpi;
drop policy if exists "kpi_delete" on public.kpi;

create policy "kpi_select" on public.kpi for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kpi.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "kpi_insert" on public.kpi for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kpi_update" on public.kpi for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kpi_delete" on public.kpi for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── kg_recomendacion ────────────────────────────────────────────────────
drop policy if exists "kg_rec_select" on public.kg_recomendacion;
drop policy if exists "kg_rec_insert" on public.kg_recomendacion;
drop policy if exists "kg_rec_update" on public.kg_recomendacion;
drop policy if exists "kg_rec_delete" on public.kg_recomendacion;

create policy "kg_rec_select" on public.kg_recomendacion for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kg_recomendacion.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "kg_rec_insert" on public.kg_recomendacion for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kg_rec_update" on public.kg_recomendacion for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kg_rec_delete" on public.kg_recomendacion for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

-- ── kg_roadmap ──────────────────────────────────────────────────────────
drop policy if exists "kg_roadmap_select" on public.kg_roadmap;
drop policy if exists "kg_roadmap_insert" on public.kg_roadmap;
drop policy if exists "kg_roadmap_update" on public.kg_roadmap;
drop policy if exists "kg_roadmap_delete" on public.kg_roadmap;

create policy "kg_roadmap_select" on public.kg_roadmap for select
  using (
    (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = kg_roadmap.proyecto_id and up.usuario_id = auth.uid())
  );

create policy "kg_roadmap_insert" on public.kg_roadmap for insert
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kg_roadmap_update" on public.kg_roadmap for update
  using  (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id))
  with check (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));

create policy "kg_roadmap_delete" on public.kg_roadmap for delete
  using (get_user_rol() in ('super_admin', 'director_proyecto', 'consultor') and user_has_proyecto(proyecto_id));
