import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { cliente_id, nombre, alcance } = await req.json()
    if (!cliente_id || !nombre) {
      return NextResponse.json({ error: 'cliente_id y nombre son requeridos' }, { status: 400 })
    }

    const { data: proyecto, error } = await supabase.from('proyecto').insert({
      cliente_id,
      nombre,
      alcance: alcance ?? null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'proyecto',
      entidad_id: proyecto.id,
      detalle: { nombre, cliente_id },
    })

    return NextResponse.json({ ok: true, proyecto })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
