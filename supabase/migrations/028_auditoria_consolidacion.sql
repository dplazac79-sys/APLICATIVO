-- ============================================================
-- Auditoría integral — consolidación y limpieza (2026-07-08)
-- ============================================================
-- Esta migración es idempotente (todo usa IF NOT EXISTS / IF EXISTS).
-- Resuelve inconsistencias detectadas en la auditoría:
--   1. Índice faltante en proceso.codigo
--   2. Columnas de proyecto que podrían faltar en DB antigua
--   3. Columna proceso.codigo que podría faltar en DB antigua
--   4. Garantizar que artefacto_historial tiene FK correcta
--   5. Garantizar grants a service_role en tablas nuevas
-- ============================================================

-- 1. proceso.codigo (ya en migración 025, pero asegurar idempotencia)
ALTER TABLE proceso ADD COLUMN IF NOT EXISTS codigo TEXT;
CREATE INDEX IF NOT EXISTS idx_proceso_codigo ON proceso(codigo) WHERE codigo IS NOT NULL;

-- 2. proyecto — campos del brief y fechas (migraciones 020 + 021)
ALTER TABLE proyecto
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS fecha_estimada_cierre DATE,
  ADD COLUMN IF NOT EXISTS objetivos TEXT,
  ADD COLUMN IF NOT EXISTS n_procesos_estimados INTEGER,
  ADD COLUMN IF NOT EXISTS alcance_incluye TEXT,
  ADD COLUMN IF NOT EXISTS alcance_excluye TEXT,
  ADD COLUMN IF NOT EXISTS contexto TEXT;

-- 3. usuario — toggle MFA (migración 022)
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS mfa_habilitado BOOLEAN NOT NULL DEFAULT true;

-- 4. Asegurar que artefacto_historial tiene índice en artefacto_id
CREATE INDEX IF NOT EXISTS artefacto_historial_artefacto_idx
  ON public.artefacto_historial (artefacto_id);

-- 5. Grants service_role en todas las tablas que podrían faltar
GRANT ALL ON public.artefacto_historial TO service_role;
GRANT ALL ON public.encuesta_feedback    TO service_role;
GRANT ALL ON public.firma_solicitud      TO service_role;
GRANT ALL ON public.documento_cliente    TO service_role;
GRANT ALL ON public.proceso_enriquecido  TO service_role;
GRANT ALL ON public.uso_ia               TO service_role;
GRANT ALL ON public.glosario_roles_analisis TO service_role;
GRANT ALL ON public.kg_nodo              TO service_role;
GRANT ALL ON public.kg_relacion          TO service_role;
GRANT ALL ON public.kg_recomendacion     TO service_role;
GRANT ALL ON public.kg_roadmap           TO service_role;

-- 6. Limpiar artefactos con tipos descontinuados (complemento de migración 027)
DELETE FROM public.artefacto
WHERE tipo NOT IN (
  'sipoc', 'as_is', 'bpmn', 'raci',
  'riesgo_control', 'kpi_sla', 'diagnostico', 'to_be'
);

-- 7. Limpiar historial y feedback huérfanos
DELETE FROM public.artefacto_historial
WHERE artefacto_id NOT IN (SELECT id FROM public.artefacto);

DELETE FROM public.encuesta_feedback
WHERE artefacto_id NOT IN (SELECT id FROM public.artefacto);
