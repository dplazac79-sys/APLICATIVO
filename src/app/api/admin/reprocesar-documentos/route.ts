import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

// Endpoint de uso único para relanzar el análisis IA de documentos por proyecto
// Solo accesible con la service role key como Bearer token
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== serviceKey) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json() as { proyecto_id?: string; documento_ids?: string[] }
  const admin = createAdminClient()

  let ids: string[] = body.documento_ids ?? []

  if (!ids.length && body.proyecto_id) {
    const { data } = await admin.from('documento')
      .select('id')
      .eq('proyecto_id', body.proyecto_id)
      .in('estado_procesamiento', ['listo', 'error'])
    ids = (data ?? []).map(d => d.id)
  }

  if (!ids.length) return NextResponse.json({ error: 'No hay documentos' }, { status: 400 })

  // Marcar como pendiente y disparar job por cada uno
  await admin.from('documento').update({ estado_procesamiento: 'pendiente' }).in('id', ids)

  const eventos = ids.map(id => ({
    name: 'documento/procesar' as const,
    data: { documento_id: id, usuario_id: 'admin-reprocesar' },
  }))
  await inngest.send(eventos)

  return NextResponse.json({ ok: true, encolados: ids.length, ids })
}
