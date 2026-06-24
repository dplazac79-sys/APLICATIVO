'use client'

import { useState } from 'react'
import { Clock, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import type { ArtefactoHistorial } from '@/types/database'
import { LABEL_ARTEFACTO } from '@/lib/artefactos-meta'
import type { TipoArtefacto } from '@/types/database'

interface Props {
  historial: ArtefactoHistorial[]
  onRestaurar?: (version: ArtefactoHistorial) => Promise<void>
}

export default function ControlCambios({ historial, onRestaurar }: Props) {
  const [expandido, setExpandido] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<string | null>(null)

  if (!historial.length) {
    return (
      <p className="text-slate-600 text-sm text-center py-4">Sin versiones anteriores registradas.</p>
    )
  }

  const estadoColor: Record<string, string> = {
    pendiente: 'text-amber-400',
    validado: 'text-blue-400',
    publicado: 'text-emerald-400',
  }

  async function handleRestaurar(h: ArtefactoHistorial) {
    if (!onRestaurar) return
    setRestaurando(h.id)
    try {
      await onRestaurar(h)
    } finally {
      setRestaurando(null)
    }
  }

  return (
    <div className="space-y-2">
      {historial.map((h) => {
        const abierto = expandido === h.id
        const label = LABEL_ARTEFACTO[h.tipo as TipoArtefacto] ?? h.tipo
        const fecha = new Date(h.created_at).toLocaleString('es-CL', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        return (
          <div key={h.id} className="bg-slate-800/50 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-200 text-sm font-medium">v{h.version} — {label}</span>
                  <span className={`text-xs ${estadoColor[h.estado_validacion] ?? 'text-slate-400'}`}>
                    {h.estado_validacion}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                  <span>{fecha}</span>
                  {h.motivo_cambio ? <span>· {h.motivo_cambio}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onRestaurar && (
                  <button
                    onClick={() => handleRestaurar(h)}
                    disabled={restaurando === h.id}
                    className="text-slate-500 hover:text-blue-400 transition-colors p-1 rounded"
                    title="Restaurar esta versión"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${restaurando === h.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => setExpandido(abierto ? null : h.id)}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                >
                  {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {abierto && (
              <div className="border-t border-slate-700/50 p-3">
                <pre className="text-xs text-slate-400 overflow-auto max-h-48 bg-slate-900 rounded p-2">
                  {JSON.stringify(h.contenido, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
