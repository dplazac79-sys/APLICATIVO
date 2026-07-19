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

// pdf-parse/mammoth no tienen límite propio de tiempo ni de recursos — un
// PDF/DOCX patológico (muchísimos objetos anidados, "zip bomb" en el
// contenedor DOCX, etc.) puede colgar el parseo indefinidamente incluso
// dentro del límite de tamaño del bucket (25MB, ver migración 046). Sin
// timeout, un solo archivo así puede agotar el tiempo/memoria del worker
// serverless en cada intento de procesamiento — hallazgo de auditoría.
const TIMEOUT_EXTRACCION_MS = 30_000

function conTimeout<T>(promise: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout extrayendo texto (${etiqueta}) — el archivo tardó más de ${ms / 1000}s en procesarse`)), ms)
    ),
  ])
}

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  const result = await conTimeout(pdfParse(buffer), TIMEOUT_EXTRACCION_MS, 'PDF')
  return result.text
}

export async function extraerTextoDOCX(buffer: Buffer): Promise<string> {
  const result = await conTimeout(mammothLib.extractRawText({ buffer }), TIMEOUT_EXTRACCION_MS, 'DOCX')
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
