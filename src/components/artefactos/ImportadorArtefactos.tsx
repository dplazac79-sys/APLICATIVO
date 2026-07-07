'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'

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

const TIEMPO_ESTIMADO = 35 // segundos estimados

export default function ImportadorArtefactos({ procesoId, procesoNombre }: Props) {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('extrayendo')
  const [guardados, setGuardados] = useState(0)
  const [fuente, setFuente] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [explicacionGap, setExplicacionGap] = useState<{
    titulo: string
    mensaje_principal: string
    artefactos_criticos: string[]
    artefactos_pendientes_razon: string
    siguiente_paso: string
  } | null>(null)
  const [total, setTotal] = useState(0)
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
        const guardadosN = d.guardados ?? 0
        const totalN = d.total ?? ARTEFACTOS_LABELS.length
        setGuardados(guardadosN)
        setTotal(totalN)
        setFuente(d.fuente ?? '')
        if (d.explicacion_gap) setExplicacionGap(d.explicacion_gap)
        setEstado('ok')
        // Si salieron todos, refrescar automático. Si hay gap, el usuario refresca manualmente.
        if (guardadosN >= totalN) {
          setTimeout(() => { if (!cancelado) router.refresh() }, 600)
        }
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
    const pasado = elapsed > TIEMPO_ESTIMADO
    // Hasta el estimado: avanza hasta 92%. Después: sube muy lento hacia 99%, nunca retrocede
    const pctEstimado = pasado
      ? Math.min(92 + (elapsed - TIEMPO_ESTIMADO) * 0.15, 99)
      : Math.min((elapsed / TIEMPO_ESTIMADO) * 92, 92)
    const activo = Math.min(Math.floor((elapsed / TIEMPO_ESTIMADO) * total), total - 1)
    const restantes = Math.max(TIEMPO_ESTIMADO - elapsed, 0)

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
            <p className="text-slate-600 text-xs">
              {pasado ? `${elapsed}s · finalizando...` : `~${restantes}s restantes`}
            </p>
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
    const hayGap = guardados < total && explicacionGap

    return (
      <div className="space-y-3">
        {/* Banner de éxito */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1">
              <p className="text-emerald-300 font-medium text-sm">
                {guardados} de {total} artefactos extraídos en {tiempoReal}s
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {fuente === 'documento' ? 'Desde el texto del documento' : 'Desde el análisis del documento'}
              </p>
            </div>
            <button
              onClick={() => router.refresh()}
              className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-800/50 border border-emerald-700/50 text-emerald-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Ver artefactos
            </button>
          </div>
        </div>

        {/* Explicación de gap cuando hay artefactos faltantes */}
        {hayGap && (
          <div className="bg-blue-950/20 border border-blue-800/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-900/50 border border-blue-700/50 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-blue-300 text-sm">i</span>
              </div>
              <div className="min-w-0">
                <p className="text-blue-200 font-semibold text-sm">{explicacionGap.titulo}</p>
                <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                  {explicacionGap.mensaje_principal}
                </p>
              </div>
            </div>

            {/* Artefactos críticos generados */}
            {explicacionGap.artefactos_criticos?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">
                  Artefactos clave generados para este proceso
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {explicacionGap.artefactos_criticos.map((a, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/40 text-emerald-300">
                      ✓ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Razón de los pendientes */}
            <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/60">
              <p className="text-slate-500 text-xs font-medium mb-1">Artefactos pendientes</p>
              <p className="text-slate-400 text-xs leading-relaxed">
                {explicacionGap.artefactos_pendientes_razon}
              </p>
            </div>

            {/* Siguiente paso */}
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-xs shrink-0 mt-0.5">→</span>
              <p className="text-amber-300/80 text-xs leading-relaxed">{explicacionGap.siguiente_paso}</p>
            </div>
          </div>
        )}
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
