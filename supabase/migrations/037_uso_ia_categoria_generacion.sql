-- Migración 037: agrega la categoría 'generacion' a uso_ia_mes_actual.
-- Auditoría de la integración de IA: 7 endpoints (proyectar, recomendacion-
-- implementacion, importar-artefactos, discovery/resumir-proceso,
-- artefactos/mejorar, horizonte/simular, automation/recomendar) llamaban al
-- proveedor de IA sin pasar nunca por verificarLimiteIA/registrarUsoIA — un
-- bypass completo del control de costos para toda esa superficie. Se
-- corrigió en código (src/lib/ai/rate-limit.ts + cada route) agregando la
-- categoría 'generacion'; esta migración solo actualiza la vista para que
-- el nuevo conteo se refleje en el dashboard de uso.

create or replace view uso_ia_mes_actual as
select
  proyecto_id,
  count(*) filter (where tipo = 'clasificar')  as clasificaciones,
  count(*) filter (where tipo = 'resumir')     as resumenes,
  count(*) filter (where tipo = 'discovery')   as discoveries,
  count(*) filter (where tipo = 'embedding')   as embeddings,
  count(*) filter (where tipo = 'generacion')  as generaciones,
  sum(tokens_input + tokens_output)            as tokens_totales,
  sum(costo_usd)                               as costo_total_usd
from uso_ia
where created_at >= date_trunc('month', now())
group by proyecto_id;
