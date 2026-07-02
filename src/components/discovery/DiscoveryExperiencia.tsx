'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Brain, Sparkles, ChevronDown, ChevronUp, CheckCircle, XCircle,
  Clock, Zap, Target, AlertTriangle, TrendingUp, Users, ArrowRight,
  Activity, Shield, BarChart3, Cpu, Layers, FileText, AlertCircle, Lock,
  Edit2, Save, X, RefreshCw
} from 'lucide-react'
import { GlosarioRoles } from '@/app/(platform)/portal/GlosarioRoles'
import DiscoveryAcciones from './DiscoveryAcciones'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Proceso {
  id: string
  nombre: string
  descripcion: string | null
  nivel: number
  estado_oferta: 'propuesto' | 'aceptado' | 'rechazado'
  origen: string
  roles_involucrados: string[]
  riesgos_detectados: string[]
  metadata_ia: Record<string, unknown> | null
}

interface ProcesoConHijos extends Proceso {
  hijos: Proceso[]
}

interface Resumen {
  diagnostico: string
  estado_salud: 'critico' | 'en_riesgo' | 'estable' | 'optimizado'
  impacto_negocio: string
  quick_win: string
  potencial_automatizacion: 'alto' | 'medio' | 'bajo'
  siguiente_paso: string
}

interface DocumentoItem {
  id: string
  nombre_archivo: string
  tipo: string | null
  estado_procesamiento: string
  clasificacion: Record<string, unknown> | null
  created_at: string
}

interface Props {
  proyectoId: string
  nombreProyecto: string
  clienteNombre: string | null
  macroprocesos: ProcesoConHijos[]
  totalProcesos: number
  aceptados: number
  pendientes: number
  rechazados: number
  procesosDetectados: number
  procesosPropeustosIA: number
  resumenDiscovery: Record<string, unknown> | null
  rolesDetectados: Array<{ rol: string; descripcion: string; procesos: string[] }>
  proyectosParaAcciones: { id: string; nombre: string }[]
  documentos: DocumentoItem[]
}

// ─── Config visual ────────────────────────────────────────────────────────────

const SALUD_CONFIG = {
  critico:    { label: 'Crítico',    color: 'text-red-400',    bg: 'bg-red-950/60',    border: 'border-red-700/60',    bar: 'bg-red-500',    dot: 'bg-red-400' },
  en_riesgo:  { label: 'En riesgo',  color: 'text-amber-400',  bg: 'bg-amber-950/60',  border: 'border-amber-700/60',  bar: 'bg-amber-500',  dot: 'bg-amber-400' },
  estable:    { label: 'Estable',    color: 'text-blue-400',   bg: 'bg-blue-950/60',   border: 'border-blue-700/60',   bar: 'bg-blue-500',   dot: 'bg-blue-400' },
  optimizado: { label: 'Optimizado', color: 'text-emerald-400',bg: 'bg-emerald-950/60',border: 'border-emerald-700/60',bar: 'bg-emerald-500',dot: 'bg-emerald-400' },
}

const AUTOMATIZACION_CONFIG = {
  alto:  { label: 'Alto', color: 'text-violet-400', icon: '⚡' },
  medio: { label: 'Medio', color: 'text-blue-400', icon: '🔧' },
  bajo:  { label: 'Bajo', color: 'text-slate-400', icon: '📋' },
}

const CRITICIDAD_CONFIG: Record<string, { label: string; color: string; bg: string; accent: string }> = {
  critica: { label: 'Crítica', color: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/50',    accent: 'bg-red-500' },
  alta:    { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800/50', accent: 'bg-orange-500' },
  media:   { label: 'Media',   color: 'text-amber-400',  bg: 'bg-amber-950/40 border-amber-800/50',  accent: 'bg-amber-500' },
  baja:    { label: 'Baja',    color: 'text-slate-400',  bg: 'bg-slate-800/40 border-slate-700/50',  accent: 'bg-slate-500' },
}

// ─── ProcesoCard ─────────────────────────────────────────────────────────────

function ProcesoCard({ proceso, esHijo = false }: { proceso: ProcesoConHijos; esHijo?: boolean }) {
  const [expandido, setExpandido] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [aprobando, setAprobando] = useState(false)
  const [estadoLocal, setEstadoLocal] = useState(proceso.estado_oferta)

  // Inline edit state
  const [editando, setEditando] = useState(false)
  const [editNombre, setEditNombre] = useState(proceso.nombre)
  const [editDesc, setEditDesc] = useState(proceso.descripcion ?? '')
  const [guardando, setGuardando] = useState(false)

  // Proyección IA
  type Proyeccion = {
    estado_actual: { diagnostico: string; nivel_madurez: number; principales_fricciones: string[]; costo_ineficiencia_estimado: string }
    mejoras_propuestas: Array<{ id: string; titulo: string; descripcion: string; impacto: string; esfuerzo: string; tipo: string; plazo_semanas: number; valor_estimado: string }>
    escenarios: { conservador: { descripcion: string; ahorro_estimado: string; probabilidad: number }; base: { descripcion: string; ahorro_estimado: string; probabilidad: number }; optimista: { descripcion: string; ahorro_estimado: string; probabilidad: number } }
    roadmap_90_dias: Array<{ semana: string; accion: string; responsable: string; entregable: string }>
    proyeccion_kpis: Array<{ kpi: string; valor_actual: string; valor_6_meses: string; valor_12_meses: string; unidad: string }>
    recomendacion_ejecutiva: string
    nivel_confianza: number
  }
  const proyeccionGuardada = (proceso.metadata_ia as any)?.proyeccion_ia as Proyeccion | undefined
  const [proyeccion, setProyeccion] = useState<Proyeccion | null>(proyeccionGuardada ?? null)
  const [proyectando, setProyectando] = useState(false)
  const [tabProyeccion, setTabProyeccion] = useState<'mejoras' | 'escenarios' | 'roadmap' | 'kpis'>('mejoras')

  async function generarProyeccion() {
    if (proyectando) return
    setProyectando(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/proyectar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.proyeccion) setProyeccion(data.proyeccion)
    } catch { /* silent */ }
    finally { setProyectando(false) }
  }

  const meta = proceso.metadata_ia
  const criticidad = meta?.criticidad as string | undefined
  const critCfg = criticidad ? CRITICIDAD_CONFIG[criticidad] : null
  const saludCfg = resumen ? SALUD_CONFIG[resumen.estado_salud] ?? SALUD_CONFIG.estable : null

  const accentColor = critCfg?.accent ?? 'bg-violet-500'

  async function analizarConIA() {
    if (analizando) return
    setExpandido(true)
    if (resumen) return
    setAnalizando(true)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (data.resumen) setResumen(data.resumen)
    } catch { /* silent */ }
    finally { setAnalizando(false) }
  }

  async function reanalizarConIA() {
    setResumen(null)
    setAnalizando(true)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (data.resumen) setResumen(data.resumen)
    } catch { /* silent */ }
    finally { setAnalizando(false) }
  }

  async function cambiarEstado(nuevoEstado: 'aceptado' | 'rechazado') {
    setAprobando(true)
    try {
      await fetch(`/api/procesos/${proceso.id}/revisar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_oferta: nuevoEstado }),
      })
      setEstadoLocal(nuevoEstado)
    } catch { /* silent */ }
    finally { setAprobando(false) }
  }

  async function guardarEdicion() {
    setGuardando(true)
    try {
      await fetch(`/api/procesos/${proceso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editNombre, descripcion: editDesc }),
      })
      setEditando(false)
    } catch { /* silent */ }
    finally { setGuardando(false) }
  }

  const estadoIcon = estadoLocal === 'aceptado'
    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
    : estadoLocal === 'rechazado'
    ? <XCircle className="w-4 h-4 text-red-400" />
    : <Clock className="w-4 h-4 text-amber-400" />

  const tieneHijos = (proceso.hijos?.length ?? 0) > 0

  if (esHijo) {
    const meta = proceso.metadata_ia as any
    const docCode = meta?.documento_referencia ? (meta.documento_referencia as string).replace(/\.[^.]+$/, '') : null
    const riesgos: string[] = proceso.riesgos_detectados ?? []
    const oportunidades: string[] = meta?.oportunidades_mejora ?? []
    const automatizacion: string[] = meta?.oportunidades_automatizacion ?? []
    const kpis: string[] = meta?.kpis_recomendados ?? []
    const benchmark: string | null = meta?.benchmark_industria ?? null
    const evidencia: string | null = meta?.evidencia_documento ?? null
    const justificacion: string | null = meta?.justificacion_ia ?? null

    const borderColor = estadoLocal === 'aceptado' ? 'border-emerald-700/50' :
      estadoLocal === 'rechazado' ? 'border-red-800/40' :
      proceso.origen === 'propuesta_ia' ? 'border-violet-700/50' : 'border-slate-700/50'

    const accentBar = estadoLocal === 'aceptado' ? 'bg-emerald-500' :
      estadoLocal === 'rechazado' ? 'bg-red-600' :
      critCfg?.accent ?? 'bg-slate-600'

    return (
      <div
        id={proceso.origen === 'propuesta_ia' ? `proceso-propuesta-ia-${proceso.id}` : undefined}
        className={`relative rounded-xl border transition-all duration-300 overflow-hidden ${borderColor} ${
          estadoLocal === 'rechazado' ? 'opacity-50' : ''
        } ${expandido ? 'bg-slate-900/70' : 'bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer'}`}
        onClick={() => !expandido && setExpandido(true)}
      >
        {/* Accent left bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentBar}`} />

        {/* ── Collapsed header (always visible) ── */}
        <div className="pl-3 pr-4 py-3.5 flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            estadoLocal === 'aceptado' ? 'bg-emerald-900/50 text-emerald-400' :
            estadoLocal === 'rechazado' ? 'bg-red-900/30 text-red-400' :
            'bg-slate-800 text-slate-400'
          }`}>
            {estadoIcon}
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            {docCode && (
              <span className="text-xs font-bold font-mono text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">{docCode}</span>
            )}
            <p className="text-white text-sm font-semibold leading-snug">{proceso.nombre}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {estadoLocal === 'aceptado' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><CheckCircle className="w-3.5 h-3.5" /> Aceptado</span>
            )}
            {estadoLocal === 'rechazado' && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><XCircle className="w-3.5 h-3.5" /> Rechazado</span>
            )}
            {proceso.origen === 'propuesta_ia' ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-700/50 font-medium">✨ IA</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/50 text-blue-300 border border-blue-800/40 font-medium">📄 Detectado</span>
            )}
            {expandido
              ? <ChevronUp className="w-4 h-4 text-slate-500 cursor-pointer" onClick={e => { e.stopPropagation(); setExpandido(false) }} />
              : <ChevronDown className="w-4 h-4 text-slate-500" />
            }
          </div>
        </div>

        {/* ── Expanded detail panel ── */}
        {expandido && (
          <div className="border-t border-slate-700/40" onClick={e => e.stopPropagation()}>

            {/* ── Sección 1: Qué es este proceso ── */}
            <div className="px-5 pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">¿Qué es este proceso?</span>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">{proceso.descripcion}</p>

              {/* Evidencia o justificación */}
              {evidencia && (
                <div className="rounded-lg bg-blue-950/30 border border-blue-800/30 p-3 flex items-start gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-blue-300 text-xs font-semibold mb-0.5">Evidencia en documento {docCode}</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{evidencia}</p>
                  </div>
                </div>
              )}
              {proceso.origen === 'propuesta_ia' && justificacion && (
                <div className="rounded-lg bg-violet-950/30 border border-violet-800/30 p-3 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-violet-300 text-xs font-semibold mb-0.5">¿Por qué debería existir?</p>
                    <p className="text-slate-300 text-xs leading-relaxed">{justificacion}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sección 2: Criticidad + Roles ── */}
            <div className="px-5 pb-4 grid grid-cols-2 gap-3">
              {/* Criticidad */}
              {critCfg && (
                <div className={`rounded-xl border p-3 space-y-1 ${critCfg.bg}`}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Criticidad</p>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${critCfg.color}`} />
                    <span className={`text-sm font-bold ${critCfg.color}`}>{critCfg.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {critCfg.label === 'Crítica' ? 'Su falla detiene o daña el negocio' :
                     critCfg.label === 'Alta' ? 'Genera costos o riesgos significativos' :
                     critCfg.label === 'Media' ? 'Oportunidad relevante no urgente' :
                     'Mejora deseable a largo plazo'}
                  </p>
                </div>
              )}
              {/* Roles */}
              {proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Roles involucrados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {proceso.roles_involucrados.map(r => (
                      <span key={r} className="flex items-center gap-1 text-xs bg-slate-700/60 text-slate-300 border border-slate-600/40 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3" />{r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Sección 3: Riesgos ── */}
            {riesgos.length > 0 && (
              <div className="px-5 pb-4">
                <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-widest">Riesgos si falla o no existe</span>
                  </div>
                  {riesgos.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-slate-300 leading-snug">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sección 4: Oportunidades + Automatización en grid ── */}
            {(oportunidades.length > 0 || automatizacion.length > 0) && (
              <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                {oportunidades.length > 0 && (
                  <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Mejoras</span>
                    </div>
                    {oportunidades.map((o, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-slate-300 leading-snug">{o}</p>
                      </div>
                    ))}
                  </div>
                )}
                {automatizacion.length > 0 && (
                  <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Automatización</span>
                    </div>
                    {automatizacion.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <p className="text-xs text-slate-300 leading-snug">{a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Sección 5: KPIs ── */}
            {kpis.length > 0 && (
              <div className="px-5 pb-4">
                <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">KPIs recomendados</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {kpis.map((k, i) => (
                      <span key={i} className="text-xs bg-amber-950/40 text-amber-300 border border-amber-800/40 px-2 py-1 rounded-lg">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Sección 6: Benchmark ── */}
            {benchmark && (
              <div className="px-5 pb-4">
                <div className="rounded-xl border border-slate-600/30 bg-slate-800/20 p-3 flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Benchmark industria</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{benchmark}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Sección 7: Análisis IA ── */}
            <div className="px-5 pb-4">
              <div className="rounded-xl border border-violet-800/30 bg-violet-950/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-semibold text-violet-300 uppercase tracking-widest">Diagnóstico IA</span>
                  </div>
                  {resumen && (
                    <button onClick={reanalizarConIA} disabled={analizando} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-300 transition-colors">
                      <RefreshCw className="w-3 h-3" /> Re-analizar
                    </button>
                  )}
                </div>
                {analizando && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-4 h-4 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin shrink-0" />
                    <span className="text-violet-300 text-xs">Analizando en profundidad...</span>
                  </div>
                )}
                {!analizando && !resumen && (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-slate-500 text-xs">Obtén un diagnóstico ejecutivo con criticidad, estado actual y próximo paso recomendado.</p>
                    <button onClick={analizarConIA} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 mx-auto transition-all">
                      <Sparkles className="w-3.5 h-3.5" /> Analizar con IA
                    </button>
                  </div>
                )}
                {resumen && saludCfg && (
                  <div className={`rounded-lg border p-3 space-y-2 ${saludCfg.bg} ${saludCfg.border}`}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${saludCfg.color} bg-slate-900/60 border border-current/20`}>{saludCfg.label}</span>
                    <p className="text-slate-200 text-sm leading-relaxed">{resumen.diagnostico}</p>
                    {resumen.siguiente_paso && (
                      <div className="flex items-start gap-2 pt-1 border-t border-slate-700/40">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-indigo-300"><span className="font-semibold">Siguiente paso:</span> {resumen.siguiente_paso}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Sección 8: Decisión ── */}
            <div className="px-5 pb-5">
              <div className={`rounded-xl border p-4 space-y-3 ${
                estadoLocal === 'aceptado' ? 'bg-emerald-950/20 border-emerald-700/40' :
                estadoLocal === 'rechazado' ? 'bg-red-950/20 border-red-800/40' :
                'bg-slate-800/30 border-slate-700/40'
              }`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tu decisión sobre este proceso</p>

                {estadoLocal === 'propuesto' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => cambiarEstado('aceptado')}
                      disabled={aprobando}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40"
                    >
                      <CheckCircle className="w-4 h-4" /> Aceptar proceso
                    </button>
                    <button
                      onClick={() => cambiarEstado('rechazado')}
                      disabled={aprobando}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-red-900/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                )}

                {estadoLocal === 'aceptado' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-bold">Proceso aceptado — forma parte del inventario oficial</span>
                    </div>
                    <button
                      onClick={() => cambiarEstado('rechazado')}
                      disabled={aprobando}
                      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                    >
                      Deshacer y rechazar
                    </button>
                  </div>
                )}

                {estadoLocal === 'rechazado' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle className="w-5 h-5" />
                      <span className="text-sm font-bold">Proceso rechazado — la consultora revisará</span>
                    </div>
                    <button
                      onClick={() => setEstadoLocal('propuesto' as any)}
                      disabled={aprobando}
                      className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      Deshacer y volver a propuesto
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    )
  }

  // ── Full enterprise card (macroproceso container) ──
  return (
    <div className="group relative rounded-2xl border transition-all duration-300 overflow-hidden bg-slate-900/80 border-violet-800/40 hover:border-violet-700/60">

      {/* Left accent bar by criticidad */}
      {critCfg && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      )}

      <div className={critCfg ? 'pl-4' : ''}>
        {/* Header — click to toggle expanded */}
        <div
          className="p-5 cursor-pointer select-none"
          onClick={() => !editando && setExpandido(v => !v)}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-900/40 text-violet-300">
              <Layers className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-violet-400 font-semibold uppercase tracking-widest">Macroproceso</span>
                    {critCfg && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${critCfg.bg} ${critCfg.color}`}>
                        {critCfg.label}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold text-base leading-snug">{editNombre || proceso.nombre}</h3>
                  {proceso.descripcion && (
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">{editDesc || proceso.descripcion}</p>
                  )}
                </div>
              </div>

              {/* Roles as pills */}
              {proceso.roles_involucrados?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  <Users className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                  {proceso.roles_involucrados.map(r => (
                    <span key={r} className="text-xs text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{r}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Expand chevron */}
            <div className="shrink-0 mt-1 text-slate-500 group-hover:text-slate-300 transition-colors">
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {/* Actions row — stop propagation so clicks don't toggle card */}
          <div
            className="flex items-center gap-2 mt-4 flex-wrap"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={analizarConIA}
              disabled={analizando}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                resumen
                  ? 'bg-violet-700/30 text-violet-300 border border-violet-700/50 hover:bg-violet-700/40'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-900/40'
              } disabled:opacity-50`}
            >
              {analizando ? (
                <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />Analizando...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" />{resumen ? 'Ver diagnóstico IA' : 'Analizar con IA'}</>
              )}
            </button>


            {/* Edit toggle */}
            <button
              onClick={() => { setEditando(v => !v); setExpandido(true) }}
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-violet-300 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Editar
            </button>

            {tieneHijos && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Layers className="w-3.5 h-3.5" />
                {proceso.hijos.length} proceso{proceso.hijos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Expanded panel ── */}
        {expandido && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-800/60 pt-4">

            {/* Section A: Diagnóstico IA */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Diagnóstico IA</span>
                </div>
                {resumen && (
                  <button
                    onClick={reanalizarConIA}
                    disabled={analizando}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" /> Volver a analizar
                  </button>
                )}
              </div>

              {analizando && (
                <div className="rounded-xl bg-violet-950/30 border border-violet-800/40 p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 border border-violet-600/40 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="absolute inset-0 rounded-full border border-violet-500/30 animate-ping" />
                    </div>
                    <div>
                      <p className="text-violet-300 text-sm font-medium">IA analizando proceso...</p>
                      <p className="text-slate-500 text-xs">Evaluando criticidad, riesgos y oportunidades</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {['Leyendo contexto del proceso', 'Evaluando riesgos operacionales', 'Identificando quick wins', 'Calculando potencial de automatización'].map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                        <span className="text-xs text-slate-500">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!analizando && !resumen && (
                <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center">
                  <p className="text-slate-500 text-xs">Presiona "Analizar con IA" para obtener el diagnóstico completo de este {esHijo ? 'proceso' : 'macroproceso'}.</p>
                </div>
              )}

              {resumen && saludCfg && (
                <div className={`rounded-xl border p-5 space-y-4 ${saludCfg.bg} ${saludCfg.border}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">AICOUNTS Intelligence</span>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${saludCfg.color} bg-slate-900/60 border border-current/20`}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: 'currentColor' }} />
                      {saludCfg.label}
                    </span>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">{resumen.diagnostico}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resumen.impacto_negocio && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Impacto al negocio</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{resumen.impacto_negocio}</p>
                      </div>
                    )}
                    {resumen.quick_win && (
                      <div className="bg-slate-900/60 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="text-xs text-yellow-400 font-semibold uppercase tracking-wider">Quick Win · 30 días</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed">{resumen.quick_win}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-3 flex-wrap">
                    {resumen.potencial_automatizacion && (
                      <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
                        <Cpu className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs text-slate-400">Automatización:</span>
                        <span className={`text-xs font-bold ${AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.color ?? 'text-slate-300'}`}>
                          {AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.icon} {AUTOMATIZACION_CONFIG[resumen.potencial_automatizacion]?.label}
                        </span>
                      </div>
                    )}
                    {resumen.siguiente_paso && (
                      <div className="flex-1 flex items-start gap-2 bg-slate-900/60 rounded-lg px-3 py-2 min-w-[200px]">
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-300 leading-relaxed"><span className="text-indigo-400 font-medium">Siguiente:</span> {resumen.siguiente_paso}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Riesgos detectados */}
            {proceso.riesgos_detectados?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Riesgos detectados</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {proceso.riesgos_detectados.map((r, i) => (
                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      i < 2 ? 'bg-red-950/40 text-red-300 border-red-900/50' : 'bg-amber-950/40 text-amber-300 border-amber-900/50'
                    }`}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section C: Editar proceso */}
            {editando && (
              <div className="rounded-xl bg-slate-800/40 border border-violet-700/30 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Edit2 className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Editar proceso</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Nombre</label>
                    <input
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-600 transition-colors resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={guardarEdicion}
                    disabled={guardando}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50"
                  >
                    {guardando ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => { setEditando(false); setEditNombre(proceso.nombre); setEditDesc(proceso.descripcion ?? '') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Section D: Procesos dentro del macroproceso */}
            {tieneHijos && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Procesos ({proceso.hijos.length})</span>
                  <span className="text-slate-600 text-xs">— Acepta o rechaza cada uno</span>
                </div>
                <div className="space-y-2 pl-4 border-l border-slate-700/50">
                  {proceso.hijos.map((hijo) => (
                    <ProcesoCard key={hijo.id} proceso={hijo as ProcesoConHijos} esHijo />
                  ))}
                </div>
              </div>
            )}

            {/* Section E: Proyecciones IA */}
            {!esHijo && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-violet-400 text-xs font-semibold uppercase tracking-widest">Proyecciones e Impacto</span>
                  </div>
                  {!proyeccion && (
                    <button
                      onClick={generarProyeccion}
                      disabled={proyectando}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 border border-violet-500/40 text-violet-300 text-xs font-medium rounded-lg hover:bg-violet-600/30 transition-all disabled:opacity-50"
                    >
                      {proyectando ? <><span className="w-3 h-3 border border-violet-400/40 border-t-violet-300 rounded-full animate-spin" />Analizando...</> : <><Zap className="w-3 h-3" />Generar proyección</>}
                    </button>
                  )}
                  {proyeccion && (
                    <button onClick={generarProyeccion} disabled={proyectando} className="text-xs text-slate-500 hover:text-violet-400 transition-colors flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Actualizar
                    </button>
                  )}
                </div>

                {!proyeccion && !proyectando && (
                  <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center space-y-2">
                    <p className="text-slate-400 text-xs">Genera una proyección estratégica con escenarios, mejoras priorizadas, roadmap y proyección de KPIs a 12 meses.</p>
                  </div>
                )}

                {proyectando && (
                  <div className="rounded-xl bg-violet-950/20 border border-violet-800/30 p-4 space-y-2">
                    {['Diagnosticando estado actual...', 'Modelando escenarios de mejora...', 'Construyendo roadmap 90 días...', 'Proyectando KPIs a 12 meses...'].map((msg, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                        <span className="text-xs text-slate-400">{msg}</span>
                      </div>
                    ))}
                  </div>
                )}

                {proyeccion && (
                  <div className="space-y-3">
                    {/* Diagnóstico actual */}
                    <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 p-3 space-y-1.5">
                      <p className="text-xs text-slate-400 leading-relaxed">{proyeccion.estado_actual.diagnostico}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-slate-500">Madurez: <span className="text-white font-semibold">Nivel {proyeccion.estado_actual.nivel_madurez}/5</span></span>
                        {proyeccion.estado_actual.costo_ineficiencia_estimado && (
                          <span className="text-xs text-amber-400">⚡ {proyeccion.estado_actual.costo_ineficiencia_estimado}</span>
                        )}
                        <span className="text-xs bg-violet-600/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">
                          Confianza {proyeccion.nivel_confianza}%
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/40 rounded-xl p-1">
                      {(['mejoras', 'escenarios', 'roadmap', 'kpis'] as const).map(t => (
                        <button key={t} onClick={() => setTabProyeccion(t)}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${tabProyeccion === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                          {t === 'kpis' ? 'KPIs' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Mejoras */}
                    {tabProyeccion === 'mejoras' && (
                      <div className="space-y-2">
                        {proyeccion.mejoras_propuestas.slice(0, 5).map((m, i) => (
                          <div key={i} className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-3 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-white font-medium">{m.titulo}</p>
                              <div className="flex gap-1 shrink-0">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${m.impacto === 'alto' ? 'bg-emerald-900/60 text-emerald-300' : m.impacto === 'medio' ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                                  {m.impacto}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.tipo === 'quick_win' ? 'bg-violet-900/60 text-violet-300' : 'bg-slate-700/60 text-slate-400'}`}>
                                  {m.tipo === 'quick_win' ? '⚡ Quick win' : m.tipo === 'proyecto_corto' ? '📦 Proyecto' : '🔄 Transformación'}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{m.descripcion}</p>
                            <div className="flex gap-3 text-xs text-slate-500">
                              <span>⏱ {m.plazo_semanas} sem</span>
                              {m.valor_estimado && <span className="text-emerald-400">💰 {m.valor_estimado}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab: Escenarios */}
                    {tabProyeccion === 'escenarios' && (
                      <div className="space-y-2">
                        {(['conservador', 'base', 'optimista'] as const).map(esc => {
                          const e = proyeccion.escenarios[esc]
                          const color = esc === 'optimista' ? 'emerald' : esc === 'base' ? 'blue' : 'slate'
                          return (
                            <div key={esc} className={`rounded-xl bg-${color}-950/20 border border-${color}-800/30 p-3 space-y-1`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold text-${color}-400 capitalize`}>{esc}</span>
                                <span className="text-xs text-slate-500">{e.probabilidad}% prob.</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{e.descripcion}</p>
                              {e.ahorro_estimado && <p className="text-xs text-emerald-400 font-medium">💰 {e.ahorro_estimado}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Tab: Roadmap */}
                    {tabProyeccion === 'roadmap' && (
                      <div className="space-y-2">
                        {proyeccion.roadmap_90_dias.map((r, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-900/40 border border-violet-700/40 flex items-center justify-center">
                              <span className="text-xs text-violet-300 font-bold">{r.semana?.replace(/[^0-9]/g, '') || i + 1}</span>
                            </div>
                            <div className="flex-1 py-1">
                              <p className="text-xs text-white font-medium">{r.accion}</p>
                              <p className="text-xs text-slate-500">{r.responsable} · {r.entregable}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tab: KPIs */}
                    {tabProyeccion === 'kpis' && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-700/40">
                              <th className="text-left py-2 pr-3 font-medium">KPI</th>
                              <th className="text-right py-2 px-2 font-medium">Actual</th>
                              <th className="text-right py-2 px-2 font-medium text-blue-400">6 meses</th>
                              <th className="text-right py-2 pl-2 font-medium text-emerald-400">12 meses</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/20">
                            {proyeccion.proyeccion_kpis.map((k, i) => (
                              <tr key={i}>
                                <td className="py-2 pr-3 text-slate-300">{k.kpi} <span className="text-slate-600">({k.unidad})</span></td>
                                <td className="py-2 px-2 text-right text-slate-400">{k.valor_actual}</td>
                                <td className="py-2 px-2 text-right text-blue-300 font-medium">{k.valor_6_meses}</td>
                                <td className="py-2 pl-2 text-right text-emerald-300 font-bold">{k.valor_12_meses}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Recomendación ejecutiva */}
                    <div className="rounded-xl bg-gradient-to-r from-violet-950/40 to-slate-800/40 border border-violet-700/30 p-3">
                      <p className="text-xs text-violet-300 font-semibold mb-1">Recomendación ejecutiva</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{proyeccion.recomendacion_ejecutiva}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Polling screen (Feature 1) ───────────────────────────────────────────────

function PollingScreen({
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
  }, [proyectoId, procesadosIds])

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
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            ) : (
              <>
                <span className="text-2xl font-bold text-white">{pct}%</span>
                <span className="text-xs text-slate-500">procesado</span>
              </>
            )}
          </div>
          {!todosListos && (
            <div className="absolute inset-0 rounded-full border border-violet-500/20 animate-ping" />
          )}
        </div>

        <div className="text-center">
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
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
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
                  estadoVisual === 'listo' ? 'text-emerald-400' : 'text-slate-600'
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
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
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

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EstadoVacioDiscovery({
  proyectosParaAcciones,
  documentos,
  proyectoId,
}: {
  proyectosParaAcciones: { id: string; nombre: string }[]
  documentos: DocumentoItem[]
  proyectoId: string
}) {
  const listos = documentos.filter(d => d.estado_procesamiento === 'listo')
  const noListos = documentos.filter(d => d.estado_procesamiento !== 'listo')
  const tieneListos = listos.length > 0

  // Selección para Discovery IA (docs listos)
  const [seleccionados, setSeleccionados] = useState<string[]>(listos.map(d => d.id))
  const todosSeleccionados = listos.length > 0 && seleccionados.length === listos.length

  // Selección para procesar (docs pendientes)
  const [selParaProcesar, setSelParaProcesar] = useState<string[]>(noListos.map(d => d.id))
  const todosParaProcesar = noListos.length > 0 && selParaProcesar.length === noListos.length

  const [procesando, setProcesando] = useState(false)
  const [procesadosIds, setProcesadosIds] = useState<string[]>([])
  const [exitoso, setExitoso] = useState(false)
  const totalParaProcesar = selParaProcesar.length

  // Al montar: si hay docs ya en procesando, entrar directo al polling screen
  useEffect(() => {
    const yaEnProceso = documentos.filter(d => d.estado_procesamiento === 'procesando')
    if (yaEnProceso.length > 0 && procesadosIds.length === 0) {
      // Incluir también los pendientes que el usuario tenía seleccionados para mostrar la lista completa
      const todosEnCola = documentos
        .filter(d => d.estado_procesamiento === 'pendiente' || d.estado_procesamiento === 'procesando')
        .map(d => d.id)
      setProcesadosIds(todosEnCola)
      setExitoso(true)
    }
  }, [])

  function toggleDoc(id: string) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? [] : listos.map(d => d.id))
  }
  function toggleParaProcesar(id: string) {
    setSelParaProcesar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleTodosParaProcesar() {
    setSelParaProcesar(todosParaProcesar ? [] : noListos.map(d => d.id))
  }

  async function procesarSeleccionados() {
    const targets = noListos.filter(d => selParaProcesar.includes(d.id))
    if (procesando || targets.length === 0) return
    setProcesando(true)

    // Verificar estado actual en DB — solo enviar docs que siguen en 'pendiente'
    // Los que ya están 'procesando' se incluyen en el polling pero no se re-envían
    let estadosActuales: Record<string, string> = {}
    try {
      const r = await fetch(
        `/api/documentos/estado?proyecto_id=${proyectoId}&ids=${targets.map(d => d.id).join(',')}`
      )
      const data = await r.json()
      if (data.documentos) {
        for (const d of data.documentos) estadosActuales[d.id] = d.estado_procesamiento
      }
    } catch { /* si falla, intentar procesar todos */ }

    const ids: string[] = []
    for (const doc of targets) {
      const estadoActual = estadosActuales[doc.id] ?? 'pendiente'
      // Si ya está procesando o listo, incluirlo en el seguimiento pero no re-enviar
      if (estadoActual === 'procesando' || estadoActual === 'listo') {
        ids.push(doc.id)
        setProcesadosIds(prev => [...prev, doc.id])
        continue
      }
      try {
        await fetch('/api/documentos/procesar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documento_id: doc.id }),
        })
        ids.push(doc.id)
        setProcesadosIds(prev => [...prev, doc.id])
      } catch { /* continúa con el siguiente */ }
    }
    setProcesando(false)
    setExitoso(true)
  }

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950/40 to-indigo-950/20 border border-violet-800/30 p-8 sm:p-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(to right, #818cf8 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-violet-900/50 border border-violet-600/40 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-violet-300 text-xs font-bold uppercase tracking-[0.15em]">AICOUNTS Intelligence Engine</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight max-w-2xl">
            Tu documentación contiene el<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300">mapa completo de tu organización.</span>
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-2xl">
            AICOUNTS Consultores despliega su framework propietario sobre tu documentación para extraer la arquitectura de procesos críticos, los roles de decisión y las brechas operacionales que ningún diagnóstico tradicional detecta con esta velocidad y precisión. El resultado es inteligencia estratégica lista para ser ejecutada por tu directorio.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { icon: Shield, color: 'text-violet-400', label: 'Metodología certificada AICOUNTS' },
              { icon: TrendingUp, color: 'text-emerald-400', label: 'Inteligencia lista para la dirección' },
              { icon: Cpu, color: 'text-blue-400', label: 'Motor de análisis de última generación' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon className={`w-4 h-4 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Paso 1: documentos ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">

        {/* Header del paso */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <p className="text-white font-semibold text-sm">
                {!tieneListos && documentos.length > 0 ? 'Activa la inteligencia en tus documentos' : 'Documentos indexados y listos'}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {documentos.length === 0
                  ? 'Carga documentación en Centro Documental para comenzar.'
                  : tieneListos
                  ? `${listos.length} documento${listos.length !== 1 ? 's' : ''} indexado${listos.length !== 1 ? 's' : ''} · elige cuáles entran al análisis en el Paso 2`
                  : `${noListos.length} documento${noListos.length !== 1 ? 's' : ''} cargado${noListos.length !== 1 ? 's' : ''} · activa la inteligencia para habilitarlos`}
              </p>
            </div>
          </div>
          {tieneListos && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-full px-2.5 py-1 shrink-0">
              {listos.length} listo{listos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Cuerpo del paso */}
        {exitoso ? (
          /* ── Feature 1: Real-time polling screen ── */
          <PollingScreen
            proyectoId={proyectoId}
            procesadosIds={procesadosIds}
            totalParaProcesar={totalParaProcesar}
            documentos={documentos}
            proyectosParaAcciones={proyectosParaAcciones}
            onCancelar={() => {
              setProcesadosIds([])
              setExitoso(false)
            }}
          />

        ) : procesando ? (
          /* ── Estado procesando en curso ── */
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-8 h-8 shrink-0">
                <div className="w-8 h-8 rounded-full bg-violet-900/50 border border-violet-600/40 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-violet-400" />
                </div>
                <div className="absolute inset-0 rounded-full border border-violet-500/30 animate-ping" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Activando inteligencia en tus documentos</p>
                <p className="text-slate-500 text-xs">{procesadosIds.length} de {totalParaProcesar} encolados</p>
              </div>
              <div className="ml-auto text-xs font-bold text-violet-300 bg-violet-900/40 border border-violet-700/40 rounded-full px-3 py-1 shrink-0">
                {totalParaProcesar > 0 ? Math.round((procesadosIds.length / totalParaProcesar) * 100) : 0}%
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${totalParaProcesar > 0 ? (procesadosIds.length / totalParaProcesar) * 100 : 5}%` }} />
            </div>
            {noListos.map(doc => {
              const hecho = procesadosIds.includes(doc.id)
              return (
                <div key={doc.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  hecho ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    hecho ? 'bg-emerald-500' : 'border-2 border-slate-600'
                  }`}>
                    {hecho
                      ? <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      : <span className="w-2 h-2 rounded-full border border-slate-500/50 border-t-slate-400 animate-spin" />}
                  </div>
                  <FileText className={`w-4 h-4 shrink-0 ${hecho ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <p className={`text-sm font-medium flex-1 truncate ${hecho ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {doc.nombre_archivo}
                  </p>
                  <span className={`text-xs shrink-0 ${hecho ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {hecho ? 'Encolado ✓' : 'Esperando'}
                  </span>
                </div>
              )
            })}
          </div>

        ) : documentos.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">Aún no hay documentos cargados</p>
            <p className="text-slate-400 text-sm">Carga tu documentación en Centro Documental para activar el motor de análisis.</p>
            <a href="/documentos" className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              <Layers className="w-4 h-4" /> Ir a Centro Documental
            </a>
          </div>

        ) : !tieneListos ? (
          /* Todos pendientes: selección individual + explicación + botón */
          <div className="divide-y divide-slate-800">
            <div className="p-5 bg-violet-950/10">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-900/50 border border-violet-700/50 flex items-center justify-center shrink-0">
                  <Brain className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">¿Qué significa procesar un documento?</p>
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed max-w-2xl">
                    Antes de ejecutar el análisis, el motor lee e indexa el contenido de cada documento — extrae texto, tablas, estructuras y metadatos — construyendo una representación inteligente sobre la que opera el framework AICOUNTS. Es el paso previo que garantiza que el análisis posterior sea profundo, trazable y de alta precisión.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {noListos.map(doc => {
                const enProceso = procesadosIds.includes(doc.id)
                const marcado = selParaProcesar.includes(doc.id)
                return (
                  <button
                    key={doc.id}
                    onClick={() => !enProceso && toggleParaProcesar(doc.id)}
                    disabled={enProceso || procesando}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-left ${
                      enProceso
                        ? 'bg-violet-950/20 border-violet-800/40 cursor-default'
                        : marcado
                        ? 'bg-slate-800/60 border-violet-700/40 hover:border-violet-600/60'
                        : 'bg-slate-800/20 border-slate-700/30 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      enProceso ? 'bg-violet-500/30 border-violet-500/50' : marcado ? 'bg-violet-600 border-violet-600' : 'border-slate-600'
                    }`}>
                      {enProceso
                        ? <span className="w-2.5 h-2.5 rounded-full border border-violet-400/40 border-t-violet-400 animate-spin" />
                        : marcado && <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <FileText className={`w-4 h-4 ${enProceso ? 'text-violet-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${enProceso ? 'text-violet-300' : marcado ? 'text-white' : 'text-slate-400'}`}>
                        {doc.nombre_archivo}
                      </p>
                      <p className="text-xs text-slate-600">
                        {enProceso ? 'Procesando...' : 'Listo para procesar'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="p-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={procesarSeleccionados}
                disabled={procesando || selParaProcesar.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {procesando
                  ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Activando inteligencia...</>
                  : <><Sparkles className="w-4 h-4" />Procesar {selParaProcesar.length} documento{selParaProcesar.length !== 1 ? 's' : ''} para el análisis</>}
              </button>
              <button onClick={toggleTodosParaProcesar} className="text-xs text-slate-500 hover:text-violet-300 transition-colors font-medium">
                {todosParaProcesar ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
          </div>

        ) : (
          /* Hay listos — mostrar solo estado, la selección va en Paso 2 */
          <div className="p-4 space-y-2">
            {listos.map(doc => {
              const bloque = (doc.clasificacion as any)?.bloque_metodologico as string | undefined
              return (
                <div
                  key={doc.id}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-950/20 border border-emerald-800/40"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-800/60 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                    {bloque && <p className="text-slate-500 text-xs truncate">{bloque}</p>}
                  </div>
                  <span className="text-xs text-emerald-400 font-medium shrink-0">Listo ✓</span>
                </div>
              )
            })}

            {noListos.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <p className="text-xs text-slate-600 px-1">Pendientes de procesamiento</p>
                {noListos.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 bg-slate-800/20 border border-slate-700/20 rounded-xl px-4 py-3 opacity-40">
                    <div className="w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center shrink-0">
                      <Lock className="w-3 h-3 text-slate-600" />
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm truncate flex-1">{doc.nombre_archivo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Paso 2: Ejecutar Discovery IA ── */}
      {tieneListos ? (
        <div className="bg-gradient-to-br from-violet-950/50 via-indigo-950/30 to-slate-900 border border-violet-700/40 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-violet-800/20">
            <div className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/60">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-xl">Ejecutar Discovery IA</p>
                <p className="text-slate-400 text-sm mt-1">
                  {seleccionados.length > 0
                    ? <><span className="text-emerald-400 font-semibold">{seleccionados.length} documento{seleccionados.length !== 1 ? 's' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}</span> · el framework AICOUNTS analizará cada uno y construirá el diagnóstico completo de tu organización.</>
                    : <span className="text-amber-400">Selecciona al menos un documento para continuar.</span>}
                </p>
              </div>
            </div>
          </div>

          {/* ── Selector de documentos para Discovery ── */}
          <div className="px-6 pt-5 pb-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Documentos a analizar</span>
              </div>
              <button
                onClick={toggleTodos}
                className="text-xs text-violet-300 hover:text-violet-100 font-medium transition-colors"
              >
                {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {listos.map(doc => {
                const elegido = seleccionados.includes(doc.id)
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`group flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
                      elegido
                        ? 'bg-emerald-900/40 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-500/70 shadow-sm shadow-emerald-900/30'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-500/70 hover:text-slate-300'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                      elegido ? 'bg-emerald-400' : 'bg-slate-600 group-hover:bg-slate-400'
                    }`} />
                    <span className="max-w-[140px] truncate">{doc.nombre_archivo}</span>
                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      elegido ? 'bg-emerald-500/30' : 'bg-slate-700/60'
                    }`}>
                      {elegido
                        ? <CheckCircle className="w-2.5 h-2.5 text-emerald-300" strokeWidth={3} />
                        : <X className="w-2.5 h-2.5 text-slate-600 group-hover:text-slate-400" strokeWidth={2.5} />}
                    </div>
                  </button>
                )
              })}
            </div>
            {seleccionados.length === 0 && (
              <p className="text-xs text-amber-400/80 mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Selecciona al menos un documento para ejecutar el análisis
              </p>
            )}
            {seleccionados.length > 5 && (
              <p className="text-xs text-amber-400/80 mt-2.5 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Más de 5 documentos puede aumentar el tiempo de análisis. Se recomienda analizar por bloques temáticos.
              </p>
            )}
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Activity, color: 'text-violet-400', border: 'border-violet-800/40',
                title: 'Inventario de Procesos',
                desc: 'Mapa completo de macroprocesos y subprocesos críticos. Cada uno con nivel de criticidad, estado operacional, riesgos detectados y oportunidades de mejora.',
              },
              {
                icon: Users, color: 'text-indigo-400', border: 'border-indigo-800/40',
                title: 'Glosario de Roles',
                desc: 'Matriz de todos los roles detectados en la organización: en qué procesos participan, qué nivel de responsabilidad tienen y qué brechas existen en la cobertura.',
              },
              {
                icon: Zap, color: 'text-amber-400', border: 'border-amber-800/30',
                title: 'Roadmap de Transformación',
                desc: 'Oportunidades de automatización y mejora priorizadas por impacto. Incluye quick wins ejecutables en menos de 30 días y recomendaciones estratégicas para el directorio.',
              },
            ].map(({ icon: Icon, color, border, title, desc }) => (
              <div key={title} className={`rounded-xl border bg-slate-900/60 p-4 space-y-2 ${border}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <p className={`text-sm font-semibold ${color}`}>{title}</p>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6 flex items-center gap-4">
            <DiscoveryAcciones proyectos={proyectosParaAcciones} documentoIds={seleccionados} disabled={seleccionados.length === 0} />
            <span className="text-xs text-slate-500">Diagnóstico de alta precisión · 1–3 minutos · puedes seguir navegando</span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800/40 bg-slate-900/20 p-6 opacity-40 pointer-events-none select-none">
          <div className="flex items-center gap-4">
            <span className="w-7 h-7 rounded-full bg-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center shrink-0">2</span>
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-slate-500 font-semibold text-sm">Ejecutar Discovery IA</p>
              <p className="text-slate-600 text-xs">Se habilitará cuando tus documentos hayan sido indexados en el Paso 1</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiscoveryExperiencia({
  proyectoId, nombreProyecto, clienteNombre,
  macroprocesos, totalProcesos, aceptados, pendientes, rechazados,
  procesosDetectados, procesosPropeustosIA,
  resumenDiscovery, rolesDetectados, proyectosParaAcciones, documentos,
}: Props) {
  const [tab, setTab] = useState<'procesos' | 'glosario'>('procesos')

  const pctAprobacion = totalProcesos > 0 ? Math.round((aceptados / totalProcesos) * 100) : 0

  return (
    <div className="space-y-6">

      {/* ── Header del módulo ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950/20 to-slate-900 border border-violet-800/20 rounded-2xl p-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl" />
        </div>
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Process Discovery IA</h1>
              <p className="text-slate-400 text-xs">{nombreProyecto}{clienteNombre ? ` · ${clienteNombre}` : ''}</p>
            </div>
          </div>
          {totalProcesos > 0 && <DiscoveryAcciones proyectos={proyectosParaAcciones} />}
        </div>

        {/* Panel de resultados post-discovery */}
        {totalProcesos > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800 space-y-4">

            {/* Narrativa clara del resultado */}
            <div className="bg-violet-950/30 border border-violet-800/30 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-white font-semibold">
                    Se analizaron {documentos.filter(d => d.estado_procesamiento === 'listo').length} documentos y se encontró {macroprocesos.length} macroproceso: <span className="text-violet-300">{macroprocesos[0]?.nombre ?? 'Cadena de Suministro'}</span>
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Dentro de ese macroproceso se identificaron{' '}
                    <span className="text-emerald-400 font-semibold">{procesosDetectados} proceso{procesosDetectados !== 1 ? 's' : ''} existentes</span>
                    {' '}(uno por cada documento analizado){procesosPropeustosIA > 0 && (
                      <> y <span className="text-amber-400 font-semibold">{procesosPropeustosIA} proceso{procesosPropeustosIA !== 1 ? 's' : ''} propuesto{procesosPropeustosIA !== 1 ? 's' : ''} por IA</span> — actividades que deberían existir en esta organización pero aún no están documentadas.</>
                    )}{procesosPropeustosIA === 0 && '.'}
                  </p>
                </div>
              </div>
              {procesosPropeustosIA > 0 && (
                <div className="flex items-center gap-4 pt-1 border-t border-violet-800/20 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-emerald-400 font-medium">{procesosDetectados} detectados</span> en tus documentos
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-amber-400 font-medium">{procesosPropeustosIA} propuestos por IA</span> — brechas identificadas
                  </span>
                </div>
              )}
            </div>

            {/* Qué hacer ahora: 3 acciones concretas */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  step: '1',
                  icon: Target,
                  label: 'Lee cada proceso',
                  desc: 'Expande el macroproceso y revisa el nombre y descripción de cada proceso. Verifica que refleja la realidad de tu organización.',
                  color: 'text-violet-400',
                  bg: 'bg-violet-950/30 border-violet-800/30',
                },
                {
                  step: '2',
                  icon: CheckCircle,
                  label: 'Acepta o rechaza',
                  desc: 'Haz clic en "Aceptar proceso" si es correcto, o "Rechazar" si no aplica. Esto construye tu inventario oficial de procesos.',
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-950/30 border-emerald-800/30',
                },
                {
                  step: '3',
                  icon: TrendingUp,
                  label: 'Profundiza con IA',
                  desc: 'En los procesos aceptados, usa "Analizar con IA" para obtener diagnóstico de criticidad, riesgos y oportunidades de mejora.',
                  color: 'text-blue-400',
                  bg: 'bg-blue-950/30 border-blue-800/30',
                },
              ].map(({ step, icon: Icon, label, desc, color, bg }) => (
                <div key={step} className={`rounded-xl border px-3 py-3 ${bg}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-600">PASO {step}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className={`text-sm font-semibold ${color}`}>{label}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Barra de progreso de validación */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-semibold">{pendientes}</span> pendientes de revisión
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">{aceptados}</span> aceptados
                  </span>
                  {rechazados > 0 && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400 font-semibold">{rechazados}</span> rechazados
                    </span>
                  )}
                </div>
                <span className="text-slate-500">{pctAprobacion}% validado</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700"
                  style={{ width: `${pctAprobacion}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      {totalProcesos > 0 && (
        <div className="flex gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1 w-fit">
          {[
            { id: 'procesos', label: 'Macroprocesos y Procesos', icon: Activity, count: procesosPropeustosIA },
            { id: 'glosario', label: 'Glosario de Roles', icon: Users, count: rolesDetectados.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as 'procesos' | 'glosario')
                if (t.id === 'procesos' && procesosPropeustosIA > 0) {
                  setTimeout(() => {
                    const el = document.querySelector('[id^="proceso-propuesta-ia-"]')
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }, 100)
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-amber-400/30 text-amber-200' : 'bg-amber-900/60 text-amber-300'}`}>
                  {t.count} nuevo{t.count !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Contenido ── */}
      {totalProcesos === 0 ? (
        <EstadoVacioDiscovery proyectosParaAcciones={proyectosParaAcciones} documentos={documentos} proyectoId={proyectoId} />
      ) : tab === 'procesos' ? (
        <div className="space-y-4">
          {resumenDiscovery && (resumenDiscovery.resumen_ejecutivo_discovery as string | undefined) && (
            <div className="bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-800/30 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Diagnóstico ejecutivo del proyecto</span>
              </div>
              <p className="text-slate-200 text-sm leading-relaxed">{resumenDiscovery.resumen_ejecutivo_discovery as string}</p>
              <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-800/60">
                {(resumenDiscovery.industria_detectada as string | undefined) && <span>Industria: <span className="text-slate-300">{resumenDiscovery.industria_detectada as string}</span></span>}
                {(resumenDiscovery.nivel_madurez_operacional as string | undefined) && <span>Madurez: <span className="text-slate-300">{resumenDiscovery.nivel_madurez_operacional as string}</span></span>}
                {(resumenDiscovery.cobertura_documentacion as string | undefined) && <span>Cobertura: <span className="text-slate-300">{resumenDiscovery.cobertura_documentacion as string}</span></span>}
              </div>
            </div>
          )}

          {/* Encabezado de la lista */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Macroprocesos detectados</span>
              <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">{macroprocesos.length}</span>
            </div>
            {procesosPropeustosIA > 0 && (
              <p className="text-xs text-amber-400/80">
                ✨ {procesosPropeustosIA} proceso{procesosPropeustosIA !== 1 ? 's' : ''} propuesto{procesosPropeustosIA !== 1 ? 's' : ''} por IA — revisa y acepta o rechaza
              </p>
            )}
          </div>

          <div className="space-y-3">
            {macroprocesos.map(macro => (
              <ProcesoCard key={macro.id} proceso={macro} />
            ))}
          </div>

          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <p className="text-slate-400 text-xs">
              Activa <span className="text-violet-300 font-medium">Analizar con IA</span> en cualquier proceso para un análisis ejecutivo instantáneo de criticidad, impacto al negocio y oportunidades de automatización.
            </p>
          </div>

          <DiscoveryAcciones proyectos={proyectosParaAcciones} variant="bottom" />
        </div>
      ) : (
        /* Feature 3: Glosario de Roles tab */
        rolesDetectados.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-900/40 border border-indigo-800/50 flex items-center justify-center mx-auto">
              <Users className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-2">Acepta procesos primero para ver roles detectados</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                El Glosario de Roles se construye a partir de los roles involucrados en los procesos que hayas <span className="text-emerald-400 font-medium">aceptado</span>. Ve a la pestaña <span className="text-violet-300 font-medium">Inventario de Procesos</span> y valida los procesos relevantes para desbloquear este análisis.
              </p>
            </div>
            <div className="flex items-start gap-3 max-w-sm mx-auto bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-left mt-2">
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  Abre la pestaña <strong className="text-slate-300">Inventario de Procesos</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  Haz clic en <strong className="text-emerald-400">Aceptar proceso</strong> en los procesos relevantes
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  Vuelve aquí para el análisis completo de roles
                </div>
              </div>
            </div>
            <button
              onClick={() => setTab('procesos')}
              className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Activity className="w-4 h-4" /> Ver Inventario de Procesos
            </button>
          </div>
        ) : (
          <GlosarioRoles
            proyectoId={proyectoId}
            nombreProyecto={nombreProyecto}
            rolesDetectados={rolesDetectados}
          />
        )
      )}
    </div>
  )
}
