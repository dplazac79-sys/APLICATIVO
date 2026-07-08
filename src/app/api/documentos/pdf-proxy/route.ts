import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documento')
    .select('url_storage, nombre_archivo, proyecto_id')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'documento no encontrado' }, { status: 404 })
  if (!doc.url_storage) return NextResponse.json({ error: 'documento sin archivo asociado' }, { status: 404 })

  // Verificar que el usuario tiene acceso al proyecto del documento
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

  const { data: signedData, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(doc.url_storage, 300)

  if (error || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'no se pudo generar URL firmada' }, { status: 500 })
  }

  const pdfRes = await fetch(signedData.signedUrl)
  if (!pdfRes.ok) return NextResponse.json({ error: 'error al obtener PDF' }, { status: 502 })

  const buffer = await pdfRes.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.nombre_archivo ?? 'documento'}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
