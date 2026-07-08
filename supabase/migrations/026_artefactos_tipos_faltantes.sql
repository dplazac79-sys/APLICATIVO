-- Agrega los 6 tipos de artefacto que faltaban en el enum.
-- Sin estos valores el INSERT fallaba silenciosamente, causando el bug 12/18.
alter type public.tipo_artefacto add value if not exists 'checklist';
alter type public.tipo_artefacto add value if not exists 'backlog';
alter type public.tipo_artefacto add value if not exists 'cinco_porques';
alter type public.tipo_artefacto add value if not exists 'acta_inicio';
alter type public.tipo_artefacto add value if not exists 'plan_pruebas';
alter type public.tipo_artefacto add value if not exists 'roadmap';
