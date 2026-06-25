-- 022: Toggle MFA por usuario
alter table usuario add column if not exists mfa_habilitado boolean not null default true;
