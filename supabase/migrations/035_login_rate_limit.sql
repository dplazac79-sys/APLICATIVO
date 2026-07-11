-- Migración 035: rate limiting de /api/auth/login por IP.
-- El lockout existente (3 intentos → bloqueo) está scoped a una sola cuenta;
-- no hay nada que límite el volumen total de requests a /api/auth/login, lo
-- que permite credential-stuffing distribuido entre muchas cuentas distintas
-- desde la misma IP (o automatizado desde muchas IPs, pero al menos esto
-- cierra el caso más común de fuerza bruta desde un origen único).

create table public.login_intento_ip (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

create index login_intento_ip_ip_idx on public.login_intento_ip (ip, created_at desc);

-- Solo el service_role (usado por el endpoint de login vía admin client)
-- puede leer/escribir esta tabla — no se expone vía anon/authenticated.
alter table public.login_intento_ip enable row level security;

create policy "service_role_only_login_intento_ip" on public.login_intento_ip
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
