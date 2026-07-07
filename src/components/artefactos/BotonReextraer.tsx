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
  const incompleto = totalActual < totalEsperado

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
    <div className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
      incompleto
        ? 'bg-amber-950/20 border-amber-800/40'
        : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <RefreshCw className={`w-4 h-4 shrink-0 ${incompleto ? 'text-amber-400' : 'text-slate-500'}`} />
        <div>
          {incompleto ? (
            <>
              <p className="text-amber-300 text-sm font-medium">
                Extracción incompleta — {totalActual} de {totalEsperado} artefactos
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                Re-extrae para obtener todos los artefactos desde el documento original
              </p>
            </>
          ) : (
            <p className="text-slate-400 text-sm">
              {totalActual} artefactos extraídos · Re-extraer sobreescribirá el contenido actual
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => setExtrayendo(true)}
        className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
          incompleto
            ? 'bg-amber-600 hover:bg-amber-500 text-white'
            : 'border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
        }`}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {incompleto ? 'Completar extracción' : 'Re-extraer todo'}
      </button>
    </div>
  )
}
