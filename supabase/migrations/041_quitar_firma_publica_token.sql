-- 041: Elimina la política "firma_publica_token" (using (true)) sobre firma_solicitud.
-- Migración 018 la creó pensando en la página pública de firma (/firma/[token]),
-- pero esa página y su API ya leen firma_solicitud con el cliente admin
-- (service role, que bypasea RLS) — la política nunca fue necesaria y en la
-- práctica exponía toda la tabla (tokens, nombres y correos de firmantes de
-- todos los clientes) a cualquiera con la anon key pública.
drop policy if exists "firma_publica_token" on public.firma_solicitud;
