/**
 * Chunking semántico de documentos
 * Estrategia: dividir por secciones detectadas primero, luego por tamaño
 * Target: ~500 tokens por chunk, 100 tokens de overlap
 */

export interface Chunk {
  indice: number
  titulo: string | null
  texto: string
  tokens_est: number
}

const TOKENS_POR_CHAR = 0.25 // estimación conservadora: 4 chars ≈ 1 token
const TARGET_TOKENS = 500
const OVERLAP_TOKENS = 100
const TARGET_CHARS = TARGET_TOKENS / TOKENS_POR_CHAR   // ~2000 chars
const OVERLAP_CHARS = OVERLAP_TOKENS / TOKENS_POR_CHAR // ~400 chars

// Patrones que indican inicio de sección
const SECTION_PATTERNS = [
  /^#{1,4}\s+.+/m,           // Markdown headers
  /^\d+\.\s+[A-ZÁÉÍÓÚ].+/m, // "1. Título"
  /^[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ\s]{5,}$/m, // MAYÚSCULAS (títulos de sección)
  /^(Artículo|ARTÍCULO|Cláusula|CLÁUSULA|Sección|SECCIÓN)\s+\d+/m,
  /^(Capítulo|CAPÍTULO|Parte|PARTE)\s+[IVXivx\d]+/m,
]

function estimarTokens(texto: string): number {
  return Math.round(texto.length * TOKENS_POR_CHAR)
}

function detectarTituloSeccion(linea: string): string | null {
  const limpia = linea.trim()
  if (!limpia) return null
  for (const pattern of SECTION_PATTERNS) {
    if (pattern.test(limpia)) return limpia.slice(0, 100)
  }
  return null
}

/**
 * Divide texto en chunks semánticos con overlap.
 * 1. Intenta dividir por secciones detectadas
 * 2. Si una sección es muy larga, la subdivide por párrafos
 * 3. Si aún es larga, por caracteres con overlap
 */
export function chunkearTexto(texto: string): Chunk[] {
  if (!texto?.trim()) return []

  const lineas = texto.split('\n')
  const secciones: { titulo: string | null; contenido: string[] }[] = []
  let seccionActual: { titulo: string | null; contenido: string[] } = { titulo: null, contenido: [] }

  for (const linea of lineas) {
    const titulo = detectarTituloSeccion(linea)
    if (titulo && seccionActual.contenido.join('').length > 200) {
      // Nueva sección detectada — guardar la actual
      secciones.push(seccionActual)
      seccionActual = { titulo, contenido: [] }
    } else {
      seccionActual.contenido.push(linea)
    }
  }
  secciones.push(seccionActual)

  // Si no detectó secciones, tratar todo como una sola
  if (secciones.length === 1 && !secciones[0].titulo) {
    return dividirPorTamano(texto, null)
  }

  const chunks: Chunk[] = []
  let indice = 0

  for (const seccion of secciones) {
    const textoSeccion = seccion.contenido.join('\n').trim()
    if (!textoSeccion) continue

    if (estimarTokens(textoSeccion) <= TARGET_TOKENS * 1.5) {
      // Sección cabe en un chunk
      chunks.push({
        indice: indice++,
        titulo: seccion.titulo,
        texto: textoSeccion,
        tokens_est: estimarTokens(textoSeccion),
      })
    } else {
      // Sección muy larga — subdividir
      const subchunks = dividirPorTamano(textoSeccion, seccion.titulo)
      for (const sc of subchunks) {
        chunks.push({ ...sc, indice: indice++ })
      }
    }
  }

  return chunks.filter(c => c.texto.length > 50) // descartar chunks vacíos o triviales
}

function dividirPorTamano(texto: string, titulo: string | null): Chunk[] {
  const chunks: Chunk[] = []

  if (texto.length <= TARGET_CHARS) {
    return [{ indice: 0, titulo, texto, tokens_est: estimarTokens(texto) }]
  }

  // Dividir por párrafos primero
  const parrafos = texto.split(/\n\s*\n/).filter(p => p.trim())
  let buffer = ''
  let idx = 0

  for (const parrafo of parrafos) {
    const candidato = buffer ? buffer + '\n\n' + parrafo : parrafo

    if (estimarTokens(candidato) > TARGET_TOKENS && buffer) {
      chunks.push({ indice: idx++, titulo: idx === 1 ? titulo : null, texto: buffer.trim(), tokens_est: estimarTokens(buffer) })
      // Overlap: incluir últimos OVERLAP_CHARS del buffer anterior
      const overlap = buffer.slice(-OVERLAP_CHARS)
      buffer = overlap + '\n\n' + parrafo
    } else {
      buffer = candidato
    }
  }

  if (buffer.trim()) {
    chunks.push({ indice: idx++, titulo: idx === 1 ? titulo : null, texto: buffer.trim(), tokens_est: estimarTokens(buffer) })
  }

  return chunks
}
