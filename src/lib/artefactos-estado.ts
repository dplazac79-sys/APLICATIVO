import type { EstadoValidacion } from '@/types/database'

// Única fuente de verdad para roles y transiciones de estado_validacion de un
// artefacto. Antes esto vivía duplicado e independiente en tres lugares
// (PATCH /api/artefactos/[id], POST .../historial, y ArtefactoCardEditor.tsx
// en el frontend) — un cambio de regla en uno podía quedar desincronizado
// de los otros dos sin que ningún test o typecheck lo detectara.
export const ROLES_EDITAN_ARTEFACTO = ['super_admin', 'director_proyecto', 'consultor', 'sponsor_cliente']
export const ROLES_STAFF_ARTEFACTO = ['super_admin', 'director_proyecto', 'consultor']

export function esStaffArtefacto(rol: string | null | undefined): boolean {
  return ROLES_STAFF_ARTEFACTO.includes(rol ?? '')
}

interface TransicionEstado {
  siguiente: EstadoValidacion
  label: string
  soloStaff: boolean
}

// pendiente→validado la puede pedir cualquier rol con permiso de edición
// (incluye sponsor_cliente); validado→publicado y publicado→validado
// (revertir entrega) son exclusivas del equipo interno. validado→pendiente
// no aparece aquí a propósito: solo ocurre automáticamente al editar
// contenido, nunca como transición elegida por botón.
export const TRANSICIONES_ESTADO_ARTEFACTO: Record<EstadoValidacion, TransicionEstado | null> = {
  pendiente: { siguiente: 'validado', label: 'Validar', soloStaff: false },
  validado: { siguiente: 'publicado', label: 'Marcar entregado', soloStaff: true },
  publicado: { siguiente: 'validado', label: 'Revertir entrega', soloStaff: true },
}

export function transicionPermitida(estado: EstadoValidacion, esStaff: boolean): TransicionEstado | null {
  const t = TRANSICIONES_ESTADO_ARTEFACTO[estado]
  if (!t) return null
  if (t.soloStaff && !esStaff) return null
  return t
}

export function esTransicionValida(estadoActual: EstadoValidacion, estadoNuevo: EstadoValidacion, esStaff: boolean): boolean {
  return transicionPermitida(estadoActual, esStaff)?.siguiente === estadoNuevo
}
