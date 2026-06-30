import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const documentoId = req.nextUrl.searchParams.get('id')
  if (!documentoId) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que el usuario tiene acceso al documento (vía proyecto)
  const { data: doc } = await admin
    .from('documento')
    .select('url_storage, proyecto_id')
    .eq('id', documentoId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Verificar que el usuario pertenece al proyecto
  const { data: usuarioDB } = await admin
    .from('usuario')
    .select('rol, usuario_proyecto(proyecto_id)')
    .eq('id', user.id)
    .single()

  const esSuperAdmin = usuarioDB?.rol === 'super_admin'
  const proyectosUsuario = (usuarioDB?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  if (!esSuperAdmin && !proyectosUsuario.includes(doc.proyecto_id)) {
    return NextResponse.json({ error: 'Sin acceso a este documento' }, { status: 403 })
  }

  // Generar URL firmada válida por 1 hora
  const { data: signed, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(doc.url_storage, 3600)

  if (error || !signed) {
    return NextResponse.json({ error: 'No se pudo generar la URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
