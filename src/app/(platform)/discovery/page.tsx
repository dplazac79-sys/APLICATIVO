import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Brain, FileSearch, CheckCircle, XCircle, Clock, Target, TrendingUp,
  Zap, Map, AlertTriangle, Award, BarChart3
} from 'lucide-react'
import DiscoveryAcciones from '@/components/discovery/DiscoveryAcciones'
import DiscoveryTabsWrapper from '@/components/discovery/DiscoveryTabsWrapper'
import ProcesoRevisor from '@/components/discovery/ProcesoRevisor'
import { GlosarioRoles } from '@/app/(platform)/portal/GlosarioRoles'
import type { Proceso, Proyecto } from '@/types/database'

export const dynamic = 'force-dynamic'

const ORIGEN_CONFIG = {
  detectado: { label: 'Detectado en doc.', class: 'bg-blue-950 text-blue-300 border-blue-800' },
  propuesta_ia: { label: 'Propuesta IA', class: 'bg-purple-950 text-purple-300 border-purple-800' },
  manual: { label: 'Manual', class: 'bg-slate-800 text-slate-300 border-slate-700' },
}

const OFERTA_ICON = {
  propuesto: <Clock className="w-4 h-4 text-amber-400" />,
  aceptado: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  rechazado: <XCircle className="w-4 h-4 text-red-400" />,
}

const CRITICIDAD_CONFIG: Record<string, string> = {
  critica: 'bg-red-950 text-red-400 border-red-800',
  alta: 'bg-orange-950 text-orange-400 border-orange-800',
  media: 'bg-amber-950 text-amber-400 border-amber-800',
  baja: 'bg-slate-800 text-slate-400 border-slate-700',
}

const URGENCIA_CONFIG: Record<string, string> = {
  inmediata: 'text-red-400',
  '3 meses': 'text-amber-400',
  '6 meses': 'text-emerald-400',
}

export default async function DiscoveryPage() {
  const admin = createAdminClient()

  const { data: proyectosRaw } = await admin
    .from('proyecto')
    .select('*, cliente(razon_social)')
    .eq('estado_general', 'activo')

  const { data: procesos } = await admin
    .from('proceso')
    .select('*')
    .order('nivel', { ascending: true })
    .order('orden', { ascending: true })

  const proyectos = (proyectosRaw ?? []) as Array<Proyecto & { cliente: { razon_social: string } | null }>

  const proyectosNorm = proyectos.map(p => ({ id: p.id, nombre: p.nombre }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            Process Discovery IA
          </h1>
          <p className="text-slate-400 text-sm mt-1">Descubrimiento de procesos, roles y modelado inteligente</p>
        </div>
        <DiscoveryAcciones proyectos={proyectosNorm} />
      </div>

      {proyectos.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center space-y-3">
            <FileSearch className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-300 font-medium">No hay proyectos activos</p>
          </CardContent>
        </Card>
      )}

      {proyectos.map((proyecto) => {
        const procesosProyecto = (procesos ?? []).filter((p: Proceso) => p.proyecto_id === proyecto.id)
        const macroprocesos = procesosProyecto.filter((p: Proceso) => p.nivel === 0)
        const subprocesos = procesosProyecto.filter((p: Proceso) => p.nivel === 1)
        const totalProcesos = procesosProyecto.length
        const aceptados = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'aceptado').length
        const pendientes = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'propuesto').length
        const resumen = proyecto.discovery_resumen as Record<string, unknown> | null

        // Extraer roles únicos de procesos aceptados para GlosarioRoles
        const procesosAceptados = procesosProyecto.filter((p: Proceso) => p.estado_oferta === 'aceptado')
        const rolesDetectados = Array.from(
          new Set(procesosAceptados.flatMap((p: Proceso) => p.roles_involucrados ?? []))
        ).map((rol: string) => ({
          rol,
          descripcion: '',
          procesos: procesosAceptados
            .filter((p: Proceso) => (p.roles_involucrados ?? []).includes(rol))
            .map((p: Proceso) => p.nombre),
        }))

        if (totalProcesos === 0 && !resumen) {
          return (
            <Card key={proyecto.id} className="bg-slate-900 border-slate-800">
              <CardContent className="py-8 text-center space-y-2">
                <p className="text-slate-300 font-medium">{proyecto.nombre}</p>
                <p className="text-slate-500 text-sm">
                  {proyecto.cliente?.razon_social} · Sin inventario de procesos aún. Analiza documentos y ejecuta Discovery AI.
                </p>
              </CardContent>
            </Card>
          )
        }

        const procesosTabContent = (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Total procesos</p>
                  <p className="text-2xl font-bold text-white mt-1">{totalProcesos}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Aceptados</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{aceptados}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wider">Pendientes revisión</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{pendientes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Resumen ejecutivo de discovery */}
            {resumen && (
              <>
                <div className="bg-gradient-to-br from-purple-950/50 to-slate-900 border border-purple-800/40 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest">Diagnóstico de Arquitectura de Procesos</span>
                  </div>
                  <p className="text-white text-base leading-relaxed font-light">
                    {String(resumen.resumen_ejecutivo_discovery ?? '')}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800">
                    {resumen.industria_detectada ? <span>Industria: <span className="text-slate-200">{String(resumen.industria_detectada)}</span></span> : null}
                    {resumen.nivel_madurez_operacional ? <span>Madurez: <span className="text-slate-200">{String(resumen.nivel_madurez_operacional)}</span></span> : null}
                    {resumen.cobertura_documentacion ? <span>Cobertura documental: <span className="text-slate-200">{String(resumen.cobertura_documentacion)}</span></span> : null}
                  </div>
                </div>

                {resumen.recomendacion_ceo && (
                  <div className="bg-gradient-to-r from-amber-950/50 to-orange-950/30 border border-amber-700/50 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <Target className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-400 text-xs font-semibold uppercase tracking-widest mb-1.5">Recomendación para el CEO</p>
                        <p className="text-white text-sm leading-relaxed font-medium">{String(resumen.recomendacion_ceo)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.isArray(resumen.top_3_brechas_criticas) && (resumen.top_3_brechas_criticas as Array<Record<string, string>>).length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-xs font-semibold uppercase tracking-widest">Top 3 Brechas Críticas</span>
                      </div>
                      <ul className="space-y-3">
                        {(resumen.top_3_brechas_criticas as Array<Record<string, string>>).map((b, i) => (
                          <li key={i} className="space-y-1">
                            <p className="text-slate-300 text-sm leading-snug">{b.brecha}</p>
                            <p className="text-slate-500 text-xs">{b.impacto_negocio}</p>
                            {b.urgencia && (
                              <span className={`text-xs font-medium ${URGENCIA_CONFIG[b.urgencia] ?? 'text-slate-400'}`}>
                                Urgencia: {b.urgencia}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(resumen.top_3_oportunidades_valor) && (resumen.top_3_oportunidades_valor as Array<Record<string, string>>).length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Top 3 Oportunidades de Valor</span>
                      </div>
                      <ul className="space-y-3">
                        {(resumen.top_3_oportunidades_valor as Array<Record<string, string>>).map((o, i) => (
                          <li key={i} className="space-y-1">
                            <p className="text-slate-300 text-sm leading-snug">{o.oportunidad}</p>
                            <p className="text-slate-500 text-xs">{o.valor_potencial}</p>
                            <div className="flex gap-3 text-xs text-slate-500">
                              {o.complejidad && <span>Complejidad: {o.complejidad}</span>}
                              {o.tiempo_implementacion && <span>· {o.tiempo_implementacion}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {Array.isArray(resumen.quick_wins_90_dias) && (resumen.quick_wins_90_dias as string[]).length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">Quick Wins — 90 días</span>
                    </div>
                    <ul className="space-y-2">
                      {(resumen.quick_wins_90_dias as string[]).map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-300">
                          <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resumen.roadmap_transformacion != null && typeof resumen.roadmap_transformacion === 'object' && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Map className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 text-xs font-semibold uppercase tracking-widest">Roadmap de Transformación</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(resumen.roadmap_transformacion as Record<string, string>).map(([fase, texto], i) => (
                        <div key={fase} className="bg-slate-800/50 rounded-lg p-3">
                          <p className="text-blue-400 text-xs font-medium mb-1">Fase {i + 1}</p>
                          <p className="text-slate-300 text-sm leading-snug">{texto}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Inventario de procesos */}
            {macroprocesos.map((macro: Proceso) => {
              const hijos = subprocesos.filter((p: Proceso) => p.padre_id === macro.id)
              const origenCfg = ORIGEN_CONFIG[macro.origen] ?? ORIGEN_CONFIG.manual
              const metaMacro = macro.metadata_ia as Record<string, unknown> | null
              return (
                <Card key={macro.id} className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-white flex items-center gap-2">
                        {OFERTA_ICON[macro.estado_oferta]}
                        {macro.nombre}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {metaMacro?.criticidad ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${CRITICIDAD_CONFIG[metaMacro.criticidad as string] ?? CRITICIDAD_CONFIG.media}`}>
                            {String(metaMacro.criticidad)}
                          </span>
                        ) : null}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${origenCfg.class}`}>
                          {origenCfg.label}
                        </span>
                        <ProcesoRevisor procesoId={macro.id} estadoActual={macro.estado_oferta} />
                      </div>
                    </div>
                    {macro.descripcion && (
                      <p className="text-slate-400 text-sm">{macro.descripcion}</p>
                    )}
                    {metaMacro?.estado_actual ? (
                      <p className="text-slate-500 text-xs italic">Estado actual: {String(metaMacro.estado_actual)}</p>
                    ) : null}
                  </CardHeader>

                  {hijos.length > 0 && (
                    <CardContent className="pt-0 space-y-3">
                      {hijos.map((p: Proceso) => {
                        const pOrigenCfg = ORIGEN_CONFIG[p.origen] ?? ORIGEN_CONFIG.manual
                        const meta = p.metadata_ia as Record<string, unknown> | null
                        return (
                          <div key={p.id} className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-3 space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{OFERTA_ICON[p.estado_oferta]}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-200 text-sm font-medium">{p.nombre}</p>
                                {p.descripcion && (
                                  <p className="text-slate-500 text-xs mt-0.5">{p.descripcion}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {meta?.criticidad ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${CRITICIDAD_CONFIG[meta.criticidad as string] ?? CRITICIDAD_CONFIG.media}`}>
                                    {String(meta.criticidad)}
                                  </span>
                                ) : null}
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${pOrigenCfg.class}`}>
                                  {pOrigenCfg.label}
                                </span>
                                <ProcesoRevisor procesoId={p.id} estadoActual={p.estado_oferta} />
                              </div>
                            </div>

                            {p.origen === 'propuesta_ia' && meta?.justificacion_ia ? (
                              <div className="bg-purple-950/30 border border-purple-800/40 rounded-md px-3 py-2">
                                <p className="text-purple-300 text-xs font-medium mb-0.5">Por qué la IA propone este proceso</p>
                                <p className="text-slate-300 text-xs leading-relaxed">{String(meta.justificacion_ia)}</p>
                              </div>
                            ) : null}
                            {p.origen === 'detectado' && meta?.evidencia_documento ? (
                              <p className="text-slate-500 text-xs italic">Evidencia: {String(meta.evidencia_documento)}</p>
                            ) : null}

                            {p.roles_involucrados && p.roles_involucrados.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {p.roles_involucrados.map((r: string) => (
                                  <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{r}</span>
                                ))}
                              </div>
                            )}

                            {p.riesgos_detectados && p.riesgos_detectados.length > 0 && (
                              <div>
                                <p className="text-red-400 text-xs font-medium mb-1">Riesgos si falla</p>
                                <ul className="space-y-0.5">
                                  {p.riesgos_detectados.map((r: string, i: number) => (
                                    <li key={i} className="text-slate-400 text-xs flex gap-1.5">
                                      <span className="text-red-500 shrink-0">·</span>{r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(meta?.oportunidades_mejora) && (meta.oportunidades_mejora as string[]).length > 0 && (
                              <div>
                                <p className="text-emerald-400 text-xs font-medium mb-1">Oportunidades de mejora</p>
                                <ul className="space-y-0.5">
                                  {(meta.oportunidades_mejora as string[]).map((o: string, i: number) => (
                                    <li key={i} className="text-slate-400 text-xs flex gap-1.5">
                                      <span className="text-emerald-500 shrink-0">·</span>{o}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(meta?.oportunidades_automatizacion) && (meta.oportunidades_automatizacion as string[]).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {(meta.oportunidades_automatizacion as string[]).map((o: string, i: number) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 flex items-center gap-1">
                                    <Zap className="w-3 h-3" />{o}
                                  </span>
                                ))}
                              </div>
                            )}

                            {Array.isArray(meta?.kpis_recomendados) && (meta.kpis_recomendados as string[]).length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {(meta.kpis_recomendados as string[]).map((k: string, i: number) => (
                                  <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 flex items-center gap-1">
                                    <BarChart3 className="w-3 h-3" />{k}
                                  </span>
                                ))}
                              </div>
                            )}

                            {meta?.benchmark_industria ? (
                              <p className="text-slate-500 text-xs flex items-start gap-1.5">
                                <Award className="w-3 h-3 shrink-0 mt-0.5 text-slate-600" />
                                {String(meta.benchmark_industria)}
                              </p>
                            ) : null}
                          </div>
                        )
                      })}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )

        return (
          <div key={proyecto.id} className="space-y-4">
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-lg font-semibold text-white">{proyecto.nombre}</h2>
              <span className="text-slate-500 text-sm">· {proyecto.cliente?.razon_social}</span>
            </div>

            <DiscoveryTabsWrapper
              procesosContent={procesosTabContent}
              glosarioContent={
                <GlosarioRoles
                  proyectoId={proyecto.id}
                  nombreProyecto={proyecto.nombre}
                  rolesDetectados={rolesDetectados}
                />
              }
            />
          </div>
        )
      })}
    </div>
  )
}
