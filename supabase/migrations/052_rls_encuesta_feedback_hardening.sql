-- Migración 052: corrige encuesta_feedback (hallazgo de auditoría profunda).
--
-- Las políticas de insert/update solo comprobaban `usuario_id = auth.uid()`
-- (dueño de la fila) — nunca que proyecto_id/artefacto_id realmente
-- pertenezcan a un proyecto del usuario, ni que artefacto_id pertenezca al
-- proyecto_id declarado. Un usuario (incluso rol cliente) con acceso al
-- Proyecto A podía insertar/actualizar una fila apuntando a proyecto_id =
-- Proyecto B y artefacto_id de Proyecto B, inyectando feedback falso visible
-- para el staff/cliente de otro proyecto (encuesta_leer_proyecto sí filtra
-- correctamente por proyecto, así que la fila queda visible ahí).
drop policy if exists "encuesta_insertar_propio" on encuesta_feedback;
drop policy if exists "encuesta_actualizar_propio" on encuesta_feedback;

create policy "encuesta_insertar_propio" on encuesta_feedback
  for insert with check (
    usuario_id = auth.uid()
    and user_has_proyecto(proyecto_id)
    and exists (
      select 1 from artefacto a
      where a.id = encuesta_feedback.artefacto_id
        and a.proyecto_id = encuesta_feedback.proyecto_id
    )
  );

create policy "encuesta_actualizar_propio" on encuesta_feedback
  for update using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and user_has_proyecto(proyecto_id)
    and exists (
      select 1 from artefacto a
      where a.id = encuesta_feedback.artefacto_id
        and a.proyecto_id = encuesta_feedback.proyecto_id
    )
  );
