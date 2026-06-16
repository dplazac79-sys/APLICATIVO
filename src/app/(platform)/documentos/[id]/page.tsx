import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, FileText, AlertTriangle, TrendingUp, Zap, Target,
  Shield, Users, ChevronRight, Award, BarChart3, Clock, Brain
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const NIVEL_CONFIG: Record<number, { color: string; bg: string; bar: string; label: string }> = {
  1: { color: 'text-red-400', bg: 'bg-red-950/40 border-red-800/50', bar: 'bg-red-500', label: 'Reactivo' },
  2: { color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800/50', bar: 'bg-orange-500', label: 'Definido' },
  3: { color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/50', bar: 'bg-amber-500', label: 'Gestionado' },
  4: { color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/50', bar: 'bg-emerald-500', label: 'Optimizado' },
  5: { color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/50', bar: 'bg-indigo-500', label: 'Inteligente' },
}

const IMPACTO_CONFIG: Record<string, { color: string; label: string }> = {
  alto: { color: 'bg-red-950 text-red-400 border-red-800', label: 'Impacto Alto' },
  medio: { color: 'bg-amber-950 text-amber-400 border-amber-800', label: 'Impacto Medio' },
  bajo: { color: 'bg-slate-800 text-slate-400 border-slate-700', label: 'Impacto Bajo' },
}

const COMPLEJIDAD_CONFIG: Record<string, string> = {
  alta: 'text-red-400',
  media: 'text-amber-400',
  baja: 'text-emerald-400',
}

export default async function DocumentoAnalisisPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documento')
    .select('*, proyecto(nombre, cliente(razon_social))')
    .eq('id', params.id)
    .single()

  if (!doc) notFound()

  const clasificacion = doc.clasificacion as Record<string, unknown> | null
  const analisis = (doc as Record<string, unknown>).analisis_ia as Record<string, unknown> | null

  // Fallback: parse resumen_ejecutivo if analisis_ia not available
  const resumen = analisis ?? (() => {
    try { return JSON.parse(doc.resumen_ejecutivo ?? '{}') } catch { return null }
  })()

  const proyecto = Array.isArray(doc.proyecto) ? doc.proyecto[0] : doc.proyecto
  const cliente = Array.isArray(proyecto?.cliente) ? proyecto?.cliente[0] : proyecto?.cliente

  const nivel = (resumen?.nivel_madurez_amo as number) ?? 2
  const nivelCfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG[2]

  const hallazgos = (resumen?.hallazgos_criticos as string[]) ?? []
  const riesgos = (resumen?.riesgos_criticos as Array<{ riesgo: string; impacto: string; evidencia: string }>) ?? []
  const oportunidades = (resumen?.oportunidades_valor as Array<{ oportunidad: string; impacto_estimado: string; complejidad_implementacion: string }>) ?? []
  const quickWins = (resumen?.quick_wins as string[]) ?? []
  const procesos = (resumen?.procesos_identificados as string[]) ?? []
  const rolesId = (resumen?.roles_y_responsabilidades as Record<string, unknown>)?.roles_identificados as string[] ?? []
  const brechasRol = (resumen?.roles_y_responsabilidades as Record<string, unknown>)?.brechas_de_rol as string[] ?? []
  const brechasDoc = (resumen?.brechas_documentacion as string[]) ?? []
  const proximos = (resumen?.proximos_pasos_sugeridos as string[]) ?? []

  const hasAnalisis = resumen && (resumen.resumen_ejecutivo || hallazgos.length > 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back nav */}
      <Link
        href="/documentos"
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al Centro Documental
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/50 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-white truncate">{doc.nombre_archivo}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {cliente?.razon_social && (
                <span className="text-slate-500 text-xs">{cliente.razon_social}</span>
              )}
              {proyecto?.nombre && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-700" />
                  <span className="text-slate-500 text-xs">{proyecto.nombre}</span>
                </>
              )}
              <span className="text-slate-700">·</span>
              <span className="text-slate-600 text-xs">
                {new Date(doc.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {clasificacion?.bloque && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                {String(clasificacion.bloque)}
              </span>
            )}
            {clasificacion?.industria_detectada && (
              <span className="text-xs text-slate-500">{String(clasificacion.industria_detectada)}</span>
            )}
          </div>
        </div>

        {clasificacion?.tipo_documento && (
          <p className="text-slate-500 text-sm mt-4 italic">{String(clasificacion.tipo_documento)}</p>
        )}
      </div>

      {!hasAnalisis && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-8 text-center">
          <Brain className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <p className="text-amber-400 font-medium">Este documento aún no ha sido analizado por IA</p>
          <p className="text-slate-500 text-sm mt-1">Regresa al Centro Documental y usa el botón "Analizar con IA"</p>
        </div>
      )}

      {hasAnalisis && (
        <>
          {/* Diagnóstico ejecutivo — full width hero */}
          <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-800/40 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">Diagnóstico Ejecutivo — ProcessOS Intelligence Engine</span>
            </div>
            {resumen.resumen_ejecutivo && (
              <p className="text-white text-base leading-relaxed font-light">
                {String(resumen.resumen_ejecutivo)}
              </p>
            )}
            {resumen.diagnostico_operacional && (
              <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800 pt-4">
                {String(resumen.diagnostico_operacional)}
              </p>
            )}
          </div>

          {/* Recomendación CEO — destaque máximo */}
          {resumen.recomendacion_ejecutiva && (
            <div className="bg-gradient-to-r from-amber-950/50 to-orange-950/30 border border-amber-700/50 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-900/50 border border-amber-700/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Recomendación para el Directorio</p>
                  <p className="text-white text-sm leading-relaxed font-medium">
                    {String(resumen.recomendacion_ejecutiva)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nivel de Madurez AMO */}
          <div className={`border rounded-xl p-5 ${nivelCfg.bg}`}>
            <div className="flex items-center gap-2 mb-4">
              <Award className={`w-4 h-4 ${nivelCfg.color}`} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${nivelCfg.color}`}>
                Escala de Madurez Operacional AICOUNTS (AMO)
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between mb-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        n === nivel
                          ? `${nivelCfg.bar} border-transparent text-white scale-110`
                          : n < nivel
                          ? 'bg-slate-700 border-slate-600 text-slate-400'
                          : 'bg-slate-900 border-slate-800 text-slate-700'
                      }`}>
                        {n}
                      </div>
                      <span className={`text-xs hidden sm:block ${n === nivel ? nivelCfg.color : 'text-slate-700'}`}>
                        {NIVEL_CONFIG[n].label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${nivelCfg.bar}`}
                    style={{ width: `${(nivel / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            {resumen.nivel_madurez_evidencia && (
              <p className={`text-sm mt-3 leading-relaxed ${nivelCfg.color} opacity-80`}>
                {String(resumen.nivel_madurez_evidencia)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hallazgos Críticos */}
            {hallazgos.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">Hallazgos Críticos</span>
                </div>
                <ul className="space-y-2.5">
                  {hallazgos.map((h: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-sm text-slate-300 leading-relaxed">
                      <span className="text-red-500 font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Riesgos Críticos */}
            {riesgos.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span className="text-orange-400 text-xs font-semibold uppercase tracking-widest">Riesgos Detectados</span>
                </div>
                <ul className="space-y-3">
                  {riesgos.map((r, i) => {
                    const cfg = IMPACTO_CONFIG[r.impacto] ?? IMPACTO_CONFIG.medio
                    return (
                      <li key={i} className="space-y-1">
                        <div className="flex items-start gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <p className="text-slate-300 text-sm leading-snug">{r.riesgo}</p>
                        </div>
                        {r.evidencia && (
                          <p className="text-slate-600 text-xs pl-16">{r.evidencia}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Oportunidades de Valor */}
            {oportunidades.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Oportunidades de Valor</span>
                </div>
                <ul className="space-y-3">
                  {oportunidades.map((o, i) => (
                    <li key={i} className="space-y-1">
                      <p className="text-slate-300 text-sm leading-snug">{o.oportunidad}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-500">{o.impacto_estimado}</span>
                        {o.complejidad_implementacion && (
                          <span className={`font-medium ${COMPLEJIDAD_CONFIG[o.complejidad_implementacion] ?? 'text-slate-400'}`}>
                            Complejidad {o.complejidad_implementacion}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Wins */}
            {quickWins.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">Quick Wins</span>
                </div>
                <ul className="space-y-2">
                  {quickWins.map((q: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
                      <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Procesos identificados */}
          {procesos.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-xs font-semibold uppercase tracking-widest">Procesos Identificados</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {procesos.map((p: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300 bg-slate-800/50 rounded-lg px-3 py-2">
                    <span className="text-blue-500 shrink-0">→</span>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Roles y brechas */}
          {(rolesId.length > 0 || brechasRol.length > 0) && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest">Roles y Responsabilidades</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rolesId.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium">Roles detectados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rolesId.map((r: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {brechasRol.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-500 mb-2 font-medium">Brechas de rol detectadas</p>
                    <ul className="space-y-1">
                      {brechasRol.map((b: string, i: number) => (
                        <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                          <span className="text-amber-600 shrink-0">⚠</span>{b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Brechas documentación */}
          {brechasDoc.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-5 space-y-3">
              <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Brechas de Documentación</p>
              <ul className="space-y-1.5">
                {brechasDoc.map((b: string, i: number) => (
                  <li key={i} className="text-sm text-slate-400 flex gap-2">
                    <span className="text-amber-600 shrink-0">—</span>{b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Próximos pasos */}
          {proximos.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Próximos Pasos — Equipo AICOUNTS</span>
              </div>
              <ol className="space-y-2">
                {proximos.map((p: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-300">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-500 shrink-0 mt-0.5 font-mono">
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Clasificación técnica */}
          {clasificacion && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 space-y-3">
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest">Clasificación Metodológica</p>
              <div className="flex flex-wrap gap-4 text-xs">
                {clasificacion.bloque && (
                  <div>
                    <span className="text-slate-600">Bloque principal: </span>
                    <span className="text-slate-300">{String(clasificacion.bloque)}</span>
                  </div>
                )}
                {(clasificacion.bloques_secundarios as string[])?.length > 0 && (
                  <div>
                    <span className="text-slate-600">Bloques secundarios: </span>
                    <span className="text-slate-300">
                      {(clasificacion.bloques_secundarios as string[]).join(', ')}
                    </span>
                  </div>
                )}
                {clasificacion.confianza && (
                  <div>
                    <span className="text-slate-600">Confianza: </span>
                    <span className="text-slate-300">{Math.round((clasificacion.confianza as number) * 100)}%</span>
                  </div>
                )}
              </div>
              {(clasificacion.palabras_clave as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(clasificacion.palabras_clave as string[]).map((k: string, i: number) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700/50">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer firma */}
          <div className="text-center py-4">
            <p className="text-slate-700 text-xs">
              Análisis generado por ProcessOS Intelligence Engine · AICOUNTS Consultores
            </p>
          </div>
        </>
      )}
    </div>
  )
}
