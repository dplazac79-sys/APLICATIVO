-- Migración 058: último hallazgo 🟢 Bajo accionable de la auditoría
-- analítica de BD — kg_industria_snapshot.updated_at nunca tuvo el trigger
-- set_updated_at() que sí tiene el resto de las tablas con esa columna. Hoy
-- no se nota porque el único escritor (src/lib/automation/job-cierre.ts) lo
-- setea a mano en cada upsert, pero queda inconsistente con el resto del
-- schema y se rompería en silencio si algún código futuro escribe sin
-- recordar hacerlo.
drop trigger if exists kg_industria_snapshot_updated_at on kg_industria_snapshot;
create trigger kg_industria_snapshot_updated_at
  before update on kg_industria_snapshot
  for each row execute function set_updated_at();
