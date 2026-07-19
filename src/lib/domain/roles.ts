import { createAdminClient } from '@/lib/supabase/admin'

export interface RolDetectado {
  rol: string
  descripcion: string
  procesos: string[]
}

/**
 * Roles únicos detectados en los documentos ya procesados de un proyecto —
 * de `documento.analisis_ia.roles_y_responsabilidades` (roles_identificados +
 * brechas_de_rol, que sí trae descripción). Es la misma fuente y lógica que
 * usa /api/portal/glosario-roles al lanzar el análisis IA — se extrajo acá
 * para que el conteo/badge de "Glosario de Roles" en Process Discovery use
 * los mismos roles (con descripción real) en vez de una lista derivada de
 * `proceso.roles_involucrados` con descripción siempre vacía.
 */
export async function obtenerRolesDesdeDocumentos(proyectoId: string): Promise<RolDetectado[]> {
  const admin = createAdminClient()
  const { data: documentos } = await admin
    .from('documento')
    .select('nombre_archivo, analisis_ia')
    .eq('proyecto_id', proyectoId)
    .eq('estado_procesamiento', 'listo')
    .not('analisis_ia', 'is', null)

  const rolesMap = new Map<string, RolDetectado>()

  for (const doc of documentos ?? []) {
    const ia = doc.analisis_ia as Record<string, unknown>
    const rolesDoc = ia?.roles_y_responsabilidades as Record<string, unknown> | undefined
    const procesosDocName = doc.nombre_archivo as string

    const rolesId = (rolesDoc?.roles_identificados as string[] | undefined) ?? []
    for (const rol of rolesId) {
      if (!rol?.trim()) continue
      const key = rol.toLowerCase().trim()
      if (rolesMap.has(key)) {
        const existing = rolesMap.get(key)!
        if (!existing.procesos.includes(procesosDocName)) existing.procesos.push(procesosDocName)
      } else {
        rolesMap.set(key, { rol: rol.trim(), descripcion: '', procesos: [procesosDocName] })
      }
    }

    const brechas = (rolesDoc?.brechas_de_rol as string[] | undefined) ?? []
    for (const brecha of brechas) {
      if (!brecha?.trim()) continue
      const nombreRol = brecha.split(':')[0].trim()
      const key = `brecha:${nombreRol.toLowerCase()}`
      if (!rolesMap.has(key)) {
        rolesMap.set(key, { rol: nombreRol, descripcion: brecha, procesos: [procesosDocName] })
      }
    }
  }

  return Array.from(rolesMap.values()).slice(0, 30)
}
