-- ============================================================
-- Fase 2 — Análisis IA enriquecido
-- Columnas para almacenar el JSON completo de los prompts v3.0
-- (antes solo se guardaba resumen_ejecutivo como texto plano)
-- ============================================================

alter table public.documento add column if not exists analisis_ia jsonb;
alter table public.proceso add column if not exists metadata_ia jsonb;
alter table public.proyecto add column if not exists discovery_resumen jsonb;
