'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Zap, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  proyectos: { id: string; nombre: string }[]
  variant?: 'top' | 'bottom'  // top = compacto header, bottom = banner ancho
}

const ETAPAS = [
  'Leyendo documentos analizados del proyecto...',
  'Identificando macroprocesos de la cadena de valor...',
  'Cruzando evidencia documental contra el framework AICOUNTS...',
  'Detectando procesos ausentes y puntos ciegos...',
  'Evaluando criticidad, riesgos y KPIs por proceso...',
  'Construyendo roadmap de transformación...',
  'Redactando recomendación para el CEO...',
]

export default function DiscoveryAcciones({ proyectos, variant = 'top' }: Props) {
  const [proyectoId, setProyectoId] = useState(proyectos[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [etapaIdx, setEtapaIdx] = useState(0)
  const [segundos, setSegundos] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const etapaTimerRef = useRef<NodeJS.Timeout | null>(null)
  const segundosTimerRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const proyectoSeleccionado = proyectos.find(p => p.id === proyectoId)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function limpiarTimers() {
    if (pollRef.current) clearInterval(pollRef.current)
    if (etapaTimerRef.current) clearInterval(etapaTimerRef.current)
    if (segundosTimerRef.current) clearInterval(segundosTimerRef.current)
  }

  useEffect(() => () => limpiarTimers(), [])

  async function ejecutarDiscovery() {
    if (!proyectoId) return
    setCargando(true)
    setEtapaIdx(0)
    setSegundos(0)

    etapaTimerRef.current = setInterval(() => {
      setEtapaIdx(i => (i < ETAPAS.length - 1 ? i + 1 : i))
    }, 8000)
    segundosTimerRef.current = setInterval(() => setSegundos(s => s + 1), 1000)

    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/discovery`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al iniciar discovery')

      const jobId = data.job_id
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/jobs/${jobId}`)
        const d = await r.json()
        if (!r.ok) return
        if (d.job.estado === 'listo') {
          limpiarTimers()
          toast.success('Discovery AI completado — inventario de procesos generado')
          window.location.reload()
        } else if (d.job.estado === 'error') {
          limpiarTimers()
          toast.error(d.job.error_mensaje ?? 'Error al generar el inventario de procesos')
          setCargando(false)
        }
      }, 3000)
    } catch (err) {
      limpiarTimers()
      toast.error(err instanceof Error ? err.message : 'Error inesperado al iniciar Discovery')
      setCargando(false)
    }
  }

  // Estado cargando — igual para ambas variantes
  if (cargando) {
    const mins = Math.floor(segundos / 60)
    const secs = segundos % 60
    return (
      <div className={`space-y-2 py-1 ${variant === 'bottom' ? 'w-full' : 'w-full max-w-md'}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-violet-300 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {ETAPAS[etapaIdx]}
          </span>
          <span className="text-xs text-slate-500 font-mono">{mins}:{secs.toString().padStart(2, '0')}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-400 animate-pulse" />
        </div>
        <p className="text-slate-600 text-xs">Análisis exhaustivo en curso · puede tardar 1-3 minutos · puedes navegar a otra sección y volver</p>
      </div>
    )
  }

  // ── Variante top (compacta, en el header) ──
  if (variant === 'top') {
    return (
      <div className="flex items-center gap-2 shrink-0">
        {/* Selector de proyecto custom */}
        {proyectos.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-sm text-slate-200 transition-all min-w-[160px] max-w-[220px]"
            >
              <span className="flex-1 text-left truncate">{proyectoSeleccionado?.nombre ?? 'Proyecto'}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-2 z-50 min-w-[240px] bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                <div className="p-1.5 space-y-0.5">
                  {proyectos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setProyectoId(p.id); setOpen(false) }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                        p.id === proyectoId
                          ? 'bg-violet-600/20 text-violet-300 font-medium'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{p.nombre}</span>
                      {p.id === proyectoId && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={ejecutarDiscovery}
          disabled={!proyectoId}
          className="flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Zap className="w-4 h-4" />
          Ejecutar Discovery AI
        </button>
      </div>
    )
  }

  // ── Variante bottom (banner ancho, al final del listado) ──
  return (
    <div className="bg-gradient-to-r from-violet-900/30 via-indigo-900/20 to-slate-900 border border-violet-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <p className="text-white font-semibold text-sm">¿Faltan procesos o quieres actualizar el inventario?</p>
          <p className="text-slate-400 text-xs">Vuelve a ejecutar Discovery AI para re-analizar los documentos y regenerar el inventario completo.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {proyectos.length > 1 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm text-slate-200 transition-all min-w-[150px]"
              >
                <span className="flex-1 text-left truncate">{proyectoSeleccionado?.nombre ?? 'Proyecto'}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="absolute right-0 bottom-full mb-2 z-50 min-w-[220px] bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                  <div className="p-1.5 space-y-0.5">
                    {proyectos.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setProyectoId(p.id); setOpen(false) }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                          p.id === proyectoId
                            ? 'bg-violet-600/20 text-violet-300 font-medium'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        <span className="truncate">{p.nombre}</span>
                        {p.id === proyectoId && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={ejecutarDiscovery}
            disabled={!proyectoId}
            className="flex items-center gap-2 h-9 px-5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-900/40 disabled:opacity-40"
          >
            <Zap className="w-4 h-4" />
            Ejecutar Discovery AI
          </button>
        </div>
      </div>
    </div>
  )
}
