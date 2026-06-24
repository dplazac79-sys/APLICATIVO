'use client'

import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function PrintButton({ procesoNombre }: { procesoNombre: string }) {
  const params = useParams()
  return (
    <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <Link
          href={`/artefactos/${params.procesoId}`}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <span className="text-slate-600">·</span>
        <span className="text-slate-300 text-sm">{procesoNombre}</span>
      </div>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
      >
        <Printer className="w-4 h-4" />
        Imprimir / Guardar PDF
      </button>
    </div>
  )
}
