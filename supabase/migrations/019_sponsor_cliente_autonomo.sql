-- 019: sponsor_cliente acceso autónomo completo (scoped a su proyecto)
-- usuario_cliente sigue siendo solo lectura

-- ============================================================
-- PROCESO: sponsor_cliente puede insertar y actualizar
-- ============================================================
drop policy if exists "proceso_insert" on public.proceso;
drop policy if exists "proceso_update" on public.proceso;

create policy "proceso_insert" on public.proceso
  for insert with check (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    )
  );

create policy "proceso_update" on public.proceso
  for update using (
    exists (
      select 1 from public.usuario u
      join public.usuario_proyecto up on up.usuario_id = u.id
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
      and up.proyecto_id = proceso.proyecto_id
    )
  );

-- ============================================================
-- ARTEFACTO: sponsor_cliente puede insertar y actualizar
-- ============================================================
drop policy if exists "artefacto_staff_insert" on public.artefacto;
drop policy if exists "artefacto_staff_update" on public.artefacto;

create policy "artefacto_staff_insert" on public.artefacto
  for insert with check (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
  );

create policy "artefacto_staff_update" on public.artefacto
  for update using (
    get_user_rol() in ('super_admin','director_proyecto','consultor','sponsor_cliente')
  );

-- ============================================================
-- ARTEFACTO SELECT: sponsor_cliente ve todos los artefactos de su proyecto
-- (no solo los publicados)
-- ============================================================
drop policy if exists "artefacto_cliente_select" on public.artefacto;
drop policy if exists "artefacto_select" on public.artefacto;

create policy "artefacto_select" on public.artefacto
  for select using (
    exists (
      select 1 from public.usuario u
      left join public.usuario_proyecto up on up.usuario_id = u.id
      where u.id = auth.uid()
      and (
        u.rol = 'super_admin'
        or (
          u.rol in ('director_proyecto','consultor','sponsor_cliente')
          and up.proyecto_id = artefacto.proyecto_id
        )
        or (
          u.rol = 'usuario_cliente'
          and artefacto.estado_validacion = 'publicado'
          and up.proyecto_id = artefacto.proyecto_id
        )
      )
    )
  );

-- ============================================================
-- JOBS (Discovery AI): sponsor_cliente puede insertar jobs
-- ============================================================
drop policy if exists "jobs_insert" on public.jobs;

create policy "jobs_insert" on public.jobs
  for insert with check (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    )
  );

-- ============================================================
-- DOCUMENTO (tabla): sponsor_cliente puede subir y editar
-- ============================================================
drop policy if exists "documento_insert" on public.documento;
drop policy if exists "documento_update" on public.documento;

create policy "documento_insert" on public.documento
  for insert with check (
    exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    )
  );

create policy "documento_update" on public.documento
  for update using (
    exists (
      select 1 from public.usuario u
      join public.usuario_proyecto up on up.usuario_id = u.id
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
      and up.proyecto_id = documento.proyecto_id
    )
  );

-- ============================================================
-- STORAGE bucket documentos: sponsor_cliente puede subir archivos
-- ============================================================
drop policy if exists "storage_documentos_insert" on storage.objects;

create policy "storage_documentos_insert" on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.usuario u
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
    )
  );
