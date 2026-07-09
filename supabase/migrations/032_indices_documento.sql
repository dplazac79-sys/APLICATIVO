-- 032: Índices de performance faltantes
-- documento(proyecto_id, estado_procesamiento) usado en discoveryAI con ambos filtros
CREATE INDEX IF NOT EXISTS idx_documento_proyecto_estado
  ON documento(proyecto_id, estado_procesamiento);

-- uso_ia(proyecto_id, tipo) usado para rate limiting
CREATE INDEX IF NOT EXISTS idx_uso_ia_proyecto_tipo
  ON uso_ia(proyecto_id, tipo);
