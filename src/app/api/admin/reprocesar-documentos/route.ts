import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest } from '@/lib/inngest/client'

// Endpoint de uso único para relanzar el análisis IA de documentos por proyecto
// Solo accesible con ADMIN_REPROCESAR_SECRET como Bearer token
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.ADMIN_REPROCESAR_SECRET ?? ''
  if (!secret) return NextResponse.json({ error: 'Endpoint no configurado' }, { status: 503 })
  const encoder = new TextEncoder()
  const a = encoder.encode(auth.slice(7))
  const b = encoder.encode(secret)
  const match = auth.startsWith('Bearer ') &&
    a.length === b.length &&
    crypto.subtle ? await (async () => {
      // timing-safe compare
      const key = await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const sig1 = await crypto.subtle.sign('HMAC', key, a)
      const sig2 = await crypto.subtle.sign('HMAC', key, b)
      const v1 = new Uint8Array(sig1); const v2 = new Uint8Array(sig2)
      let diff = 0; for (let i = 0; i < v1.length; i++) diff |= v1[i] ^ v2[i]
      return diff === 0
    })() : auth.slice(7) === secret
  if (!match) {
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
