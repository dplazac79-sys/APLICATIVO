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

    // El path pasa la validación de prefijo aunque el archivo nunca se haya
    // subido realmente — sin esto, se pueden crear filas 'documento' con
    // url_storage inventado, cada una disparando un job de Inngest que va a
    // fallar en el paso de descarga/extracción (gasto de cola sin límite).
    const carpeta = url_storage.slice(0, url_storage.lastIndexOf('/'))
    const nombreArchivoStorage = url_storage.slice(url_storage.lastIndexOf('/') + 1)
    const { data: listado } = await admin.storage.from('documentos').list(carpeta, { search: nombreArchivoStorage })
    if (!listado?.some(f => f.name === nombreArchivoStorage)) {
      return NextResponse.json({ error: 'El archivo no existe en el storage — vuelve a subirlo.' }, { status: 400 })
    }
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

    // Sin este límite, cualquier usuario con acceso a un proyecto puede
    // insertar filas 'documento' en loop (con url_storage inventado, ya que
    // no se verifica que el objeto exista realmente en Storage) — cada una
    // dispara un job de Inngest, inflando la BD y saturando la cola de
    // procesamiento sin límite. 500 es generoso para uso legítimo real.
    const MAX_DOCUMENTOS_POR_PROYECTO = 500
    const { count: totalDocs } = await admin
      .from('documento')
      .select('id', { count: 'exact', head: true })
      .eq('proyecto_id', proyecto_id)
    if ((totalDocs ?? 0) >= MAX_DOCUMENTOS_POR_PROYECTO) {
      return NextResponse.json({ error: `Límite de ${MAX_DOCUMENTOS_POR_PROYECTO} documentos por proyecto alcanzado.` }, { status: 429 })
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
