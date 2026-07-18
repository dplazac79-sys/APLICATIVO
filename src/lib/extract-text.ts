/**
 * Extracción de texto de documentos.
 * pdf-parse@1.1.1 y mammoth declarados como webpack externals en next.config.mjs
 * → Next.js los carga como módulos nativos de Node, no los bundlea.
 *
 * pdf-parse v1 API: pdfParse(buffer) → Promise<{ text: string }>
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer, opts?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammothLib = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer)
  return result.text
}

export async function extraerTextoDOCX(buffer: Buffer): Promise<string> {
  const result = await mammothLib.extractRawText({ buffer })
  return result.value
}

// Extracción determinística (sin IA) del macroproceso declarado en la
// carátula del documento — ej. "MACROPROCESO: CADENA DE SUMINISTRO". Esta es
// la fuente de verdad: el macroproceso lo define la consultora al construir
// el documento, nunca lo decide ni lo infiere la IA de Discovery. Busca solo
// en los primeros ~3000 caracteres (la carátula), para no capturar una
// mención casual de "macroproceso" en el cuerpo del documento.
export function extraerMacroprocesoDeTexto(texto: string): string | null {
  const caratula = texto.slice(0, 3000)
  const match = caratula.match(/macro\s*[-–]?\s*proceso\s*:\s*([^\n\r]{2,120})/i)
  if (!match) return null
  const nombre = match[1].trim().replace(/\s+/g, ' ')
  return nombre.length > 0 ? nombre : null
}
