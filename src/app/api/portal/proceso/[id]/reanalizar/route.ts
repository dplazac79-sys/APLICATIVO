import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reAnalizarContenidoEditado } from '@/lib/ai/claude'
import { verificarLimiteIA, registrarUsoIA } from '@/lib/ai/rate-limit'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { descripcion, sin_proceso_riesgos, con_proceso_beneficios } = body

  if (!descripcion || !sin_proceso_riesgos || !con_proceso_beneficios) {
    return NextResponse.json({ error: 'Faltan campos para re-analizar' }, { status: 400 })
  }

  // Verificar acceso via RLS y obtener datos del proceso
  const { data: proceso } = await supabase
    .from('proceso_enriquecido')
    .select('id, proyecto_id, nombre_proceso')
    .eq('id', params.id)
    .single()

  if (!proceso) return NextResponse.json({ error: 'Proceso no encontrado' }, { status: 404 })

  const limite = await verificarLimiteIA(proceso.proyecto_id, 'resumir')
  if (!limite.permitido) return NextResponse.json({ error: limite.mensaje }, { status: 429 })

  // Ancla documental: cargar analisis_ia de documentos del proyecto para grounding
  const admin = createAdminClient()
  const { data: docs } = await admin
    .from('documento')
    .select('nombre_archivo, analisis_ia')
    .eq('proyecto_id', proceso.proyecto_id)
    .eq('estado_procesamiento', 'listo')
    .limit(3)

  const contextoDocumental = (docs ?? [])
    .filter(d => d.analisis_ia)
    .map(d => {
      const ia = d.analisis_ia as Record<string, unknown>
      return `### ${d.nombre_archivo}\nResumen: ${(ia.resumen_ejecutivo as string ?? '').slice(0, 400)}\nDiagnóstico: ${(ia.diagnostico_operacional as string ?? '').slice(0, 300)}`
    })
    .join('\n\n')

  const resultado = await reAnalizarContenidoEditado({
    nombre_proceso: proceso.nombre_proceso,
    descripcion,
    sin_proceso_riesgos,
    con_proceso_beneficios,
    contexto_documental: contextoDocumental || null,
  })
  await admin.from('proceso_enriquecido').update({
    valor_negocio: resultado.valor_negocio,
    kpis: resultado.kpis,
    riesgos: resultado.riesgos,
    contenido_editado: { descripcion, sin_proceso_riesgos, con_proceso_beneficios },
  }).eq('id', params.id)

  await registrarUsoIA({ proyecto_id: proceso.proyecto_id, usuario_id: user.id, tipo: 'resumir', tokens_input: 1500, tokens_output: 800 })

  return NextResponse.json({ ok: true, valor_negocio: resultado.valor_negocio, kpis: resultado.kpis, riesgos: resultado.riesgos })
}
