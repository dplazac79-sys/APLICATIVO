// Formato de fecha compacto para listas/badges — antes se reimplementaba de
// forma independiente en varios archivos con distintas opciones (numeric vs
// 2-digit, short vs long), así que la misma clase de fecha se veía distinta
// entre pantallas (ej. Bienvenida vs Centro Documental vs Admin).
export function formatFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Fecha relativa tipo "hace 2 días" — da sensación de proyecto vivo en
// badges de actividad reciente, donde una fecha fija ("18 jul 2026") no
// comunica qué tan al día está el trabajo sin que el lector haga la resta
// mentalmente.
export function formatFechaRelativa(fecha: string | Date | number): string {
  const ahora = Date.now()
  const entonces = new Date(fecha).getTime()
  const diffMs = ahora - entonces
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHoras = Math.floor(diffMs / 3_600_000)
  const diffDias = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'Recién ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras !== 1 ? 's' : ''}`
  if (diffDias === 1) return 'Ayer'
  if (diffDias < 7) return `Hace ${diffDias} días`
  if (diffDias < 30) {
    const semanas = Math.floor(diffDias / 7)
    return `Hace ${semanas} semana${semanas !== 1 ? 's' : ''}`
  }
  if (diffDias < 365) {
    const meses = Math.floor(diffDias / 30)
    return `Hace ${meses} mes${meses !== 1 ? 'es' : ''}`
  }
  const anos = Math.floor(diffDias / 365)
  return `Hace ${anos} año${anos !== 1 ? 's' : ''}`
}
