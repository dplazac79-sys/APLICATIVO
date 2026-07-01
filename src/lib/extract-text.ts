/**
 * Extracción de texto de documentos.
 * pdf-parse y mammoth declarados como webpack externals en next.config.mjs
 * → Next.js los carga como módulos nativos de Node, no los bundlea.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseLib = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammothLib = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  const result = await pdfParseLib(buffer)
  return result.text
}

export async function extraerTextoDOCX(buffer: Buffer): Promise<string> {
  const result = await mammothLib.extractRawText({ buffer })
  return result.value
}
