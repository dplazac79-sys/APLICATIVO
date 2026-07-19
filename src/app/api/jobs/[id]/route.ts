import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertProyectoAccess } from '@/lib/auth/tenant'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // Se resuelve primero solo el proyecto_id del job y se valida acceso ANTES
  // de tocar el contenido (resultado/error_mensaje) — sin esto, cualquier
  // usuario autenticado podía leer el resultado del job de discovery/análisis
  // IA de otro cliente adivinando el id (hallazgo de auditoría de seguridad).
  const { data: jobRef } = await admin
    .from('jobs')
    .select('proyecto_id')
    .eq('id', params.id)
    .single()

  if (!jobRef) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
  if (!jobRef.proyecto_id || !(await assertProyectoAccess(user.id, jobRef.proyecto_id))) {
    return NextResponse.json({ error: 'Sin acceso a este job' }, { status: 403 })
  }

  const { data: job, error } = await admin
    .from('jobs')
    .select('id, tipo, estado, resultado, error_mensaje, created_at, updated_at')
    .eq('id', params.id)
    .single()

  if (error || !job) return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })

  return NextResponse.json({ job })
}
