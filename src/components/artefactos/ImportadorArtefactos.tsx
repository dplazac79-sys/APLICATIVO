'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FileText, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

interface Props {
  procesoId: string
  procesoNombre: string
}

type Estado = 'extrayendo' | 'ok' | 'error'

export default function ImportadorArtefactos({ procesoId, procesoNombre }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('extrayendo')
  const [guardados, setGuardados] = useState(0)
  const [fuente, setFuente] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function importar() {
      try {
        const res = await fetch(`/api/procesos/${procesoId}/importar-artefactos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (cancelado) return
        const d = await res.json()
        if (!res.ok) throw new Error(d.error ?? 'Error importando artefactos')
        setGuardados(d.guardados ?? 0)
        setFuente(d.fuente ?? '')
        setEstado('ok')
        // Refrescar la página para mostrar los artefactos recién importados
        setTimeout(() => { if (!cancelado) router.refresh() }, 800)
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setEstado('error')
        }
      }
    }

    importar()
    return () => { cancelado = true }
  }, [procesoId, router])

  if (estado === 'extrayendo') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/50 border border-purple-800/50 flex items-center justify-center">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-white font-semibold">Extrayendo artefactos del documento</p>
            <p className="text-slate-400 text-sm">{procesoNombre}</p>
            <p className="text-slate-600 text-xs mt-2">
              Analizando el documento y estructurando SIPOC, AS-IS, RACI y más...
            </p>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0,1,2].map(i => (
              <div
                key={i}
                className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (estado === 'ok') {
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
          <div>
            <p className="text-emerald-300 font-medium">
              {guardados} artefactos extraídos correctamente
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {fuente === 'documento' ? 'Extraídos del texto del documento' : 'Generados desde el análisis IA del documento'}
              {' · '}Recargando vista...
            </p>
          </div>
          <Loader2 className="w-4 h-4 text-slate-600 animate-spin ml-auto" />
        </div>
      </div>
    )
  }

  // error
  return (
    <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-medium">No se pudo extraer los artefactos automáticamente</p>
          <p className="text-slate-500 text-xs mt-1">{error}</p>
        </div>
      </div>
      <p className="text-slate-500 text-sm">
        Puedes generarlos individualmente con el botón <span className="text-purple-400 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> IA</span> en cada artefacto, o contactar a soporte.
      </p>
    </div>
  )
}
