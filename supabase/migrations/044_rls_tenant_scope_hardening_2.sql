-- Migración 044: continúa el endurecimiento de RLS de la migración 034 —
-- esa migración corrigió entregable/simulacion/reunion/riesgo/kpi/
-- kg_recomendacion/kg_roadmap (policies rol-only sin chequeo de proyecto),
-- pero una auditoría de seguridad completa (previa a la entrega al cliente)
-- encontró que la MISMA clase de falla seguía presente en:
--
--   - artefacto_staff_insert / artefacto_staff_update (007, 019) — el más
--     grave: "artefacto" es el trabajo entregado al cliente (SIPOC, BPMN,
--     RACI, etc.), y cualquier usuario con rol director_proyecto/consultor/
--     sponsor_cliente podía escribir artefactos de OTRO cliente vía la API
--     de Supabase directamente, sin pasar por la app.
--   - proceso_insert (019) — mismo problema para la tabla de procesos.
--   - jobs_select / jobs_insert (002, 019) — mismo problema para los jobs
--     de discovery/análisis IA (resultado.jsonb puede contener contenido
--     del cliente).
--   - documento_insert (019/039/042) — mismo problema para documentos.
--   - storage_documentos_insert (019) — mismo problema a nivel de Storage:
--     no valida que el prefijo de proyecto_id en la ruta del archivo
--     pertenezca al usuario, permitiendo escribir archivos en la carpeta
--     de OTRO proyecto.
--
-- Como en 034: esto no se explota hoy porque las rutas de la app usan el
-- service_role client (bypasea RLS) y assertProyectoAccess ya cierra el
-- acceso cruzado a nivel de aplicación. Esta migración es defensa en
-- profundidad — si alguna ruta futura usa el cliente RLS-respecting en vez
-- del admin client, o si alguien llama a la API de Supabase directamente
-- con un JWT válido de cualquier rol, esta capa sigue bloqueando el
-- acceso cross-tenant.

-- ── artefacto ───────────────────────────────────────────────────────────
drop policy if exists "artefacto_staff_insert" on public.artefacto;
drop policy if exists "artefacto_staff_update" on public.artefacto;

create policy "artefacto_staff_insert" on public.artefacto
  for insert with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  );

create policy "artefacto_staff_update" on public.artefacto
  for update using (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  )
  with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  );

-- ── proceso ─────────────────────────────────────────────────────────────
drop policy if exists "proceso_insert" on public.proceso;

create policy "proceso_insert" on public.proceso
  for insert with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  );

-- ── jobs ────────────────────────────────────────────────────────────────
drop policy if exists "jobs_select" on public.jobs;
drop policy if exists "jobs_insert" on public.jobs;

create policy "jobs_select" on public.jobs for select
  using (
    get_user_rol() in ('super_admin','director_proyecto','consultor')
    and user_has_proyecto(proyecto_id)
  );

create policy "jobs_insert" on public.jobs for insert
  with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  );

-- ── documento ───────────────────────────────────────────────────────────
drop policy if exists "documento_insert" on public.documento;

create policy "documento_insert" on public.documento
  for insert with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(proyecto_id)
  );

-- ── storage.objects (bucket "documentos") ──────────────────────────────
-- La app sube a `${proyecto_id}/${timestamp}-${nombre}` — el primer
-- segmento de la ruta es el proyecto_id. storage.foldername(name) devuelve
-- los segmentos de carpeta como text[]; se valida que ese primer segmento
-- sea un proyecto al que el usuario pertenece. Un nombre de archivo
-- malformado (que no empiece con un uuid válido) hace fallar el cast y
-- la policy deniega — comportamiento correcto (fail closed).
drop policy if exists "storage_documentos_insert" on storage.objects;

create policy "storage_documentos_insert" on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    and user_has_proyecto(((storage.foldername(name))[1])::uuid)
  );
