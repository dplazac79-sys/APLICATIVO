'use client'

import { useState } from 'react'
import {
  Brain, Sparkles, CheckCircle2, XCircle, Clock, Users, Activity, Layers, FileText
} from 'lucide-react'
import { GlosarioRoles } from '@/app/(platform)/portal/GlosarioRoles'
import DiscoveryAcciones from './DiscoveryAcciones'
import type { ProcesoConHijos, DocumentoItem } from './types'
import { ProcesoCard } from './ProcesoCard'
import { EstadoVacioDiscovery } from './EstadoVacioDiscovery'

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
            <div className="flex items-center gap-2 text-xs text-slate-400">
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
                  icon: CheckCircle2,
                  label: pendientes === 0 ? 'Revisión completa' : 'Revisión en curso',
                  desc: `${aceptados} aceptados · ${pendientes} pendientes. Acepta o rechaza cada proceso y profundiza con IA.`,
                  color: pendientes === 0 ? 'text-emerald-400' : 'text-blue-400',
                  bg: pendientes === 0 ? 'bg-emerald-950/20 border-emerald-800/20' : 'bg-blue-950/30 border-blue-800/40',
                  href: null,
                  done: pendientes === 0,
                },
              ].map(({ step, icon: Icon, label, desc, color, bg, href, done }) => (
                href ? (
                  <a key={step} href={href} className={`rounded-xl border px-3 py-3 ${bg} hover:brightness-125 transition-all cursor-pointer block`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-400">PASO {step}</span>
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
                      <span className="text-xs font-bold text-slate-400">PASO {step}</span>
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">{aceptados}</span> aceptados
                  </span>
                  {rechazados > 0 && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400 font-semibold">{rechazados}</span> rechazados
                    </span>
                  )}
                </div>
                <span className="text-slate-400">{pctAprobacion}% validado</span>
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
                  {t.count}
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
              <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
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
              <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">{macroprocesos.length}</span>
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

          {(() => {
            const hijos = macroprocesos.flatMap(m => m.hijos ?? [])
            const totalHijos = hijos.length
            const revisados = hijos.filter(p => p.estado_oferta === 'aceptado' || p.estado_oferta === 'rechazado').length
            const todosRevisados = totalHijos > 0 && revisados === totalHijos
            const algunoRevisado = revisados > 0 && !todosRevisados

            if (todosRevisados) return (
              <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-800/30 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-emerald-300/80 text-xs">
                  Todos los procesos han sido revisados. Puedes profundizar con <span className="font-medium text-emerald-300">Analizar con IA</span> en cualquier proceso para diagnóstico ejecutivo detallado.
                </p>
              </div>
            )
            if (algunoRevisado) return (
              <div className="flex items-center gap-3 bg-amber-950/20 border border-amber-800/20 rounded-xl px-4 py-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-amber-300/80 text-xs">
                  <span className="font-medium text-amber-300">{revisados} de {totalHijos} procesos</span> revisados. Acepta o rechaza los restantes para completar la validación.
                </p>
              </div>
            )
            return (
              <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <p className="text-slate-400 text-xs">
                  Abre cada proceso, revisa el análisis y acepta o rechaza. Usa <span className="text-violet-300 font-medium">Analizar con IA</span> para obtener diagnóstico ejecutivo de criticidad e impacto al negocio.
                </p>
              </div>
            )
          })()}

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
                El Glosario de Roles se construye a partir de los roles involucrados en los procesos que hayas <span className="text-emerald-400 font-medium">aceptado</span>. Ve a la pestaña <span className="text-violet-300 font-medium">Macroprocesos y Procesos</span> y valida los procesos relevantes para desbloquear este análisis.
              </p>
            </div>
            <div className="flex items-start gap-3 max-w-sm mx-auto bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-left mt-2">
              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  Abre la pestaña <strong className="text-slate-300">Macroprocesos y Procesos</strong>
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
              <Activity className="w-4 h-4" /> Ver Macroprocesos y Procesos
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
