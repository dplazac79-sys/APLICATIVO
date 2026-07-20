-- Migración 056: agrega CHECK constraints a columnas que usan texto libre
-- como enum informal (permitían insertar cualquier valor vía acceso directo
-- a la BD, bypaseando la validación que sí existe en el código de la app).
-- Continúa el patrón ya usado en la migración 036. Todas NOT VALID — no
-- valida filas existentes (por si hay datos históricos fuera del set
-- documentado), pero bloquea valores inválidos desde ahora en adelante.
-- Los valores permitidos se sacaron de dónde el código realmente los usa
-- (comentarios de columna, formularios, prompts de IA), no inventados.

-- documento.tipo: pdf | docx | xlsx | imagen | otro (detectTipo() en
-- DocumentUploader.tsx). Sin filas NULL hoy — se agrega también NOT NULL,
-- ya que la app siempre asigna un valor (default 'otro' si no matchea).
alter table documento alter column tipo set not null;
alter table documento alter column tipo set default 'otro';
alter table documento
  add constraint documento_tipo_check
  check (tipo in ('pdf', 'docx', 'xlsx', 'imagen', 'otro')) not valid;

-- riesgo.categoria: mismo set de categorías que ya usa el prompt de IA del
-- artefacto riesgo_control (src/lib/prompts/artefactos/riesgo_control.md) —
-- api/riesgos/route.ts acepta body.categoria sin validar contra un set fijo.
alter table riesgo
  add constraint riesgo_categoria_check
  check (categoria in ('operacional', 'tecnológico', 'regulatorio', 'financiero', 'reputacional')) not valid;

-- kpi.frecuencia: opciones del <select> en KpiForm.tsx.
alter table kpi
  add constraint kpi_frecuencia_check
  check (frecuencia in ('diaria', 'semanal', 'mensual', 'trimestral')) not valid;

-- entregable.tipo / .estado: valores documentados en el comentario original
-- de la migración 010 (artefacto | simulacion | reporte, borrador |
-- aprobado | exportado).
alter table entregable
  add constraint entregable_tipo_check
  check (tipo in ('artefacto', 'simulacion', 'reporte')) not valid;

alter table entregable
  add constraint entregable_estado_check
  check (estado in ('borrador', 'aprobado', 'exportado')) not valid;

-- audit_log.accion: set completo del tipo AuditAccion en src/lib/audit.ts
-- (algunos valores como REJECT/LOGOUT/UPLOAD están definidos en el tipo TS
-- para uso futuro aunque no todos se usen activamente hoy — se incluyen
-- para no bloquear código que ya los declara como válidos).
alter table audit_log
  add constraint audit_log_accion_check
  check (accion in ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'RUN', 'UPLOAD')) not valid;

-- proceso_historial.tipo_cambio: valores documentados en el comentario
-- original de la migración 029.
alter table proceso_historial
  add constraint proceso_historial_tipo_cambio_check
  check (tipo_cambio in ('discovery_ia', 'correccion_cliente', 'estado_oferta', 'edicion_manual', 'nueva_version')) not valid;

-- artefacto_historial.tipo / .estado_validacion: ambas columnas son text
-- (no el enum tipo_artefacto/estado_validacion) pero siempre se llenan
-- copiando artefacto.tipo / artefacto.estado_validacion (ver
-- api/artefactos/[id]/route.ts y api/artefactos/[id]/historial/route.ts) —
-- se restringen al mismo set de valores que esos dos enums.
alter table artefacto_historial
  add constraint artefacto_historial_tipo_check
  check (tipo in ('sipoc', 'as_is', 'bpmn', 'historias_usuario', 'flujograma', 'raci', 'riesgo_control', 'kpi_sla', 'diagnostico', 'to_be', 'dashboard_brechas', 'cierre_ejecutivo')) not valid;

alter table artefacto_historial
  add constraint artefacto_historial_estado_validacion_check
  check (estado_validacion in ('pendiente', 'validado', 'publicado')) not valid;
