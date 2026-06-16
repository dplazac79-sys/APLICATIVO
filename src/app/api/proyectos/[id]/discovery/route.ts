import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { discoveryProcesos } from '@/lib/ai/claude'

async function procesarDiscoveryEnSegundoPlano(proyecto_id: string, jobId: string) {
  const admin = createAdminClient()
  try {
    const { data: proyecto } = await admin
      .from('proyecto')
      .select('*, cliente(*)')
      .eq('id', proyecto_id)
      .single()

    if (!proyecto) throw new Error('Proyecto no encontrado')

    const { data: documentos } = await admin
      .from('documento')
      .select('id, nombre_archivo, resumen_ejecutivo, clasificacion')
      .eq('proyecto_id', proyecto_id)
      .eq('estado_procesamiento', 'listo')

    if (!documentos?.length) throw new Error('No hay documentos procesados. Primero procesa los documentos.')

    const cliente = proyecto.cliente as Record<string, unknown>
    const contexto = `
Empresa: ${cliente?.razon_social ?? 'N/A'}
Industria: ${cliente?.industria ?? 'N/A'}
Tamaño: ${cliente?.tamano ?? 'N/A'}
Objetivos estratégicos: ${cliente?.objetivos_estrategicos ?? 'N/A'}
`
    const resumenes = documentos.map(d =>
      `${d.nombre_archivo}\nResumen: ${d.resumen_ejecutivo ?? 'Sin resumen'}`
    )

    const resultado = await discoveryProcesos(contexto, resumenes)

    await admin.from('proceso')
      .delete()
      .eq('proyecto_id', proyecto_id)
      .in('origen', ['detectado', 'propuesta_ia'])

    for (const macro of resultado.macroprocesos) {
      const docOrigen = documentos.find(d => d.nombre_archivo === macro.documento_referencia)
      const { data: macroRow } = await admin.from('proceso').insert({
        proyecto_id,
        nombre: macro.nombre,
        descripcion: macro.descripcion,
        nivel: 0,
        tipo: 'macroproceso',
        origen: macro.origen,
        estado_oferta: 'propuesto',
        documento_origen_id: docOrigen?.id ?? null,
        metadata_ia: {
          criticidad: macro.criticidad,
          estado_actual: macro.estado_actual,
        },
      }).select().single()

      if (!macroRow) continue

      for (let i = 0; i < macro.procesos.length; i++) {
        const p = macro.procesos[i]
        const docP = documentos.find(d => d.nombre_archivo === p.documento_referencia)
        await admin.from('proceso').insert({
          proyecto_id,
          padre_id: macroRow.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          nivel: 1,
          tipo: 'proceso',
          origen: p.origen,
          estado_oferta: 'propuesto',
          documento_origen_id: docP?.id ?? null,
          roles_involucrados: p.roles_involucrados,
          riesgos_detectados: p.riesgos_si_no_existe_o_falla,
          metadata_ia: {
            criticidad: p.criticidad,
            justificacion_ia: p.justificacion_ia,
            evidencia_documento: p.evidencia_documento,
            oportunidades_mejora: p.oportunidades_mejora,
            oportunidades_automatizacion: p.oportunidades_automatizacion,
            kpis_recomendados: p.kpis_recomendados,
            benchmark_industria: p.benchmark_industria,
          },
          orden: i,
        })
      }
    }

    await admin.from('proyecto').update({
      discovery_resumen: {
        resumen_ejecutivo_discovery: resultado.resumen_ejecutivo_discovery,
        industria_detectada: resultado.industria_detectada,
        nivel_madurez_operacional: resultado.nivel_madurez_operacional,
        cobertura_documentacion: resultado.cobertura_documentacion,
        top_3_brechas_criticas: resultado.top_3_brechas_criticas,
        top_3_oportunidades_valor: resultado.top_3_oportunidades_valor,
        quick_wins_90_dias: resultado.quick_wins_90_dias,
        roadmap_transformacion: resultado.roadmap_transformacion,
        recomendacion_ceo: resultado.recomendacion_ceo,
      },
    }).eq('id', proyecto_id)

    await admin.from('jobs').update({
      estado: 'listo',
      resultado: { resumen: resultado.resumen_ejecutivo_discovery, industria: resultado.industria_detectada },
    }).eq('id', jobId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[discovery] Error:', err)
    await admin.from('jobs').update({
      estado: 'error',
      error_mensaje: msg,
    }).eq('id', jobId)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proyecto_id = params.id
    const admin = createAdminClient()

    const { data: job, error } = await admin.from('jobs').insert({
      tipo: 'discovery_procesos',
      estado: 'procesando',
      proyecto_id,
      payload: { proyecto_id },
    }).select().single()

    if (error || !job) return NextResponse.json({ error: 'No se pudo crear el job' }, { status: 500 })

    // Disparar en segundo plano sin bloquear la respuesta HTTP
    procesarDiscoveryEnSegundoPlano(proyecto_id, job.id)

    return NextResponse.json({ ok: true, job_id: job.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
