'use client'

import { useState, useEffect } from 'react'
import { Network, AlertTriangle, Factory, ChevronUp, ChevronDown } from 'lucide-react'
import type { KgNodo, KgNodoTipo, KgRelacionExpandida } from '@/lib/automation/tipos'

const NODO_TIPO_LABEL: Record<KgNodoTipo, string> = {
  proceso: 'Procesos',
  riesgo: 'Riesgos',
  kpi: 'KPIs',
  automatizacion: 'Automatizaciones',
  herramienta: 'Herramientas',
  rol: 'Roles',
}

const NODO_TIPO_BADGE: Record<KgNodoTipo, string> = {
  proceso: 'bg-indigo-900 text-indigo-200',
  riesgo: 'bg-red-900 text-red-200',
  kpi: 'bg-emerald-900 text-emerald-200',
  automatizacion: 'bg-blue-900 text-blue-200',
  herramienta: 'bg-purple-900 text-purple-200',
  rol: 'bg-amber-900 text-amber-200',
}

const RELACION_LABEL: Record<string, string> = {
  usa: 'usa', genera: 'genera', mitiga: 'mitiga',
  requiere: 'requiere', produce: 'produce', causa: 'causa',
}

function GrafoRelaciones({ industria }: { industria: string }) {
  const [nodos, setNodos] = useState<KgNodo[] | null>(null)
  const [relaciones, setRelaciones] = useState<KgRelacionExpandida[]>([])

  useEffect(() => {
    let cancelado = false
    fetch(`/api/kg/grafo?industria=${encodeURIComponent(industria)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelado) return
        if (!d.error) {
          setNodos(d.nodos ?? [])
          setRelaciones(d.relaciones ?? [])
        } else {
          setNodos([])
        }
      })
      .catch(() => { if (!cancelado) setNodos([]) })
    return () => { cancelado = true }
  }, [industria])

  if (nodos === null) {
    return <p className="text-xs text-slate-400 mt-4">Cargando grafo...</p>
  }
  if (nodos.length === 0) return null

  // Agrupar nodos por tipo
  const porTipo = new Map<KgNodoTipo, KgNodo[]>()
  for (const n of nodos) {
    const arr = porTipo.get(n.tipo) ?? []
    arr.push(n)
    porTipo.set(n.tipo, arr)
  }

  return (
    <div className="col-span-full mt-4 pt-4 border-t border-slate-700">
      <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide font-medium flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> Grafo de Relaciones</p>

      {/* Nodos agrupados por tipo */}
      <div className="space-y-2 mb-4">
        {(Array.from(porTipo.entries()) as [KgNodoTipo, KgNodo[]][]).map(([tipo, items]) => (
          <div key={tipo} className="flex items-start gap-2">
            <span className="text-[10px] text-slate-400 w-28 shrink-0 text-right pt-0.5 uppercase">{NODO_TIPO_LABEL[tipo]}</span>
            <div className="flex flex-wrap gap-1.5">
              {items.map(n => (
                <span key={n.id} className={`text-xs px-2 py-0.5 rounded ${NODO_TIPO_BADGE[tipo]}`}>
                  {n.nombre}
                  {n.frecuencia > 1 && <span className="opacity-60 ml-1">{n.frecuencia}×</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Relaciones como tabla nodo → relación → nodo */}
      {relaciones.length > 0 && (
        <div className="bg-slate-950/40 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">Relaciones</p>
          <div className="space-y-1">
            {relaciones.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs flex-wrap">
                <span className={`px-1.5 py-0.5 rounded ${NODO_TIPO_BADGE[r.origen_tipo]}`}>{r.origen_nombre}</span>
                <span className="text-slate-400">— {RELACION_LABEL[r.tipo_relacion] ?? r.tipo_relacion} →</span>
                <span className={`px-1.5 py-0.5 rounded ${NODO_TIPO_BADGE[r.destino_tipo]}`}>{r.destino_nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface AnalyticsData {
  resumen: {
    total_proyectos: number
    proyectos_cerrados: number
    total_industrias: number
    total_recomendaciones: number
    recomendaciones_aprobadas: number
    score_impacto_promedio: number
  }
  distribucion_industrias: { industria: string; count: number }[]
  estado_proyectos: Record<string, number>
  automatizaciones_frecuentes: { tipo: string; count: number }[]
  procesos_recurrentes: { nombre: string; frecuencia: number }[]
  riesgos_frecuentes: { tipo: string; count: number }[]
  knowledge_graph: {
    industria: string
    proyectos_cerrados: number
    procesos_frecuentes: { nombre: string; frecuencia: number }[]
    automatizaciones: { tipo: string; frecuencia: number; herramientas: string[] }[]
  }[]
}

const TIPO_LABEL: Record<string, string> = {
  RPA: 'RPA',
  integracion: 'Integración',
  ia_generativa: 'IA Generativa',
  workflow: 'Workflow',
  hibrida: 'Híbrida',
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({ items, colorClass = 'bg-indigo-600' }: {
  items: { label: string; value: number; max: number }[]
  colorClass?: string
}) {
  // Sin varianza (todos los valores iguales, ej. todo ocurrió 1 vez): una barra
  // proporcional dibujaría el 100% en cada fila, sugiriendo una comparación que
  // no existe. En ese caso se muestra como lista simple en vez de gráfico.
  const sinVarianza = items.length > 1 && items.every(i => i.value === items[0].value)

  if (sinVarianza) {
    return (
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-400 truncate">{item.label}</span>
            <span className="font-mono text-slate-400">{item.value}×</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 w-36 truncate text-right">{item.label}</span>
          <div className="flex-1 bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${colorClass}`}
              style={{ width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-400 w-6 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')
  const [kgExpanded, setKgExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Error al cargar analytics.'))
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-slate-400">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-500" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        Cargando analytics...
      </div>
    )
  }

  const maxInd = Math.max(...data.distribucion_industrias.map(i => i.count), 1)
  const maxAut = Math.max(...data.automatizaciones_frecuentes.map(a => a.count), 1)
  const maxProc = Math.max(...data.procesos_recurrentes.map(p => p.frecuencia), 1)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Analytics Ejecutivo</h1>
        <p className="text-sm text-slate-400">Vista transversal de todos los proyectos — Solo Super Administrador</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total proyectos" value={data.resumen.total_proyectos} />
        <KpiCard label="Proyectos cerrados" value={data.resumen.proyectos_cerrados} />
        <KpiCard label="Industrias" value={data.resumen.total_industrias} />
        <KpiCard label="Recomendaciones IA" value={data.resumen.total_recomendaciones} />
        <KpiCard label="Aprobadas" value={data.resumen.recomendaciones_aprobadas} />
        <KpiCard
          label="Score impacto prom."
          value={data.resumen.total_recomendaciones > 0 ? data.resumen.score_impacto_promedio : '—'}
          sub={data.resumen.total_recomendaciones > 0 ? 'sobre 5' : 'sin recomendaciones aún'}
        />
      </div>

      {/* Gráficas en grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Distribución industrias */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Distribución por Industria</h2>
          <BarChart
            items={data.distribucion_industrias.map(i => ({ label: i.industria, value: i.count, max: maxInd }))}
            colorClass="bg-indigo-600"
          />
        </div>

        {/* Automatizaciones frecuentes */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Tipos de Automatización Recomendados</h2>
          {data.automatizaciones_frecuentes.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin recomendaciones de IA generadas todavía.</p>
          ) : (
            <BarChart
              items={data.automatizaciones_frecuentes.map(a => ({
                label: TIPO_LABEL[a.tipo] ?? a.tipo,
                value: a.count,
                max: maxAut,
              }))}
              colorClass="bg-purple-600"
            />
          )}
        </div>

        {/* Estado de proyectos */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Estado de Proyectos</h2>
          <div className="space-y-3">
            {Object.entries(data.estado_proyectos).map(([estado, count]) => (
              <div key={estado} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  estado === 'activo' ? 'bg-green-900 text-green-300' :
                  estado === 'cerrado' ? 'bg-slate-700 text-slate-400' :
                  'bg-amber-900 text-amber-300'
                }`}>
                  {estado}
                </span>
                <span className="text-xl font-bold text-slate-200">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Procesos recurrentes */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 md:col-span-2">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Procesos más Recurrentes (top 10)</h2>
          <BarChart
            items={data.procesos_recurrentes.map(p => ({ label: p.nombre, value: p.frecuencia, max: maxProc }))}
            colorClass="bg-emerald-600"
          />
        </div>

        {/* Riesgos frecuentes */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Tipos de Riesgo más Frecuentes</h2>
          {data.riesgos_frecuentes.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin datos de riesgos registrados.</p>
          ) : (
            <BarChart
              items={data.riesgos_frecuentes.map(r => ({
                label: r.tipo,
                value: r.count,
                max: Math.max(...data.riesgos_frecuentes.map(x => x.count), 1),
              }))}
              colorClass="bg-red-600"
            />
          )}
        </div>
      </div>

      {/* Knowledge Graph por industria */}
      <div>
        <h2 className="text-lg font-medium text-slate-200 mb-4">Knowledge Graph Corporativo</h2>
        {data.knowledge_graph.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            <Network className="w-8 h-8 mx-auto mb-2 text-slate-700" />
            <p>El Knowledge Graph se poblará al cerrar el primer proyecto.</p>
            <p className="text-xs mt-1">Usa el botón &quot;Cerrar proyecto&quot; en Administración.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.knowledge_graph.map(snap => (
              <div key={snap.industria} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-colors text-left"
                  onClick={() => setKgExpanded(kgExpanded === snap.industria ? null : snap.industria)}
                >
                  <div className="flex items-center gap-3">
                    <Factory className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-200">{snap.industria}</p>
                      <p className="text-xs text-slate-400">{snap.proyectos_cerrados} proyecto(s) cerrado(s)</p>
                    </div>
                  </div>
                  {kgExpanded === snap.industria ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {kgExpanded === snap.industria && (
                  <div className="p-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Procesos frecuentes</p>
                      {snap.procesos_frecuentes.slice(0, 6).map(p => (
                        <div key={p.nombre} className="flex items-center justify-between text-sm py-1">
                          <span className="text-slate-300">{p.nombre}</span>
                          <span className="text-slate-400 text-xs">{p.frecuencia}×</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">Automatizaciones recomendadas</p>
                      {snap.automatizaciones.map(a => (
                        <div key={a.tipo} className="py-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              a.tipo === 'RPA' ? 'bg-blue-900 text-blue-200' :
                              a.tipo === 'integracion' ? 'bg-purple-900 text-purple-200' :
                              a.tipo === 'ia_generativa' ? 'bg-emerald-900 text-emerald-200' :
                              'bg-slate-700 text-slate-300'
                            }`}>{a.tipo}</span>
                            <span className="text-slate-400 text-xs">{a.frecuencia}×</span>
                          </div>
                          {a.herramientas?.length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{a.herramientas.join(', ')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <GrafoRelaciones industria={snap.industria} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
