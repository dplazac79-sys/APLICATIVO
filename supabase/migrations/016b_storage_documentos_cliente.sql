-- Bucket para documentos subidos por el cliente
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-cliente',
  'documentos-cliente',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword']
)
on conflict (id) do nothing;

-- Solo el service_role puede hacer operaciones de storage (el upload viene de la API route, no del browser)
create policy "service_upload_doc_cliente" on storage.objects
  for insert with check (bucket_id = 'documentos-cliente' and auth.role() = 'service_role');

create policy "service_read_doc_cliente" on storage.objects
  for select using (bucket_id = 'documentos-cliente' and auth.role() = 'service_role');
