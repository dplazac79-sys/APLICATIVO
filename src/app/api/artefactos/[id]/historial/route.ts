import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: obtener historial de versiones de un artefacto
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('artefacto_historial')
      .select('id, version, estado_validacion, motivo_cambio, modificado_por, created_at')
      .eq('artefacto_id', params.id)
      .order('version', { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ historial: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET con ?ver=<version_id>: obtener contenido de una versión específica
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const admin = createAdminClient()
    const { historial_id } = await req.json() as { historial_id: string }

    // Obtener contenido de esa versión
    const { data: histEntry } = await admin
      .from('artefacto_historial')
      .select('contenido, version')
      .eq('id', historial_id)
      .eq('artefacto_id', params.id)
      .single()

    if (!histEntry) return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })

    // Restaurar: guardar versión actual en historial primero, luego actualizar
    const { data: actual } = await admin
      .from('artefacto')
      .select('*')
      .eq('id', params.id)
      .single()

    if (!actual) return NextResponse.json({ error: 'Artefacto no encontrado' }, { status: 404 })

    await admin.from('artefacto_historial').insert({
      artefacto_id: params.id,
      proceso_id: actual.proceso_id,
      tipo: actual.tipo,
      contenido: actual.contenido,
      version: actual.version,
      estado_validacion: actual.estado_validacion,
      modificado_por: user.id,
      motivo_cambio: `Backup antes de restaurar v${histEntry.version}`,
    })

    const nuevaVersion = actual.version + 1
    await admin.from('artefacto').update({
      contenido: histEntry.contenido,
      version: nuevaVersion,
      estado_validacion: 'pendiente',
      generado_por_ia: false,
    }).eq('id', params.id)

    return NextResponse.json({ ok: true, version: nuevaVersion })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
