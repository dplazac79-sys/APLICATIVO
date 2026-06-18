-- Migración 014: corrige FKs sin ON DELETE en campos de autoría
-- Aplica SET NULL a todos los campos creado_por / subido_por / responsable_id
-- que apuntan a usuario(id) — el contenido debe sobrevivir si se elimina el usuario.

-- ── documento.subido_por ────────────────────────────────────────────────────
ALTER TABLE documento
  DROP CONSTRAINT IF EXISTS documento_subido_por_fkey,
  ADD CONSTRAINT documento_subido_por_fkey
    FOREIGN KEY (subido_por) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── audit_log.usuario_id ────────────────────────────────────────────────────
ALTER TABLE audit_log
  DROP CONSTRAINT IF EXISTS audit_log_usuario_id_fkey,
  ADD CONSTRAINT audit_log_usuario_id_fkey
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── workflow_estado.responsable_id ──────────────────────────────────────────
ALTER TABLE workflow_estado
  DROP CONSTRAINT IF EXISTS workflow_estado_responsable_id_fkey,
  ADD CONSTRAINT workflow_estado_responsable_id_fkey
    FOREIGN KEY (responsable_id) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── reunion.created_by ──────────────────────────────────────────────────────
ALTER TABLE reunion
  DROP CONSTRAINT IF EXISTS reunion_created_by_fkey,
  ADD CONSTRAINT reunion_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── simulacion.creado_por ───────────────────────────────────────────────────
ALTER TABLE simulacion
  DROP CONSTRAINT IF EXISTS simulacion_creado_por_fkey,
  ADD CONSTRAINT simulacion_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── entregable.creado_por ───────────────────────────────────────────────────
ALTER TABLE entregable
  DROP CONSTRAINT IF EXISTS entregable_creado_por_fkey,
  ADD CONSTRAINT entregable_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── kg_recomendacion.creado_por ─────────────────────────────────────────────
ALTER TABLE kg_recomendacion
  DROP CONSTRAINT IF EXISTS kg_recomendacion_creado_por_fkey,
  ADD CONSTRAINT kg_recomendacion_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES usuario(id) ON DELETE SET NULL;

-- ── kg_roadmap.creado_por ───────────────────────────────────────────────────
ALTER TABLE kg_roadmap
  DROP CONSTRAINT IF EXISTS kg_roadmap_creado_por_fkey,
  ADD CONSTRAINT kg_roadmap_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES usuario(id) ON DELETE SET NULL;
