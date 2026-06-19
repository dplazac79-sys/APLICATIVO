-- ── Migración 017: Glosario de Roles ─────────────────────────────────────────
-- Permite al cliente subir su organigrama y CVs, y la IA mapea roles del
-- proceso a personas reales de su organización.

-- Organigrama del cliente (PDF o imagen)
CREATE TABLE IF NOT EXISTS organigrama_cliente (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id   uuid NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  nombre_archivo text NOT NULL,
  texto_extraido text,               -- texto extraído del PDF/imagen
  estado        text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','procesando','listo','error')),
  subido_por    uuid REFERENCES usuario(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- CVs de personas del organigrama
CREATE TABLE IF NOT EXISTS cv_persona_org (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     uuid NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  organigrama_id  uuid REFERENCES organigrama_cliente(id) ON DELETE SET NULL,
  nombre_persona  text NOT NULL,
  cargo_actual    text,
  storage_path    text,              -- path en storage si subieron PDF
  texto_cv        text,              -- texto libre o extraído
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Resultado del análisis de glosario de roles (uno por proyecto × revisión)
CREATE TABLE IF NOT EXISTS glosario_roles_analisis (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id       uuid NOT NULL REFERENCES proyecto(id) ON DELETE CASCADE,
  organigrama_id    uuid REFERENCES organigrama_cliente(id),
  estado            text NOT NULL DEFAULT 'generando'
                    CHECK (estado IN ('generando','completado','error')),
  roles_en_procesos jsonb,           -- array de roles detectados en documentos SC
  mapeos            jsonb,           -- array de RolMapeo (ver abajo)
  resumen_ejecutivo text,
  total_mapeados    int DEFAULT 0,
  total_equivalencias int DEFAULT 0,
  total_crear_cargo int DEFAULT 0,
  error_msg         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- RolMapeo (estructura JSON dentro de mapeos[]):
-- {
--   rol_proceso: string,          -- "Jefe de Supply Chain"
--   descripcion_rol: string,      -- qué hace ese rol en el proceso
--   tipo: "mapeo_directo" | "equivalencia" | "crear_cargo",
--   persona_sugerida: string|null, -- "María Pérez"
--   cargo_sugerido: string|null,   -- "Jefe de Operaciones"
--   confianza: number,             -- 0–100
--   justificacion: string,
--   skills_requeridos: string[],
--   gap_detectado: string|null,
--   accion_recomendada: string
-- }

-- Triggers updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS organigrama_cliente_updated_at ON organigrama_cliente;
CREATE TRIGGER organigrama_cliente_updated_at
  BEFORE UPDATE ON organigrama_cliente
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS glosario_roles_analisis_updated_at ON glosario_roles_analisis;
CREATE TRIGGER glosario_roles_analisis_updated_at
  BEFORE UPDATE ON glosario_roles_analisis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE organigrama_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_persona_org      ENABLE ROW LEVEL SECURITY;
ALTER TABLE glosario_roles_analisis ENABLE ROW LEVEL SECURITY;

-- Service role lo gestiona todo
CREATE POLICY "service_role_organigrama" ON organigrama_cliente
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_cv" ON cv_persona_org
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_glosario" ON glosario_roles_analisis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cliente ve solo su proyecto
CREATE POLICY "cliente_ve_organigrama" ON organigrama_cliente
  FOR SELECT USING (
    proyecto_id IN (
      SELECT proyecto_id FROM usuario_proyecto
      WHERE usuario_id = auth.uid()
    )
  );
CREATE POLICY "cliente_ve_cv" ON cv_persona_org
  FOR SELECT USING (
    proyecto_id IN (
      SELECT proyecto_id FROM usuario_proyecto
      WHERE usuario_id = auth.uid()
    )
  );
CREATE POLICY "cliente_ve_glosario" ON glosario_roles_analisis
  FOR SELECT USING (
    proyecto_id IN (
      SELECT proyecto_id FROM usuario_proyecto
      WHERE usuario_id = auth.uid()
    )
  );

-- Storage bucket para organigramas y CVs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'glosario-roles',
  'glosario-roles',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf','image/png','image/jpeg','image/jpg','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "service_role_storage_glosario" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'glosario-roles') WITH CHECK (bucket_id = 'glosario-roles');
