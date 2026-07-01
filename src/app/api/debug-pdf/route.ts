import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/debug-pdf?doc_id=<uuid>
// Descarga un doc de Supabase Storage y prueba extraer texto — devuelve resultado o error exacto
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('doc_id')
  if (!docId) return NextResponse.json({ error: 'doc_id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: doc } = await admin.from('documento').select('id,nombre_archivo,url_storage').eq('id', docId).single()
  if (!doc) return NextResponse.json({ error: 'Doc no encontrado' }, { status: 404 })

  const steps: string[] = []
  try {
    steps.push('1. Descargando archivo...')
    const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage)
    if (!fileData) return NextResponse.json({ steps, error: 'Storage download falló' })
    steps.push('2. Archivo descargado OK, convirtiendo a Buffer...')

    const buffer = Buffer.from(await fileData.arrayBuffer())
    steps.push(`3. Buffer OK, size=${buffer.length} bytes`)

    steps.push('4. Cargando pdf-parse...')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>
    steps.push(`5. pdf-parse cargado, tipo=${typeof pdfParse}`)

    steps.push('6. Llamando pdfParse(buffer)...')
    const result = await pdfParse(buffer)
    steps.push(`7. Éxito: ${result.numpages} páginas, ${result.text.length} chars`)

    return NextResponse.json({
      ok: true,
      nombre: doc.nombre_archivo,
      numpages: result.numpages,
      chars: result.text.length,
      snippet: result.text.slice(0, 200),
      steps,
    })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({
      ok: false,
      nombre: doc.nombre_archivo,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
      steps,
    })
  }
}
