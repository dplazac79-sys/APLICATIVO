import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

// Antes cualquier id inválido (/documentos/<id-inexistente>, /clientes/<id>,
// etc.) caía en el 404 genérico de Next.js, sin la identidad visual del
// resto de la app — hallazgo de auditoría UX/UI.
export default function PlatformNotFound() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7 text-slate-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">No encontramos esto</h2>
          <p className="text-slate-400 text-sm mt-1">
            El recurso que buscas no existe o ya no está disponible.
          </p>
        </div>
        <Link
          href="/bienvenida"
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors border border-slate-700"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
