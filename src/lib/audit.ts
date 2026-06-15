import { createClient } from '@/lib/supabase/server'

type AuditAccion = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'LOGIN' | 'LOGOUT'

interface AuditParams {
  accion: AuditAccion
  entidad: string
  entidad_id?: string
  detalle?: Record<string, unknown>
}

export async function registrarAudit(params: AuditParams) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('audit_log').insert({
    usuario_id: user?.id ?? null,
    accion: params.accion,
    entidad: params.entidad,
    entidad_id: params.entidad_id ?? null,
    detalle: params.detalle ?? {},
  })
}
