import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const proyecto_id = req.nextUrl.searchParams.get('proyecto_id')
  if (!proyecto_id) return NextResponse.json({ error: 'proyecto_id requerido' }, { status: 400 })

  // Verifica acceso via RLS
  const { data: procesos, error } = await supabase
    .from('proceso_enriquecido')
    .select('id, nombre_proceso, macroproceso, numero_en_macroproceso, total_en_macroproceso, estado_aprobacion, created_at, documento_cliente_id')
    .eq('proyecto_id', proyecto_id)
    .order('created_at', { ascending: false })

  if (error) return jsonError(error)

  // También documentos en procesando para mostrar spinner
  const { data: docsEnProceso } = await supabase
    .from('documento_cliente')
    .select('id, nombre_archivo, estado, error_mensaje, created_at')
    .eq('proyecto_id', proyecto_id)
    .in('estado', ['subido', 'procesando'])

  return NextResponse.json({ procesos: procesos ?? [], procesando: docsEnProceso ?? [] })
}
