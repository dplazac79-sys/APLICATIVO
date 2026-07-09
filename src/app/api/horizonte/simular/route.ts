import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chatCompletion, MODELOS } from '@/lib/ai/client'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { proceso_id, artefacto_ids } = await req.json() as {
    proceso_id: string
    artefacto_ids?: string[]
  }

  // Cargar proceso + documento origen
  const { data: proceso } = await admin
    .from('proceso')
    .select('nombre, descripcion, roles_involucrados, metadata_ia, documento_origen_id, proyecto_id')
    .eq('id', proceso_id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  // Proyecto y cliente para contexto
  const { data: proyecto } = await admin
    .from('proyecto')
    .select('nombre, cliente:cliente_id(razon_social, industria)')
    .eq('id', proceso.proyecto_id)
    .single()

  const cliente = ((proyecto?.cliente as unknown) as Record<string, string> | null)
  const industria = cliente?.industria ?? 'empresa'
  const razonSocial = cliente?.razon_social ?? 'la organización'

  // Análisis IA del documento origen
  let analisisIA: Record<string, unknown> = {}
  if (proceso.documento_origen_id) {
    const { data: doc } = await admin
      .from('documento')
      .select('analisis_ia')
      .eq('id', proceso.documento_origen_id)
      .single()
    if (doc?.analisis_ia) {
      const raw = doc.analisis_ia as Record<string, unknown>
      analisisIA = (raw.analisis ?? raw) as Record<string, unknown>
    }
  }

  // Artefactos seleccionados (TO-BE, KPI-SLA, etc.)
  let contenidoArtefactos = ''
  if (artefacto_ids?.length) {
    const { data: artefactos } = await admin
      .from('artefacto')
      .select('tipo, contenido')
      .in('id', artefacto_ids)

    for (const a of artefactos ?? []) {
      const c = a.contenido as Record<string, unknown>
      contenidoArtefactos += `\n\n[Artefacto: ${a.tipo}]\n${JSON.stringify(c).slice(0, 1200)}`
    }
  }

  const hallazgos = (analisisIA.hallazgos_criticos as string[]) ?? []
  const riesgos = (analisisIA.riesgos_criticos as Array<{ riesgo: string; impacto: string }>) ?? []
  const oportunidades = (analisisIA.oportunidades_valor as Array<{ oportunidad: string; complejidad_implementacion: string }>) ?? []
  const quickWins = (analisisIA.quick_wins as string[]) ?? []
  const resumen = (analisisIA.resumen_ejecutivo as string) ?? proceso.descripcion ?? ''
  const madurez = (analisisIA.nivel_madurez_amo as number) ?? 2
  const roles = (proceso.roles_involucrados as string[]) ?? []

  const contexto = [
    `Proceso: ${proceso.nombre}`,
    `Empresa: ${razonSocial} | Industria: ${industria} | Madurez: ${madurez}/5`,
    `Resumen: ${resumen.slice(0, 300)}`,
    hallazgos.length ? `Hallazgos: ${hallazgos.slice(0, 3).join(' | ')}` : '',
    riesgos.length ? `Riesgos: ${riesgos.slice(0, 3).map(r => r.riesgo).join(' | ')}` : '',
    oportunidades.length ? `Oportunidades: ${oportunidades.slice(0, 3).map(o => o.oportunidad).join(' | ')}` : '',
    contenidoArtefactos ? contenidoArtefactos.slice(0, 600) : '',
  ].filter(Boolean).join('\n')

  const prompt = `Eres consultor senior de transformación empresarial. Genera una simulación de impacto realista para este proceso.

CONTEXTO:
${contexto}

Responde SOLO con JSON válido (sin markdown, sin texto extra):
{"impacto_global_score":<65-95>,"ahorro_anual_clp":<CLP realista>,"reduccion_tiempo_porcentaje":<15-70>,"reduccion_errores_porcentaje":<20-80>,"roi_meses":<6-36>,"empleados_liberados_horas_mes":<número>,"headline":"<8-10 palabras de impacto>","subtitulo":"<15 palabras>","transformacion_narrativa":"<3 oraciones sobre el futuro con implementación>","situacion_actual":"<2 oraciones sobre problemas actuales>","antes":["<problema 1>","<problema 2>","<problema 3>","<problema 4>"],"despues":["<mejora 1>","<mejora 2>","<mejora 3>","<mejora 4>"],"quick_wins":[{"titulo":"<acción>","descripcion":"<resultado>","plazo_dias":<30-90>,"impacto":"alto"},{"titulo":"","descripcion":"","plazo_dias":60,"impacto":"medio"},{"titulo":"","descripcion":"","plazo_dias":90,"impacto":"medio"}],"hitos":[{"mes":1,"titulo":"<hito>","descripcion":"<logro>"},{"mes":3,"titulo":"","descripcion":""},{"mes":6,"titulo":"","descripcion":""},{"mes":12,"titulo":"","descripcion":""}],"riesgos_mitigados":["<riesgo 1>","<riesgo 2>","<riesgo 3>"],"kpis_proyectados":[{"nombre":"<KPI>","antes":"<valor>","despues":"<valor>","unidad":"<unidad>"},{"nombre":"","antes":"","despues":"","unidad":""},{"nombre":"","antes":"","despues":"","unidad":""},{"nombre":"","antes":"","despues":"","unidad":""}],"impacto_organizacional":"<2 oraciones>","nivel_confianza":"alto","nota_consultor":"<1 oración clave>","sin_implementacion":{"headline":"<riesgo de no actuar 8 palabras>","costo_inaccion_anual_clp":<CLP>,"deterioro_en_meses":<6-24>,"consecuencias":["<consecuencia 1>","<consecuencia 2>","<consecuencia 3>","<consecuencia 4>"],"riesgos_escalados":["<riesgo que escala 1>","<riesgo que escala 2>"],"competitividad":"<1 oración sobre rezago competitivo>"}}`

  const TIMEOUT_MS = 28000
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
  )

  try {
    const completion = await Promise.race([
      chatCompletion({
        model: MODELOS.rapido,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.3,
      }),
      timeoutPromise,
    ])

    const raw = completion.choices[0]?.message?.content ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Error al procesar la simulación' }, { status: 500 })

    const simulacion = JSON.parse(jsonMatch[0])
    return NextResponse.json({ simulacion })
  } catch (e) {
    if (e instanceof Error && e.message === 'TIMEOUT') {
      return NextResponse.json({ error: 'La proyección tardó demasiado. Intenta de nuevo.' }, { status: 504 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
