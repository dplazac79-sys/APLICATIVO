'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ImportadorArtefactos from './ImportadorArtefactos'

interface Props {
  procesoId: string
  procesoNombre: string
  totalActual: number
  totalEsperado: number
}

export default function BotonReextraer({ procesoId, procesoNombre, totalActual, totalEsperado }: Props) {
  const [extrayendo, setExtrayendo] = useState(false)

  if (extrayendo) {
    return (
      <ImportadorArtefactos
        procesoId={procesoId}
        procesoNombre={procesoNombre}
        onComplete={() => setExtrayendo(false)}
      />
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 bg-slate-900 border-slate-800">
      <div className="flex items-center gap-3 min-w-0">
        <RefreshCw className="w-4 h-4 shrink-0 text-slate-500" />
        <p className="text-slate-400 text-sm">
          {totalActual} de {totalEsperado} artefactos · Re-extraer actualizará el contenido con la última versión del análisis
        </p>
      </div>
      <button
        onClick={() => setExtrayendo(true)}
        className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Re-extraer
      </button>
    </div>
  )
}
