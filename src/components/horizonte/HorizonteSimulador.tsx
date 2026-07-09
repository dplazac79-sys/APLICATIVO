'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Shield, BarChart3, CheckCircle2,
  Zap, Target, Building2, AlertCircle, XCircle, Flame,
  ArrowRight, Brain, RefreshCw, Sparkles, Clock
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
  if (n >= 1_000_000_000) return `$${Math.round(n / 1_000_000_000).toLocaleString('es-CL')} mil millones`
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000).toLocaleString('es-CL')} millones`
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString('es-CL')} mil`
  return `$${n.toLocaleString('es-CL')}`
}

const TIPO_LABEL: Record<string, string> = {
  sipoc: 'SIPOC', as_is: 'AS-IS', bpmn: 'BPMN',
  raci: 'RACI', riesgo_control: 'Riesgos', kpi_sla: 'KPI & SLA',
  diagnostico: 'Diagnóstico', to_be: 'TO-BE',
}

// ── Glass card ────────────────────────────────────────────────────────────────

function Card({ children, className = '', accent = '' }: {
  children: React.ReactNode; className?: string; accent?: string
}) {
  return (
    <div className={`rounded-2xl border bg-white/[0.04] backdrop-blur-xl ${accent || 'border-white/8'} ${className}`}>
      {children}
    </div>
  )
}

// ── Número animado ────────────────────────────────────────────────────────────

function AnimNum({ target, active, suffix = '', prefix = '', duration = 1800 }: {
  target: number; active: boolean; suffix?: string; prefix?: string; duration?: number
}) {
  const val = useAnimatedNumber(target, active, duration)
  return <>{prefix}{val.toLocaleString('es-CL')}{suffix}</>
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingState() {
  const steps = [
    { label: 'Leyendo análisis del proceso', icon: '📋' },
    { label: 'Calculando impacto operacional', icon: '⚙️' },
    { label: 'Proyectando retorno financiero', icon: '📈' },
    { label: 'Evaluando riesgo de no actuar', icon: '⚠️' },
    { label: 'Generando proyección completa', icon: '✦' },
  ]
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <Card className="px-8 py-16 overflow-hidden relative">
      {/* Fondo animado */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-violet-600/8 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative flex flex-col items-center gap-10 max-w-md mx-auto text-center">

        {/* Orbe central */}
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          {/* Anillos giratorios */}
          <div className="absolute inset-0 rounded-full border border-indigo-500/20"
            style={{ animation: 'spin 8s linear infinite' }} />
          <div className="absolute inset-2 rounded-full border border-violet-500/15"
            style={{ animation: 'spin 6s linear infinite reverse' }} />
          <div className="absolute inset-4 rounded-full border border-indigo-400/10"
            style={{ animation: 'spin 4s linear infinite' }} />

          {/* Puntos orbitales */}
          <div className="absolute inset-0" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          </div>
          <div className="absolute inset-0" style={{ animation: 'spin 6s linear infinite reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.8)]" />
          </div>

          {/* Centro */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/30 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center backdrop-blur-sm shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <span className="text-2xl" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
              {steps[step].icon}
            </span>
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-3 w-full">
          <p className="text-white font-bold text-xl tracking-tight">Proyectando con IA</p>
          <p key={step} className="text-slate-400 text-sm" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {steps[step].label}…
          </p>

          {/* Progress steps */}
          <div className="flex items-center gap-2 justify-center pt-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`transition-all duration-500 rounded-full flex items-center justify-center
                  ${i < step ? 'w-5 h-5 bg-indigo-500/30 border border-indigo-500/50' :
                    i === step ? 'w-6 h-6 bg-indigo-500/20 border border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' :
                    'w-3 h-3 bg-white/5 border border-white/10'}`}>
                  {i < step && <span className="text-[8px] text-indigo-400">✓</span>}
                  {i === step && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-px w-4 transition-all duration-500 ${i < step ? 'bg-indigo-500/40' : 'bg-white/8'}`} />
                )}
              </div>
            ))}
          </div>

          <p className="text-slate-600 text-xs">Esto puede tomar hasta 30 segundos</p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Card>
  )
}

// ── Resultado ─────────────────────────────────────────────────────────────────

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(Math.round((value / max) * 100)), 200); return () => clearTimeout(t) }, [value, max])
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} style={{ width: `${w}%` }} />
    </div>
  )
}

function Resultado({ sim }: { sim: SimulacionResult }) {
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 80) }, [])

  const ahorro = useAnimatedNumber(sim.ahorro_anual_clp, show, 2000)
  const costo = useAnimatedNumber(sim.sin_implementacion?.costo_inaccion_anual_clp ?? 0, show, 2000)

  return (
    <div className={`space-y-4 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>

      {/* ── SCORE HERO ── */}
      <Card accent="border-indigo-500/15" className="overflow-hidden">
        <div className="relative px-7 py-6">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-violet-600/5 pointer-events-none" />
          <div className="relative flex items-center gap-6">
            {/* Score ring */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: 100, height: 100 }}>
              <svg width="100" height="100" className="-rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="url(#scoreGrad)" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${show ? (sim.impacto_global_score / 100) * 2 * Math.PI * 40 : 0} ${2 * Math.PI * 40}`}
                  style={{ transition: 'stroke-dasharray 1.8s cubic-bezier(0.4,0,0.2,1)' }} />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-white tabular-nums">{sim.impacto_global_score}</span>
                <span className="text-[9px] text-slate-600 uppercase tracking-widest">/ 100</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-widest font-medium ${sim.nivel_confianza === 'alto' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
                  Confianza {sim.nivel_confianza}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 uppercase tracking-widest">Proyección IA</span>
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">{sim.headline}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{sim.subtitulo}</p>
            </div>
          </div>
        </div>

        {/* Métricas en barra inferior */}
        <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
          {[
            { label: 'Ahorro anual', value: formatCLP(ahorro), sub: 'si se implementa', color: 'text-emerald-300' },
            { label: 'Reducción tiempo', value: `${sim.reduccion_tiempo_porcentaje}%`, sub: 'menos tiempo operativo', color: 'text-violet-300' },
            { label: 'ROI', value: `${sim.roi_meses} meses`, sub: 'retorno de inversión', color: 'text-amber-300' },
            { label: 'Horas liberadas', value: `${sim.empleados_liberados_horas_mes}h/mes`, sub: 'capacidad recuperada', color: 'text-indigo-300' },
          ].map((m, i) => (
            <div key={i} className="px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-1">{m.label}</p>
              <p className={`text-lg font-black tabular-nums ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── NARRATIVA — pull quote ── */}
      <Card className="px-7 py-6 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 via-violet-500 to-indigo-500/0 rounded-full" />
        <div className="flex items-start gap-4">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Visión de transformación</p>
            <p className="text-slate-200 text-sm leading-relaxed font-light">{sim.transformacion_narrativa}</p>
          </div>
        </div>
      </Card>

      {/* ── DOS CAMINOS LADO A LADO ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* SI IMPLEMENTA */}
        <Card accent="border-emerald-500/15" className="overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-emerald-500/8 bg-gradient-to-br from-emerald-500/6 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-medium">Si se implementa</p>
            </div>
            <p className="text-3xl font-black text-white tabular-nums">{formatCLP(ahorro)}</p>
            <p className="text-xs text-slate-500 mt-0.5">ahorro anual estimado</p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Errores eliminados</span><span className="text-emerald-400">{sim.reduccion_errores_porcentaje}%</span>
              </div>
              <ProgressBar value={sim.reduccion_errores_porcentaje} color="bg-emerald-500/60" />
            </div>
          </div>
          <ul className="p-4 space-y-2.5">
            {sim.despues.slice(0, 4).map((d, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-300">{d}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* SI NO IMPLEMENTA */}
        <Card accent="border-rose-500/15" className="overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-rose-500/8 bg-gradient-to-br from-rose-500/6 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <p className="text-[10px] uppercase tracking-widest text-rose-400/80 font-medium">Si no se actúa</p>
            </div>
            <p className="text-3xl font-black text-rose-400 tabular-nums">{formatCLP(costo)}</p>
            <p className="text-xs text-slate-500 mt-0.5">costo de inacción / año</p>
            {sim.sin_implementacion?.deterioro_en_meses && (
              <div className="mt-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-rose-500/60" />
                <span className="text-[11px] text-rose-400/70">Situación crítica en <strong className="text-rose-400">{sim.sin_implementacion.deterioro_en_meses} meses</strong></span>
              </div>
            )}
          </div>
          <ul className="p-4 space-y-2.5">
            {(sim.sin_implementacion?.consecuencias ?? []).slice(0, 4).map((c, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <XCircle className="w-3.5 h-3.5 text-rose-500/70 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400">{c}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── COMPETITIVIDAD ALERT ── */}
      {sim.sin_implementacion?.competitividad && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-rose-500/15 bg-gradient-to-r from-rose-500/5 to-transparent">
          <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-300 leading-relaxed">{sim.sin_implementacion.competitividad}</p>
        </div>
      )}

      {/* ── KPIs — tabla visual ── */}
      {sim.kpis_proyectados.filter(k => k.nombre).length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-white/5">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">KPIs proyectados</p>
          </div>
          <div className="divide-y divide-white/5">
            {sim.kpis_proyectados.filter(k => k.nombre).map((kpi, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-4 hover:bg-white/[0.015] transition-colors">
                <p className="text-sm text-slate-300">{kpi.nombre}</p>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-500 tabular-nums">{kpi.antes}</p>
                  <p className="text-[9px] text-slate-700 uppercase tracking-wider">Actual</p>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-500/50" />
                <div className="text-right min-w-[60px]">
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">{kpi.despues}</p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-wider">{kpi.unidad}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ROADMAP horizontal ── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-4 h-4 text-violet-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Roadmap de implementación</p>
        </div>
        <div className="relative">
          {/* Línea conectora */}
          <div className="absolute top-[18px] left-4 right-4 h-px bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-transparent" />
          <div className="grid grid-cols-4 gap-3 relative">
            {sim.hitos.map((h, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <div className="w-9 h-9 rounded-full border-2 border-indigo-500/40 bg-[#0a0a15] flex items-center justify-center z-10 shrink-0 shadow-[0_0_12px_rgba(99,102,241,0.15)]">
                  <span className="text-[10px] font-black text-indigo-400">{h.mes}</span>
                </div>
                <p className="text-[10px] text-indigo-400/60 font-mono">MES {h.mes}</p>
                <p className="text-xs font-semibold text-white leading-tight">{h.titulo}</p>
                {h.descripcion && <p className="text-[10px] text-slate-600 leading-relaxed">{h.descripcion}</p>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── QUICK WINS ── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Quick Wins — acciones con impacto inmediato</p>
        </div>
        <div className="space-y-2.5">
          {sim.quick_wins.filter(q => q.titulo).map((qw, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3.5 hover:bg-white/[0.04] transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${qw.impacto === 'alto' ? 'bg-amber-500/15 border border-amber-500/25 text-amber-400' : 'bg-white/5 border border-white/8 text-slate-500'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-0.5">
                  <p className="text-sm font-semibold text-white">{qw.titulo}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {qw.impacto === 'alto' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">alto impacto</span>}
                    <span className="text-[10px] text-slate-600 font-mono">{qw.plazo_dias}d</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{qw.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── RIESGOS + IMPACTO ORG ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-rose-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Riesgos eliminados</p>
          </div>
          <ul className="space-y-2.5">
            {sim.riesgos_mitigados.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-400/60 mt-0.5 shrink-0" />{r}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-sky-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Impacto organizacional</p>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{sim.impacto_organizacional}</p>
        </Card>
      </div>

      {/* ── RIESGOS QUE ESCALAN ── */}
      {(sim.sin_implementacion?.riesgos_escalados ?? []).filter(Boolean).length > 0 && (
        <Card accent="border-amber-500/10" className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Riesgos que se agravan si no se actúa</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sim.sin_implementacion.riesgos_escalados.filter(Boolean).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500/50 mt-0.5 shrink-0" />{r}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── NOTA DEL CONSULTOR ── */}
      {sim.nota_consultor && (
        <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-amber-500/15 bg-amber-500/[0.04]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200/80 leading-relaxed">
            <strong className="text-amber-300">Criterio clave: </strong>{sim.nota_consultor}
          </p>
        </div>
      )}
    </div>
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
  const [procesoId, setProcesoId] = useState('')
  const [artefactoIds, setArtefactoIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [sim, setSim] = useState<SimulacionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const procesoActual = procesos.find(p => p.id === procesoId)
  const artefactos = artefactosPorProceso[procesoId] ?? []

  useEffect(() => {
    setArtefactoIds(artefactos.map(a => a.id))
    setSim(null)
    setError(null)
  }, [procesoId])

  function toggleArtefacto(id: string) {
    setArtefactoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function proyectar() {
    if (!procesoId) return
    setLoading(true); setSim(null); setError(null)
    try {
      const res = await fetch('/api/horizonte/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: procesoId, artefacto_ids: artefactoIds }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Error al proyectar')
      }
      // Consumir stream token a token
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      if (accumulated.startsWith('__ERROR__:')) {
        throw new Error(accumulated.replace('__ERROR__:', ''))
      }
      const jsonMatch = accumulated.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Respuesta inválida de la IA. Intenta de nuevo.')
      setSim(JSON.parse(jsonMatch[0]) as SimulacionResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Fondo */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] bg-indigo-600/7 rounded-full blur-[130px]" />
        <div className="absolute bottom-[15%] right-[5%] w-[400px] h-[400px] bg-violet-600/7 rounded-full blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto pb-20 space-y-6">

        {/* ── HEADER ── */}
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
          {sim && (
            <button onClick={() => { setSim(null); setError(null) }}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-2 px-3 py-2 rounded-xl border border-white/8 hover:border-white/20">
              <RefreshCw className="w-3.5 h-3.5" /> Nueva proyección
            </button>
          )}
        </div>

        {/* ── EXPLICACIÓN DEL MÓDULO — visible siempre ── */}
        {!sim && !loading && (
          <div className="grid grid-cols-2 gap-4">
            <Card accent="border-emerald-500/12" className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-white">Si se implementa</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                La IA proyecta el ahorro financiero, reducción de tiempos, mejora de KPIs y el roadmap de implementación específico para este proceso en tu organización.
              </p>
            </Card>
            <Card accent="border-rose-500/12" className="p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                </div>
                <p className="text-sm font-semibold text-white">Si no se actúa</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                También verás el costo de la inacción: qué riesgos se agravan, cuánto pierde la organización por año y en cuántos meses la situación se vuelve crítica.
              </p>
            </Card>
          </div>
        )}

        {/* ── PANEL DE SELECCIÓN ── */}
        {!sim && (
          <Card className="p-6 space-y-5">
            {/* Selector de proceso */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Proceso a proyectar</p>
              <div className="relative">
                {procesoActual && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg pointer-events-none">
                    {procesoActual.codigo}
                  </span>
                )}
                <select
                  value={procesoId}
                  onChange={e => setProcesoId(e.target.value)}
                  className={`w-full appearance-none ${procesoActual ? 'pl-16' : 'pl-5'} pr-10 py-4 rounded-2xl border border-white/10 bg-[#0f0f1a] text-sm cursor-pointer hover:border-indigo-500/30 focus:outline-none focus:border-indigo-500/50 transition-all ${procesoId ? 'text-white' : 'text-slate-500'}`}
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="" disabled className="bg-[#0f0f1a] text-slate-500">Elige el proceso a proyectar…</option>
                  {procesos.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#0f0f1a] text-white">
                      {p.codigo} — {p.nombre}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Artefactos */}
            {artefactos.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">Documentos del proceso a incluir</p>
                  <p className="text-[10px] text-slate-600">{artefactoIds.length} de {artefactos.length}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {artefactos.map(a => (
                    <button key={a.id} onClick={() => toggleArtefacto(a.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${artefactoIds.includes(a.id)
                        ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
                        : 'border-white/8 text-slate-500 hover:text-slate-400 hover:border-white/15'}`}>
                      {TIPO_LABEL[a.tipo] ?? a.tipo} v{a.version}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <button onClick={proyectar} disabled={!procesoId || loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all
                bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                text-white shadow-[0_0_30px_rgba(99,102,241,0.18)] hover:shadow-[0_0_45px_rgba(99,102,241,0.30)]
                disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.99]">
              <Brain className="w-4 h-4" />
              {procesoActual
                ? `Proyectar impacto de ${procesoActual.codigo} con IA`
                : 'Proyectar impacto con IA'}
            </button>
          </Card>
        )}

        {/* Estados */}
        {loading && <LoadingState />}

        {error && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {sim && !loading && <Resultado sim={sim} />}

      </div>
    </div>
  )
}
