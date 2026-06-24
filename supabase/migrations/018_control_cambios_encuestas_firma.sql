-- 018: Control de cambios, encuestas de feedback y firma digital

-- ============================================================
-- TABLA: artefacto_historial
-- Snapshot inmutable de cada versión anterior de un artefacto
-- ============================================================
create table if not exists artefacto_historial (
  id              uuid primary key default uuid_generate_v4(),
  artefacto_id    uuid not null references artefacto(id) on delete cascade,
  proceso_id      uuid not null,
  tipo            text not null,
  contenido       jsonb not null,
  version         integer not null,
  estado_validacion text not null,
  modificado_por  uuid references usuario(id) on delete set null,
  motivo_cambio   text,
  created_at      timestamptz not null default now()
);

create index idx_historial_artefacto on artefacto_historial(artefacto_id);
create index idx_historial_proceso    on artefacto_historial(proceso_id);

alter table artefacto_historial enable row level security;

create policy "historial_lectura_proyecto" on artefacto_historial
  for select using (
    exists (
      select 1 from proyecto_usuario pu
      join artefacto a on a.proceso_id = artefacto_historial.proceso_id
      where pu.proyecto_id = a.proyecto_id
        and pu.usuario_id = auth.uid()
    )
  );

-- ============================================================
-- TABLA: encuesta_feedback
-- Valoración de artefactos por usuarios del cliente
-- ============================================================
create table if not exists encuesta_feedback (
  id              uuid primary key default uuid_generate_v4(),
  artefacto_id    uuid not null references artefacto(id) on delete cascade,
  proyecto_id     uuid not null references proyecto(id) on delete cascade,
  usuario_id      uuid references usuario(id) on delete set null,
  puntuacion      integer not null check (puntuacion between 1 and 5),
  comentario      text,
  aprobado        boolean not null default false,
  created_at      timestamptz not null default now()
);

create unique index idx_encuesta_unica on encuesta_feedback(artefacto_id, usuario_id);
create index idx_encuesta_proyecto on encuesta_feedback(proyecto_id);

alter table encuesta_feedback enable row level security;

create policy "encuesta_insertar_propio" on encuesta_feedback
  for insert with check (usuario_id = auth.uid());

create policy "encuesta_leer_proyecto" on encuesta_feedback
  for select using (
    exists (
      select 1 from proyecto_usuario pu
      where pu.proyecto_id = encuesta_feedback.proyecto_id
        and pu.usuario_id = auth.uid()
    )
  );

create policy "encuesta_actualizar_propio" on encuesta_feedback
  for update using (usuario_id = auth.uid());

-- ============================================================
-- TABLA: firma_solicitud
-- Solicitudes de firma digital por artefacto/documento
-- ============================================================
create table if not exists firma_solicitud (
  id              uuid primary key default uuid_generate_v4(),
  proyecto_id     uuid not null references proyecto(id) on delete cascade,
  artefacto_id    uuid references artefacto(id) on delete cascade,
  titulo          text not null,
  descripcion     text,
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  solicitado_por  uuid references usuario(id) on delete set null,
  firmante_nombre text,
  firmante_email  text,
  firmante_cargo  text,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'firmado', 'rechazado', 'expirado')),
  firmado_at      timestamptz,
  expira_at       timestamptz not null default (now() + interval '30 days'),
  ip_firma        text,
  created_at      timestamptz not null default now()
);

create index idx_firma_proyecto   on firma_solicitud(proyecto_id);
create index idx_firma_token      on firma_solicitud(token);
create index idx_firma_artefacto  on firma_solicitud(artefacto_id);

alter table firma_solicitud enable row level security;

create policy "firma_leer_proyecto" on firma_solicitud
  for select using (
    exists (
      select 1 from proyecto_usuario pu
      where pu.proyecto_id = firma_solicitud.proyecto_id
        and pu.usuario_id = auth.uid()
    )
  );

create policy "firma_insertar_interno" on firma_solicitud
  for insert with check (
    exists (
      select 1 from usuario u
      where u.id = auth.uid()
        and u.rol in ('super_admin','director_proyecto','consultor')
    )
  );

create policy "firma_actualizar_proyecto" on firma_solicitud
  for update using (
    exists (
      select 1 from proyecto_usuario pu
      where pu.proyecto_id = firma_solicitud.proyecto_id
        and pu.usuario_id = auth.uid()
    )
  );

-- Acceso público al token (sin auth) para la página de firma
create policy "firma_publica_token" on firma_solicitud
  for select using (true);
