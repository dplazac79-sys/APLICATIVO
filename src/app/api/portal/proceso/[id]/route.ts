import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — obtener proceso enriquecido completo
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: proceso, error } = await supabase
    .from('proceso_enriquecido')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !proceso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ proceso })
}

// PATCH — guardar ediciones del cliente
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { contenido_editado } = body

  if (!contenido_editado || typeof contenido_editado !== 'object') {
    return NextResponse.json({ error: 'contenido_editado requerido' }, { status: 400 })
  }

  // RLS valida acceso
  const { error } = await supabase
    .from('proceso_enriquecido')
    .update({ contenido_editado })
    .eq('id', params.id)

  if (error) return jsonError(error)
  return NextResponse.json({ ok: true })
}

// POST — aprobar o rechazar proceso
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { accion, comentario } = body as { accion: 'aprobar' | 'rechazar'; comentario?: string }

  if (!['aprobar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'accion debe ser "aprobar" o "rechazar"' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el proceso pertenece a un proyecto del usuario
  const { data: proceso } = await supabase
    .from('proceso_enriquecido')
    .select('id, proyecto_id')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { error } = await admin
    .from('proceso_enriquecido')
    .update({
      estado_aprobacion: accion === 'aprobar' ? 'aprobado' : 'rechazado',
      aprobado_por: user.id,
      aprobado_at: new Date().toISOString(),
      comentario_aprobacion: comentario ?? null,
    })
    .eq('id', params.id)

  if (error) return jsonError(error)

  // Notificar al equipo interno
  await admin.from('notificacion').insert({
    usuario_id: null,
    titulo: `Proceso ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} por cliente`,
    cuerpo: `El proceso "${proceso.id}" fue ${accion === 'aprobar' ? 'aprobado' : 'rechazado'}.${comentario ? ' Comentario: ' + comentario : ''}`,
    leida: false,
  }).select().maybeSingle()

  return NextResponse.json({ ok: true, estado: accion === 'aprobar' ? 'aprobado' : 'rechazado' })
}
