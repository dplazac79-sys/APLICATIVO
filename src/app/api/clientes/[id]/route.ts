import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { registrarAudit } from '@/lib/audit'
import type { Cliente } from '@/types/database'
import { requireRole } from '@/lib/auth/tenant'

// Campos editables por admin/super_admin — excluye explícitamente id/created_at/updated_at
// para evitar mass-assignment vía payload arbitrario (ver auditoría).
const CAMPOS_EDITABLES = [
  'razon_social', 'rut', 'industria', 'tamano', 'facturacion', 'dotacion',
  'objetivos_estrategicos', 'riesgos_declarados', 'madurez_digital',
  'inteligencia_industria', 'activo',
] as const satisfies readonly (keyof Cliente)[]

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin', 'admin']))) {
    return NextResponse.json({ error: 'Solo admin o super_admin pueden modificar clientes' }, { status: 403 })
  }

  const rawPayload = await req.json()
  const payload: Record<string, unknown> = {}
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in rawPayload) payload[campo] = rawPayload[campo]
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('cliente')
    .update(payload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return jsonError(error)

  await registrarAudit({
    accion: 'UPDATE',
    entidad: 'cliente',
    entidad_id: params.id,
    detalle: payload,
  })

  return NextResponse.json({ ok: true, cliente: data })
}
