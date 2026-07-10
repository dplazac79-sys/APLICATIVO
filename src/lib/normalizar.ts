export function titleCase(str: string): string {
  if (!str) return str
  const minusculas = new Set([
    'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'o', 'u',
    'a', 'en', 'con', 'por', 'para', 'sin', 'al', 's.a.', 'ltda.',
    'spa', 'eirl', 'srl',
  ])
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, i) => {
      // Siglas como S.A., LTDA., SPA siempre en mayúsculas
      if (/^[a-z]+\.([a-z]+\.)+$/i.test(word)) return word.toUpperCase()
      // Primera palabra siempre con mayúscula
      if (i === 0) return word.charAt(0).toUpperCase() + word.slice(1)
      // Palabras de enlace en minúscula
      if (minusculas.has(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function oracionCase(str: string): string {
  if (!str) return str
  const s = str.trim().toLowerCase().replace(/\s+/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Formatea un RUT chileno mientras se escribe: 761234567 → 76.123.456-7
export function formatRut(value: string): string {
  const limpio = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (!limpio) return ''
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!cuerpo) return dv
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpoFormateado}-${dv}`
}

// Formatea un número mientras se escribe con separador de miles chileno: 1000000 → 1.000.000
export function formatMiles(value: string): string {
  const limpio = value.replace(/[^0-9]/g, '')
  if (!limpio) return ''
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// Extrae el valor numérico crudo de un string formateado con puntos
export function parseMiles(value: string): number | null {
  const limpio = value.replace(/\./g, '')
  return limpio ? parseInt(limpio, 10) : null
}
