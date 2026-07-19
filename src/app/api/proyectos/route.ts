import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import { errorResponse } from '@/lib/api/error-response'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('proyecto')
    .select('id, nombre, cliente_id')
    .order('nombre')

  if (error) return jsonError(error)
  return NextResponse.json({ proyectos: data ?? [] })
}

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

    if (error) return jsonError(error)

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'proyecto',
      entidad_id: proyecto.id,
      detalle: { nombre, cliente_id },
    })

    return NextResponse.json({ ok: true, proyecto })
  } catch (err) {
    return errorResponse(err, 500)
  }
}
