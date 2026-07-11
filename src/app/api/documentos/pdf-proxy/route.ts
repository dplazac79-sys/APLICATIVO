import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'

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

  if (!(await assertProyectoAccess(user.id, doc.proyecto_id))) {
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
  // nombre_archivo es datos del usuario — encodeURIComponent evita que unas
  // comillas o un salto de línea rompan el header Content-Disposition.
  const nombreSeguro = encodeURIComponent(`${doc.nombre_archivo ?? 'documento'}.pdf`)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${nombreSeguro}`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
