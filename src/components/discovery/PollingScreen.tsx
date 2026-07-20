'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, CheckCircle2, Clock, Cpu, FileText, X, RefreshCw } from 'lucide-react'
import DiscoveryAcciones from './DiscoveryAcciones'
import type { DocumentoItem } from './types'

export function PollingScreen({
  proyectoId,
  procesadosIds,
  totalParaProcesar,
  documentos,
  proyectosParaAcciones,
  onCancelar,
}: {
  proyectoId: string
  procesadosIds: string[]
  totalParaProcesar: number
  documentos: DocumentoItem[]
  proyectosParaAcciones: { id: string; nombre: string }[]
  onCancelar: () => void
}) {
  const [estadosDocs, setEstadosDocs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const id of procesadosIds) init[id] = 'pendiente'
    return init
  })
  const [todosListos, setTodosListos] = useState(false)
  const [timeout3min, setTimeout3min] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  // Elapsed seconds — drives asymptotic curve, always moving
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const [estadosRef] = useState<{ current: Record<string, string> }>({ current: {} })

  // Map doc id → nombre
  const docMap = Object.fromEntries(documentos.map(d => [d.id, d.nombre_archivo]))

  // Tick every second — elapsed drives the curve so it never freezes
  useEffect(() => {
    tickRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [])

  useEffect(() => {
    if (procesadosIds.length === 0) return

    async function poll() {
      const elapsedMs = Date.now() - startRef.current
      if (elapsedMs > 8 * 60 * 1000) {
        setTimeout3min(true)
        if (intervalRef.current) clearInterval(intervalRef.current)
        if (tickRef.current) clearInterval(tickRef.current)
        return
      }
      try {
        const res = await fetch(
          `/api/documentos/estado?proyecto_id=${proyectoId}&ids=${procesadosIds.join(',')}`
        )
        const data = await res.json()
        if (data.documentos) {
          const newEstados: Record<string, string> = {}
          for (const doc of data.documentos) newEstados[doc.id] = doc.estado_procesamiento
          setEstadosDocs(newEstados)
          estadosRef.current = newEstados
          const allDone = procesadosIds.every(id => newEstados[id] === 'listo')
          if (allDone) {
            setTodosListos(true)
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (tickRef.current) clearInterval(tickRef.current)
          }
        }
      } catch { /* silent */ }
    }

    poll()
    intervalRef.current = setInterval(poll, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [proyectoId, procesadosIds, estadosRef]) // estadosRef es estable (useState sin setter), no reintroduce reruns

  async function detenerYReiniciar() {
    if (cancelando) return
    setCancelando(true)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    try {
      await fetch('/api/documentos/resetear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: procesadosIds }),
      })
    } catch { /* si falla igual volvemos a selección */ }
    onCancelar()
  }

  const listosCount = procesadosIds.filter(id => estadosDocs[id] === 'listo').length
  const procesandoCount = procesadosIds.filter(id => estadosDocs[id] === 'procesando').length

  // Asymptotic curve: 99 * (1 - e^(-t/tau)) — always moving, never reaches 99 on its own
  // tau=120s → ~63% at 2min, ~86% at 4min, ~95% at 6min
  const tau = 120
  const curvePct = Math.round(99 * (1 - Math.exp(-elapsed / tau)))
  // Real data takes precedence if higher
  const realPct = totalParaProcesar > 0
    ? Math.round(((listosCount + procesandoCount * 0.5) / totalParaProcesar) * 100)
    : 0
  const pct = todosListos ? 100 : Math.min(99, Math.max(curvePct, realPct))
  const circleRadius = 54
  const circleCircumference = 2 * Math.PI * circleRadius
  const circleOffset = circleCircumference - (pct / 100) * circleCircumference

  return (
    <div className="p-8 space-y-6">
      {/* Top: circular progress */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-36 h-36">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={circleRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="64" cy="64" r={circleRadius}
              fill="none"
              stroke={todosListos ? '#10b981' : '#7c3aed'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circleCircumference}
              strokeDashoffset={circleOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {todosListos ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            ) : (
              <>
                <span className="text-2xl font-bold text-white">{pct}%</span>
                <span className="text-xs text-slate-400">procesado</span>
              </>
            )}
          </div>
          {!todosListos && (
            <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
          )}
        </div>

        <div className="text-center" role="status" aria-live="polite">
          {todosListos ? (
            <>
              <p className="text-white font-bold text-xl">¡Documentos procesados!</p>
              <p className="text-slate-400 text-sm mt-1">Listo para ejecutar Discovery IA</p>
            </>
          ) : (
            <>
              <p className="text-white font-semibold text-lg">
                {listosCount > 0 ? `${listosCount} de ${totalParaProcesar} completados` : 'AICOUNTS Intelligence Engine activo...'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {listosCount > 0
                  ? `${totalParaProcesar - listosCount} documento${totalParaProcesar - listosCount !== 1 ? 's' : ''} en análisis`
                  : 'Analizando tu documentación con precisión diagnóstica'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Doc list with per-doc status */}
      <div className="space-y-2 max-w-lg mx-auto">
        {procesadosIds.map((id, idx) => {
          const estadoReal = estadosDocs[id] ?? 'pendiente'
          const nombre = docMap[id] ?? id
          // Visual state: after enough time, show animated "analizando" even if DB hasn't updated
          // Each doc gets a staggered threshold so they don't all flip at once
          const umbralAnalizando = 12 + idx * 8 // doc 0→12s, doc 1→20s, doc 2→28s...
          const estadoVisual = estadoReal === 'listo' ? 'listo'
            : estadoReal === 'procesando' ? 'procesando'
            : elapsed > umbralAnalizando ? 'procesando'  // DB lag — mostrar activo
            : 'pendiente'

          return (
            <div key={id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-500 ${
              estadoVisual === 'listo' ? 'bg-emerald-950/20 border-emerald-800/30' :
              estadoVisual === 'procesando' ? 'bg-violet-950/20 border-violet-800/30' :
              'bg-slate-800/30 border-slate-700/30'
            }`}>
              <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                {estadoVisual === 'listo' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : estadoVisual === 'procesando' ? (
                  <span className="w-4 h-4 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin block" />
                ) : (
                  <Clock className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <FileText className={`w-4 h-4 shrink-0 ${estadoVisual === 'listo' ? 'text-emerald-400' : estadoVisual === 'procesando' ? 'text-violet-400' : 'text-slate-500'}`} />
              <p className={`text-sm font-medium flex-1 truncate ${estadoVisual === 'listo' ? 'text-emerald-300' : estadoVisual === 'procesando' ? 'text-violet-300' : 'text-slate-400'}`}>
                {nombre}
              </p>
              {estadoVisual === 'procesando' ? (
                <div className="shrink-0 h-1.5 w-16 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full animate-pulse w-2/3" />
                </div>
              ) : (
                <span className={`text-xs font-medium shrink-0 ${
                  estadoVisual === 'listo' ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {estadoVisual === 'listo' ? 'Listo ✓' : 'En cola'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Botón detener ── */}
      {!todosListos && (
        <div className="flex justify-center">
          <button
            onClick={detenerYReiniciar}
            disabled={cancelando}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 border border-slate-700/60 hover:border-red-700/60 hover:text-red-400 hover:bg-red-950/20 transition-all disabled:opacity-50"
          >
            {cancelando
              ? <><span className="w-3 h-3 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin" />Deteniendo...</>
              : <><X className="w-3.5 h-3.5" />Detener y volver a elegir documentos</>}
          </button>
        </div>
      )}

      {/* ── Por qué procesamos primero ── */}
      {!todosListos && (
        <div className="max-w-lg mx-auto border border-slate-700/40 rounded-2xl overflow-hidden">
          <div className="bg-slate-800/40 px-4 py-2.5 flex items-center gap-2 border-b border-slate-700/40">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">¿Por qué indexamos antes del análisis?</span>
          </div>
          <div className="p-4 space-y-3">
            {[
              { icon: '⚡', title: 'Vectorización semántica', desc: 'Cada documento se convierte en embeddings multidimensionales que el motor puede razonar, no solo leer.' },
              { icon: '🔬', title: 'Diagnóstico de calidad', desc: 'Clasificamos el tipo, madurez y relevancia de cada fuente antes de cruzarla con el framework AICOUNTS.' },
              { icon: '🧠', title: 'Contexto enriquecido para Discovery', desc: 'Sin este paso, el análisis trabaja sobre texto plano. Con él, trabaja sobre inteligencia estructurada.' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      {todosListos && (
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-700/40 p-6 text-center space-y-4 max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <p className="text-emerald-300 font-bold text-lg">¡Todo listo!</p>
          </div>
          <p className="text-slate-400 text-sm">Todos los documentos han sido indexados. Ejecuta el análisis completo ahora.</p>
          <DiscoveryAcciones proyectos={proyectosParaAcciones} documentoIds={procesadosIds} />
        </div>
      )}

      {timeout3min && !todosListos && (
        <div className="rounded-2xl bg-gradient-to-br from-violet-950/40 to-slate-900/60 border border-violet-700/30 p-6 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto">
            <Cpu className="w-5 h-5 text-violet-400 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <p className="text-white font-semibold text-sm">AICOUNTS Intelligence Engine en proceso</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Tu documentación está siendo analizada con precisión. Los documentos más densos requieren
              un procesamiento exhaustivo — esto garantiza que cada insight sea sólido y accionable.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1">
            {[0,1,2,3,4].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-violet-600/20 border border-violet-500/40 text-violet-300 text-sm font-medium rounded-xl hover:bg-violet-600/30 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Ver estado actualizado
          </button>
        </div>
      )}
    </div>
  )
}
