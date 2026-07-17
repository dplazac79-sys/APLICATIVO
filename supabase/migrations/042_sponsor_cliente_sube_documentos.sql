-- Migración 042: permite a sponsor_cliente insertar documentos en su
-- proyecto — la migración 039 lo había excluido a propósito ("debe ser
-- solo lectura"), pero eso quedó en contradicción directa con el resto de
-- la plataforma: la UI de Centro Documental le muestra la zona de carga
-- sin restricción de rol, y el manual de usuario del cliente documenta
-- explícitamente que puede subir sus propios documentos ("Documentos que
-- subes tú: etiquetados 'Cliente'"). Confirmado con el negocio: sponsor_
-- cliente sí debe poder subir — se corrige la política para que la base
-- de datos coincida con el producto real, no al revés.

drop policy if exists "documento_insert" on public.documento;

create policy "documento_insert" on public.documento
  for insert with check (
    exists (
      select 1 from public.usuario u
      join public.usuario_proyecto up on up.usuario_id = u.id
      where u.id = auth.uid()
      and u.rol in ('super_admin','director_proyecto','consultor','sponsor_cliente')
      and up.proyecto_id = documento.proyecto_id
    )
    or exists (
      select 1 from public.usuario u
      where u.id = auth.uid() and u.rol = 'super_admin'
    )
  );
