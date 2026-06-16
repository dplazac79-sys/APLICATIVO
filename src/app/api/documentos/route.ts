import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { proyecto_id, nombre_archivo, tipo, url_storage } = await req.json()
    if (!proyecto_id || !nombre_archivo || !url_storage) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data: documento, error } = await supabase.from('documento').insert({
      proyecto_id,
      nombre_archivo,
      tipo: tipo ?? 'otro',
      url_storage,
      estado_procesamiento: 'pendiente',
      subido_por: user.id,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'documento',
      entidad_id: documento.id,
      detalle: { nombre_archivo, proyecto_id },
    })

    return NextResponse.json({ ok: true, documento })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
