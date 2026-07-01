import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/documentos/resetear
// Body: { ids: string[] }  — resetea esos docs a estado pendiente
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { ids } = body as { ids?: string[] }
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que todos los docs pertenecen al usuario (a través del proyecto)
  const { data: docs } = await admin
    .from('documento')
    .select('id, proyecto:proyecto_id(miembros:proyecto_miembro(usuario_id))')
    .in('id', ids)

  if (!docs) return NextResponse.json({ error: 'No se encontraron documentos' }, { status: 404 })

  // Solo resetear docs a los que el usuario tiene acceso
  const accesibles = docs.filter(d => {
    const miembros = (d.proyecto as any)?.miembros as Array<{ usuario_id: string }> | undefined
    return miembros?.some(m => m.usuario_id === user.id)
  }).map(d => d.id)

  if (accesibles.length === 0) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })

  await admin
    .from('documento')
    .update({
      estado_procesamiento: 'pendiente',
      texto_extraido: null,
      resumen_ejecutivo: null,
      clasificacion: null,
      metadata_ia: null,
    })
    .in('id', accesibles)
    .in('estado_procesamiento', ['procesando', 'pendiente'])

  return NextResponse.json({ ok: true, reseteados: accesibles.length })
}
