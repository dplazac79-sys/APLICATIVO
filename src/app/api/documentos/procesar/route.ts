import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { documento_id } = body
  if (!documento_id) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: doc, error } = await admin.from('documento').select('id, proyecto_id').eq('id', documento_id).single()
  if (error || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (!(await assertProyectoAccess(user.id, doc.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este documento' }, { status: 403 })
  }

  // Marcar como encolado y disparar job async
  await admin.from('documento').update({ estado_procesamiento: 'procesando' }).eq('id', documento_id)

  await inngest.send({
    name: 'documento/procesar',
    data: { documento_id, usuario_id: user.id },
  })

  return NextResponse.json({ ok: true, status: 'encolado', documento_id })
}
