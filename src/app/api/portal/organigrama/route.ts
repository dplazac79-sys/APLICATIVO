import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file       = formData.get('file') as File | null
  const proyectoId = formData.get('proyecto_id') as string | null

  if (!file || !proyectoId) return NextResponse.json({ error: 'Falta archivo o proyecto_id' }, { status: 400 })

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) return NextResponse.json({ error: 'Archivo demasiado grande (máx 10 MB)' }, { status: 400 })

  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar acceso al proyecto
  const { data: acceso } = await admin.from('usuario_proyecto')
    .select('id').eq('usuario_id', user.id).eq('proyecto_id', proyectoId).maybeSingle()
  if (!acceso) return NextResponse.json({ error: 'Sin acceso al proyecto' }, { status: 403 })

  const ext  = file.name.split('.').pop()
  const path = `${proyectoId}/organigrama-${Date.now()}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage.from('glosario-roles').upload(path, buf, {
    contentType: file.type, upsert: true,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Extraer texto si es PDF
  let textoExtraido: string | null = null
  if (file.type === 'application/pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      textoExtraido = (await pdfParse(buf)).text
    } catch { /* imagen u otro formato */ }
  }

  const { data: org, error: dbError } = await admin.from('organigrama_cliente').insert({
    proyecto_id: proyectoId,
    storage_path: path,
    nombre_archivo: file.name,
    texto_extraido: textoExtraido,
    estado: textoExtraido ? 'listo' : 'pendiente',
    subido_por: user.id,
  }).select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ ok: true, organigrama: org })
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const proyectoId = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyectoId) return NextResponse.json({ error: 'Falta proyecto_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data } = await admin.from('organigrama_cliente')
    .select('id, nombre_archivo, estado, created_at')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ organigramas: data ?? [] })
}
