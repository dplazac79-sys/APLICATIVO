// Formato de fecha compacto para listas/badges — antes se reimplementaba de
// forma independiente en varios archivos con distintas opciones (numeric vs
// 2-digit, short vs long), así que la misma clase de fecha se veía distinta
// entre pantallas (ej. Bienvenida vs Centro Documental vs Admin).
export function formatFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}
