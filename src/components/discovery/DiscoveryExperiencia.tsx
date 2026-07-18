'use client'

import { useState } from 'react'
import {
  Brain, Sparkles, CheckCircle2, XCircle, Clock, Users, Activity, Layers
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
              <span><span className="text-emerald-400 font-semibold">{totalProcesos}</span> procesos mapeados</span>
            </div>
          )}
        </div>

        {/* Panel de resultados post-discovery */}
        {totalProcesos > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800 space-y-4">

            {/* Narrativa clara del resultado — qué encontró la IA y qué significa */}
            <div className="bg-violet-950/30 border border-violet-800/30 rounded-xl px-4 py-4 space-y-3">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm text-white font-semibold">
                    La IA leyó {documentos.filter(d => d.estado_procesamiento === 'listo').length} de tus documentos y mapeó el macroproceso <span className="text-violet-300">{macroprocesos[0]?.nombre ?? 'Cadena de Suministro'}</span>
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Revisó <span className="text-emerald-400 font-semibold">{procesosDetectados} proceso{procesosDetectados !== 1 ? 's' : ''}</span> ya documentado{procesosDetectados !== 1 ? 's' : ''} en lo que subiste y, dentro de cada uno, buscó puntos de mejora concretos — cada sugerencia la revisas y decides tú si aplicarla, documento por documento.
                  </p>
                </div>
              </div>
            </div>

            {/* Qué te toca hacer ahora — una sola instrucción, sin duplicar la barra de abajo */}
            <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
              {pendientes === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-sm text-slate-300">
                    <span className="text-emerald-400 font-semibold">Ya revisaste todo.</span> Este mapa de procesos es la base del resto del proyecto — Artefactos, Roadmap y Simulador se construyen sobre lo que aceptaste aquí.
                  </p>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-sm text-slate-300">
                    <span className="text-amber-400 font-semibold">Te toca revisar {pendientes} proceso{pendientes !== 1 ? 's' : ''}.</span> Abre cada uno abajo y decide si corresponde a tu organización — nada queda oficial hasta que tú lo apruebas.
                  </p>
                </>
              )}
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
        /* Feature 3: Glosario de Roles tab — el análisis se arma a partir de
           los documentos ya procesados del proyecto (roles_y_responsabilidades
           de analisis_ia en /api/portal/glosario-roles), no de procesos
           aceptados. rolesDetectados (roles de procesos con estado_oferta =
           'aceptado') nunca llega a usarse en el backend, así que exigir
           aceptar procesos antes de ver esta pestaña era una restricción
           artificial que no reflejaba cómo funciona realmente el análisis. */
        <div id="glosario-roles">
          <GlosarioRoles
            proyectoId={proyectoId}
            nombreProyecto={nombreProyecto}
            rolesDetectados={rolesDetectados}
          />
        </div>
      )}
    </div>
  )
}
