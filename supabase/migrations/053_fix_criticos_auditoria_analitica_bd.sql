-- Migración 053: corrige los 3 hallazgos Críticos de la auditoría analítica
-- profunda de base de datos.

-- 1. uso_ia_mes_actual filtraba costo/uso de IA de TODOS los proyectos de
-- TODOS los clientes a cualquier usuario autenticado. Las vistas de Postgres
-- son SECURITY DEFINER por defecto (corren con los privilegios del dueño de
-- la vista, no del que consulta) — así que aunque uso_ia tiene RLS que
-- escopa correctamente por proyecto_id del usuario, consultar la VISTA
-- directamente por PostgREST (GET /rest/v1/uso_ia_mes_actual, sin filtro)
-- ignoraba esa RLS por completo. La app siempre la consulta ya filtrada por
-- proyecto_id vía el cliente admin (src/lib/ai/rate-limit.ts), pero el
-- grant a `authenticated` dejaba la vista abierta a cualquiera vía REST
-- directo. security_invoker hace que la vista respete la RLS del usuario
-- que consulta, igual que si hiciera la consulta directo contra uso_ia.
alter view uso_ia_mes_actual set (security_invoker = true);

-- 2. documento_cliente.usuario_id era NOT NULL pero su FK es ON DELETE SET
-- NULL — contradicción que rompe la transacción de borrado completa la
-- primera vez que se intenta eliminar un usuario que subió algún documento
-- de cliente ("null value in column usuario_id violates not-null
-- constraint"). Se relaja a nullable para que el ON DELETE SET NULL
-- original (conservar el documento, olvidar quién lo subió) funcione como
-- estaba pensado.
alter table documento_cliente alter column usuario_id drop not null;
