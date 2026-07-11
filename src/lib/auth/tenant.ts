import { createAdminClient } from '@/lib/supabase/admin'

// Punto único de verificación de pertenencia a proyecto — evita que cada
// route reimplemente su propia variante (ver auditoría: documentos/[id] y
// artefactos/[id] no la tenían, permitiendo acceso cruzado entre clientes).
export async function assertProyectoAccess(userId: string, proyectoId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data: usuario } = await admin
    .from('usuario')
    .select('rol, usuario_proyecto(proyecto_id)')
    .eq('id', userId)
    .single()

  if (!usuario) return false
  if (usuario.rol === 'super_admin') return true

  const proyectosUsuario = (usuario.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)
  return proyectosUsuario.includes(proyectoId)
}

export async function getRolUsuario(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data: usuario } = await admin.from('usuario').select('rol').eq('id', userId).single()
  return usuario?.rol ?? null
}
