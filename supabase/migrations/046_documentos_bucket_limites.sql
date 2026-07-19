-- Migración 046: fija límites de tamaño y tipo de archivo en el bucket de
-- Storage "documentos" a nivel de servidor.
--
-- Hallazgo de auditoría: el bucket fue creado manualmente (fuera de las
-- migraciones) sin file_size_limit ni allowed_mime_types. La validación de
-- tipo/tamaño (25MB, PDF/DOC/DOCX/XLS/XLSX/JPG/PNG/GIF/WEBP — ver
-- src/components/documentos/DocumentUploader.tsx) solo existía en el
-- navegador, así que cualquiera con un token válido podía subir directo a
-- la API de Storage saltándose por completo esa validación: archivos de
-- cualquier tamaño/tipo (ejecutables, scripts, etc.).
--
-- Aplicado ya en producción directamente vía la API de Storage
-- (PUT /storage/v1/bucket/documentos con la service_role key) — esta
-- migración deja el mismo cambio documentado en el historial de SQL para
-- que un entorno nuevo (o un reset de la base) lo reproduzca igual.
update storage.buckets
set
  file_size_limit = 26214400, -- 25 MB, igual al límite ya anunciado en la UI
  allowed_mime_types = array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
where id = 'documentos';
