/**
 * Extracción de texto de documentos — cargado con createRequire para evitar
 * problemas de interop CJS/ESM en el standalone build de Next.js.
 * pdf-parse y mammoth son módulos CJS que no se bundlean bien con webpack dynamic import.
 */
import { createRequire } from 'module'

// createRequire fuerza la carga CJS nativa, evitando que webpack intente bundlearlos
const _require = createRequire(import.meta.url)

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = _require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text
}

export async function extraerTextoDOCX(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = _require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}
