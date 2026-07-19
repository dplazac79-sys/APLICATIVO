-- Migración 051: corrige firma_solicitud (hallazgo de auditoría profunda).
--
-- 1. firma_insertar_interno (INSERT) solo chequeaba el rol del usuario, sin
--    verificar que el proyecto_id insertado pertenezca a un proyecto suyo.
--    Un consultor/director asignado solo al Proyecto A podía insertar una
--    firma_solicitud con proyecto_id = Proyecto B (otro cliente) vía REST
--    directo, generando un token de firma válido para un artefacto ajeno.
--
-- 2. firma_actualizar_proyecto (UPDATE) permitía a CUALQUIER miembro del
--    proyecto — incluyendo roles cliente (usuario_cliente, sponsor_cliente)
--    — marcar una solicitud como "firmado" directamente, sin pasar por el
--    flujo real de firma (que exige poseer el token y va por
--    /api/firmas/[id] con el cliente admin, ver PATCH ahí). Se restringe a
--    solo lectura para clientes; solo staff (vía la app) puede transicionar
--    estado, y el flujo público de firma sigue funcionando porque usa el
--    cliente service_role (bypassa RLS), no la sesión del firmante.
drop policy if exists "firma_insertar_interno" on firma_solicitud;
drop policy if exists "firma_actualizar_proyecto" on firma_solicitud;

create policy "firma_insertar_interno" on firma_solicitud
  for insert with check (
    exists (
      select 1 from usuario u
      where u.id = auth.uid()
        and u.rol in ('super_admin','director_proyecto','consultor')
    )
    and user_has_proyecto(proyecto_id)
  );

create policy "firma_actualizar_staff_proyecto" on firma_solicitud
  for update using (
    exists (
      select 1 from usuario u
      where u.id = auth.uid()
        and u.rol in ('super_admin','director_proyecto','consultor')
    )
    and user_has_proyecto(proyecto_id)
  );
