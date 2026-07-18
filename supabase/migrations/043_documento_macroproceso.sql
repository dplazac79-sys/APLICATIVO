-- El macroproceso de cada documento viene declarado literalmente en su
-- carátula (ej. "MACROPROCESO: CADENA DE SUMINISTRO" en SC06.docx) — nunca
-- es algo que la IA de Discovery deba inferir o clasificar por su cuenta.
-- Se extrae de forma determinística (regex, sin IA) al procesar el
-- documento y se guarda acá como fuente de verdad para agrupar procesos.
ALTER TABLE documento ADD COLUMN IF NOT EXISTS macroproceso TEXT;
