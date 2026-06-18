import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clasificarDocumento, resumirDocumento } from '@/lib/ai/claude'
import { generarEmbedding } from '@/lib/ai/embeddings'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  // Auth check — ruta interna pero debe estar autenticada
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let documento_id: string | undefined
  const admin = createAdminClient()

  try {
    const body = await req.json()
    documento_id = body.documento_id
    if (!documento_id) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = ((await import('pdf-parse')) as any).default ?? (await import('pdf-parse'))
      const buffer = Buffer.from(await fileData.arrayBuffer())
      const result = await pdfParse(buffer)
      texto = result.text
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

    await registrarAudit({
      accion: 'UPDATE',
      entidad: 'documento',
      entidad_id: documento_id,
      detalle: { accion_detalle: 'procesado_con_ia', bloque: clasificacion.bloque },
    })

    return NextResponse.json({ ok: true, clasificacion, resumen })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[procesar] Error:', err)

    if (documento_id) {
      await admin.from('documento').update({ estado_procesamiento: 'error' }).eq('id', documento_id)
      await admin.from('jobs').update({
        estado: 'error',
        error_mensaje: msg,
      }).eq('documento_id', documento_id).eq('tipo', 'clasificar_documento')
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
