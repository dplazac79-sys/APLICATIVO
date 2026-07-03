import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('id, nombre, documento_origen_id, metadata_ia')
    .eq('id', params.id)
    .single()

  if (!proceso?.documento_origen_id) {
    return NextResponse.json({ error: 'sin_documento' }, { status: 404 })
  }

  const { data: doc } = await admin
    .from('documento')
    .select('nombre_archivo, resumen_ejecutivo, analisis_ia')
    .eq('id', proceso.documento_origen_id)
    .single()

  if (!doc) {
    return NextResponse.json({ error: 'documento_no_encontrado' }, { status: 404 })
  }

  // analisis_ia tiene estructura { clasificacion: {...}, analisis: { resumen_ejecutivo, ... } }
  // Normalizamos para que los consumidores siempre reciban la sub-sección "analisis" plana
  const iaRaw = doc.analisis_ia as Record<string, unknown> | null
  const analisisNormalizado = iaRaw
    ? ((iaRaw.analisis ?? iaRaw) as Record<string, unknown>)
    : null

  return NextResponse.json({
    nombre_archivo: doc.nombre_archivo,
    resumen_ejecutivo: doc.resumen_ejecutivo,
    analisis_ia: analisisNormalizado,
  })
}
