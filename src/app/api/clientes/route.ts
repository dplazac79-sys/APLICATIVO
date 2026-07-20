import { NextRequest, NextResponse } from 'next/server'
import { jsonError } from '@/lib/http/errors'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import { requireRole } from '@/lib/auth/tenant'
import { errorResponse } from '@/lib/api/error-response'
import type { Cliente } from '@/types/database'

// Mismo allowlist que clientes/[id]/route.ts PATCH — evita mass-assignment
// (id, created_at, updated_at, etc.) vía payload arbitrario en la creación.
const CAMPOS_EDITABLES = [
  'razon_social', 'rut', 'industria', 'tamano', 'facturacion', 'dotacion',
  'objetivos_estrategicos', 'riesgos_declarados', 'madurez_digital',
  'inteligencia_industria', 'activo',
] as const satisfies readonly (keyof Cliente)[]

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    if (!(await requireRole(user.id, ['super_admin']))) {
      return NextResponse.json({ error: 'Solo super_admin puede crear clientes' }, { status: 403 })
    }

    const rawPayload = await req.json()
    if (!rawPayload.razon_social) {
      return NextResponse.json({ error: 'razon_social es requerida' }, { status: 400 })
    }
    const payload: Record<string, unknown> = {}
    for (const campo of CAMPOS_EDITABLES) {
      if (campo in rawPayload) payload[campo] = rawPayload[campo]
    }

    const { data: cliente, error } = await supabase.from('cliente').insert(payload).select().single()
    if (error) return jsonError(error)

    await registrarAudit({
      accion: 'CREATE',
      entidad: 'cliente',
      entidad_id: cliente.id,
      detalle: { razon_social: cliente.razon_social },
    })

    return NextResponse.json({ ok: true, cliente })
  } catch (err) {
    return errorResponse(err, 500)
  }
}
