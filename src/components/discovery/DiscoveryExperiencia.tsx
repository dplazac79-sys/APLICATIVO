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
  nivel_madurez?: string
  impacto_negocio: string
  quick_win: string
  potencial_automatizacion: 'alto' | 'medio' | 'bajo'
  siguiente_paso: string
  brechas_principales?: string[]
  oportunidades_valor?: string[]
  riesgos_criticos?: string[]
  benchmark_industria?: string
  ancla_documental?: boolean
  documentos_considerados?: number
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

// ─── ProcesoTabContent ───────────────────────────────────────────────────────

type PlanImplementacion = {
  contexto_estrategico: string
  situacion_actual: string
  antes: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  durante: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  despues: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  factores_criticos_exito: string[]
  riesgos_implementacion: string[]
}

type DocAnalisis = {
  nombre_archivo: string
  resumen_ejecutivo: string | null
  analisis_ia: {
    resumen_ejecutivo?: string
    diagnostico_operacional?: string
    nivel_madurez_amo?: number
    nivel_madurez_nombre?: string
    nivel_madurez_evidencia?: string
    hallazgos_criticos?: string[]
    riesgos_criticos?: Array<{ riesgo: string; impacto: string; evidencia: string }>
    oportunidades_valor?: Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>
    brechas_documentacion?: string[]
    quick_wins?: string[]
    proximos_pasos_sugeridos?: string[]
    roles_y_responsabilidades?: { brechas_de_rol?: string[] }
    recomendacion_ejecutiva?: string
  } | null
}

const MADUREZ_LABELS: Record<number, { label: string; color: string; ring: string }> = {
  1: { label: 'Reactivo',     color: 'text-red-400',    ring: 'ring-red-500' },
  2: { label: 'Definido',     color: 'text-orange-400', ring: 'ring-orange-500' },
  3: { label: 'Gestionado',   color: 'text-amber-400',  ring: 'ring-amber-500' },
  4: { label: 'Optimizado',   color: 'text-emerald-400',ring: 'ring-emerald-500' },
  5: { label: 'Innovador',    color: 'text-violet-400', ring: 'ring-violet-500' },
}

const URGENCIA_STYLE: Record<string, string> = {
  critica: 'bg-red-950/60 text-red-300 border-red-800/50',
  alta:    'bg-orange-950/60 text-orange-300 border-orange-800/50',
  media:   'bg-slate-800/60 text-slate-400 border-slate-700/50',
}

function ProcesoTabContent({ proceso, docAnalisis, critCfg, accentColor, justificacion }: {
  proceso: ProcesoConHijos
  docAnalisis: DocAnalisis | null
  critCfg: { label: string; color: string; bg: string; accent: string } | null
  accentColor: string
  justificacion: string | null | undefined
}) {
  const ia = docAnalisis?.analisis_ia
  const planGuardado = (proceso.metadata_ia as any)?.plan_implementacion as PlanImplementacion | undefined
  const [plan, setPlan] = useState<PlanImplementacion | null>(planGuardado ?? null)
  const [generandoPlan, setGenerandoPlan] = useState(false)
  const [faseActiva, setFaseActiva] = useState<'antes' | 'durante' | 'despues'>('antes')

  useEffect(() => {
    if (plan) return
    fetch(`/api/procesos/${proceso.id}/recomendacion-implementacion`)
      .then(r => r.json())
      .then(d => { if (d.plan) setPlan(d.plan) })
      .catch(() => {})
  }, [proceso.id])

  async function generarPlan() {
    if (generandoPlan) return
    setGenerandoPlan(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/recomendacion-implementacion`, { method: 'POST' })
      const data = await res.json()
      if (data.plan) setPlan(data.plan)
    } catch { /* silent */ }
    finally { setGenerandoPlan(false) }
  }

  const madurezN = ia?.nivel_madurez_amo
  const madurezCfg = madurezN != null ? MADUREZ_LABELS[madurezN] : null
  const madurezDots = [1, 2, 3, 4, 5]

  return (
    <div className="divide-y divide-slate-700/30">

      {/* ── 1. Contexto estratégico ── */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full bg-violet-500" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Por qué este proceso importa ahora</p>
        </div>

        {/* Capa 1: resumen ejecutivo del documento (siempre primero, siempre trazable) */}
        {(ia?.resumen_ejecutivo || docAnalisis?.resumen_ejecutivo) ? (
          <div className="space-y-1">
            <p className="text-slate-200 text-sm leading-relaxed">
              {ia?.resumen_ejecutivo ?? (docAnalisis?.resumen_ejecutivo as string)}
            </p>
            <p className="text-xs text-slate-600 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Extraído del documento formal
            </p>
          </div>
        ) : proceso.origen === 'propuesta_ia' && justificacion ? (
          <p className="text-slate-200 text-sm leading-relaxed">{justificacion}</p>
        ) : (
          <p className="text-slate-500 text-sm italic">Sin resumen disponible — procesa el documento para ver este análisis.</p>
        )}

        {/* Capa 2: perspectiva estratégica IA (solo si hay plan, como enriquecimiento adicional) */}
        {plan?.contexto_estrategico && (
          <div className="rounded-xl border border-violet-800/25 bg-violet-950/15 p-3 space-y-1">
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Perspectiva estratégica IA
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">{plan.contexto_estrategico}</p>
          </div>
        )}
      </div>

      {/* ── 2. Foto actual: Madurez + Criticidad + Diagnóstico ── */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full bg-amber-500" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Estado actual del proceso</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Madurez visual */}
          {madurezN != null && madurezCfg && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 space-y-3">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Madurez AMO</p>
              <div className="flex items-center gap-1.5">
                {madurezDots.map(n => (
                  <div key={n} className={`flex-1 h-2 rounded-full transition-all ${n <= madurezN ? accentColor : 'bg-slate-700/60'}`} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xl font-black ${madurezCfg.color}`}>{madurezN}<span className="text-slate-600 text-sm font-normal">/5</span></span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  madurezN <= 1 ? 'bg-red-950/60 text-red-300 border-red-800/40' :
                  madurezN <= 2 ? 'bg-orange-950/60 text-orange-300 border-orange-800/40' :
                  madurezN <= 3 ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' :
                  'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                }`}>{ia?.nivel_madurez_nombre ?? madurezCfg.label}</span>
              </div>
              {ia?.nivel_madurez_evidencia && (
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{ia.nivel_madurez_evidencia}</p>
              )}
            </div>
          )}

          {/* Criticidad + Roles */}
          <div className="space-y-2">
            {critCfg && (
              <div className={`rounded-xl border p-3 ${critCfg.bg}`}>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Criticidad</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${critCfg.color}`} />
                  <span className={`text-sm font-bold ${critCfg.color}`}>{critCfg.label}</span>
                </div>
              </div>
            )}
            {proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">Roles</p>
                <div className="flex flex-wrap gap-1">
                  {proceso.roles_involucrados.map(r => (
                    <span key={r} className="text-xs bg-slate-700/60 text-slate-300 border border-slate-600/40 px-2 py-0.5 rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Diagnóstico operacional — documento primero, IA como capa adicional */}
        {ia?.diagnostico_operacional && (
          <div className="rounded-xl border border-amber-800/20 bg-amber-950/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold">Diagnóstico operacional hoy</p>
              <p className="text-xs text-slate-600 flex items-center gap-1"><FileText className="w-3 h-3" /> Del documento</p>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{ia.diagnostico_operacional}</p>
            {plan?.situacion_actual && plan.situacion_actual !== ia.diagnostico_operacional && (
              <div className="border-t border-amber-800/20 pt-2 space-y-1">
                <p className="text-xs text-violet-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Interpretación IA</p>
                <p className="text-slate-400 text-xs leading-relaxed">{plan.situacion_actual}</p>
              </div>
            )}
          </div>
        )}
        {!ia?.diagnostico_operacional && plan?.situacion_actual && (
          <div className="rounded-xl border border-amber-800/20 bg-amber-950/10 p-4">
            <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold mb-2">Diagnóstico operacional hoy</p>
            <p className="text-slate-300 text-sm leading-relaxed">{plan.situacion_actual}</p>
          </div>
        )}
      </div>

      {/* ── 3. Plan de implementación ── */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Hoja de ruta de implementación</p>
          </div>
          {!plan && (
            <button
              onClick={generarPlan}
              disabled={generandoPlan}
              className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-60"
            >
              {generandoPlan
                ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Analizando...</>
                : <><Sparkles className="w-3 h-3" /> Generar plan</>
              }
            </button>
          )}
        </div>

        {!plan && !generandoPlan && (
          <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-700/30 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-slate-400 text-sm font-medium">Plan de implementación no generado</p>
            <p className="text-slate-600 text-xs">Genera un roadmap estructurado con fases, responsables y factores críticos de éxito.</p>
          </div>
        )}

        {generandoPlan && (
          <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 p-6 flex items-center justify-center gap-3">
            <span className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
            <p className="text-violet-300 text-sm">Construyendo hoja de ruta...</p>
          </div>
        )}

        {plan && (
          <div className="space-y-4">
            {/* Tabs de fase */}
            <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1">
              {([
                { id: 'antes',   label: 'Antes', emoji: '⚙️', desc: 'Preparación' },
                { id: 'durante', label: 'Durante', emoji: '🚀', desc: 'Ejecución' },
                { id: 'despues', label: 'Después', emoji: '📈', desc: 'Sostenibilidad' },
              ] as const).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFaseActiva(f.id)}
                  className={`flex-1 flex flex-col items-center py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                    faseActiva === f.id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="text-base">{f.emoji}</span>
                  <span>{f.label}</span>
                  <span className={`text-xs font-normal ${faseActiva === f.id ? 'text-slate-400' : 'text-slate-600'}`}>{f.desc}</span>
                </button>
              ))}
            </div>

            {/* Acciones de la fase */}
            <div className="space-y-2">
              {(faseActiva === 'antes' ? plan.antes : faseActiva === 'durante' ? plan.durante : plan.despues).map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-700/30 bg-slate-800/20 p-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-slate-300 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{item.categoria}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${URGENCIA_STYLE[item.urgencia] ?? URGENCIA_STYLE.media}`}>
                        {item.urgencia}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-snug">{item.accion}</p>
                    <p className="text-xs text-slate-500 mt-0.5">→ {item.responsable}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Factores críticos + Riesgos */}
            <div className="grid grid-cols-2 gap-3">
              {plan.factores_criticos_exito.length > 0 && (
                <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/10 p-3 space-y-2">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Claves de éxito</p>
                  {plan.factores_criticos_exito.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-300 leading-snug">{f}</p>
                    </div>
                  ))}
                </div>
              )}
              {plan.riesgos_implementacion.length > 0 && (
                <div className="rounded-xl border border-red-900/30 bg-red-950/10 p-3 space-y-2">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Riesgos</p>
                  {plan.riesgos_implementacion.map((r, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-slate-300 leading-snug">{r}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={generarPlan}
              disabled={generandoPlan}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Regenerar plan
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── ProcesoCard ─────────────────────────────────────────────────────────────

type Correccion = {
  tipo: 'riesgo' | 'hallazgo' | 'brecha' | 'rol'
  indice: number
  observacion: string
  estado: 'atendido' | 'archivado'
  fecha: string
}
type VersionDoc = {
  numero: number
  fecha: string
  descripcion: string
  correcciones_aplicadas: number
}

function ProcesoCard({ proceso, esHijo = false, proyectoId }: { proceso: ProcesoConHijos; esHijo?: boolean; proyectoId: string }) {
  const [expandido, setExpandido] = useState(false)
  const [tabDoc, setTabDoc] = useState<'proceso' | 'hallazgos' | 'oportunidades' | 'roles' | 'versiones'>('proceso')
  const [docAnalisis, setDocAnalisis] = useState<DocAnalisis | null>(null)
  const [cargandoDoc, setCargandoDoc] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [errorIA, setErrorIA] = useState<string | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(
    (proceso.metadata_ia as any)?.resumen_ia ?? null
  )
  const [aprobando, setAprobando] = useState(false)
  const [estadoLocal, setEstadoLocal] = useState(proceso.estado_oferta)
  const [errorCorr, setErrorCorr] = useState<string | null>(null)
  const [versionDetalle, setVersionDetalle] = useState<number | null>(null)
  const [docVisorUrl, setDocVisorUrl] = useState<string | null>(null)
  const [cargandoVisor, setCargandoVisor] = useState(false)
  // Oportunidades checkeadas: { indice: number, texto: string, accion: 'realizado'|'descartado', fecha: string }[]
  const [opChecked, setOpChecked] = useState<Array<{indice:number;texto:string;accion:'realizado'|'descartado';fecha:string}>>(
    ((proceso.metadata_ia as any)?.oportunidades_checkeadas ?? [])
  )

  // Correcciones y versiones
  const metaInit = (proceso.metadata_ia ?? {}) as Record<string, unknown>
  const [correcciones, setCorrecciones] = useState<Correccion[]>((metaInit.correcciones ?? []) as Correccion[])
  const [versiones, setVersiones] = useState<VersionDoc[]>((metaInit.versiones ?? []) as VersionDoc[])
  const [textoCorr, setTextoCorr] = useState<Record<string, string>>({})
  const [expandCorr, setExpandCorr] = useState<Record<string, boolean>>({})
  const [guardandoCorr, setGuardandoCorr] = useState(false)
  const [generandoVersion, setGenerandoVersion] = useState(false)

  function claveCorr(tipo: string, indice: number) { return `${tipo}-${indice}` }
  function getCorr(tipo: string, indice: number) {
    return correcciones.find(c => c.tipo === (tipo as Correccion['tipo']) && c.indice === indice)
  }
  function esAtendido(tipo: string, indice: number) {
    return correcciones.some(c => c.tipo === (tipo as Correccion['tipo']) && c.indice === indice && (c.estado === 'atendido' || c.estado === 'archivado'))
  }

  async function marcarAtendido(tipo: Correccion['tipo'], indice: number) {
    const obs = textoCorr[claveCorr(tipo, indice)] ?? ''
    if (!obs.trim()) { setErrorCorr('Debes escribir una observación antes de registrar.'); return }
    setErrorCorr(null)
    const nuevas = correcciones.filter(c => !(c.tipo === tipo && c.indice === indice))
    const nueva: Correccion = { tipo, indice, observacion: obs, estado: 'atendido', fecha: new Date().toISOString() }
    const updated = [...nuevas, nueva]
    setCorrecciones(updated)
    setExpandCorr(prev => ({ ...prev, [claveCorr(tipo, indice)]: false }))
    setGuardandoCorr(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones: updated }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        setErrorCorr(e.error ?? 'Error al guardar. Intenta de nuevo.')
      }
    } catch { setErrorCorr('Error de red. Intenta de nuevo.') }
    finally { setGuardandoCorr(false) }
  }

  async function desmarcarAtendido(tipo: Correccion['tipo'], indice: number) {
    const updated = correcciones.filter(c => !(c.tipo === tipo && c.indice === indice))
    setCorrecciones(updated)
    setErrorCorr(null)
    try {
      await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones: updated }),
      })
    } catch { /* best effort */ }
  }

  async function generarNuevaVersion() {
    setGenerandoVersion(true)
    setErrorCorr(null)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/nueva-version`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setVersiones(data.versiones)
        setCorrecciones(prev => prev.map(c => c.estado === 'atendido' ? { ...c, estado: 'archivado' as const } : c))
        setTabDoc('versiones')
        setVersionDetalle(data.version.numero)
      } else {
        setErrorCorr(data.error ?? 'Error al generar versión.')
      }
    } catch { setErrorCorr('Error de red al generar versión.') }
    finally { setGenerandoVersion(false) }
  }

  async function toggleOportunidad(indice: number, texto: string, accion: 'realizado' | 'descartado') {
    const yaExiste = opChecked.find(o => o.indice === indice)
    const updated = yaExiste
      ? opChecked.filter(o => o.indice !== indice)
      : [...opChecked, { indice, texto, accion, fecha: new Date().toISOString() }]
    setOpChecked(updated)
    try {
      await fetch(`/api/procesos/${proceso.id}/correcciones`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correcciones, oportunidades_checkeadas: updated }),
      })
    } catch { /* best effort */ }
  }

  async function abrirDocumento(documentoId: string) {
    if (docVisorUrl) { setDocVisorUrl(null); return }
    setCargandoVisor(true)
    try {
      const res = await fetch(`/api/documentos/signed-url?id=${documentoId}`)
      const data = await res.json()
      if (data.url) setDocVisorUrl(data.url)
      else setErrorCorr('No se pudo obtener el documento.')
    } catch { setErrorCorr('Error al abrir el documento.') }
    finally { setCargandoVisor(false) }
  }

  const atendidasActivas = correcciones.filter(c => c.estado === 'atendido').length

  // Glosario de roles (análisis organigrama cross-reference)
  type MapeoRol = {
    tipo: 'mapeo_directo' | 'equivalencia' | 'crear_cargo'
    rol_proceso: string
    cargo_sugerido?: string
    persona_sugerida?: string
    confianza: number
    justificacion: string
    gap_detectado?: string
    accion_recomendada: string
    skills_requeridos?: string[]
  }
  type GlosarioAnalisis = {
    id: string
    score_cobertura_organizacional: number
    resumen_ejecutivo: string
    mapeos: MapeoRol[]
    estado: string
  }
  const [glosarioData, setGlosarioData] = useState<GlosarioAnalisis | null>(null)
  const [cargandoGlosario, setCargandoGlosario] = useState(false)
  const [glosarioCargado, setGlosarioCargado] = useState(false)

  useEffect(() => {
    if (tabDoc === 'roles' && !glosarioCargado && !cargandoGlosario) {
      setCargandoGlosario(true)
      fetch(`/api/portal/glosario-roles?proyecto_id=${proyectoId}`)
        .then(r => r.json())
        .then(d => { if (d.analisis) setGlosarioData(d.analisis) })
        .catch(() => {})
        .finally(() => { setCargandoGlosario(false); setGlosarioCargado(true) })
    }
  }, [tabDoc, glosarioCargado, cargandoGlosario, proyectoId])

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

  async function cargarDocAnalisis() {
    if (docAnalisis || cargandoDoc) return
    setCargandoDoc(true)
    try {
      const res = await fetch(`/api/procesos/${proceso.id}/documento-analisis`)
      if (res.ok) setDocAnalisis(await res.json())
    } catch { /* silent */ }
    finally { setCargandoDoc(false) }
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
    setErrorIA(null)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorIA(data.error ?? `Error ${res.status}`); return }
      if (data.resumen) setResumen(data.resumen)
      else setErrorIA('La IA no devolvió diagnóstico. Intenta de nuevo.')
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setAnalizando(false) }
  }

  async function reanalizarConIA() {
    setResumen(null)
    setAnalizando(true)
    setErrorIA(null)
    try {
      const res = await fetch('/api/discovery/resumir-proceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: proceso.id }),
      })
      const data = await res.json()
      if (!res.ok) { setErrorIA(data.error ?? `Error ${res.status}`); return }
      if (data.resumen) setResumen(data.resumen)
      else setErrorIA('La IA no devolvió diagnóstico. Intenta de nuevo.')
    } catch (e) {
      setErrorIA(e instanceof Error ? e.message : 'Error de conexión')
    } finally { setAnalizando(false) }
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
        onClick={() => { if (!expandido) { setExpandido(true); cargarDocAnalisis() } }}
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
              <span title="Proceso propuesto por IA sin documento formal — requiere validación del consultor" className="text-xs px-2 py-0.5 rounded-full bg-violet-950/60 text-violet-300 border border-violet-700/50 font-medium">✨ Propuesta IA</span>
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

            {/* Loading skeleton */}
            {cargandoDoc && (
              <div className="p-6 flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin shrink-0" />
                <span className="text-sm text-slate-400">Cargando análisis del documento...</span>
              </div>
            )}

            {!cargandoDoc && (
              <>
                {/* ── Tabs ── */}
                <div className="flex gap-0 border-b border-slate-700/50 bg-slate-900/40 px-4">
                  {([
                    { id: 'proceso', label: 'El Proceso', icon: FileText },
                    { id: 'hallazgos', label: 'Hallazgos', icon: AlertTriangle },
                    { id: 'oportunidades', label: 'Oportunidades', icon: TrendingUp },
                    { id: 'roles', label: 'Roles', icon: Users },
                    { id: 'versiones', label: 'Versiones', icon: Clock, badge: versiones.length },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTabDoc(t.id as typeof tabDoc)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${
                        tabDoc === t.id
                          ? 'border-violet-500 text-violet-300'
                          : 'border-transparent text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />{t.label}
                      {'badge' in t && t.badge > 0 && (
                        <span className="bg-violet-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{t.badge}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ── TAB: El Proceso ── */}
                {tabDoc === 'proceso' && (
                  <ProcesoTabContent
                    proceso={proceso}
                    docAnalisis={docAnalisis}
                    critCfg={critCfg}
                    accentColor={accentColor}
                    justificacion={justificacion}
                  />
                )}

                {/* ── TAB: Hallazgos ── */}
                {tabDoc === 'hallazgos' && (() => {
                  const riesgosList = docAnalisis?.analisis_ia?.riesgos_criticos ?? []
                  const hallazgosList = docAnalisis?.analisis_ia?.hallazgos_criticos ?? []
                  const brechasList = docAnalisis?.analisis_ia?.brechas_documentacion ?? []
                  const totalItems = riesgosList.length + hallazgosList.length + brechasList.length
                  const resueltos = atendidasActivas
                  const pct = totalItems > 0 ? Math.round((resueltos / totalItems) * 100) : 0
                  return (
                    <div className="p-5 space-y-7">

                      {/* Error de guardado */}
                      {errorCorr && (
                        <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {errorCorr}
                          <button onClick={() => setErrorCorr(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                        </div>
                      )}

                      {/* ── Progress header ── */}
                      {totalItems > 0 && (
                        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Estado de resolución</p>
                            <span className="text-lg font-black tabular-nums" style={{ color: pct === 100 ? '#34d399' : pct > 50 ? '#fbbf24' : '#f87171' }}>{pct}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#059669,#34d399)' : pct > 50 ? 'linear-gradient(90deg,#d97706,#fbbf24)' : 'linear-gradient(90deg,#dc2626,#f87171)' }} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">{resueltos} de {totalItems} puntos resueltos</p>
                        </div>
                      )}

                      {/* ── Exposiciones operacionales ── */}
                      {riesgosList.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-red-950/60 border border-red-800/50 flex items-center justify-center">
                                <Shield className="w-3.5 h-3.5 text-red-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Exposiciones operacionales</p>
                                <p className="text-xs text-slate-600">Riesgos activos identificados en el documento</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-950/60 border border-red-800/40 text-red-300">
                              {riesgosList.filter((_: unknown, i: number) => !esAtendido('riesgo', i)).length} activos
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(riesgosList as Array<{ riesgo: string; impacto: string; evidencia?: string }>).map((r, i) => {
                              const atendido = esAtendido('riesgo', i)
                              const key = claveCorr('riesgo', i)
                              const abierto = expandCorr[key]
                              const nivel = r.impacto === 'alto' ? 3 : r.impacto === 'medio' ? 2 : 1
                              return (
                                <div key={i}>
                                  {/* Card — overflow-hidden NO va aquí para no cortar el form */}
                                  <div className={`flex gap-0 rounded-2xl border ${
                                    atendido ? 'border-emerald-800/25 bg-emerald-950/5 opacity-60' :
                                    r.impacto === 'alto' ? 'border-red-900/50 bg-gradient-to-r from-red-950/20 to-transparent' :
                                    r.impacto === 'medio' ? 'border-amber-900/40 bg-gradient-to-r from-amber-950/15 to-transparent' :
                                    'border-slate-700/40 bg-slate-800/15'
                                  }`}>
                                    {/* Left severity bar */}
                                    <div className={`w-[3px] rounded-l-2xl shrink-0 ${
                                      atendido ? 'bg-emerald-500' :
                                      r.impacto === 'alto' ? 'bg-red-500' :
                                      r.impacto === 'medio' ? 'bg-amber-400' : 'bg-slate-500'
                                    }`} />

                                    <div className="flex-1 px-4 py-3.5">
                                      <div className="flex items-start gap-3">
                                        <p className={`text-sm font-semibold leading-snug flex-1 ${atendido ? 'line-through text-slate-500' : 'text-white'}`}>{r.riesgo}</p>
                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                          {[1, 2, 3].map(n => (
                                            <div key={n} className={`w-2 h-2 rounded-full ${
                                              n <= nivel
                                                ? atendido ? 'bg-emerald-500' : r.impacto === 'alto' ? 'bg-red-500' : r.impacto === 'medio' ? 'bg-amber-400' : 'bg-slate-400'
                                                : 'bg-slate-700'
                                            }`} />
                                          ))}
                                          <span className={`text-xs font-bold ml-1.5 uppercase ${
                                            atendido ? 'text-emerald-400' : r.impacto === 'alto' ? 'text-red-400' : r.impacto === 'medio' ? 'text-amber-400' : 'text-slate-400'
                                          }`}>{atendido ? 'OK' : r.impacto}</span>
                                        </div>
                                      </div>

                                      {r.evidencia && !atendido && (
                                        <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                                          <span className="text-red-400/70 font-medium">Evidencia · </span>{r.evidencia}
                                        </p>
                                      )}

                                      <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/5">
                                        {!atendido ? (
                                          <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
                                            <Edit2 className="w-3 h-3" />
                                            {abierto ? 'Cerrar' : 'Registrar modificación y/o observación →'}
                                          </button>
                                        ) : (
                                          <button onClick={() => desmarcarAtendido('riesgo', i)}
                                            className="text-xs text-slate-600 hover:text-red-400 transition-colors">
                                            Reactivar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Formulario de corrección — FUERA del card para no ser cortado */}
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-3 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                      <p className="text-xs text-emerald-400 font-semibold">¿Cómo está siendo gestionado este riesgo en tu organización?</p>
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: ya implementamos un control dual desde enero 2025, la segregación de funciones está documentada en el procedimiento P-042..."
                                        rows={3}
                                        className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-3">
                                        <button onClick={() => marcarAtendido('riesgo', i)} disabled={guardandoCorr}
                                          className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
                                          <CheckCircle className="w-4 h-4" /> Marcar como mitigado
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Puntos de atención — timeline ── */}
                      {hallazgosList.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Puntos de atención</p>
                              <p className="text-xs text-slate-600">Aspectos críticos del estado actual · confirma cuáles ya están resueltos</p>
                            </div>
                          </div>

                          <div className="relative">
                            {/* Vertical line */}
                            <div className="absolute left-[19px] top-5 bottom-5 w-px bg-gradient-to-b from-amber-700/40 via-amber-800/20 to-transparent" />

                            <div className="space-y-3">
                              {(hallazgosList as string[]).map((h, i) => {
                                const atendido = esAtendido('hallazgo', i)
                                const key = claveCorr('hallazgo', i)
                                const abierto = expandCorr[key]
                                return (
                                  <div key={i}>
                                    <div className="flex items-start gap-3">
                                      {/* Node */}
                                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                        atendido ? 'border-emerald-600/60 bg-emerald-900/50' : 'border-amber-600/50 bg-amber-950/40'
                                      }`}>
                                        {atendido
                                          ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                                          : <span className="text-amber-300 text-sm font-black">{i + 1}</span>
                                        }
                                      </div>

                                      <div className={`flex-1 rounded-2xl border p-3.5 ${
                                        atendido ? 'border-emerald-800/20 bg-emerald-950/5' : 'border-slate-700/30 bg-slate-800/20'
                                      }`}>
                                        <p className={`text-sm leading-relaxed ${atendido ? 'line-through text-slate-500' : 'text-slate-200'}`}>{h}</p>
                                        <div className="flex items-center gap-3 mt-2.5">
                                          {!atendido ? (
                                            <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
                                              <Edit2 className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Registrar modificación y/o observación →'}
                                            </button>
                                          ) : (
                                            <span className="flex items-center gap-2 text-xs">
                                              <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Resuelto</span>
                                              <button onClick={() => desmarcarAtendido('hallazgo', i)} className="text-slate-600 hover:text-slate-400 transition-colors">· desmarcar</button>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Formulario FUERA del flex-row para no ser cortado */}
                                    {abierto && !atendido && (
                                      <div className="mt-2 ml-14 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                        <p className="text-xs text-emerald-400 font-semibold">¿Cómo está siendo gestionado o resuelto en tu organización?</p>
                                        <textarea
                                          value={textoCorr[key] ?? ''}
                                          onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                          placeholder="Ej: ya incorporado en nuestro proceso desde Q1, tenemos procedimiento P-021 vigente..."
                                          rows={3}
                                          className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                        />
                                        <div className="flex items-center gap-3">
                                          <button onClick={() => marcarAtendido('hallazgo', i)}
                                            className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">
                                            <CheckCircle className="w-4 h-4" /> Marcar como resuelto
                                          </button>
                                          <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                            className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Brechas ── */}
                      {brechasList.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Oportunidades de formalización</p>
                              <p className="text-xs text-slate-600">Áreas sin definición formal detectadas · indica cuáles ya están documentadas</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(brechasList as string[]).map((b, i) => {
                              const atendido = esAtendido('brecha', i)
                              const key = claveCorr('brecha', i)
                              const abierto = expandCorr[key]
                              return (
                                <div key={i}>
                                  <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                                    atendido
                                      ? 'border-emerald-800/25 bg-emerald-950/5 opacity-70'
                                      : 'border-slate-700/30 bg-slate-800/15'
                                  }`}>
                                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${atendido ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                    <p className={`flex-1 text-sm leading-relaxed ${atendido ? 'line-through text-slate-500' : 'text-slate-300'}`}>{b}</p>
                                    <div className="shrink-0 flex items-center gap-3">
                                      {!atendido ? (
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                          className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors whitespace-nowrap">
                                          <Edit2 className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Registrar oportunidad →'}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold"><CheckCircle className="w-3 h-3" /> Formalizado</span>
                                          <button onClick={() => desmarcarAtendido('brecha', i)} className="text-xs text-slate-600 hover:text-slate-400 transition-colors">· desmarcar</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Formulario FUERA del card */}
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-5 p-4 rounded-2xl border border-emerald-700/30 bg-emerald-950/10 space-y-3">
                                      <p className="text-xs text-emerald-400 font-semibold">¿Está esto ya documentado internamente?</p>
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: tenemos procedimiento escrito P-014 vigente desde 2024, disponible en SharePoint..."
                                        rows={3}
                                        className="w-full text-sm text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-3">
                                        <button onClick={() => marcarAtendido('brecha', i)}
                                          className="flex items-center gap-1.5 text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">
                                          <CheckCircle className="w-4 h-4" /> Marcar como formalizado
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── CTA nueva versión ── */}
                      {atendidasActivas > 0 && (
                        <div className="rounded-2xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950/30 to-transparent p-4 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-bold text-emerald-300">{atendidasActivas} punto{atendidasActivas > 1 ? 's' : ''} resuelto{atendidasActivas > 1 ? 's' : ''}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Genera la v{versiones.length + 1} del documento excluyendo los hallazgos ya incorporados en tu organización.</p>
                          </div>
                          <button onClick={generarNuevaVersion} disabled={generandoVersion}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-emerald-900/50">
                            {generandoVersion
                              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                              : <><Zap className="w-4 h-4" /> Consolidar v{versiones.length + 1}</>}
                          </button>
                        </div>
                      )}

                    </div>
                  )
                })()}

                {/* ── TAB: Oportunidades ── */}
                {tabDoc === 'oportunidades' && (() => {
                  const quickWins = (docAnalisis?.analisis_ia?.quick_wins ?? []) as string[]
                  const oportunidades = (docAnalisis?.analisis_ia?.oportunidades_valor ?? []) as Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>
                  const pasos = (docAnalisis?.analisis_ia?.proximos_pasos_sugeridos ?? []) as string[]
                  return (
                    <div className="p-5 space-y-7">

                      {/* ── Quick wins ── */}
                      {quickWins.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-emerald-950/70 border border-emerald-800/50 flex items-center justify-center">
                              <Zap className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Quick wins</p>
                              <p className="text-xs text-slate-600">Acciones ejecutables en menos de 30 días</p>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            {quickWins.map((q, i) => (
                              <div key={i} className="group flex items-start gap-3 rounded-2xl border border-emerald-800/25 bg-gradient-to-r from-emerald-950/20 to-transparent p-4 hover:border-emerald-700/40 transition-all duration-200">
                                <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center shrink-0">
                                  <span className="text-emerald-300 text-sm font-black">{i + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-slate-100 text-sm leading-relaxed font-medium">{q}</p>
                                </div>
                                <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 font-semibold whitespace-nowrap">
                                  ≤ 30 días
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── Oportunidades de valor con checklist ── */}
                      {oportunidades.length > 0 && (() => {
                        const checkedIndices = new Set(opChecked.map(o => o.indice))
                        const activas = oportunidades.filter((_, i) => !checkedIndices.has(i))
                        const historial = opChecked.slice().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-indigo-950/70 border border-indigo-800/50 flex items-center justify-center">
                                  <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Oportunidades de valor</p>
                                  <p className="text-xs text-slate-600">Iniciativas de mayor alcance · {activas.length} activas{historial.length > 0 ? ` · ${historial.length} en historial` : ''}</p>
                                </div>
                              </div>
                            </div>

                            {/* Oportunidades activas */}
                            <div className="space-y-2">
                              {oportunidades.map((o, i) => {
                                const checked = checkedIndices.has(i)
                                if (checked) return null
                                const nivel = o.complejidad_implementacion === 'alta' ? 3 : o.complejidad_implementacion === 'media' ? 2 : 1
                                const color = o.complejidad_implementacion === 'alta' ? 'text-red-400' : o.complejidad_implementacion === 'media' ? 'text-amber-400' : 'text-emerald-400'
                                const dotColor = o.complejidad_implementacion === 'alta' ? 'bg-red-500' : o.complejidad_implementacion === 'media' ? 'bg-amber-400' : 'bg-emerald-500'
                                return (
                                  <div key={i} className="group rounded-2xl border border-indigo-800/20 bg-gradient-to-br from-indigo-950/15 to-slate-900/20 p-4 hover:border-indigo-700/30 transition-all">
                                    <div className="flex items-start gap-3">
                                      {/* Checkbox realizado */}
                                      <button
                                        onClick={() => toggleOportunidad(i, o.oportunidad, 'realizado')}
                                        title="Marcar como realizado"
                                        className="mt-0.5 w-5 h-5 rounded-md border-2 border-indigo-600/50 bg-indigo-950/40 hover:border-emerald-500 hover:bg-emerald-950/40 transition-all shrink-0 flex items-center justify-center"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-semibold leading-snug">{o.oportunidad}</p>
                                        {o.impacto_estimado && (
                                          <p className="text-slate-400 text-xs leading-relaxed mt-1.5">{o.impacto_estimado}</p>
                                        )}
                                        {/* Acción descartar */}
                                        <button
                                          onClick={() => toggleOportunidad(i, o.oportunidad, 'descartado')}
                                          className="mt-2 text-xs text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                          Descartar →
                                        </button>
                                      </div>
                                      {/* Complexity meter */}
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <div className="flex gap-1">
                                          {[1, 2, 3].map(n => (
                                            <div key={n} className={`w-2.5 h-2.5 rounded-full ${n <= nivel ? dotColor : 'bg-slate-700'}`} />
                                          ))}
                                        </div>
                                        <span className={`text-xs font-bold uppercase ${color}`}>
                                          {o.complejidad_implementacion === 'baja' ? 'Rápida' : o.complejidad_implementacion === 'media' ? 'Media' : 'Compleja'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Historial de oportunidades completadas/descartadas */}
                            {historial.length > 0 && (
                              <div className="mt-4 rounded-xl border border-slate-700/30 bg-slate-900/40 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center gap-2">
                                  <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Historial — {historial.length} oportunidad{historial.length > 1 ? 'es' : ''}</p>
                                </div>
                                <div className="divide-y divide-slate-700/20">
                                  {historial.map((h, hi) => {
                                    const original = oportunidades[h.indice]
                                    return (
                                      <div key={hi} className="px-4 py-3 flex items-start gap-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${
                                          h.accion === 'realizado'
                                            ? 'bg-emerald-950/40 border-emerald-700/30 text-emerald-400'
                                            : 'bg-slate-800/60 border-slate-700/30 text-slate-500'
                                        }`}>
                                          {h.accion === 'realizado' ? '✓ Realizado' : '✕ Descartado'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-xs leading-relaxed ${h.accion === 'realizado' ? 'text-slate-400 line-through' : 'text-slate-600 line-through'}`}>
                                            {h.texto}
                                          </p>
                                          {original?.impacto_estimado && (
                                            <p className="text-xs text-slate-600 mt-0.5">{original.impacto_estimado}</p>
                                          )}
                                          <p className="text-xs text-slate-700 mt-1">
                                            {new Date(h.fecha).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' })}
                                          </p>
                                        </div>
                                        {/* Restaurar */}
                                        <button
                                          onClick={() => toggleOportunidad(h.indice, h.texto, h.accion)}
                                          className="text-xs text-slate-600 hover:text-indigo-400 transition-colors shrink-0"
                                          title="Restaurar a activas"
                                        >
                                          Restaurar
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── Próximos pasos — roadmap ── */}
                      {pasos.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center">
                              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Próximos pasos</p>
                              <p className="text-xs text-slate-600">Secuencia recomendada por el análisis</p>
                            </div>
                          </div>

                          {/* Horizontal roadmap */}
                          <div className="relative">
                            {pasos.map((paso, i) => (
                              <div key={i} className="flex gap-4 mb-3 last:mb-0">
                                {/* Step indicator + connector */}
                                <div className="flex flex-col items-center shrink-0">
                                  <div className="w-8 h-8 rounded-full border-2 border-amber-600/50 bg-amber-950/40 flex items-center justify-center">
                                    <span className="text-amber-300 text-xs font-black">{i + 1}</span>
                                  </div>
                                  {i < pasos.length - 1 && (
                                    <div className="w-px flex-1 min-h-[12px] bg-gradient-to-b from-amber-700/40 to-transparent mt-1" />
                                  )}
                                </div>
                                <div className={`flex-1 rounded-2xl border p-3.5 mb-1 ${
                                  i === 0
                                    ? 'border-amber-700/40 bg-amber-950/15'
                                    : 'border-slate-700/30 bg-slate-800/15'
                                }`}>
                                  {i === 0 && (
                                    <p className="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wider">Primero</p>
                                  )}
                                  <p className="text-sm text-slate-200 leading-relaxed">{paso}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {quickWins.length === 0 && oportunidades.length === 0 && pasos.length === 0 && (
                        <div className="py-12 text-center">
                          <TrendingUp className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">El análisis del documento no detectó oportunidades de valor aún.</p>
                        </div>
                      )}

                    </div>
                  )
                })()}

                {/* ── TAB: Roles ── */}
                {tabDoc === 'roles' && (() => {
                  const mapeos: MapeoRol[] = glosarioData?.mapeos ?? []
                  // Filter mapeos relevant to this process's roles
                  const rolesDelProceso = new Set((proceso.roles_involucrados ?? []).map(r => r.toLowerCase()))
                  const mapeosRelevantes = mapeos.filter(m =>
                    rolesDelProceso.size === 0 || rolesDelProceso.has(m.rol_proceso.toLowerCase())
                  )
                  const directos   = mapeosRelevantes.filter(m => m.tipo === 'mapeo_directo')
                  const equivalencias = mapeosRelevantes.filter(m => m.tipo === 'equivalencia')
                  const sinCobertura  = mapeosRelevantes.filter(m => m.tipo === 'crear_cargo')

                  const score = glosarioData?.score_cobertura_organizacional ?? null

                  function ConfianzaMeter({ valor }: { valor: number }) {
                    const pct = Math.max(0, Math.min(100, valor))
                    const color = pct >= 75 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-500'
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums w-6 text-right">{pct}%</span>
                      </div>
                    )
                  }

                  return (
                    <div className="p-5 space-y-5">

                      {/* Loading state */}
                      {cargandoGlosario && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
                          <RefreshCw className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                          Cruzando roles del proceso con tu organigrama…
                        </div>
                      )}

                      {/* No glosario yet */}
                      {!cargandoGlosario && glosarioCargado && !glosarioData && (
                        <div className="rounded-2xl border border-slate-700/40 bg-slate-800/30 p-5 space-y-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-violet-900/30 border border-violet-700/30 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-violet-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">Análisis de organigrama pendiente</p>
                              <p className="text-xs text-slate-500 mt-0.5">Sube tu organigrama en Centro Documental para que AICOUNTS cruce los roles del proceso con tu estructura real.</p>
                            </div>
                          </div>
                          {proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
                            <div className="pt-2 border-t border-slate-700/30 space-y-1.5">
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Roles identificados en el proceso</p>
                              <div className="flex flex-wrap gap-1.5">
                                {proceso.roles_involucrados.map(r => (
                                  <span key={r} className="text-xs bg-slate-700/60 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600/40">{r}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Glosario header + coverage score */}
                      {glosarioData && mapeosRelevantes.length > 0 && (
                        <div className="rounded-2xl border border-slate-700/40 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Brain className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">Inteligencia Organizacional · AICOUNTS</span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{glosarioData.resumen_ejecutivo}</p>
                            </div>
                            {score !== null && (
                              <div className="shrink-0 flex flex-col items-center gap-1">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 font-bold text-lg
                                  ${score >= 70 ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-400' : score >= 40 ? 'border-amber-600/50 bg-amber-950/40 text-amber-400' : 'border-red-600/50 bg-red-950/40 text-red-400'}`}>
                                  {score}
                                </div>
                                <span className="text-[9px] text-slate-600 text-center leading-tight">cobertura<br/>org.</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4 pt-1 border-t border-slate-700/30">
                            {directos.length > 0 && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{directos.length} match directo{directos.length > 1 ? 's' : ''}</span>}
                            {equivalencias.length > 0 && <span className="flex items-center gap-1 text-[10px] text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{equivalencias.length} equivalencia{equivalencias.length > 1 ? 's' : ''}</span>}
                            {sinCobertura.length > 0 && <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />{sinCobertura.length} sin cobertura</span>}
                          </div>
                        </div>
                      )}

                      {/* Match directo cards */}
                      {directos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle className="w-3 h-3" /> Match directo en tu organigrama
                          </p>
                          {directos.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-emerald-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-emerald-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-slate-500">Rol en el proceso</p>
                                    <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[10px] text-slate-500">Asignar a</p>
                                    <p className="text-sm font-semibold text-emerald-300">{m.persona_sugerida ?? m.cargo_sugerido ?? '—'}</p>
                                    {m.persona_sugerida && m.cargo_sugerido && (
                                      <p className="text-[10px] text-slate-500">{m.cargo_sugerido}</p>
                                    )}
                                  </div>
                                </div>
                                <ConfianzaMeter valor={m.confianza} />
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-emerald-950/30 rounded-xl px-3 py-2">
                                  <Zap className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-emerald-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Equivalencia cards */}
                      {equivalencias.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> Equivalencia posible — requiere ajuste
                          </p>
                          {equivalencias.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-amber-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-amber-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-xs text-slate-500">Rol en el proceso</p>
                                    <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-[10px] text-slate-500">Cargo equivalente</p>
                                    <p className="text-sm font-semibold text-amber-300">{m.cargo_sugerido ?? '—'}</p>
                                  </div>
                                </div>
                                <ConfianzaMeter valor={m.confianza} />
                                {m.gap_detectado && (
                                  <div className="flex items-start gap-1.5 bg-amber-950/20 rounded-xl px-3 py-2">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-300 leading-relaxed"><span className="font-semibold">Gap:</span> {m.gap_detectado}</p>
                                  </div>
                                )}
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-slate-800/50 rounded-xl px-3 py-2">
                                  <Target className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-slate-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sin cobertura cards */}
                      {sinCobertura.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3" /> Sin cobertura — considerar contratación externa
                          </p>
                          {sinCobertura.map((m, i) => (
                            <div key={i} className="flex gap-0 rounded-2xl border border-red-800/30 overflow-hidden">
                              <div className="w-[3px] shrink-0 bg-red-500 rounded-l-2xl" />
                              <div className="flex-1 px-4 py-3 space-y-2">
                                <div>
                                  <p className="text-xs text-slate-500">Rol en el proceso</p>
                                  <p className="text-sm font-semibold text-slate-200">{m.rol_proceso}</p>
                                </div>
                                {m.skills_requeridos && m.skills_requeridos.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {m.skills_requeridos.map((s, si) => (
                                      <span key={si} className="text-[10px] bg-red-950/40 text-red-300 border border-red-800/30 px-2 py-0.5 rounded-lg">{s}</span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[11px] text-slate-400 leading-relaxed">{m.justificacion}</p>
                                <div className="flex items-start gap-1.5 bg-red-950/20 rounded-xl px-3 py-2">
                                  <Shield className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-red-300 leading-relaxed">{m.accion_recomendada}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Glosario loaded but no mapeos for this process → show roles pills fallback */}
                      {!cargandoGlosario && glosarioCargado && glosarioData && mapeosRelevantes.length === 0 && proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Roles en este proceso</p>
                          <div className="flex flex-wrap gap-2">
                            {proceso.roles_involucrados.map(r => (
                              <span key={r} className="text-xs bg-slate-800/60 border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded-xl">{r}</span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-600">El análisis de glosario existe pero no incluyó roles específicos de este proceso.</p>
                        </div>
                      )}

                      {/* Brechas de rol (documental) */}
                      {docAnalisis?.analisis_ia?.roles_y_responsabilidades?.brechas_de_rol && docAnalisis.analisis_ia.roles_y_responsabilidades.brechas_de_rol.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> Brechas documentales de rol
                          </p>
                          <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-4 space-y-3">
                            {docAnalisis.analisis_ia.roles_y_responsabilidades.brechas_de_rol.map((b, i) => {
                              const atendido = esAtendido('rol', i)
                              const key = claveCorr('rol', i)
                              const abierto = expandCorr[key]
                              return (
                                <div key={i}>
                                  <div className={`pb-3 ${i < (docAnalisis.analisis_ia?.roles_y_responsabilidades?.brechas_de_rol?.length ?? 0) - 1 ? 'border-b border-amber-800/20' : ''}`}>
                                    <div className="flex items-start gap-2.5">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${atendido ? 'bg-emerald-900/50 border border-emerald-700/40' : 'bg-amber-900/50 border border-amber-700/40'}`}>
                                        {atendido ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <span className="text-amber-400 text-xs font-bold">{i + 1}</span>}
                                      </div>
                                      <p className={`text-sm leading-relaxed flex-1 ${atendido ? 'line-through text-slate-500' : 'text-slate-300'}`}>{b}</p>
                                    </div>
                                    <div className="flex items-center gap-3 pl-7 mt-2">
                                      {!atendido ? (
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: !p[key] }))}
                                          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
                                          <Edit2 className="w-3 h-3" /> {abierto ? 'Cerrar' : 'Comentar y resolver'}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                            <CheckCircle className="w-3 h-3" /> Resuelto
                                          </span>
                                          <button onClick={() => desmarcarAtendido('rol', i)}
                                            className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                                            · Desmarcar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {abierto && !atendido && (
                                    <div className="mt-2 ml-3 p-3 rounded-xl border border-emerald-700/30 bg-emerald-950/10 space-y-2">
                                      <textarea
                                        value={textoCorr[key] ?? ''}
                                        onChange={e => setTextoCorr(p => ({ ...p, [key]: e.target.value }))}
                                        placeholder="Ej: el rol de Coordinador de Inventario cubre esta función..."
                                        rows={2}
                                        className="w-full text-xs text-slate-200 bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-emerald-500/50 placeholder:text-slate-600"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => marcarAtendido('rol', i)}
                                          className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                                          <CheckCircle className="w-3 h-3" /> Marcar como resuelto
                                        </button>
                                        <button onClick={() => setExpandCorr(p => ({ ...p, [key]: false }))}
                                          className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── TAB: Versiones ── */}
                {tabDoc === 'versiones' && (
                  <div className="p-5 space-y-4">
                    {/* Estado actual sin versiones consolidadas */}
                    {versiones.length === 0 && atendidasActivas === 0 && (
                      <div className="text-center py-10 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mx-auto">
                          <Clock className="w-6 h-6 text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium">Sin versiones consolidadas</p>
                        <p className="text-slate-600 text-xs max-w-xs mx-auto">
                          Cuando marques hallazgos como resueltos y consolides, cada versión quedará disponible aquí para descarga.
                        </p>
                      </div>
                    )}

                    {/* CTA cuando hay hallazgos resueltos pero no se ha consolidado */}
                    {atendidasActivas > 0 && (
                      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-emerald-300">
                            {atendidasActivas} hallazgo{atendidasActivas > 1 ? 's' : ''} resuelto{atendidasActivas > 1 ? 's' : ''} sin consolidar
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            La v{versiones.length + 1} se generará con estos hallazgos excluidos.
                          </p>
                        </div>
                        <button
                          onClick={generarNuevaVersion}
                          disabled={generandoVersion}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shrink-0"
                        >
                          {generandoVersion
                            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                            : <><Zap className="w-4 h-4" /> Crear v{versiones.length + 1}</>
                          }
                        </button>
                      </div>
                    )}

                    {/* Error de correcciones */}
                    {errorCorr && (
                      <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errorCorr}
                        <button onClick={() => setErrorCorr(null)} className="ml-auto text-red-500 hover:text-red-300">✕</button>
                      </div>
                    )}

                    {/* Lista de versiones consolidadas */}
                    {versiones.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Versiones consolidadas</p>
                        <div className="space-y-3">
                          {([...versiones] as Array<Record<string,unknown>>).reverse().map((v, i) => {
                            const esUltima = i === 0
                            const vNum = v.numero as number
                            const vDesc = v.descripcion as string
                            const vFecha = v.fecha as string
                            const vCount = v.correcciones_aplicadas as number
                            const detalle = (v.detalle_correcciones ?? []) as Array<{tipo:string;indice:number;texto_original:string;observacion:string;fecha:string}>
                            const docId = v.documento_id as string | null | undefined
                            const abierto = versionDetalle === vNum
                            return (
                              <div key={vNum} className={`rounded-xl border overflow-hidden ${esUltima ? 'border-violet-700/40' : 'border-slate-700/40'}`}>
                                {/* Header de versión */}
                                <div className={`p-4 flex items-center justify-between gap-4 ${esUltima ? 'bg-violet-950/20' : 'bg-slate-800/20'}`}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${esUltima ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                      v{vNum}
                                    </div>
                                    <div className="min-w-0">
                                      <p className={`text-sm font-semibold ${esUltima ? 'text-violet-200' : 'text-slate-300'}`}>
                                        Versión {vNum}
                                        {esUltima && <span className="ml-2 text-xs font-normal text-violet-400 bg-violet-950/60 border border-violet-800/40 px-2 py-0.5 rounded-full">Última</span>}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-0.5">{vDesc}</p>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        {new Date(vFecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        {vCount > 0 && ` · ${vCount} mejora${vCount > 1 ? 's' : ''}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {detalle.length > 0 && (
                                      <button
                                        onClick={() => setVersionDetalle(abierto ? null : vNum)}
                                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600/40 transition-all"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        {abierto ? 'Cerrar' : 'Ver detalle'}
                                      </button>
                                    )}
                                    <a
                                      href={`/api/procesos/${proceso.id}/exportar?v=${vNum}`}
                                      download={`${proceso.nombre.replace(/[^a-z0-9]/gi,'_')}_v${vNum}.html`}
                                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all ${
                                        esUltima ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-slate-600/40'
                                      }`}
                                    >
                                      <ArrowRight className="w-3.5 h-3.5 -rotate-45" />
                                      Descargar
                                    </a>
                                  </div>
                                </div>

                                {/* Panel de detalle de correcciones con visor de documento */}
                                {abierto && detalle.length > 0 && (
                                  <div className="border-t border-slate-700/40 bg-slate-900/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mejoras aplicadas en esta versión</p>
                                      {docId && (
                                        <button
                                          onClick={() => abrirDocumento(docId)}
                                          disabled={cargandoVisor}
                                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-700/40 hover:bg-indigo-700/60 text-indigo-300 border border-indigo-700/40 transition-all disabled:opacity-50"
                                        >
                                          {cargandoVisor ? <span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                          {docVisorUrl ? 'Cerrar documento' : 'Ver documento fuente'}
                                        </button>
                                      )}
                                    </div>

                                    {/* Visor PDF inline */}
                                    {docVisorUrl && (
                                      <div className="rounded-xl overflow-hidden border border-indigo-700/30 bg-slate-950">
                                        <div className="flex items-center justify-between px-3 py-2 bg-indigo-950/40 border-b border-indigo-700/20">
                                          <p className="text-xs text-indigo-300 font-medium">Documento fuente — localiza los ítems del detalle abajo</p>
                                          <button onClick={() => setDocVisorUrl(null)} className="text-slate-500 hover:text-slate-300 text-xs">✕ Cerrar</button>
                                        </div>
                                        <iframe
                                          src={docVisorUrl}
                                          className="w-full"
                                          style={{ height: '480px' }}
                                          title="Documento fuente"
                                        />
                                      </div>
                                    )}

                                    {/* Lista de correcciones con contexto */}
                                    <div className="space-y-2">
                                      {detalle.map((d, di) => {
                                        const TIPO_LABEL: Record<string,string> = { riesgo: 'Riesgo', hallazgo: 'Hallazgo', brecha: 'Brecha', rol: 'Rol' }
                                        const TIPO_COLOR: Record<string,string> = {
                                          riesgo: 'bg-red-950/40 border-red-700/30 text-red-300',
                                          hallazgo: 'bg-amber-950/40 border-amber-700/30 text-amber-300',
                                          brecha: 'bg-blue-950/40 border-blue-700/30 text-blue-300',
                                          rol: 'bg-violet-950/40 border-violet-700/30 text-violet-300',
                                        }
                                        return (
                                          <div key={di} className="rounded-lg border border-slate-700/30 bg-slate-800/30 p-3 space-y-2">
                                            <div className="flex items-start gap-2">
                                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${TIPO_COLOR[d.tipo] ?? 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                                                {TIPO_LABEL[d.tipo] ?? d.tipo} #{d.indice + 1}
                                              </span>
                                              <p className="text-xs text-slate-400 leading-relaxed">{d.texto_original || '(ítem del documento)'}</p>
                                            </div>
                                            <div className="flex items-start gap-2 ml-1">
                                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                              <p className="text-xs text-emerald-300 italic">"{d.observacion}"</p>
                                            </div>
                                            <p className="text-xs text-slate-600 ml-5">
                                              {new Date(d.fecha).toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                                            </p>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Decisión (siempre visible al fondo) ── */}
                <div className="px-5 pb-5 pt-2 border-t border-slate-700/40">
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    estadoLocal === 'aceptado' ? 'bg-emerald-950/20 border-emerald-700/40' :
                    estadoLocal === 'rechazado' ? 'bg-red-950/20 border-red-800/40' :
                    'bg-slate-800/30 border-slate-700/40'
                  }`}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Tu decisión sobre este proceso</p>
                    {estadoLocal === 'propuesto' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => cambiarEstado('aceptado')} disabled={aprobando}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40">
                          <CheckCircle className="w-4 h-4" /> Aceptar proceso
                        </button>
                        <button onClick={() => cambiarEstado('rechazado')} disabled={aprobando}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-red-900/60 hover:bg-red-900/80 text-red-300 border border-red-800/50 transition-all disabled:opacity-50">
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}
                    {estadoLocal === 'aceptado' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-bold">Proceso aceptado — inventario oficial</span>
                        </div>
                        <button onClick={() => cambiarEstado('rechazado')} disabled={aprobando} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Rechazar</button>
                      </div>
                    )}
                    {estadoLocal === 'rechazado' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400">
                          <XCircle className="w-5 h-5" />
                          <span className="text-sm font-bold">Proceso rechazado — la consultora revisará</span>
                        </div>
                        <button onClick={() => setEstadoLocal('propuesto' as any)} disabled={aprobando} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">Deshacer</button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
                <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 text-center space-y-2">
                  {errorIA ? (
                    <>
                      <p className="text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Error al analizar
                      </p>
                      <p className="text-red-300/70 text-xs">{errorIA}</p>
                      <button onClick={analizarConIA} className="text-xs text-violet-400 hover:text-violet-300 underline transition-colors">
                        Reintentar
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-500 text-xs">Presiona "Analizar con IA" para obtener el diagnóstico completo de este {esHijo ? 'proceso' : 'macroproceso'}.</p>
                  )}
                </div>
              )}

              {resumen && saludCfg && (
                <div className={`rounded-xl border p-5 space-y-4 ${saludCfg.bg} ${saludCfg.border}`}>

                  {/* Header: badge + docs count + madurez */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">AICOUNTS Intelligence</span>
                      {(resumen.documentos_considerados ?? 0) > 0 && (
                        <span className="text-[10px] bg-violet-900/50 text-violet-300 border border-violet-700/40 px-2 py-0.5 rounded-full font-medium">
                          {resumen.documentos_considerados} doc{(resumen.documentos_considerados ?? 0) !== 1 ? 's' : ''} analizados
                        </span>
                      )}
                      {!resumen.ancla_documental && (
                        <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/30 px-2 py-0.5 rounded-full">Análisis preliminar</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {resumen.nivel_madurez && (
                        <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-700/40">{resumen.nivel_madurez}</span>
                      )}
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${saludCfg.color} bg-slate-900/60 border border-current/20`}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: 'currentColor' }} />
                        {saludCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <p className="text-slate-200 text-sm leading-relaxed">{resumen.diagnostico}</p>

                  {/* Impacto + Quick Win */}
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

                  {/* Brechas principales */}
                  {resumen.brechas_principales && resumen.brechas_principales.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" /> Brechas críticas detectadas
                      </p>
                      <ul className="space-y-1">
                        {resumen.brechas_principales.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-red-900/50 border border-red-700/40 flex items-center justify-center text-red-400 text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Oportunidades de valor */}
                  {resumen.oportunidades_valor && resumen.oportunidades_valor.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3" /> Oportunidades de valor
                      </p>
                      <ul className="space-y-1">
                        {resumen.oportunidades_valor.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400 shrink-0 mt-0.5">✦</span>
                            {o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Riesgos críticos */}
                  {resumen.riesgos_criticos && resumen.riesgos_criticos.length > 0 && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Shield className="w-3 h-3" /> Riesgos a gestionar
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {resumen.riesgos_criticos.map((r, i) => (
                          <span key={i} className="text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/30 px-2 py-0.5 rounded-lg">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Benchmark industria */}
                  {resumen.benchmark_industria && (
                    <div className="bg-slate-900/50 rounded-xl p-3 space-y-1 border border-violet-800/20">
                      <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                        <BarChart3 className="w-3 h-3" /> Benchmark de industria
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">{resumen.benchmark_industria}</p>
                    </div>
                  )}

                  {/* Automatización + Siguiente paso */}
                  <div className="flex items-start gap-3 flex-wrap pt-1 border-t border-slate-800/60">
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
                    <ProcesoCard key={hijo.id} proceso={hijo as ProcesoConHijos} esHijo proyectoId={proyectoId} />
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
          {totalProcesos > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Análisis activo · {totalProcesos} procesos</span>
            </div>
          )}
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

            {/* Navegación de etapas — clickeables */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  step: '1',
                  icon: FileText,
                  label: 'Centro Documental',
                  desc: 'Vuelve a revisar o agregar documentos al proyecto.',
                  color: 'text-violet-400',
                  bg: 'bg-violet-950/20 border-violet-800/20',
                  href: '/documentos',
                  done: true,
                },
                {
                  step: '2',
                  icon: Brain,
                  label: 'Discovery ejecutado',
                  desc: `${documentos.filter(d => d.estado_procesamiento === 'listo').length} documentos analizados. Puedes re-ejecutar desde Centro Documental si subes nuevos archivos.`,
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-950/20 border-emerald-800/20',
                  href: null,
                  done: true,
                },
                {
                  step: '3',
                  icon: CheckCircle,
                  label: 'Revisión en curso',
                  desc: `${aceptados} aceptados · ${pendientes} pendientes. Acepta o rechaza cada proceso y profundiza con IA.`,
                  color: 'text-blue-400',
                  bg: 'bg-blue-950/30 border-blue-800/40',
                  href: null,
                  done: false,
                },
              ].map(({ step, icon: Icon, label, desc, color, bg, href, done }) => (
                href ? (
                  <a key={step} href={href} className={`rounded-xl border px-3 py-3 ${bg} hover:brightness-125 transition-all cursor-pointer block`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-600">PASO {step}</span>
                      <span className="text-xs text-emerald-500 font-semibold">✓ Hecho</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                    <p className="text-xs text-violet-400 mt-1.5">→ Ir a documentos</p>
                  </a>
                ) : (
                  <div key={step} className={`rounded-xl border px-3 py-3 ${bg}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-600">PASO {step}</span>
                      {done && <span className="text-xs text-emerald-500 font-semibold">✓ Hecho</span>}
                      {!done && <span className="text-xs text-blue-400 font-semibold animate-pulse">● Aquí ahora</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                )
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
              <ProcesoCard key={macro.id} proceso={macro} proyectoId={proyectoId} />
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
          <div id="glosario-roles">
            <GlosarioRoles
              proyectoId={proyectoId}
              nombreProyecto={nombreProyecto}
              rolesDetectados={rolesDetectados}
            />
          </div>
        )
      )}
    </div>
  )
}
