'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Zap, Sparkles, ClipboardList, Bot, Download, CheckCircle2 } from 'lucide-react'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface Proyecto { id: string; nombre: string }
interface Proceso  { id: string; nombre: string; tipo: string }
interface Simulacion { id: string; nombre: string; tipo: string }

interface Recomendacion {
  id: string
  tipo_automatizacion: string
  herramientas: string[]
  justificacion: string
  score_impacto: number
  score_esfuerzo: number
  prioridad: number
  estado: 'sugerida' | 'aprobada' | 'descartada'
  roadmap_id: string | null
}

interface Roadmap {
  id: string
  nombre: string
  estado: string
  entregable_id: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, string> = {
  RPA:            'bg-blue-900 text-blue-200',
  integracion:    'bg-purple-900 text-purple-200',
  ia_generativa:  'bg-emerald-900 text-emerald-200',
  workflow:       'bg-amber-900 text-amber-200',
  hibrida:        'bg-pink-900 text-pink-200',
}

const ESTADO_COLOR: Record<string, string> = {
  sugerida:   'bg-slate-700 text-slate-200',
  aprobada:   'bg-green-800 text-green-200',
  descartada: 'bg-red-900 text-red-300',
}

function ScoreDot({ value, max = 5, color = 'bg-indigo-500' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-2 h-2 rounded-full ${i < value ? color : 'bg-slate-700'}`} />
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AutomationStudioPage() {
  const [proyectos, setProyectos]           = useState<Proyecto[]>([])
  const [proyectoId, setProyectoId]         = useState('')
  const [procesos, setProcesos]             = useState<Proceso[]>([])
  const [procesoId, setProcesoId]           = useState('')
  const [simulaciones, setSimulaciones]     = useState<Simulacion[]>([])
  const [simulacionId, setSimulacionId]     = useState('')
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [roadmaps, setRoadmaps]             = useState<Roadmap[]>([])
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [generando, setGenerando]           = useState(false)
  const [creandoRoadmap, setCreandoRoadmap] = useState(false)
  const [nombreRoadmap, setNombreRoadmap]   = useState('')
  const [tab, setTab]                       = useState<'recomendaciones' | 'roadmap'>('recomendaciones')

  // Cargar proyectos al montar
  useEffect(() => {
    fetch('/api/proyectos').then(r => r.json()).then(d => setProyectos(d.proyectos ?? [])).catch(() => {})
  }, [])

  // Al seleccionar proyecto: cargar procesos, simulaciones, recomendaciones y roadmaps
  useEffect(() => {
    if (!proyectoId) return
    fetch(`/api/simulaciones/contexto?proyecto_id=${proyectoId}`)
      .then(r => r.json()).then(d => setProcesos(d.procesos ?? [])).catch(() => {})
    fetch(`/api/simulaciones?proyecto_id=${proyectoId}`)
      .then(r => r.json()).then(d => setSimulaciones(d.simulaciones ?? [])).catch(() => {})
    fetch(`/api/automation/recomendar?proyecto_id=${proyectoId}`)
      .then(r => r.json()).then(d => setRecomendaciones(d.recomendaciones ?? [])).catch(() => {})
    fetch(`/api/automation/roadmap?proyecto_id=${proyectoId}`)
      .then(r => r.json()).then(d => setRoadmaps(d.roadmaps ?? [])).catch(() => {})
  }, [proyectoId])

  const recargarRecs = useCallback(() => {
    if (!proyectoId) return
    fetch(`/api/automation/recomendar?proyecto_id=${proyectoId}`)
      .then(r => r.json()).then(d => setRecomendaciones(d.recomendaciones ?? []))
  }, [proyectoId])

  async function generarRecomendaciones() {
    if (!procesoId) return
    setGenerando(true)
    try {
      const res = await fetch('/api/automation/recomendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proceso_id: procesoId, simulacion_id: simulacionId || null }),
      })
      if (res.ok) recargarRecs()
    } finally {
      setGenerando(false)
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/automation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    setRecomendaciones(prev =>
      prev.map(r => r.id === id ? { ...r, estado: estado as Recomendacion['estado'] } : r)
    )
  }

  async function crearRoadmap() {
    if (!nombreRoadmap.trim() || selected.size === 0) return
    setCreandoRoadmap(true)
    try {
      const res = await fetch('/api/automation/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_id: proyectoId,
          nombre: nombreRoadmap,
          recomendacion_ids: Array.from(selected),
        }),
      })
      if (res.ok) {
        setNombreRoadmap('')
        setSelected(new Set())
        recargarRecs()
        fetch(`/api/automation/roadmap?proyecto_id=${proyectoId}`)
          .then(r => r.json()).then(d => setRoadmaps(d.roadmaps ?? []))
        setTab('roadmap')
      }
    } finally {
      setCreandoRoadmap(false)
    }
  }

  async function exportarRoadmap(roadmapId: string) {
    const res = await fetch(`/api/automation/roadmap/${roadmapId}/exportar`, { method: 'POST' })
    if (res.ok) {
      setRoadmaps(prev => prev.map(r => r.id === roadmapId ? { ...r, estado: 'exportado' } : r))
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const recsOrdenadas = [...recomendaciones].sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0))

  return (
    <div className="flex h-full min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar izquierdo */}
      <aside className="w-72 border-r border-slate-800 p-4 flex flex-col gap-4 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          <h1 className="font-semibold text-slate-100">Automation Studio</h1>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">Proyecto</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm"
            value={proyectoId}
            onChange={e => { setProyectoId(e.target.value); setProcesoId(''); setSimulacionId('') }}
          >
            <option value="">Seleccionar proyecto...</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        {proyectoId && (
          <>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Proceso a analizar</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm"
                value={procesoId}
                onChange={e => setProcesoId(e.target.value)}
              >
                <option value="">Seleccionar proceso...</option>
                {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Simulación de referencia (opcional)</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm"
                value={simulacionId}
                onChange={e => setSimulacionId(e.target.value)}
              >
                <option value="">Sin simulación</option>
                {simulaciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <Button
              onClick={generarRecomendaciones}
              disabled={!procesoId || generando}
              className="w-full bg-indigo-600 hover:bg-indigo-500 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generando ? 'Analizando con IA...' : 'Generar recomendaciones'}
            </Button>

            <hr className="border-slate-700" />

            {/* Panel crear roadmap */}
            {selected.size > 0 && (
              <div className="bg-slate-800 rounded p-3 space-y-2">
                <p className="text-xs text-slate-400">{selected.size} seleccionadas</p>
                <input
                  type="text"
                  placeholder="Nombre del roadmap..."
                  value={nombreRoadmap}
                  onChange={e => setNombreRoadmap(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                />
                <Button
                  onClick={crearRoadmap}
                  disabled={!nombreRoadmap.trim() || creandoRoadmap}
                  className="w-full bg-green-700 hover:bg-green-600 text-sm gap-1.5"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  {creandoRoadmap ? 'Creando...' : 'Crear Roadmap'}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Lista de roadmaps del proyecto */}
        {roadmaps.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Roadmaps</p>
            {roadmaps.map(r => (
              <button
                key={r.id}
                onClick={() => setTab('roadmap')}
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-slate-800 text-slate-300 flex items-center justify-between"
              >
                <span className="truncate">{r.nombre}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${r.estado === 'exportado' ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                  {r.estado}
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-6 overflow-y-auto">
        {!proyectoId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <Zap className="w-16 h-16 text-slate-700" />
            <p className="text-slate-400 text-lg">Selecciona un proyecto para comenzar</p>
            <p className="text-slate-500 text-sm max-w-md">
              El Automation Studio analiza el artefacto TO-BE y la simulación de impacto
              para recomendar el tipo de automatización óptimo, priorizado por impacto/esfuerzo.
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
              <button
                onClick={() => setTab('recomendaciones')}
                className={`px-4 py-2 text-sm rounded-t ${tab === 'recomendaciones' ? 'bg-indigo-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Recomendaciones IA
                {recomendaciones.length > 0 && (
                  <span className="ml-2 bg-indigo-900 text-indigo-300 text-xs px-1.5 py-0.5 rounded-full">
                    {recomendaciones.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('roadmap')}
                className={`px-4 py-2 text-sm rounded-t ${tab === 'roadmap' ? 'bg-green-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Roadmap de Automatización
                {roadmaps.length > 0 && (
                  <span className="ml-2 bg-green-900 text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                    {roadmaps.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab: Recomendaciones */}
            {tab === 'recomendaciones' && (
              <>
                {recsOrdenadas.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Bot className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                    <p>Sin recomendaciones aún.</p>
                    <p className="text-sm mt-1">Selecciona un proceso y genera recomendaciones con IA.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-400">
                        {recsOrdenadas.length} recomendaciones — ordenadas por prioridad (impacto/esfuerzo)
                      </p>
                      {selected.size > 0 && (
                        <p className="text-sm text-indigo-400">{selected.size} seleccionadas para roadmap</p>
                      )}
                    </div>

                    {recsOrdenadas.map((rec) => (
                      <div
                        key={rec.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selected.has(rec.id)
                            ? 'border-indigo-500 bg-indigo-950'
                            : rec.estado === 'descartada'
                            ? 'border-slate-800 bg-slate-900 opacity-50'
                            : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                        }`}
                        onClick={() => rec.estado !== 'descartada' && toggleSelect(rec.id)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${TIPO_COLOR[rec.tipo_automatizacion] ?? 'bg-slate-700 text-slate-300'}`}>
                                {rec.tipo_automatizacion}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${ESTADO_COLOR[rec.estado]}`}>
                                {rec.estado}
                              </span>
                              {rec.roadmap_id && (
                                <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">
                                  En roadmap
                                </span>
                              )}
                              <span className="text-xs text-slate-500 ml-auto">
                                Prioridad: {typeof rec.prioridad === 'number' ? rec.prioridad.toFixed(1) : '—'}
                              </span>
                            </div>

                            <p className="text-sm text-slate-300 leading-relaxed mb-3 whitespace-pre-line">
                              {rec.justificacion}
                            </p>

                            {rec.herramientas.length > 0 && (
                              <div className="flex gap-1 flex-wrap mb-3">
                                {rec.herramientas.map(h => (
                                  <span key={h} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                                    {h}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-6">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Impacto <span className="text-slate-600">(mayor mejor)</span></p>
                                <ScoreDot value={rec.score_impacto} color="bg-green-500" />
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Esfuerzo <span className="text-slate-600">(menor mejor)</span></p>
                                <ScoreDot value={rec.score_esfuerzo} color="bg-amber-500" />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0">
                            {rec.estado !== 'aprobada' && (
                              <button
                                onClick={e => { e.stopPropagation(); cambiarEstado(rec.id, 'aprobada') }}
                                className="text-xs bg-green-800 hover:bg-green-700 text-green-200 px-2 py-1 rounded"
                              >
                                Aprobar
                              </button>
                            )}
                            {rec.estado !== 'descartada' && (
                              <button
                                onClick={e => { e.stopPropagation(); cambiarEstado(rec.id, 'descartada') }}
                                className="text-xs bg-slate-700 hover:bg-red-900 text-slate-300 px-2 py-1 rounded"
                              >
                                Descartar
                              </button>
                            )}
                            {rec.estado === 'descartada' && (
                              <button
                                onClick={e => { e.stopPropagation(); cambiarEstado(rec.id, 'sugerida') }}
                                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded"
                              >
                                Restaurar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tab: Roadmap */}
            {tab === 'roadmap' && (
              <>
                {roadmaps.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-700" />
                    <p>Sin roadmaps creados.</p>
                    <p className="text-sm mt-1">Selecciona recomendaciones y crea un roadmap.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {roadmaps.map(roadmap => {
                      const recsDelRoadmap = recomendaciones
                        .filter(r => r.roadmap_id === roadmap.id)
                        .sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0))

                      return (
                        <div key={roadmap.id} className="border border-slate-700 rounded-lg p-5 bg-slate-900">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-100">{roadmap.nombre}</h2>
                              <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                                roadmap.estado === 'exportado' ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {roadmap.estado}
                              </span>
                            </div>
                            {roadmap.estado !== 'exportado' && (
                              <Button
                                onClick={() => exportarRoadmap(roadmap.id)}
                                className="bg-slate-700 hover:bg-slate-600 text-sm gap-1.5"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Exportar como entregable
                              </Button>
                            )}
                            {roadmap.estado === 'exportado' && (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Entregable generado
                              </span>
                            )}
                          </div>

                          {/* Tabla priorizada */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase tracking-wide">
                                  <th className="text-left pb-2 pr-4">Tipo</th>
                                  <th className="text-left pb-2 pr-4">Herramientas</th>
                                  <th className="text-center pb-2 pr-4">Impacto ↑</th>
                                  <th className="text-center pb-2 pr-4">Esfuerzo ↓</th>
                                  <th className="text-center pb-2">Prioridad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recsDelRoadmap.map((rec, i) => (
                                  <tr key={rec.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                                    <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-500 text-xs">#{i + 1}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${TIPO_COLOR[rec.tipo_automatizacion] ?? 'bg-slate-700 text-slate-300'}`}>
                                          {rec.tipo_automatizacion}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-4">
                                      <div className="flex gap-1 flex-wrap">
                                        {rec.herramientas.slice(0, 3).map(h => (
                                          <span key={h} className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                            {h}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-4 text-center">
                                      <ScoreDot value={rec.score_impacto} color="bg-green-500" />
                                    </td>
                                    <td className="py-2.5 pr-4 text-center">
                                      <ScoreDot value={rec.score_esfuerzo} color="bg-amber-500" />
                                    </td>
                                    <td className="py-2.5 text-center font-mono text-indigo-300 font-semibold">
                                      {typeof rec.prioridad === 'number' ? rec.prioridad.toFixed(1) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {recsDelRoadmap.length === 0 && (
                              <p className="text-slate-500 text-sm text-center py-4">
                                Sin recomendaciones asignadas a este roadmap.
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
