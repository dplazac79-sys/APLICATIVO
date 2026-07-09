-- 031: Corregir RLS INSERT de proceso_historial
-- La policy anterior tenía WITH CHECK (true), permitiendo que cualquier
-- usuario autenticado insertara registros. Solo el backend (service_role) debe hacerlo.

DROP POLICY IF EXISTS "proceso_historial_insert_service" ON proceso_historial;

CREATE POLICY "proceso_historial_insert_service" ON proceso_historial
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
