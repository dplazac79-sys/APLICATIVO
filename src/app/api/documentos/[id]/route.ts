import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Obtener el documento para saber el storage path
  const { data: doc, error: errDoc } = await admin.from('documento').select('url_storage').eq('id', params.id).single()
  if (errDoc || !doc) return NextResponse.json({ error: errDoc?.message ?? 'Documento no encontrado' }, { status: 404 })

  // Eliminar del storage
  if (doc.url_storage) {
    const { error: errStorage } = await admin.storage.from('documentos').remove([doc.url_storage])

  }

  // Eliminar de la BD
  const { error } = await admin.from('documento').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAudit({
    accion: 'DELETE',
    entidad: 'documento',
    entidad_id: params.id,
    detalle: { url_storage: doc.url_storage },
  })

  return NextResponse.json({ ok: true })
}
