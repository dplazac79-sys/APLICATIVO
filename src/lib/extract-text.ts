/**
 * Extracción de texto de documentos.
 * pdf-parse y mammoth declarados como webpack externals en next.config.mjs
 * → Next.js los carga como módulos nativos de Node, no los bundlea.
 *
 * pdf-parse v2 API: new PDFParse({ data: buffer }).getText()
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> } }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammothLib = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> }

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const result = await parser.getText()
  return result.text
}

export async function extraerTextoDOCX(buffer: Buffer): Promise<string> {
  const result = await mammothLib.extractRawText({ buffer })
  return result.value
}
