'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, TrendingUp, Shield, Clock, BarChart3,
  Play, RefreshCw, ChevronDown, ArrowRight, CheckCircle2,
  Zap, Target, Building2, AlertCircle, Star
} from 'lucide-react'

// ── Tipos ───────────────────────────────────────────────────────────────────

interface Proceso {
  id: string
  nombre: string
  codigo?: string | null
}

interface Artefacto {
  id: string
  tipo: string
  version: number
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
}

// ── Hooks ───────────────────────────────────────────────────────────────────

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
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// ── Componentes de UI ────────────────────────────────────────────────────────

function GlassCard({ children, className = '', glow = '' }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div className={`relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl overflow-hidden ${glow} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function ScoreRing({ score, active }: { score: number; active: boolean }) {
  const animated = useAnimatedNumber(score, active, 2000)
  const r = 54
  const circ = 2 * Math.PI * r
  const progress = (animated / 100) * circ

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke="url(#scoreGrad)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circ}`}
          style={{ transition: 'stroke-dasharray 1.8s ease-out' }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#a78bfa" />
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

function MetricPill({ label, value, sub, color = 'indigo', active }: {
  label: string; value: number; sub: string; color?: string; active: boolean
}) {
  const animated = useAnimatedNumber(value, active)
  const colors: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20 text-indigo-300',
    violet: 'from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-300',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-300',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-300',
    rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/20 text-rose-300',
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-black text-white">{animated}{sub}</p>
    </div>
  )
}

function LoadingOrbs() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-violet-500/50 animate-ping" style={{ animationDelay: '0.3s' }} />
        <div className="absolute inset-4 rounded-full border-2 border-blue-500/70 animate-ping" style={{ animationDelay: '0.6s' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-white font-semibold">Analizando con IA</p>
        <p className="text-slate-500 text-sm">Simulando el impacto de implementación…</p>
      </div>
    </div>
  )
}

// ── Selector elegante ────────────────────────────────────────────────────────

function ElegantSelect({ label, options, value, onChange, placeholder }: {
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className="space-y-1.5" ref={ref}>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm text-left hover:border-indigo-500/40 hover:bg-white/[0.07] transition-all"
        >
          <span className={`text-sm truncate ${selected ? 'text-white' : 'text-slate-500'}`}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 ${opt.value === value ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
            {options.length === 0 && (
              <p className="px-4 py-3 text-slate-500 text-sm">Sin opciones disponibles</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Resultado ────────────────────────────────────────────────────────────────

function ResultadoSimulacion({ sim }: { sim: SimulacionResult }) {
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 100) }, [])

  const ahorro = useAnimatedNumber(sim.ahorro_anual_clp, show, 2200)

  return (
    <div className={`space-y-5 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

      {/* Headline */}
      <GlassCard glow="shadow-[0_0_60px_rgba(99,102,241,0.12)]" className="p-8">
        <div className="flex items-start gap-6">
          <ScoreRing score={sim.impacto_global_score} active={show} />
          <div className="flex-1 space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-widest ${sim.nivel_confianza === 'alto' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/40 bg-amber-500/10 text-amber-400'}`}>
                Confianza {sim.nivel_confianza}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">{sim.headline}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{sim.subtitulo}</p>
          </div>
        </div>
      </GlassCard>

      {/* Métricas bento */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <GlassCard className="p-5 col-span-2 md:col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Ahorro anual estimado</p>
          <p className="text-4xl font-black text-white">{formatCLP(ahorro)}</p>
          <p className="text-slate-500 text-xs mt-1">CLP / año</p>
        </GlassCard>
        <MetricPill label="Reducción de tiempo" value={sim.reduccion_tiempo_porcentaje} sub="%" color="violet" active={show} />
        <MetricPill label="Reducción de errores" value={sim.reduccion_errores_porcentaje} sub="%" color="emerald" active={show} />
        <MetricPill label="ROI en" value={sim.roi_meses} sub=" meses" color="amber" active={show} />
        <MetricPill label="Horas/mes liberadas" value={sim.empleados_liberados_horas_mes} sub="h" color="indigo" active={show} />
        <GlassCard className="p-5">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Riesgos mitigados</p>
          <p className="text-4xl font-black text-rose-400">{sim.riesgos_mitigados.length}</p>
          <p className="text-slate-500 text-xs mt-1">identificados</p>
        </GlassCard>
      </div>

      {/* Narrativa */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-indigo-400" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Visión de transformación</p>
        </div>
        <p className="text-slate-200 leading-relaxed text-sm">{sim.transformacion_narrativa}</p>
      </GlassCard>

      {/* Antes vs Después */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-rose-400" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Situación actual</p>
          </div>
          <ul className="space-y-2.5">
            {sim.antes.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
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

      {/* KPIs proyectados */}
      {sim.kpis_proyectados.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <p className="text-xs uppercase tracking-widest text-slate-400">KPIs proyectados</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {sim.kpis_proyectados.map((kpi, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs text-slate-400 font-medium">{kpi.nombre}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-500">{kpi.antes}</p>
                    <p className="text-[9px] text-slate-600 uppercase">Actual</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-400">{kpi.despues}</p>
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
          <p className="text-xs uppercase tracking-widest text-slate-400">Roadmap de implementación</p>
        </div>
        <div className="relative">
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/40 via-violet-500/20 to-transparent" />
          <div className="space-y-5">
            {sim.hitos.map((h, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-500/60 bg-slate-950 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  </div>
                </div>
                <div className="pb-1">
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
          <p className="text-xs uppercase tracking-widest text-slate-400">Quick Wins — acciones inmediatas</p>
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
                  <span className="text-[10px] text-slate-500 shrink-0">{qw.plazo_dias}d</span>
                </div>
                <p className="text-xs text-slate-400">{qw.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Riesgos mitigados + Impacto org */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-rose-400" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Riesgos eliminados</p>
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
            <p className="text-xs uppercase tracking-widest text-slate-400">Impacto organizacional</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{sim.impacto_organizacional}</p>
        </GlassCard>
      </div>

      {/* Nota del consultor */}
      {sim.nota_consultor && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">{sim.nota_consultor}</p>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

interface Props {
  procesos: Proceso[]
  artefactosPorProceso: Record<string, Artefacto[]>
  proyectoNombre: string
  clienteNombre: string
}

export default function HorizonteSimulador({ procesos, artefactosPorProceso, proyectoNombre, clienteNombre }: Props) {
  const [procesoId, setProcesoId] = useState(procesos[0]?.id ?? '')
  const [artefactoIds, setArtefactoIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [simulacion, setSimulacion] = useState<SimulacionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const artefactos = artefactosPorProceso[procesoId] ?? []

  useEffect(() => {
    // Al cambiar proceso, preseleccionar TO-BE y KPI-SLA si existen
    const presel = artefactos
      .filter(a => ['tobe', 'kpi_sla', 'as_is'].includes(a.tipo))
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
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const TIPO_LABEL: Record<string, string> = {
    as_is: 'AS-IS', tobe: 'TO-BE', bpmn: 'BPMN',
    kpi_sla: 'KPI & SLA', analisis_brechas: 'Brechas',
    plan_comunicacion: 'Comunicación', raci: 'RACI',
  }

  return (
    <div className="min-h-screen relative">
      {/* Orbes de fondo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-[60%] left-[40%] w-[300px] h-[300px] bg-blue-600/8 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-8 pb-16">

        {/* Header */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Simulación de transformación</p>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Horizonte de Impacto</h1>
          <p className="text-slate-500 text-sm mt-1">
            {clienteNombre} · {proyectoNombre}
          </p>
        </div>

        {/* Selector */}
        <GlassCard className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <ElegantSelect
              label="Proceso a simular"
              value={procesoId}
              onChange={setProcesoId}
              placeholder="Selecciona un proceso"
              options={procesos.map(p => ({ value: p.id, label: p.nombre }))}
            />
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Artefactos a incluir</p>
              <div className="flex flex-wrap gap-2">
                {artefactos.length === 0 && (
                  <span className="text-xs text-slate-600 italic">Sin artefactos disponibles</span>
                )}
                {artefactos.map(a => (
                  <button
                    key={a.id}
                    onClick={() => toggleArtefacto(a.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      artefactoIds.includes(a.id)
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                        : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-400'
                    }`}
                  >
                    {TIPO_LABEL[a.tipo] ?? a.tipo} v{a.version}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={simular}
            disabled={!procesoId || loading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all
              bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
              text-white shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:shadow-[0_0_40px_rgba(99,102,241,0.35)]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Simulando con IA…</>
              : <><Play className="w-4 h-4" /> Simular impacto de implementación</>
            }
          </button>
        </GlassCard>

        {/* Estado de carga */}
        {loading && <GlassCard><LoadingOrbs /></GlassCard>}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Resultado */}
        {simulacion && !loading && <ResultadoSimulacion sim={simulacion} />}

        {/* Estado vacío */}
        {!simulacion && !loading && !error && (
          <GlassCard className="py-20">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <TrendingUp className="w-7 h-7 text-indigo-400" />
              </div>
              <p className="text-white font-semibold">Selecciona un proceso y simula</p>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                La IA analizará el proceso, los artefactos y proyectará el impacto real en tu organización si se implementa.
              </p>
            </div>
          </GlassCard>
        )}

      </div>
    </div>
  )
}
