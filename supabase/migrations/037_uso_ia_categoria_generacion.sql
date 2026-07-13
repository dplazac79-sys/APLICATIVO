-- Migración 037: agrega la categoría 'generacion' a uso_ia_mes_actual.
-- Auditoría de la integración de IA: 7 endpoints (proyectar, recomendacion-
-- implementacion, importar-artefactos, discovery/resumir-proceso,
-- artefactos/mejorar, horizonte/simular, automation/recomendar) llamaban al
-- proveedor de IA sin pasar nunca por verificarLimiteIA/registrarUsoIA — un
-- bypass completo del control de costos para toda esa superficie. Se
-- corrigió en código (src/lib/ai/rate-limit.ts + cada route) agregando la
-- categoría 'generacion'; esta migración solo actualiza la vista para que
-- el nuevo conteo se refleje en el dashboard de uso.

-- DROP + CREATE (no CREATE OR REPLACE): Postgres solo permite que
-- CREATE OR REPLACE VIEW agregue columnas al final sin reordenar las
-- existentes. Poner "generaciones" al final evita el error 42P16, pero
-- como igual quedaría fuera de orden lógico junto a las otras categorías,
-- se recrea la vista completa — no tiene RLS propia ni depende de otras
-- vistas, es seguro dropearla y recrearla en la misma transacción.
drop view if exists uso_ia_mes_actual;

create view uso_ia_mes_actual as
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

-- El DROP VIEW se lleva también el grant original (015_uso_ia_rate_limit.sql:47) — recreado acá.
grant select on uso_ia_mes_actual to authenticated;
