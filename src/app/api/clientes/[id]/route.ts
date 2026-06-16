import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const payload = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('cliente')
    .update(payload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'UPDATE',
    entidad: 'cliente',
    entidad_id: params.id,
    detalle: payload,
  })

  return NextResponse.json({ ok: true, cliente: data })
}
