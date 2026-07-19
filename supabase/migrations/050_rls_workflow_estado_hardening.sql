-- Migración 050: corrige workflow_estado, la única tabla que quedó fuera de
-- los dos hardening passes anteriores (034 y 044).
--
-- Hallazgo de auditoría profunda: las políticas originales (008) permitían a
-- cualquier usuario con rol super_admin/director_proyecto/consultor —
-- SIN importar si pertenece al proyecto — leer TODOS los workflow_estado de
-- TODOS los proyectos (el branch `get_user_rol() in (...)` del SELECT no
-- tiene scoping y está OR'd con el branch que sí lo tiene, así que lo
-- neutraliza), e insertar/actualizar workflow_estado de CUALQUIER proyecto
-- (INSERT/UPDATE no tienen ningún chequeo de proyecto). Mismo patrón exacto
-- ya corregido en entregable/simulacion/reunion/riesgo/kpi/etc. por 034/044,
-- pero esta tabla no estaba en ninguna de esas dos listas.
drop policy if exists "workflow_select_staff" on public.workflow_estado;
drop policy if exists "workflow_insert_staff" on public.workflow_estado;
drop policy if exists "workflow_update_staff" on public.workflow_estado;

create policy "workflow_select_staff" on public.workflow_estado for select
  using (user_has_proyecto(proyecto_id));

create policy "workflow_insert_staff" on public.workflow_estado for insert
  with check (get_user_rol() in ('super_admin','director_proyecto','consultor')
    and user_has_proyecto(proyecto_id));

create policy "workflow_update_staff" on public.workflow_estado for update
  using (get_user_rol() in ('super_admin','director_proyecto','consultor')
    and user_has_proyecto(proyecto_id));
