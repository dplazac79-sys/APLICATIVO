import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AuditAccion = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'LOGIN' | 'LOGOUT' | 'EXPORT'

interface AuditParams {
  accion: AuditAccion
  entidad: string
  entidad_id?: string
  detalle?: Record<string, unknown>
  /** Requerido cuando se llama fuera del ciclo de vida de la request (ej. jobs en segundo plano),
   * donde cookies() de next/headers ya no está disponible de forma confiable. */
  usuarioId?: string
}

export async function registrarAudit(params: AuditParams) {
  let usuarioId = params.usuarioId ?? null

  if (!usuarioId) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    usuarioId = user?.id ?? null
  }

  const admin = createAdminClient()
  await admin.from('audit_log').insert({
    usuario_id: usuarioId,
    accion: params.accion,
    entidad: params.entidad,
    entidad_id: params.entidad_id ?? null,
    detalle: params.detalle ?? {},
  })
}
