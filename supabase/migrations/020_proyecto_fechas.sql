-- 020: Agregar fechas y descripción a la tabla proyecto
alter table proyecto
  add column if not exists descripcion text,
  add column if not exists fecha_inicio date,
  add column if not exists fecha_estimada_cierre date;
