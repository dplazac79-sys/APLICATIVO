-- Migración 039: corrige documento_insert (definida en 019) —
-- quita sponsor_cliente de los roles que pueden insertar documentos
-- (debe ser solo lectura, ver tests/integration/rls.test.ts:224) y
-- agrega el chequeo de pertenencia al proyecto que documento_update
-- ya tenía pero documento_insert nunca tuvo, evitando que
-- consultor/director_proyecto insertaran documentos en proyectos
-- ajenos.

drop policy if exists "documento_insert" on public.documento;

create policy "documento_insert" on public.documento
  for insert with check (
    exists (
      select 1 from public.usuario u
      join public.usuario_proyecto up on up.usuario_id = u.id
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor')
      and up.proyecto_id = documento.proyecto_id
    )
    or exists (
      select 1 from public.usuario u
      where u.id = auth.uid() and u.rol = 'super_admin'
    )
  );
