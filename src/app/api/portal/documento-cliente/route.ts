import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuario } = await supabase.from('usuario').select('rol').eq('id', user.id).single()
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

  const formData = await req.formData()
  const archivo = formData.get('archivo') as File | null
  const proyecto_id = formData.get('proyecto_id') as string | null

  if (!archivo || !proyecto_id) {
    return NextResponse.json({ error: 'Se requiere archivo y proyecto_id' }, { status: 400 })
  }

  const ext = archivo.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'docx', 'doc'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF o DOCX' }, { status: 400 })
  }

  // El content-type declarado por el navegador es controlado por el
  // atacante — validar contra los magic bytes reales del archivo evita que
  // alguien suba un .html/.svg con script embebido disfrazado de .pdf y
  // que Storage lo sirva luego con un content-type que el navegador ejecute.
  const MAGIC_BYTES: Record<string, (buf: Uint8Array) => boolean> = {
    pdf: buf => buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46, // %PDF
    docx: buf => buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04, // ZIP (docx es un zip)
    doc: buf => buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0, // OLE2 (doc legacy)
  }
  const cabecera = new Uint8Array(await archivo.slice(0, 8).arrayBuffer())
  const tipoValido = ext === 'docx' ? MAGIC_BYTES.docx(cabecera) : ext === 'doc' ? MAGIC_BYTES.doc(cabecera) : MAGIC_BYTES.pdf(cabecera)
  if (!tipoValido) {
    return NextResponse.json({ error: 'El contenido del archivo no corresponde a su extensión' }, { status: 400 })
  }

  if (archivo.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo no puede superar 20 MB' }, { status: 400 })
  }

  // Verificar que el usuario tiene acceso al proyecto
  const { data: acceso } = await supabase
    .from('usuario_proyecto')
    .select('proyecto_id')
    .eq('usuario_id', user.id)
    .eq('proyecto_id', proyecto_id)
    .single()

  if (!acceso) return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 })

  const CONTENT_TYPE_POR_EXT: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  }

  const admin = createAdminClient()
  // Sanitizar el nombre — sin esto, un nombre como "../../otro-proyecto/x.pdf"
  // podría escribir fuera del prefijo proyecto_id/usuario_id dentro del bucket.
  const nombreSano = archivo.name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${proyecto_id}/${user.id}/${Date.now()}_${nombreSano}`
  const bytes = await archivo.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('documentos-cliente')
    .upload(storagePath, bytes, { contentType: CONTENT_TYPE_POR_EXT[ext ?? ''], upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Error al subir archivo: ' + uploadError.message }, { status: 500 })
  }

  const { data: docRow, error: insertError } = await admin
    .from('documento_cliente')
    .insert({
      proyecto_id,
      usuario_id: user.id,
      nombre_archivo: archivo.name,
      url_storage: storagePath,
      estado: 'subido',
    })
    .select()
    .single()

  if (insertError || !docRow) {
    return NextResponse.json({ error: 'Error al registrar documento' }, { status: 500 })
  }

  await inngest.send({
    name: 'portal/enriquecer-documento',
    data: {
      documento_cliente_id: docRow.id,
      proyecto_id,
      usuario_id: user.id,
    },
  })

  return NextResponse.json({ ok: true, documento_id: docRow.id })
}
