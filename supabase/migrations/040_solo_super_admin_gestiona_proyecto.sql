-- Migración 040: la creación/edición de proyectos es exclusiva de super_admin.
-- La app ya restringía esto (/api/admin/onboarding y PATCH
-- /api/proyectos/[id]/brief ahora solo aceptan super_admin), pero a nivel de
-- base de datos "director_gestiona_proyectos" seguía dando a director_proyecto
-- permiso de insert/update/delete directo sobre la tabla proyecto — una puerta
-- trasera si algún cliente futuro llamara a Supabase sin pasar por la API.
--
-- No afecta la visibilidad: "usuario_ve_sus_proyectos" (política de solo
-- lectura, independiente de esta) sigue dándole a director_proyecto/consultor
-- acceso de lectura a los proyectos que tengan asignados.

drop policy if exists "director_gestiona_proyectos" on public.proyecto;
