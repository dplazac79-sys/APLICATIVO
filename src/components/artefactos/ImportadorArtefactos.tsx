'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

interface Props {
  procesoId: string
  procesoNombre: string
}

type Estado = 'extrayendo' | 'ok' | 'error'

const ARTEFACTOS_LABELS = [
  'SIPOC', 'AS-IS', 'BPMN', 'Flujograma', 'Historias de usuario',
  'Matriz RACI', 'Riesgos y controles', 'KPIs y SLAs', 'Diagnóstico',
  'TO-BE', 'Dashboard brechas', 'Cierre ejecutivo',
]

export default function ImportadorArtefactos({ procesoId, procesoNombre }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('extrayendo')
  const [guardados, setGuardados] = useState(0)
  const [fuente, setFuente] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // Simula progreso visual mientras la API trabaja en paralelo
  useEffect(() => {
    if (estado !== 'extrayendo') return
    const id = setInterval(() => setTick(t => t + 1), 600)
    return () => clearInterval(id)
  }, [estado])

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
    const totalLabels = ARTEFACTOS_LABELS.length
    const activo = tick % totalLabels

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-white font-semibold">Extrayendo artefactos metodológicos</p>
            <p className="text-slate-500 text-sm truncate max-w-sm">{procesoNombre}</p>
          </div>
        </div>

        {/* Grid de chips — se iluminan uno a uno */}
        <div className="flex flex-wrap gap-2">
          {ARTEFACTOS_LABELS.map((label, i) => {
            const completado = i < activo
            const enProceso = i === activo
            return (
              <span
                key={label}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-all duration-300 ${
                  completado
                    ? 'bg-purple-900/60 border-purple-700 text-purple-200'
                    : enProceso
                    ? 'bg-purple-950 border-purple-500 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-600'
                }`}
              >
                {completado ? '✓ ' : enProceso ? '⟳ ' : ''}{label}
              </span>
            )
          })}
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1.5">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(((activo + 1) / totalLabels) * 100, 95)}%` }}
            />
          </div>
          <p className="text-slate-600 text-xs text-right">
            Procesando en paralelo — esto toma unos segundos
          </p>
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
              {' · '}Cargando artefactos...
            </p>
          </div>
        </div>
      </div>
    )
  }

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
        Puedes generarlos individualmente con el botón{' '}
        <span className="text-purple-400 inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> IA
        </span>{' '}
        en cada artefacto, o contactar a soporte.
      </p>
    </div>
  )
}
