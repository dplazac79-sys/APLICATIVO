-- ============================================================
-- Auditoría: alinear BD con los 8 artefactos metodológicos
-- ============================================================
-- La plataforma pasó de 18 → 8 artefactos por proceso.
-- Esta migración limpia los datos huérfanos y deja la BD
-- coherente con ORDEN_GENERACION del código.

-- Los 8 tipos válidos son:
--   sipoc, as_is, bpmn, raci, riesgo_control, kpi_sla, diagnostico, to_be
--
-- Los 10 tipos eliminados (ya no se generan ni muestran):
--   historias_usuario, flujograma, dashboard_brechas, cierre_ejecutivo,
--   checklist, backlog, cinco_porques, acta_inicio, plan_pruebas, roadmap

-- 1. Eliminar artefactos con tipos fuera del set de 8
--    (incluye historial asociado por ON DELETE CASCADE)
delete from public.artefacto
where tipo not in (
  'sipoc', 'as_is', 'bpmn', 'raci',
  'riesgo_control', 'kpi_sla', 'diagnostico', 'to_be'
);

-- 2. Limpiar historial huérfano (artefactos ya eliminados)
--    artefacto_historial tiene FK → artefacto con ON DELETE CASCADE,
--    pero por seguridad eliminamos explícitamente los que no tengan artefacto padre.
delete from public.artefacto_historial
where artefacto_id not in (select id from public.artefacto);

-- 3. Limpiar encuestas de feedback de artefactos eliminados
delete from public.encuesta_feedback
where artefacto_id not in (select id from public.artefacto);

-- 4. Asegurar que el índice de unicidad (proceso_id, tipo) siga limpio.
--    (No requiere acción — el DELETE lo deja limpio automáticamente.)

-- Nota: No eliminamos los valores del enum tipo_artefacto porque PostgreSQL
-- no soporta DROP VALUE en enums. Los 10 valores extra quedan en el tipo
-- pero nunca se insertan — son inofensivos.
