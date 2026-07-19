-- Migración 049: elimina la columna mfa_habilitado.
--
-- Se agregó en la migración 022 como base para un futuro toggle de MFA por
-- usuario, pero ningún flujo de autenticación llegó a implementarse — nada
-- en el código lee ni escribe esta columna. Se elimina para no dejar
-- esquema muerto que sugiera una protección de MFA que en realidad no
-- existe (hallazgo de auditoría de seguridad, informativo).
alter table usuario drop column if exists mfa_habilitado;
