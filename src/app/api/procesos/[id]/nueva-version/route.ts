import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: proceso } = await admin
    .from('proceso')
    .select('metadata_ia, documento_origen_id')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'no_encontrado' }, { status: 404 })

  const meta = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const correcciones = (meta.correcciones ?? []) as Array<{
    tipo: string; indice: number; observacion: string; estado: string; fecha: string
  }>
  const versionesActuales = (meta.versiones ?? []) as Array<{
    numero: number; fecha: string; correcciones_aplicadas: number; descripcion: string
  }>

  const atendidas = correcciones.filter(c => c.estado === 'atendido')
  const nuevaVersion = {
    numero: versionesActuales.length + 1,
    fecha: new Date().toISOString(),
    correcciones_aplicadas: atendidas.length,
    descripcion: atendidas.length > 0
      ? `${atendidas.length} hallazgo(s) atendido(s) por el cliente`
      : 'Nueva versión generada',
  }

  // Marcar correcciones atendidas como archivadas (quedan en historial pero no se muestran en vista activa)
  const correccionesArchivadas = correcciones.map(c =>
    c.estado === 'atendido' ? { ...c, estado: 'archivado' } : c
  )

  const versionesNuevas = versionesActuales.length === 0
    ? [{ numero: 1, fecha: meta.fecha_creacion as string ?? new Date().toISOString(), correcciones_aplicadas: 0, descripcion: 'Versión inicial' }, nuevaVersion]
    : [...versionesActuales, nuevaVersion]

  const { error } = await admin
    .from('proceso')
    .update({
      metadata_ia: {
        ...meta,
        correcciones: correccionesArchivadas,
        versiones: versionesNuevas,
        version_actual: nuevaVersion.numero,
      },
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, version: nuevaVersion, versiones: versionesNuevas })
}
