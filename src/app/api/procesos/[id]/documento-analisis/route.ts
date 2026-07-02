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

  return NextResponse.json({
    nombre_archivo: doc.nombre_archivo,
    resumen_ejecutivo: doc.resumen_ejecutivo,
    analisis_ia: doc.analisis_ia,
  })
}
