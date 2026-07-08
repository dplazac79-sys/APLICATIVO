import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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
  const versionesActuales = (meta.versiones ?? []) as Array<Record<string, unknown>>

  // Cargar analisis_ia del documento origen para snapshottear texto original de cada corrección
  let docAnalisisIA: Record<string, unknown> = {}
  if (proceso.documento_origen_id) {
    const { data: doc } = await admin
      .from('documento')
      .select('analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (doc?.analisis_ia) docAnalisisIA = doc.analisis_ia as Record<string, unknown>
  }

  const LISTAS: Record<string, string> = {
    riesgo: 'riesgos_criticos',
    hallazgo: 'hallazgos_criticos',
    brecha: 'brechas_documentacion',
    rol: 'roles_y_responsabilidades',
  }

  const atendidas = correcciones.filter(c => c.estado === 'atendido')

  // Snapshot detallado: tipo + texto original del documento + observación del cliente
  const detalleCorrecciones = atendidas.map(c => {
    const lista = (docAnalisisIA[LISTAS[c.tipo]] ?? []) as Array<unknown>
    const item = lista[c.indice]
    let textoOriginal = ''
    if (typeof item === 'string') textoOriginal = item
    else if (item && typeof item === 'object') {
      const obj = item as Record<string, string>
      textoOriginal = obj.riesgo ?? obj.hallazgo ?? obj.rol ?? obj.nombre ?? JSON.stringify(item)
    }
    return {
      tipo: c.tipo,
      indice: c.indice,
      texto_original: textoOriginal.slice(0, 300),
      observacion: c.observacion,
      fecha: c.fecha,
    }
  })

  const maxNumero = versionesActuales.reduce((max, v) => Math.max(max, (v as Record<string,unknown>).numero as number ?? 0), 0)
  const nuevaVersion = {
    numero: Math.max(versionesActuales.length === 0 ? 2 : maxNumero + 1, 2),
    fecha: new Date().toISOString(),
    correcciones_aplicadas: atendidas.length,
    descripcion: atendidas.length > 0
      ? `${atendidas.length} mejora${atendidas.length > 1 ? 's' : ''} registrada${atendidas.length > 1 ? 's' : ''} por el cliente`
      : 'Nueva versión generada',
    detalle_correcciones: detalleCorrecciones,
    documento_id: proceso.documento_origen_id ?? null,
  }

  const correccionesArchivadas = correcciones.map(c =>
    c.estado === 'atendido' ? { ...c, estado: 'archivado' } : c
  )

  const versionesNuevas = versionesActuales.length === 0
    ? [
        { numero: 1, fecha: meta.fecha_creacion as string ?? new Date().toISOString(), correcciones_aplicadas: 0, descripcion: 'Versión inicial', detalle_correcciones: [], documento_id: proceso.documento_origen_id ?? null },
        nuevaVersion,
      ]
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
