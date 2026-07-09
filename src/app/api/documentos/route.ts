import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { proyecto_id, nombre_archivo, tipo, url_storage, documento_padre_id } = await req.json()
    if (!proyecto_id || !nombre_archivo || !url_storage) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Verificar que el usuario pertenece al proyecto antes de cualquier operación
    const admin = createAdminClient()
    const { data: usuarioInfo } = await admin
      .from('usuario')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (usuarioInfo?.rol !== 'super_admin') {
      const { data: membership } = await admin
        .from('usuario_proyecto')
        .select('proyecto_id')
        .eq('usuario_id', user.id)
        .eq('proyecto_id', proyecto_id)
        .single()
      if (!membership) {
        return NextResponse.json({ error: 'Sin acceso al proyecto' }, { status: 403 })
      }
    }

    // Calcular versión si es una actualización de documento existente
    let version_numero = 1
    if (documento_padre_id) {
      const { data: versiones } = await supabase
        .from('documento')
        .select('clasificacion')
        .or(`id.eq.${documento_padre_id},clasificacion->>documento_padre_id.eq.${documento_padre_id}`)
      version_numero = (versiones?.length ?? 0) + 1
    }

    const clasificacionBase = documento_padre_id
      ? { version_numero, documento_padre_id, es_version: true }
      : {}

    const { data: documento, error } = await supabase.from('documento').insert({
      proyecto_id,
      nombre_archivo,
      tipo: tipo ?? 'otro',
      url_storage,
      estado_procesamiento: 'pendiente',
      subido_por: user.id,
      clasificacion: clasificacionBase,
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
