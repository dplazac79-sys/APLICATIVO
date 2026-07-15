'use client'

import { useState, useEffect } from 'react'
import { Sparkles, CheckCircle2, AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import type { ProcesoConHijos, DocAnalisis } from './types'

export type PlanImplementacion = {
  contexto_estrategico: string
  situacion_actual: string
  antes: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  durante: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  despues: Array<{ categoria: string; accion: string; responsable: string; urgencia: string }>
  factores_criticos_exito: string[]
  riesgos_implementacion: string[]
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

export function ProcesoTabContent({ proceso, docAnalisis, critCfg, accentColor, justificacion }: {
  proceso: ProcesoConHijos
  docAnalisis: DocAnalisis | null
  critCfg: { label: string; color: string; bg: string; accent: string } | null
  accentColor: string
  justificacion: string | null | undefined
}) {
  const ia = docAnalisis?.analisis_ia
  const planGuardado = (proceso.metadata_ia as { plan_implementacion?: PlanImplementacion } | null)?.plan_implementacion
  const [plan, setPlan] = useState<PlanImplementacion | null>(planGuardado ?? null)
  const [generandoPlan, setGenerandoPlan] = useState(false)
  const [faseActiva, setFaseActiva] = useState<'antes' | 'durante' | 'despues'>('antes')

  useEffect(() => {
    if (plan) return
    fetch(`/api/procesos/${proceso.id}/recomendacion-implementacion`)
      .then(r => r.json())
      .then(d => { if (d.plan) setPlan(d.plan) })
      .catch(() => {})
  }, [proceso.id, plan]) // el early-return `if (plan) return` evita fetch duplicado cuando plan pasa de null a un valor

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
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Extraído del documento formal
            </p>
          </div>
        ) : proceso.origen === 'propuesta_ia' && justificacion ? (
          <p className="text-slate-200 text-sm leading-relaxed">{justificacion}</p>
        ) : (
          <p className="text-slate-400 text-sm italic">Sin resumen disponible — procesa el documento para ver este análisis.</p>
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
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Madurez AMO</p>
              <div className="flex items-center gap-1.5">
                {madurezDots.map(n => (
                  <div key={n} className={`flex-1 h-2 rounded-full transition-all ${n <= madurezN ? accentColor : 'bg-slate-700/60'}`} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xl font-black ${madurezCfg.color}`}>{madurezN}<span className="text-slate-400 text-sm font-normal">/5</span></span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  madurezN <= 1 ? 'bg-red-950/60 text-red-300 border-red-800/40' :
                  madurezN <= 2 ? 'bg-orange-950/60 text-orange-300 border-orange-800/40' :
                  madurezN <= 3 ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' :
                  'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                }`}>{ia?.nivel_madurez_nombre ?? madurezCfg.label}</span>
              </div>
              {ia?.nivel_madurez_evidencia && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{ia.nivel_madurez_evidencia}</p>
              )}
            </div>
          )}

          {/* Criticidad + Roles */}
          <div className="space-y-2">
            {critCfg && (
              <div className={`rounded-xl border p-3 ${critCfg.bg}`}>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Criticidad</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${critCfg.color}`} />
                  <span className={`text-sm font-bold ${critCfg.color}`}>{critCfg.label}</span>
                </div>
              </div>
            )}
            {proceso.roles_involucrados && proceso.roles_involucrados.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Roles</p>
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
              <p className="text-xs text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" /> Del documento</p>
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
            <p className="text-slate-400 text-xs">Genera un roadmap estructurado con fases, responsables y factores críticos de éxito.</p>
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
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="text-base">{f.emoji}</span>
                  <span>{f.label}</span>
                  <span className={`text-xs font-normal ${faseActiva === f.id ? 'text-slate-400' : 'text-slate-400'}`}>{f.desc}</span>
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
                    <p className="text-xs text-slate-400 mt-0.5">→ {item.responsable}</p>
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
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
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
              className="text-xs text-slate-400 hover:text-slate-400 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Regenerar plan
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
