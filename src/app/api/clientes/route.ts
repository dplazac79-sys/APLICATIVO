import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const payload = await req.json()
    if (!payload.razon_social) {
      return NextResponse.json({ error: 'razon_social es requerida' }, { status: 400 })
    }

    const { data: cliente, error } = await supabase.from('cliente').insert(payload).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'cliente',
      entidad_id: cliente.id,
      detalle: { razon_social: cliente.razon_social },
    })

    return NextResponse.json({ ok: true, cliente })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
