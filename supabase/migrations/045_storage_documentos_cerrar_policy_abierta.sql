-- Migración 045: cierra dos políticas de storage.objects (bucket
-- "documentos") que quedaron completamente abiertas desde la creación
-- manual del bucket (fuera de las migraciones) y que en la práctica
-- anulaban el endurecimiento de la migración 044 — Postgres combina
-- políticas permisivas del mismo comando con OR, así que bastaba con que
-- UNA fuera abierta para que la restrictiva no sirviera de nada.
--
-- Encontradas al verificar en vivo la migración 044: un upload a la
-- carpeta de un proyecto ajeno seguía funcionando pese a que
-- "storage_documentos_insert" (044) ya validaba user_has_proyecto() sobre
-- el prefijo de la ruta — la causa era "autenticados_pueden_subir", una
-- policy INSERT con with_check = (bucket_id = 'documentos') sin ninguna
-- otra condición. "autenticados_pueden_eliminar" tiene el mismo problema
-- para DELETE (cualquier autenticado puede borrar archivos de cualquier
-- proyecto).

-- ── INSERT: la política abierta es completamente redundante con
--    "storage_documentos_insert" (044), que ya cubre el caso legítimo. ──
drop policy if exists "autenticados_pueden_subir" on storage.objects;

-- ── DELETE: no existía ninguna versión scoped — se reemplaza la abierta
--    por una que exige que el usuario pertenezca al proyecto (mismo
--    prefijo de ruta) y tenga rol habilitado para subir/gestionar
--    documentos, en vez de "cualquier autenticado puede borrar cualquier
--    archivo". ──
drop policy if exists "autenticados_pueden_eliminar" on storage.objects;

create policy "storage_documentos_delete" on storage.objects
  for delete using (
    bucket_id = 'documentos'
    and get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(((storage.foldername(name))[1])::uuid)
  );
