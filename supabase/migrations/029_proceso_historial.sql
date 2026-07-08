-- 029: Historial de versiones a nivel de proceso (Discovery + estado)
-- Captura automáticamente cada cambio relevante en la tabla proceso

CREATE TABLE IF NOT EXISTS proceso_historial (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proceso_id      uuid NOT NULL REFERENCES proceso(id) ON DELETE CASCADE,
  proyecto_id     uuid NOT NULL,
  version         integer NOT NULL DEFAULT 1,
  tipo_cambio     text NOT NULL,   -- 'discovery_ia', 'correccion_cliente', 'estado_oferta', 'edicion_manual', 'nueva_version'
  descripcion     text NOT NULL,   -- texto legible para el cliente: "Se generó análisis IA del proceso"
  detalle         jsonb,           -- snapshot o datos adicionales
  modificado_por  uuid REFERENCES usuario(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proceso_historial_proceso ON proceso_historial(proceso_id);
CREATE INDEX IF NOT EXISTS idx_proceso_historial_proyecto ON proceso_historial(proyecto_id);

ALTER TABLE proceso_historial ENABLE ROW LEVEL SECURITY;

-- Misma policy que artefacto_historial: miembros del proyecto pueden leer
CREATE POLICY "proceso_historial_lectura" ON proceso_historial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_proyecto up
      WHERE up.proyecto_id = proceso_historial.proyecto_id
        AND up.usuario_id = auth.uid()
    )
  );

-- super_admin ve todo
CREATE POLICY "proceso_historial_admin" ON proceso_historial
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario u WHERE u.id = auth.uid() AND u.rol = 'super_admin'
    )
  );

-- Solo insert desde service_role (backend)
CREATE POLICY "proceso_historial_insert_service" ON proceso_historial
  FOR INSERT WITH CHECK (true);
