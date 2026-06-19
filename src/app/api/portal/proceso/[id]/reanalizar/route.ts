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

  const resultado = await reAnalizarContenidoEditado({
    nombre_proceso: proceso.nombre_proceso,
    descripcion,
    sin_proceso_riesgos,
    con_proceso_beneficios,
  })

  const admin = createAdminClient()
  await admin.from('proceso_enriquecido').update({
    valor_negocio: resultado.valor_negocio,
    kpis: resultado.kpis,
    riesgos: resultado.riesgos,
    contenido_editado: { descripcion, sin_proceso_riesgos, con_proceso_beneficios },
  }).eq('id', params.id)

  await registrarUsoIA({ proyecto_id: proceso.proyecto_id, usuario_id: user.id, tipo: 'resumir', tokens_input: 1500, tokens_output: 800 })

  return NextResponse.json({ ok: true, valor_negocio: resultado.valor_negocio, kpis: resultado.kpis, riesgos: resultado.riesgos })
}
