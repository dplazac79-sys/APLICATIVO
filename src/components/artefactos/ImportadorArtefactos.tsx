'use client'

import { useEffect, useState, useRef } from 'react'
import { CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

interface Props {
  procesoId: string
  procesoNombre: string
  onComplete?: () => void
}

type Estado = 'extrayendo' | 'ok' | 'error'

const ARTEFACTOS_LABELS = [
  'SIPOC', 'AS-IS', 'BPMN', 'RACI',
  'Riesgo-Control', 'KPI-SLA', 'Diagnóstico', 'TO-BE',
]

const TIEMPO_ESTIMADO = 30 // segundos estimados

export default function ImportadorArtefactos({ procesoId, procesoNombre, onComplete: _onComplete }: Props) {
  const [estado, setEstado] = useState<Estado>('extrayendo')
  const [guardados, setGuardados] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    if (estado !== 'extrayendo') return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 500)
    return () => clearInterval(id)
  }, [estado])

  useEffect(() => {
    let cancelado = false
    startRef.current = Date.now()

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
        setTotal(d.total ?? ARTEFACTOS_LABELS.length)
        setEstado('ok')
        // Reload garantiza datos frescos desde BD
        setTimeout(() => { if (!cancelado) window.location.reload() }, 1200)
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setEstado('error')
          // Recargar de todas formas — puede haber artefactos guardados parcialmente
          setTimeout(() => { if (!cancelado) window.location.reload() }, 3000)
        }
      }
    }

    importar()
    return () => { cancelado = true }
  }, [procesoId])

  if (estado === 'extrayendo') {
    const pasado = elapsed > TIEMPO_ESTIMADO
    const pctEstimado = pasado
      ? Math.min(92 + (elapsed - TIEMPO_ESTIMADO) * 0.15, 99)
      : Math.min((elapsed / TIEMPO_ESTIMADO) * 92, 92)
    const activo = Math.min(Math.floor((elapsed / TIEMPO_ESTIMADO) * ARTEFACTOS_LABELS.length), ARTEFACTOS_LABELS.length - 1)
    const restantes = Math.max(TIEMPO_ESTIMADO - elapsed, 0)

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Extrayendo artefactos metodológicos</p>
            <p className="text-slate-500 text-xs truncate">{procesoNombre}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-purple-300 text-xl font-bold tabular-nums">{Math.round(pctEstimado)}%</p>
            <p className="text-slate-600 text-xs">
              {pasado ? `${elapsed}s · finalizando...` : `~${restantes}s restantes`}
            </p>
          </div>
        </div>

        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
            style={{ width: `${pctEstimado}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ARTEFACTOS_LABELS.map((label, i) => {
            const completado = i < activo
            const enProceso = i === activo
            return (
              <span
                key={label}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-300 ${
                  completado
                    ? 'bg-purple-900/50 border-purple-700/60 text-purple-200'
                    : enProceso
                    ? 'bg-purple-950 border-purple-500 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.35)]'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-600'
                }`}
              >
                {completado ? '✓ ' : ''}{label}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  if (estado === 'ok') {
    const tiempoReal = Math.floor((Date.now() - startRef.current) / 1000)
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="text-emerald-300 font-medium text-sm">
              {guardados} de {total} artefactos generados en {tiempoReal}s
            </p>
            <p className="text-slate-500 text-xs mt-0.5">Cargando resultados...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-medium text-sm">No se pudo generar los artefactos</p>
          <p className="text-slate-500 text-xs mt-1">{error}</p>
        </div>
      </div>
    </div>
  )
}
