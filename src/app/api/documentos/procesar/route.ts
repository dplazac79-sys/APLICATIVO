import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clasificarDocumento, resumirDocumento } from '@/lib/ai/claude'
import { generarEmbedding } from '@/lib/ai/embeddings'

export async function POST(req: NextRequest) {
  try {
    const { documento_id } = await req.json()
    if (!documento_id) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

    const admin = createAdminClient()

    const { data: doc, error } = await admin
      .from('documento')
      .select('*')
      .eq('id', documento_id)
      .single()

    if (error || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // Marcar como procesando
    await admin.from('documento').update({ estado_procesamiento: 'procesando' }).eq('id', documento_id)
    await admin.from('jobs').insert({
      tipo: 'clasificar_documento',
      estado: 'procesando',
      documento_id,
      proyecto_id: doc.proyecto_id,
      payload: { documento_id, nombre: doc.nombre_archivo },
    })

    // Descargar archivo del storage
    const { data: fileData } = await admin.storage.from('documentos').download(doc.url_storage)
    if (!fileData) throw new Error('No se pudo descargar el archivo')

    // Extraer texto según tipo de archivo
    let texto = ''
    const nombre = doc.nombre_archivo.toLowerCase()
    if (nombre.endsWith('.docx') || nombre.endsWith('.doc')) {
      const mammoth = (await import('mammoth')).default
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const result = await mammoth.extractRawText({ buffer })
      texto = result.value
    } else if (nombre.endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse')
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      texto = result.text
      await parser.destroy()
    } else {
      texto = await fileData.text()
    }

    if (!texto.trim()) throw new Error('No se pudo extraer texto del documento')

    // Clasificar, resumir y generar embedding en paralelo
    const [clasificacion, resumen, embedding] = await Promise.all([
      clasificarDocumento(texto),
      resumirDocumento(texto),
      generarEmbedding(texto, 'document').catch(err => {
        console.error('[procesar] No se pudo generar embedding:', err)
        return null
      }),
    ])

    // Guardar resultados completos
    await admin.from('documento').update({
      clasificacion,
      resumen_ejecutivo: resumen.resumen_ejecutivo ?? null,
      analisis_ia: resumen,
      embedding_ref: embedding,
      estado_procesamiento: 'listo',
    }).eq('id', documento_id)

    await admin.from('jobs').update({
      estado: 'listo',
      resultado: { clasificacion, resumen },
    }).eq('documento_id', documento_id).eq('tipo', 'clasificar_documento')

    return NextResponse.json({ ok: true, clasificacion, resumen })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
