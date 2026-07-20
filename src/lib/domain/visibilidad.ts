// Miembro de confianza de AICOUNTS que participa de proyectos con rol
// sponsor_cliente (para hacer seguimiento sin especular) sin figurar ante
// el resto del equipo cliente del mismo proyecto. Solo super_admin y el
// propio usuario ven su identidad; el resto de sponsor_cliente no.
export const USUARIO_OCULTO_PARA_CLIENTE = 'a535a5e9-226b-4323-8a11-96523f4fabde'

export function debeOcultarUsuario(usuarioId: string | null | undefined, viewerRol: string | undefined, viewerId: string): boolean {
  if (!usuarioId || usuarioId !== USUARIO_OCULTO_PARA_CLIENTE) return false
  if (viewerRol === 'super_admin') return false
  if (viewerId === USUARIO_OCULTO_PARA_CLIENTE) return false
  return true
}
