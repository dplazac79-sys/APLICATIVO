import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documento')
    .select('url_storage, nombre')
    .eq('id', id)
    .single()

  if (!doc?.url_storage) return NextResponse.json({ error: 'documento no encontrado' }, { status: 404 })

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
      'Content-Disposition': `inline; filename="${doc.nombre ?? 'documento'}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
