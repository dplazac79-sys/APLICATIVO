'use client'

import { useEffect, useState, useRef } from 'react'
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
  'TO-BE', 'Dashboard brechas', 'Cierre ejecutivo', 'Checklists',
  'Backlog', '5 Porqués', 'Acta de inicio', 'Plan de pruebas', 'Roadmap',
]

const TIEMPO_ESTIMADO = 18 // segundos estimados

export default function ImportadorArtefactos({ procesoId, procesoNombre }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('extrayendo')
  const [guardados, setGuardados] = useState(0)
  const [fuente, setFuente] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  // Contador de tiempo real
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
        setFuente(d.fuente ?? '')
        setEstado('ok')
        setTimeout(() => { if (!cancelado) router.refresh() }, 600)
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
    const total = ARTEFACTOS_LABELS.length
    // Progreso estimado: avanza suavemente hasta 95%, se completa al terminar
    const pctEstimado = Math.min((elapsed / TIEMPO_ESTIMADO) * 95, 95)
    const activo = Math.min(Math.floor((elapsed / TIEMPO_ESTIMADO) * total), total - 1)
    const restantes = Math.max(TIEMPO_ESTIMADO - elapsed, 1)

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Extrayendo artefactos metodológicos</p>
            <p className="text-slate-500 text-xs truncate">{procesoNombre}</p>
          </div>
          {/* % y tiempo */}
          <div className="text-right shrink-0">
            <p className="text-purple-300 text-xl font-bold tabular-nums">{Math.round(pctEstimado)}%</p>
            <p className="text-slate-600 text-xs">~{restantes}s restantes</p>
          </div>
        </div>

        {/* Barra de progreso real */}
        <div className="space-y-1">
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
              style={{ width: `${pctEstimado}%` }}
            />
          </div>
        </div>

        {/* Chips de artefactos */}
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
          <div>
            <p className="text-emerald-300 font-medium text-sm">
              {guardados} artefactos extraídos en {tiempoReal}s
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {fuente === 'documento' ? 'Desde el texto del documento' : 'Desde el análisis IA del documento'}
              {' · '}Cargando...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-red-300 font-medium text-sm">No se pudo extraer los artefactos</p>
          <p className="text-slate-500 text-xs mt-1">{error}</p>
        </div>
      </div>
    </div>
  )
}
