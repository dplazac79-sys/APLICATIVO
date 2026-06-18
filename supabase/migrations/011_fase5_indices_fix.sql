-- Migración 011: Índices faltantes detectados en auditoría de Fase 5

-- Índice en entregable.simulacion_id (Fase 6 busca entregables por simulación)
create index if not exists entregable_simulacion_idx
  on public.entregable (simulacion_id)
  where simulacion_id is not null;

-- Check constraint en simulacion.escenario (redundante con el CHECK de la tabla, pero explícito)
-- Ya existe en 010: check (escenario in ('conservador','base','optimista','custom'))

-- Índice en entregable para búsquedas por proyecto + estado (portal cliente)
create index if not exists entregable_proyecto_estado_idx
  on public.entregable (proyecto_id, estado)
  where estado in ('aprobado', 'exportado');
