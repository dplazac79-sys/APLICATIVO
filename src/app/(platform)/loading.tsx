import { Loader2 } from 'lucide-react'

// Cubre TODAS las rutas anidadas bajo (platform) que no definan su propio
// loading.tsx más específico — antes ninguna ruta tenía uno, así que
// navegar a cualquier página mostraba pantalla en blanco mientras el
// Server Component resolvía sus queries (hallazgo de auditoría UX/UI).
export default function PlatformLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center h-full min-h-[400px]"
    >
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" aria-hidden="true" />
        <p className="text-slate-400 text-sm">Cargando…</p>
        <span className="sr-only">Cargando contenido</span>
      </div>
    </div>
  )
}
