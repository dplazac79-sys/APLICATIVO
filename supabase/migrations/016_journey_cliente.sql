-- 016: Journey del cliente — tablas para el nuevo flujo de carga, enriquecimiento y aprobación
-- Reemplaza el mecanismo de aprobación por localStorage.

-- ============================================================
-- TABLA: documento_cliente
-- Documentos subidos por el cliente (distintos a los del consultor)
-- ============================================================
create table if not exists documento_cliente (
  id                  uuid primary key default uuid_generate_v4(),
  proyecto_id         uuid not null references proyecto(id) on delete cascade,
  usuario_id          uuid not null references usuario(id) on delete set null,
  nombre_archivo      text not null,
  url_storage         text not null,
  estado              text not null default 'subido'
                        check (estado in ('subido','procesando','enriquecido','error')),
  error_mensaje       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_doc_cliente_proyecto on documento_cliente(proyecto_id);
create index idx_doc_cliente_usuario  on documento_cliente(usuario_id);

-- ============================================================
-- TABLA: proceso_enriquecido
-- Resultado del análisis IA del documento del cliente
-- ============================================================
create table if not exists proceso_enriquecido (
  id                          uuid primary key default uuid_generate_v4(),
  documento_cliente_id        uuid not null references documento_cliente(id) on delete cascade,
  proyecto_id                 uuid not null references proyecto(id) on delete cascade,

  -- Identidad del proceso
  nombre_proceso              text not null,
  macroproceso                text,
  numero_en_macroproceso      integer,
  total_en_macroproceso       integer,

  -- Contexto de negocio generado por IA
  descripcion                 text,
  sin_proceso_riesgos         text,     -- ¿Qué pasa si este proceso NO existe?
  con_proceso_beneficios      text,     -- ¿Qué gana la organización si existe?
  valor_negocio               text,     -- KPIs, ahorros estimados, ROI narrativo
  actores                     text[],
  sistemas                    text[],

  -- Análisis de impacto estructurado
  kpis                        jsonb default '[]'::jsonb,
  riesgos                     jsonb default '[]'::jsonb,

  -- Contenido editable por el cliente (empieza igual que descripcion, puede ser modificado)
  contenido_editado           jsonb default '{}'::jsonb,

  -- Aprobación digital (reemplaza localStorage)
  estado_aprobacion           text not null default 'pendiente'
                                check (estado_aprobacion in ('pendiente','aprobado','rechazado')),
  aprobado_por                uuid references usuario(id) on delete set null,
  aprobado_at                 timestamptz,
  comentario_aprobacion       text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index idx_proc_enr_proyecto on proceso_enriquecido(proyecto_id);
create index idx_proc_enr_doc      on proceso_enriquecido(documento_cliente_id);

-- ============================================================
-- RLS: documento_cliente
-- ============================================================
alter table documento_cliente enable row level security;

-- El cliente ve/gestiona los documentos de sus proyectos
create policy "cliente_ve_sus_documentos" on documento_cliente
  for select using (
    exists (
      select 1 from usuario_proyecto up
      where up.usuario_id = auth.uid()
        and up.proyecto_id = documento_cliente.proyecto_id
    )
  );

create policy "cliente_inserta_documento" on documento_cliente
  for insert with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from usuario_proyecto up
      where up.usuario_id = auth.uid()
        and up.proyecto_id = documento_cliente.proyecto_id
    )
  );

create policy "service_gestiona_documento_cliente" on documento_cliente
  for all using (auth.role() = 'service_role');

-- ============================================================
-- RLS: proceso_enriquecido
-- ============================================================
alter table proceso_enriquecido enable row level security;

create policy "cliente_ve_procesos_enriquecidos" on proceso_enriquecido
  for select using (
    exists (
      select 1 from usuario_proyecto up
      where up.usuario_id = auth.uid()
        and up.proyecto_id = proceso_enriquecido.proyecto_id
    )
  );

create policy "cliente_edita_proceso_enriquecido" on proceso_enriquecido
  for update using (
    exists (
      select 1 from usuario_proyecto up
        join usuario u on u.id = auth.uid()
      where up.usuario_id = auth.uid()
        and up.proyecto_id = proceso_enriquecido.proyecto_id
        and u.rol in ('sponsor_cliente','usuario_cliente','super_admin','director_proyecto','consultor')
    )
  );

create policy "service_gestiona_proceso_enriquecido" on proceso_enriquecido
  for all using (auth.role() = 'service_role');

-- ============================================================
-- Triggers: updated_at automático
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_doc_cliente_updated
  before update on documento_cliente
  for each row execute function set_updated_at();

create trigger trg_proc_enr_updated
  before update on proceso_enriquecido
  for each row execute function set_updated_at();
