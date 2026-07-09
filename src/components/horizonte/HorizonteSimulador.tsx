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

function Resultado({ sim }: { sim: SimulacionResult }) {
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 80) }, [])

  const ahorro = useAnimatedNumber(sim.ahorro_anual_clp, show, 2000)
  const costo = useAnimatedNumber(sim.sin_implementacion?.costo_inaccion_anual_clp ?? 0, show, 2000)

  return (
    <div className={`space-y-5 transition-all duration-700 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>

      {/* ── SCORE + HEADLINE ── */}
      <Card accent="border-indigo-500/15" className="p-7">
        <div className="flex items-start gap-5">
          {/* Ring */}
          <div className="relative shrink-0 flex items-center justify-center" style={{ width: 112, height: 112 }}>
            <svg width="112" height="112" className="-rotate-90">
              <circle cx="56" cy="56" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
              <circle cx="56" cy="56" r="44" fill="none" stroke="url(#rg)" strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(sim.impacto_global_score / 100) * 2 * Math.PI * 44} ${2 * Math.PI * 44}`}
                style={{ transition: 'stroke-dasharray 2s ease-out' }} />
              <defs>
                <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white">{sim.impacto_global_score}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">/ 100</span>
            </div>
          </div>

          <div className="flex-1 pt-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <span className={`text-[10px] px-2.5 py-1 rounded-full border uppercase tracking-widest font-medium ${sim.nivel_confianza === 'alto' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
                Confianza {sim.nivel_confianza}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/8 text-indigo-400 uppercase tracking-widest">
                Proyección IA
              </span>
            </div>
            <p className="text-[10px] text-slate-600">Índice de impacto potencial: qué tan significativa es la mejora para tu organización (0–100)</p>
            <h2 className="text-xl font-bold text-white leading-snug">{sim.headline}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{sim.subtitulo}</p>
          </div>
        </div>
      </Card>

      {/* ── DOS CAMINOS: implementar vs no implementar ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* SI IMPLEMENTA */}
        <Card accent="border-emerald-500/15" className="overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-emerald-500/10 bg-emerald-500/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-medium">Si se implementa</p>
            </div>
            <p className="text-2xl font-black text-white">{formatCLP(ahorro)}</p>
            <p className="text-xs text-slate-500 mt-0.5">ahorro anual estimado</p>
          </div>
          <ul className="p-4 space-y-2.5">
            {sim.despues.slice(0, 4).map((d, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </Card>

        {/* SI NO IMPLEMENTA */}
        <Card accent="border-rose-500/15" className="overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-rose-500/10 bg-rose-500/[0.04]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <p className="text-[10px] uppercase tracking-widest text-rose-400/80 font-medium">Si no se actúa</p>
            </div>
            <p className="text-2xl font-black text-rose-400">{formatCLP(costo)}</p>
            <p className="text-xs text-slate-500 mt-0.5">costo de inacción / año</p>
          </div>
          <ul className="p-4 space-y-2.5">
            {(sim.sin_implementacion?.consecuencias ?? []).slice(0, 4).map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-400">
                <XCircle className="w-3.5 h-3.5 text-rose-500/70 mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ── ALERTA INACCIÓN ── */}
      {sim.sin_implementacion?.deterioro_en_meses && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05]">
          <Flame className="w-4 h-4 text-rose-400 shrink-0" />
          <p className="text-sm text-slate-300">
            Sin acción, la situación se vuelve <strong className="text-rose-300">crítica en {sim.sin_implementacion.deterioro_en_meses} meses.</strong>{' '}
            <span className="text-slate-400">{sim.sin_implementacion.competitividad}</span>
          </p>
        </div>
      )}

      {/* ── MÉTRICAS BENTO ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Reducción de tiempo', value: sim.reduccion_tiempo_porcentaje, suffix: '%', color: 'text-violet-300', bg: 'border-violet-500/15' },
          { label: 'Reducción de errores', value: sim.reduccion_errores_porcentaje, suffix: '%', color: 'text-emerald-300', bg: 'border-emerald-500/15' },
          { label: 'ROI en', value: sim.roi_meses, suffix: ' meses', color: 'text-amber-300', bg: 'border-amber-500/15' },
          { label: 'Horas/mes liberadas', value: sim.empleados_liberados_horas_mes, suffix: 'h', color: 'text-indigo-300', bg: 'border-indigo-500/15' },
        ].map((m, i) => (
          <Card key={i} accent={m.bg} className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{m.label}</p>
            <p className={`text-2xl font-black ${m.color} tabular-nums`}>
              <AnimNum target={m.value} active={show} suffix={m.suffix} />
            </p>
          </Card>
        ))}
      </div>

      {/* ── NARRATIVA ── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Visión de transformación</p>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">{sim.transformacion_narrativa}</p>
      </Card>

      {/* ── KPIs ── */}
      {sim.kpis_proyectados.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">KPIs proyectados</p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {sim.kpis_proyectados.map((kpi, i) => (
              <div key={i} className="space-y-2">
                <p className="text-xs text-slate-400">{kpi.nombre}</p>
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[44px]">
                    <p className="text-base font-bold text-slate-500 tabular-nums">{kpi.antes}</p>
                    <p className="text-[9px] text-slate-600 uppercase">Actual</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <div className="text-center min-w-[44px]">
                    <p className="text-base font-bold text-emerald-400 tabular-nums">{kpi.despues}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{kpi.unidad}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ROADMAP ── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-4 h-4 text-violet-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Roadmap de implementación</p>
        </div>
        <div className="relative">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500/30 to-transparent" />
          <div className="space-y-5">
            {sim.hitos.map((h, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500/50 bg-[#0a0a12] flex items-center justify-center shrink-0 mt-0.5">
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
      </Card>

      {/* ── QUICK WINS ── */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-amber-400" />
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Quick Wins — acciones inmediatas</p>
        </div>
        <div className="space-y-3">
          {sim.quick_wins.map((qw, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${qw.impacto === 'alto' ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-slate-500'}`}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-white">{qw.titulo}</p>
                  <span className="text-[10px] text-slate-600 font-mono shrink-0">{qw.plazo_dias}d</span>
                </div>
                <p className="text-xs text-slate-400">{qw.descripcion}</p>
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
          <ul className="space-y-2">
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
          <p className="text-xs text-slate-400 leading-relaxed">{sim.impacto_organizacional}</p>
        </Card>
      </div>

      {/* ── RIESGOS QUE ESCALAN (si no implementa) ── */}
      {(sim.sin_implementacion?.riesgos_escalados ?? []).length > 0 && (
        <Card accent="border-rose-500/10" className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Riesgos que se agravan si no se actúa</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {sim.sin_implementacion.riesgos_escalados.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400 rounded-xl border border-rose-500/10 bg-rose-500/[0.03] px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500/60 mt-0.5 shrink-0" />{r}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── NOTA DEL CONSULTOR ── */}
      {sim.nota_consultor && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <strong className="text-amber-300">Nota del consultor: </strong>{sim.nota_consultor}
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al proyectar')
      setSim(data.simulacion)
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
