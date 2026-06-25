import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // Obtener el documento para saber el storage path
  const { data: doc } = await admin.from('documento').select('url_storage, storage_path').eq('id', params.id).single()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // Eliminar del storage
  const storagePath = doc.url_storage || doc.storage_path
  if (storagePath) {
    await admin.storage.from('documentos').remove([storagePath])
  }

  // Eliminar de la BD (cascade limpia embeddings)
  const { error } = await admin.from('documento').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
