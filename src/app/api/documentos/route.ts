import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import { inngest } from '@/lib/inngest/client'
import { errorResponse } from '@/lib/api/error-response'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { proyecto_id, nombre_archivo, tipo, url_storage, documento_padre_id } = await req.json()
    if (!proyecto_id || !nombre_archivo || !url_storage) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // url_storage es provisto por el cliente (viene del path que el propio
    // navegador usó para subir el archivo a Storage) — sin esta validación,
    // un usuario con acceso a proyecto_id "sabe/adivina" un path de otro
    // proyecto y registra un documento cuyo storage real pertenece a otro
    // tenant, exponiéndolo luego vía signed-url/pdf-proxy (que solo valida
    // el proyecto_id de la fila, no que el path realmente le pertenezca).
    if (!url_storage.startsWith(`${proyecto_id}/`)) {
      return NextResponse.json({ error: 'url_storage no corresponde al proyecto indicado' }, { status: 400 })
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

    if (error) return jsonError(error)

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'documento',
      entidad_id: documento.id,
      detalle: { nombre_archivo, proyecto_id },
    })

    // Disparar el procesamiento con IA — antes esto nunca se llamaba y el
    // documento quedaba en 'pendiente' para siempre, con el toast prometiendo
    // "procesando con IA" sin que ningún job arrancara jamás.
    try {
      await inngest.send({
        name: 'documento/procesar',
        data: { documento_id: documento.id, usuario_id: user.id },
      })
    } catch (sendErr) {
      // No bloquear la subida si falla el disparo del job — pero sí dejarlo visible
      console.error('Error al encolar procesamiento de documento', documento.id, sendErr)
    }

    return NextResponse.json({ ok: true, documento })
  } catch (err) {
    return errorResponse(err, 500)
  }
}
