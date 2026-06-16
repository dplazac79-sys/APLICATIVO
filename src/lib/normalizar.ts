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
