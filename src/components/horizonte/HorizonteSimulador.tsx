'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, TrendingUp, Shield, Clock, BarChart3,
  RefreshCw, ChevronDown, ArrowRight, CheckCircle2,
  Zap, Target, Building2, AlertCircle, XCircle,
  TrendingDown, Flame, ChevronRight, Brain
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Proceso { id: string; nombre: string; codigo: string }
interface Artefacto { id: string; tipo: string; version: number }

interface SinImplementacion {
  headline: string
  costo_inaccion_anual_clp: number
  deterioro_en_meses: number
  consecuencias: string[]
  riesgos_escalados: string[]
  competitividad: string
}

interface SimulacionResult {
  impacto_global_score: number
  ahorro_anual_clp: number
  reduccion_tiempo_porcentaje: number
  reduccion_errores_porcentaje: number
  roi_meses: number
  empleados_liberados_horas_mes: number
  headline: string
  subtitulo: string
  transformacion_narrativa: string
  situacion_actual: string
  antes: string[]
  despues: string[]
  quick_wins: Array<{ titulo: string; descripcion: string; plazo_dias: number; impacto: string }>
  hitos: Array<{ mes: number; titulo: string; descripcion: string }>
  riesgos_mitigados: string[]
  kpis_proyectados: Array<{ nombre: string; antes: string; despues: string; unidad: string }>
  impacto_organizacional: string
  nivel_confianza: string
  nota_consultor: string
  sin_implementacion: SinImplementacion
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function useAnimatedNumber(target: number, active: boolean, duration = 1800) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) { setVal(0); return }
    let frame = 0
    const steps = 60
    const inc = target / steps
    const timer = setInterval(() => {
      frame++
      if (frame >= steps) { setVal(target); clearInterval(timer) }
      else setVal(Math.round(inc * frame))
    }, duration / steps)
    return () => clearInterval(timer)
  }, [target, active, duration])
  return val
}

function formatCLP(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

const TIPO_LABEL: Record<string, string> = {
  sipoc: 'SIPOC', as_is: 'AS-IS', bpmn: 'BPMN',
  raci: 'RACI', riesgo_control: 'Riesgos', kpi_sla: 'KPI & SLA',
  diagnostico: 'Diagnóstico', to_be: 'TO-BE',
}

// ── Primitivos visuales ───────────────────────────────────────────────────────

function GlassCard({ children, className = '', glow = '', overflow = 'hidden' }: {
  children: React.ReactNode; className?: string; glow?: string; overflow?: 'hidden' | 'visible'
}) {
  return (
    <div className={`relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-${overflow} ${glow} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function ScoreRing({ score, active, color = 'indigo' }: { score: number; active: boolean; color?: string }) {
  const animated = useAnimatedNumber(score, active, 2000)
  const r = 54
  const circ = 2 * Math.PI * r
  const progress = (animated / 100) * circ
  const gradId = `scoreGrad-${color}`

  const gradColors: Record<string, [string, string]> = {
    indigo: ['#818cf8', '#a78bfa'],
    rose: ['#f43f5e', '#fb7185'],
  }
  const [c1, c2] = gradColors[color] ?? gradColors.indigo

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${progress} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.8s ease-out' }} />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white tracking-tight">{animated}</span>
        <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Score</span>
      </div>
    </div>
  )
}

function StatChip({ label, value, suffix, color }: { label: string; value: number; suffix: string; color: string; }) {
  const colors: Record<string, string> = {
    violet: 'from-violet-500/15 border-violet-500/20 text-violet-300',
    emerald: 'from-emerald-500/15 border-emerald-500/20 text-emerald-300',
    amber: 'from-amber-500/15 border-amber-500/20 text-amber-300',
    indigo: 'from-indigo-500/15 border-indigo-500/20 text-indigo-300',
    rose: 'from-rose-500/15 border-rose-500/20 text-rose-300',
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-transparent p-4 ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-black text-white tabular-nums">{value}{suffix}</p>
    </div>
  )
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState() {
  const steps = [
    'Leyendo análisis del proceso…',
    'Calculando impacto operacional…',
    'Proyectando ROI financiero…',
    'Evaluando riesgo de inacción…',
    'Generando simulación completa…',
  ]
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <GlassCard className="py-20">
      <div className="flex flex-col items-center gap-8">
        <div className="relative w-28 h-28">
          <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
          <div className="absolute inset-3 rounded-full border border-violet-500/30 animate-ping" style={{ animationDelay: '0.4s' }} />
          <div className="absolute inset-6 rounded-full border border-blue-500/40 animate-ping" style={{ animationDelay: '0.8s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-10 h-10 text-indigo-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-white font-semibold text-lg">Simulando con IA</p>
          <div className="h-5">
            <p key={step} className="text-slate-400 text-sm animate-pulse">{steps[step]}</p>
          </div>
          <div className="flex gap-1.5 justify-center mt-2">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-indigo-500 w-6' : 'bg-white/10 w-3'}`} />
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ── Selector dropdown ─────────────────────────────────────────────────────────

function ProcesoSelector({ procesos, value, onChange }: {
  procesos: Proceso[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const selected = procesos.find(p => p.id === value)

  // Cerrar al hacer click fuera — escucha en el documento
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    // mousedown para capturar antes del click de las opciones
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Cerrar al hacer scroll
  useEffect(() => {
    if (!open) return
    const handle = () => setOpen(false)
    window.addEventListener('scroll', handle, true)
    return () => window.removeEventListener('scroll', handle, true)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  const dropStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    top: rect.bottom + 6,
    left: rect.left,
    width: rect.width,
    zIndex: 9999,
    maxHeight: 280,
    overflowY: 'auto',
  } : {}

  return (
    <div>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-white/10 bg-white/[0.04] text-left hover:border-indigo-500/40 hover:bg-white/[0.07] transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          {selected ? (
            <>
              <span className="text-xs font-mono font-bold text-indigo-400 shrink-0 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                {selected.codigo}
              </span>
              <span className="text-sm text-white truncate">{selected.nombre}</span>
            </>
          ) : (
            <span className="text-sm text-slate-500">Selecciona un proceso…</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && rect && (
        <div ref={listRef} style={dropStyle} className="rounded-2xl border border-white/10 bg-[#0c0c14] shadow-2xl">
          {procesos.map((p, i) => (
            <button
              key={p.id}
              onMouseDown={e => e.preventDefault()} // evita que click-outside dispare antes
              onClick={() => { onChange(p.id); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.06] ${p.id === value ? 'bg-indigo-500/10' : ''} ${i > 0 ? 'border-t border-white/[0.04]' : ''}`}
            >
              <span className={`text-xs font-mono font-bold shrink-0 px-2 py-0.5 rounded-lg border ${p.id === value ? 'text-indigo-300 bg-indigo-500/20 border-indigo-500/30' : 'text-slate-500 bg-white/[0.03] border-white/10'}`}>
                {p.codigo}
              </span>
              <span className={`text-sm truncate ${p.id === value ? 'text-white font-medium' : 'text-slate-400'}`}>{p.nombre}</span>
              {p.id === value && <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sección Sin Implementación ────────────────────────────────────────────────

function SinImplementacionCard({ data, show }: { data: SinImplementacion; show: boolean }) {
  const costo = useAnimatedNumber(data.costo_inaccion_anual_clp, show, 2000)

  return (
    <GlassCard className="overflow-hidden" glow="shadow-[0_0_60px_rgba(244,63,94,0.08)]">
      {/* Header con gradiente rojo */}
      <div className="relative px-6 pt-6 pb-5 border-b border-rose-500/10">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.08] to-transparent" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-rose-400/70 mb-1">Si no se implementa</p>
            <h3 className="text-lg font-bold text-white leading-tight">{data.headline}</h3>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Costo de inacción/año</p>
            <p className="text-2xl font-black text-rose-400 tabular-nums">{formatCLP(costo)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Alerta de tiempo */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <Flame className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300">
            La situación se vuelve <strong>crítica en {data.deterioro_en_meses} meses</strong> sin intervención.
          </p>
        </div>

        {/* Consecuencias */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Consecuencias de no actuar</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.consecuencias.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl border border-rose-500/10 bg-rose-500/[0.04] px-3.5 py-2.5">
                <XCircle className="w-3.5 h-3.5 text-rose-500/70 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{c}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Riesgos que escalan + competitividad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Riesgos que se agravan</p>
            <ul className="space-y-1.5">
              {data.riesgos_escalados.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Impacto competitivo</p>
            <p className="text-xs text-slate-400 leading-relaxed">{data.competitividad}</p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

// ── Resultado principal ───────────────────────────────────────────────────────

function ResultadoSimulacion({ sim }: { sim: SimulacionResult }) {
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 80) }, [])
  const ahorro = useAnimatedNumber(sim.ahorro_anual_clp, show, 2200)
  const tiempoAnm = useAnimatedNumber(sim.reduccion_tiempo_porcentaje, show)
  const erroresAnm = useAnimatedNumber(sim.reduccion_errores_porcentaje, show)
  const roiAnm = useAnimatedNumber(sim.roi_meses, show)
  const horasAnm = useAnimatedNumber(sim.empleados_liberados_horas_mes, show)

  return (
    <div className={`space-y-4 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* Hero — score + headline */}
      <GlassCard glow="shadow-[0_0_80px_rgba(99,102,241,0.12)]" className="p-8">
        <div className="flex items-start gap-6">
          <ScoreRing score={sim.impacto_global_score} active={show} />
          <div className="flex-1 space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] px-2.5 py-1 rounded-full border uppercase tracking-widest font-medium ${sim.nivel_confianza === 'alto' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-400'}`}>
                Confianza {sim.nivel_confianza}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 uppercase tracking-widest">
                Proyección IA
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{sim.headline}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{sim.subtitulo}</p>
          </div>
        </div>
      </GlassCard>

      {/* Métricas bento grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <GlassCard className="p-5 col-span-2 md:col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Ahorro anual estimado</p>
          <p className="text-4xl font-black text-white tabular-nums">{formatCLP(ahorro)}</p>
          <p className="text-slate-500 text-xs mt-1">CLP / año</p>
        </GlassCard>
        <StatChip label="Reducción de tiempo" value={tiempoAnm} suffix="%" color="violet" />
        <StatChip label="Reducción de errores" value={erroresAnm} suffix="%" color="emerald" />
        <StatChip label="ROI en" value={roiAnm} suffix=" meses" color="amber" />
        <StatChip label="Horas/mes liberadas" value={horasAnm} suffix="h" color="indigo" />
        <GlassCard className="p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Riesgos mitigados</p>
          <p className="text-4xl font-black text-rose-400">{sim.riesgos_mitigados.length}</p>
          <p className="text-slate-500 text-xs mt-1">identificados</p>
        </GlassCard>
      </div>

      {/* Narrativa */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Visión de transformación</p>
        </div>
        <p className="text-slate-200 leading-relaxed text-sm">{sim.transformacion_narrativa}</p>
      </GlassCard>

      {/* Antes vs Después — comparativa visual */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Situación actual</p>
          </div>
          <ul className="space-y-2.5">
            {sim.antes.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                <XCircle className="w-3.5 h-3.5 text-rose-500/60 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Con implementación</p>
          </div>
          <ul className="space-y-2.5">
            {sim.despues.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* ── SECCIÓN SI NO SE IMPLEMENTA ── */}
      {sim.sin_implementacion && (
        <SinImplementacionCard data={sim.sin_implementacion} show={show} />
      )}

      {/* KPIs proyectados */}
      {sim.kpis_proyectados.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-400">KPIs proyectados</p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {sim.kpis_proyectados.map((kpi, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs text-slate-400 font-medium">{kpi.nombre}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[48px]">
                    <p className="text-lg font-bold text-slate-500 tabular-nums">{kpi.antes}</p>
                    <p className="text-[9px] text-slate-600 uppercase">Actual</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="text-center min-w-[48px]">
                    <p className="text-lg font-bold text-emerald-400 tabular-nums">{kpi.despues}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{kpi.unidad}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Roadmap de hitos */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-4 h-4 text-violet-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Roadmap de implementación</p>
        </div>
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/20 to-transparent" />
          <div className="space-y-5">
            {sim.hitos.map((h, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-500/60 bg-slate-950 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-indigo-400 font-mono">MES {h.mes}</span>
                    <span className="text-sm font-semibold text-white">{h.titulo}</span>
                  </div>
                  <p className="text-xs text-slate-500">{h.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Quick wins */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4 text-amber-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Quick Wins — acciones inmediatas</p>
        </div>
        <div className="grid gap-3">
          {sim.quick_wins.map((qw, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${qw.impacto === 'alto' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{qw.titulo}</p>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">{qw.plazo_dias}d</span>
                </div>
                <p className="text-xs text-slate-400">{qw.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Riesgos mitigados + impacto org */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-rose-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Riesgos eliminados</p>
          </div>
          <ul className="space-y-2">
            {sim.riesgos_mitigados.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-400/70 mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-sky-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Impacto organizacional</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{sim.impacto_organizacional}</p>
        </GlassCard>
      </div>

      {/* Nota del consultor */}
      {sim.nota_consultor && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed"><strong className="text-amber-300">Nota del consultor:</strong> {sim.nota_consultor}</p>
        </div>
      )}
    </div>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────────────

function EmptyState({ procesoNombre }: { procesoNombre: string }) {
  return (
    <GlassCard className="py-16 px-8">
      <div className="flex flex-col items-center text-center gap-5 max-w-md mx-auto">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center">
            <Brain className="w-9 h-9 text-indigo-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 border-2 border-slate-950 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-white font-semibold text-lg">Listo para analizar</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            {procesoNombre
              ? `Presiona "Analizar con IA" para simular el impacto de implementar `
              : 'Selecciona un proceso y presiona "Analizar con IA" para comenzar.'}
            {procesoNombre && <strong className="text-white">{procesoNombre}</strong>}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full mt-2">
          {['Impacto financiero', 'Riesgos mitigados', 'Roadmap'].map((label, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  procesos: Proceso[]
  artefactosPorProceso: Record<string, Artefacto[]>
  proyectoNombre: string
  clienteNombre: string
  industria?: string
}

export default function HorizonteSimulador({ procesos, artefactosPorProceso, proyectoNombre, clienteNombre }: Props) {
  const [procesoId, setProcesoId] = useState(procesos[0]?.id ?? '')
  const [artefactoIds, setArtefactoIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [simulacion, setSimulacion] = useState<SimulacionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const procesoActual = procesos.find(p => p.id === procesoId)
  const artefactos = artefactosPorProceso[procesoId] ?? []

  useEffect(() => {
    const presel = artefactos
      .filter(a => ['to_be', 'kpi_sla', 'as_is', 'diagnostico', 'riesgo_control'].includes(a.tipo))
      .map(a => a.id)
    setArtefactoIds(presel)
    setSimulacion(null)
    setError(null)
  }, [procesoId])

  function toggleArtefacto(id: string) {
    setArtefactoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function simular() {
    if (!procesoId) return
    setLoading(true)
    setSimulacion(null)
    setError(null)
    try {
      const res = await fetch('/api/horizonte/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: procesoId, artefacto_ids: artefactoIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al simular')
      setSimulacion(data.simulacion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Orbes de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-[15%] right-[5%] w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-[55%] left-[35%] w-[350px] h-[350px] bg-blue-600/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6 pb-20">

        {/* Header */}
        <div className="pt-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Simulación de transformación</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Horizonte de Impacto</h1>
            <p className="text-slate-500 text-sm mt-1">{clienteNombre} · {proyectoNombre}</p>
          </div>
          {simulacion && (
            <button
              onClick={() => { setSimulacion(null); setError(null) }}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-2 px-3 py-2 rounded-xl border border-white/10 hover:border-white/20"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Nueva simulación
            </button>
          )}
        </div>

        {/* Panel de selección */}
        <GlassCard className="p-6" overflow="visible">
          <div className="space-y-5">
            {/* Proceso selector */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Proceso a simular</p>
              <ProcesoSelector procesos={procesos} value={procesoId} onChange={setProcesoId} />
            </div>

            {/* Artefactos chips */}
            {artefactos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Artefactos a incluir en el análisis</p>
                  <p className="text-[10px] text-slate-600">{artefactoIds.length} seleccionados</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {artefactos.map(a => (
                    <button
                      key={a.id}
                      onClick={() => toggleArtefacto(a.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        artefactoIds.includes(a.id)
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-400'
                      }`}
                    >
                      {TIPO_LABEL[a.tipo] ?? a.tipo} v{a.version}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={simular}
              disabled={!procesoId || loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all
                bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                text-white shadow-[0_0_30px_rgba(99,102,241,0.2)] hover:shadow-[0_0_50px_rgba(99,102,241,0.35)]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.99]"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Analizando con IA…</>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Analizar con IA
                  {procesoActual && <span className="opacity-60">— {procesoActual.codigo}</span>}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </button>
          </div>
        </GlassCard>

        {/* Estados */}
        {loading && <LoadingState />}

        {error && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {simulacion && !loading && <ResultadoSimulacion sim={simulacion} />}

        {!simulacion && !loading && !error && (
          <EmptyState procesoNombre={procesoActual?.nombre ?? ''} />
        )}

      </div>
    </div>
  )
}
