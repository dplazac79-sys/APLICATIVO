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

  const admin = createAdminClient()
  const storagePath = `${proyecto_id}/${user.id}/${Date.now()}_${archivo.name}`
  const bytes = await archivo.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('documentos-cliente')
    .upload(storagePath, bytes, { contentType: archivo.type, upsert: false })

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
