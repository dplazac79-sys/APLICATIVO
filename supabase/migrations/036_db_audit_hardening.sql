-- Migración 036: auditoría de base de datos — cierra dos agujeros RLS
-- críticos de tenant-isolation, agrega índices faltantes en columnas FK,
-- constraints CHECK para columnas tipo-enum sin validar, y hace que el
-- historial de artefactos sobreviva al borrado del artefacto padre.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. CRÍTICO: firma_solicitud tenía una policy "using (true)" sin ningún
--    filtro — cualquier usuario autenticado (de cualquier tenant) podía
--    hacer select * sobre TODAS las solicitudes de firma de TODOS los
--    clientes vía la REST API de Supabase directamente, sin pasar por la
--    app. El flujo real de la página pública de firma (/firma/[token])
--    usa el admin client (service_role, bypasea RLS) — esta policy nunca
--    fue necesaria para que la app funcionara, solo quedó como agujero.
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "firma_publica_token" on public.firma_solicitud;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CRÍTICO: documento_chunk (texto + embeddings de documentos de
--    clientes) tenía una única policy "using (true) with check (true)" —
--    mismo agujero que firma_solicitud pero sobre contenido potencialmente
--    confidencial de entregables de consultoría. Reemplazada por el mismo
--    patrón de tenant-scoping que documento/artefacto ya usan.
-- ═══════════════════════════════════════════════════════════════════════
drop policy if exists "admin_all_chunks" on public.documento_chunk;

create policy "documento_chunk_select" on public.documento_chunk
  for select
  using (
    get_user_rol() = 'super_admin'
    or exists (select 1 from public.usuario_proyecto up
               where up.proyecto_id = documento_chunk.proyecto_id and up.usuario_id = auth.uid())
  );

-- Solo el service_role (job de Inngest vía admin client) escribe chunks —
-- nunca se insertan/actualizan/borran desde el cliente.
create policy "documento_chunk_write_service_role" on public.documento_chunk
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Índices faltantes en columnas FK usadas activamente en queries de la
--    app (Postgres NO indexa automáticamente columnas FK).
-- ═══════════════════════════════════════════════════════════════════════
create index if not exists jobs_proyecto_idx on public.jobs (proyecto_id);
create index if not exists notificacion_proyecto_idx on public.notificacion (proyecto_id);
create index if not exists notificacion_proceso_idx on public.notificacion (proceso_id);
create index if not exists riesgo_proceso_idx on public.riesgo (proceso_id);
create index if not exists kpi_proceso_idx on public.kpi (proceso_id);
create index if not exists workflow_estado_responsable_idx on public.workflow_estado (responsable_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CHECK constraints para columnas que documentaban sus valores válidos
--    solo en un comentario, sin enforcement real — un typo o un bug podía
--    insertar un valor inválido y romper silenciosamente cada filtro
--    downstream (.eq('estado_general','activo')). NOT VALID: no escanea
--    filas existentes (sin lock largo), pero SÍ se aplica a partir de
--    ahora para inserts/updates nuevos.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.cliente
  add constraint cliente_tamano_check
  check (tamano is null or tamano in ('micro', 'pequeña', 'mediana', 'grande')) not valid;

alter table public.cliente
  add constraint cliente_madurez_digital_check
  check (madurez_digital is null or madurez_digital in ('inicial', 'en desarrollo', 'avanzado')) not valid;

alter table public.proyecto
  add constraint proyecto_estado_general_check
  check (estado_general in ('activo', 'pausado', 'cerrado')) not valid;

alter table public.riesgo
  add constraint riesgo_probabilidad_check
  check (probabilidad in ('alta', 'media', 'baja')) not valid;

alter table public.riesgo
  add constraint riesgo_impacto_check
  check (impacto in ('alto', 'medio', 'bajo')) not valid;

alter table public.riesgo
  add constraint riesgo_nivel_riesgo_check
  check (nivel_riesgo in ('critico', 'alto', 'medio', 'bajo')) not valid;

alter table public.riesgo
  add constraint riesgo_estado_check
  check (estado in ('activo', 'mitigado', 'aceptado')) not valid;

alter table public.notificacion
  add constraint notificacion_tipo_check
  check (tipo in ('transicion', 'escalacion', 'aprobacion', 'alarma')) not valid;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. artefacto_historial es el registro inmutable de versiones anteriores
--    de un artefacto — pero su FK a artefacto era "on delete cascade",
--    así que borrar un artefacto borraba también su propio historial,
--    contradiciendo el propósito de la tabla (defender entregables ante
--    el cliente). Se cambia a "on delete set null" + columna nullable
--    para que el historial sobreviva al borrado del artefacto padre.
-- ═══════════════════════════════════════════════════════════════════════
alter table public.artefacto_historial
  drop constraint if exists artefacto_historial_artefacto_id_fkey;

alter table public.artefacto_historial
  alter column artefacto_id drop not null;

alter table public.artefacto_historial
  add constraint artefacto_historial_artefacto_id_fkey
  foreign key (artefacto_id) references public.artefacto(id) on delete set null;
