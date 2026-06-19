'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, AlertTriangle, TrendingUp,
  Users, Monitor, BarChart3, Edit3, Shield, Zap, ArrowRight,
  Clock, Star, Sparkles, Rocket, BookOpen, ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import { GlosarioRoles } from './GlosarioRoles'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface ProcesoResumen {
  id: string
  nombre_proceso: string
  macroproceso: string | null
  numero_en_macroproceso: number | null
  total_en_macroproceso: number | null
  estado_aprobacion: 'pendiente' | 'aprobado' | 'rechazado'
  created_at: string
}

interface ProcesoCompleto extends ProcesoResumen {
  descripcion: string
  sin_proceso_riesgos: string
  con_proceso_beneficios: string
  valor_negocio: string
  actores: string[]
  sistemas: string[]
  kpis: Array<{ nombre: string; valor_actual: string; valor_objetivo: string; unidad: string }>
  riesgos: Array<{ descripcion: string; probabilidad: string; impacto: string }>
  contenido_editado: {
    descripcion?: string
    sin_proceso_riesgos?: string
    con_proceso_beneficios?: string
  }
  aprobado_at: string | null
  comentario_aprobacion: string | null
}

interface DocProcesando {
  id: string
  nombre_archivo: string
  estado: 'subido' | 'procesando'
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fecha = (s: string) =>
  new Date(s).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })

const IMPACTO_COLOR: Record<string, string> = {
  alto: 'text-red-400 bg-red-900/30 border-red-800',
  medio: 'text-amber-400 bg-amber-900/30 border-amber-800',
  baja: 'text-emerald-400 bg-emerald-900/30 border-emerald-800',
}
const PROB_COLOR: Record<string, string> = {
  alta: 'text-red-400',
  media: 'text-amber-400',
  baja: 'text-emerald-400',
}

// ── Zona de upload ─────────────────────────────────────────────────────────────
function UploadZona({ proyectoId, onSubido }: { proyectoId: string; onSubido: () => void }) {
  const [drag, setDrag] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function subirArchivo(archivo: File) {
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'].includes(archivo.type)
      && !archivo.name.match(/\.(pdf|docx|doc)$/i)) {
      toast.error('Solo se aceptan archivos PDF o DOCX')
      return
    }
    if (archivo.size > 20 * 1024 * 1024) {
      toast.error('El archivo no puede superar 20 MB')
      return
    }
    setSubiendo(true)
    const form = new FormData()
    form.append('archivo', archivo)
    form.append('proyecto_id', proyectoId)
    try {
      const res = await fetch('/api/portal/documento-cliente', { method: 'POST', body: form })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Error al subir')
      toast.success(`${archivo.name} subido — la IA está analizando el proceso`)
      onSubido()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir el documento')
    } finally {
      setSubiendo(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDrag(false)
    const archivo = e.dataTransfer.files[0]
    if (archivo) subirArchivo(archivo)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => !subiendo && inputRef.current?.click()}
      className={`
        relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer
        transition-all duration-200 select-none
        ${drag ? 'border-indigo-400 bg-indigo-900/20' : 'border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50'}
        ${subiendo ? 'pointer-events-none opacity-70' : ''}
      `}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f) }} />

      {subiendo ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
          <p className="text-slate-300 font-medium">Subiendo documento...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-indigo-600' : 'bg-slate-800'}`}>
            <Upload className={`w-8 h-8 ${drag ? 'text-white' : 'text-indigo-400'}`} />
          </div>
          <div>
            <p className="text-slate-200 font-semibold text-lg">Sube tu documento de proceso</p>
            <p className="text-slate-400 text-sm mt-1">Arrastra aquí o toca para seleccionar · PDF o DOCX · máx 20 MB</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['Manual de proceso', 'Procedimiento operativo', 'Descripción de cargo', 'Flujo de trabajo'].map(t => (
              <span key={t} className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-1 rounded-full">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de proceso en lista ────────────────────────────────────────────────
function ProcesoCard({ proceso, onAbrir }: { proceso: ProcesoResumen; onAbrir: () => void }) {
  const aprobado = proceso.estado_aprobacion === 'aprobado'
  const rechazado = proceso.estado_aprobacion === 'rechazado'

  return (
    <button
      onClick={onAbrir}
      className="w-full text-left bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-xl p-4 transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-100 truncate">{proceso.nombre_proceso}</p>
            {aprobado && <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-2 py-0.5 rounded-full shrink-0"><CheckCircle2 className="w-3 h-3" /> Aprobado</span>}
            {rechazado && <span className="flex items-center gap-1 text-xs text-red-400 bg-red-900/30 border border-red-800 px-2 py-0.5 rounded-full shrink-0"><XCircle className="w-3 h-3" /> Con observaciones</span>}
            {!aprobado && !rechazado && <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-900/30 border border-amber-800 px-2 py-0.5 rounded-full shrink-0"><Clock className="w-3 h-3" /> Pendiente revisión</span>}
          </div>
          {proceso.macroproceso && (
            <p className="text-sm text-slate-400 mt-1">
              {proceso.macroproceso}
              {proceso.numero_en_macroproceso != null && proceso.total_en_macroproceso != null && (
                <span className="ml-2 text-indigo-400">· Proceso {proceso.numero_en_macroproceso} de {proceso.total_en_macroproceso}</span>
              )}
            </p>
          )}
          <p className="text-xs text-slate-600 mt-2">{fecha(proceso.created_at)}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0 mt-1" />
      </div>
    </button>
  )
}

// ── Tarjeta de documento procesando ───────────────────────────────────────────
function DocProcesandoCard({ doc }: { doc: DocProcesando }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-4 flex items-center gap-3">
      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
      <div className="min-w-0">
        <p className="text-sm text-slate-300 truncate">{doc.nombre_archivo}</p>
        <p className="text-xs text-slate-500">La IA está analizando el proceso...</p>
      </div>
    </div>
  )
}

// ── Journey de un proceso (7 pasos condensados en 4 vistas) ──────────────────
type JourneyStep = 'vista' | 'editor' | 'impacto' | 'aprobacion'

function JourneyProceso({ procesoId, onCerrar }: { procesoId: string; onCerrar: () => void }) {
  const [proceso, setProceso] = useState<ProcesoCompleto | null>(null)
  const [cargando, setCargando] = useState(true)
  const [paso, setPaso] = useState<JourneyStep>('vista')
  const [editado, setEditado] = useState<ProcesoCompleto['contenido_editado']>({})
  const [guardando, setGuardando] = useState(false)
  const [reAnalizando, setReAnalizando] = useState(false)
  const [aprobando, setAprobando] = useState(false)
  const [comentario, setComentario] = useState('')

  useEffect(() => {
    fetch(`/api/portal/proceso/${procesoId}`)
      .then(r => r.json())
      .then(d => {
        if (d.proceso) {
          setProceso(d.proceso)
          setEditado(d.proceso.contenido_editado ?? {})
        }
      })
      .finally(() => setCargando(false))
  }, [procesoId])

  const guardarEdicion = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await fetch(`/api/portal/proceso/${procesoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido_editado: editado }),
      })
      if (!res.ok) throw new Error()
      toast.success('Cambios guardados')
    } catch {
      toast.error('No se pudieron guardar los cambios')
    } finally {
      setGuardando(false)
    }
  }, [procesoId, editado])

  const reAnalizar = useCallback(async () => {
    if (!proceso) return
    const desc = editado.descripcion ?? proceso.descripcion
    const sin = editado.sin_proceso_riesgos ?? proceso.sin_proceso_riesgos
    const con = editado.con_proceso_beneficios ?? proceso.con_proceso_beneficios
    setReAnalizando(true)
    try {
      const res = await fetch(`/api/portal/proceso/${procesoId}/reanalizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcion: desc, sin_proceso_riesgos: sin, con_proceso_beneficios: con }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setProceso(prev => prev ? { ...prev, valor_negocio: d.valor_negocio, kpis: d.kpis, riesgos: d.riesgos } : prev)
      toast.success('IA re-analizó el proceso con tus cambios')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al re-analizar')
    } finally {
      setReAnalizando(false)
    }
  }, [procesoId, proceso, editado])

  const aprobar = useCallback(async (accion: 'aprobar' | 'rechazar') => {
    setAprobando(true)
    try {
      const res = await fetch(`/api/portal/proceso/${procesoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, comentario: comentario.trim() || undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setProceso(prev => prev ? { ...prev, estado_aprobacion: d.estado, aprobado_at: new Date().toISOString() } : prev)
      toast.success(accion === 'aprobar' ? 'Proceso aprobado — el equipo fue notificado' : 'Observaciones enviadas al equipo')
    } catch {
      toast.error('No se pudo procesar la solicitud')
    } finally {
      setAprobando(false)
    }
  }, [procesoId, comentario])

  if (cargando) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (!proceso) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">No se pudo cargar el proceso</p>
          <button onClick={onCerrar} className="mt-4 text-sm text-indigo-400 underline">Volver</button>
        </div>
      </div>
    )
  }

  const PASOS: Array<{ id: JourneyStep; label: string; icon: React.ReactNode }> = [
    { id: 'vista', label: 'Proceso', icon: <FileText className="w-4 h-4" /> },
    { id: 'editor', label: 'Editar', icon: <Edit3 className="w-4 h-4" /> },
    { id: 'impacto', label: 'Impacto', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'aprobacion', label: 'Aprobar', icon: <CheckCircle2 className="w-4 h-4" /> },
  ]

  const pasoActual = PASOS.findIndex(p => p.id === paso)

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onCerrar} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{proceso.nombre_proceso}</p>
            {proceso.macroproceso && (
              <p className="text-xs text-slate-500 truncate">
                {proceso.macroproceso}
                {proceso.numero_en_macroproceso != null && ` · ${proceso.numero_en_macroproceso} de ${proceso.total_en_macroproceso}`}
              </p>
            )}
          </div>
          {proceso.estado_aprobacion === 'aprobado' && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> Aprobado</span>
          )}
        </div>

        {/* Steps nav */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-1">
          {PASOS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPaso(p.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${paso === p.id ? 'bg-indigo-600 text-white' : i < pasoActual ? 'text-emerald-400 bg-emerald-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
            >
              {i < pasoActual ? <CheckCircle2 className="w-3.5 h-3.5" /> : p.icon}
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* ① Vista inmersiva del proceso */}
          {paso === 'vista' && (
            <div className="space-y-6">
              {/* Qué es */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-indigo-400" /> ¿Qué es este proceso?
                </h2>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">{editado.descripcion ?? proceso.descripcion}</p>
              </div>

              {/* Sin proceso / Con proceso */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-5">
                  <h3 className="font-semibold text-red-300 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Sin este proceso
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{editado.sin_proceso_riesgos ?? proceso.sin_proceso_riesgos}</p>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-5">
                  <h3 className="font-semibold text-emerald-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Con este proceso
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{editado.con_proceso_beneficios ?? proceso.con_proceso_beneficios}</p>
                </div>
              </div>

              {/* Valor negocio */}
              {proceso.valor_negocio && (
                <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-5">
                  <h3 className="font-semibold text-amber-300 mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Valor para el negocio
                  </h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{proceso.valor_negocio}</p>
                </div>
              )}

              {/* Actores y sistemas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {proceso.actores?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-400" /> Quiénes participan
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {proceso.actores.map((a, i) => (
                        <span key={i} className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {proceso.sistemas?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-indigo-400" /> Sistemas involucrados
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {proceso.sistemas.map((s, i) => (
                        <span key={i} className="text-xs bg-indigo-950/40 text-indigo-300 border border-indigo-900 px-2.5 py-1 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setPaso('editor')}
                className="w-full sm:w-auto flex items-center gap-2 justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Revisar y editar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ② Editor colaborativo */}
          {paso === 'editor' && (
            <div className="space-y-5">
              <div className="bg-slate-900 border border-indigo-900/40 rounded-xl p-4">
                <p className="text-sm text-indigo-300">
                  Puedes ajustar el texto a continuación. La IA propone un análisis base — tú lo refinas con el conocimiento real de tu organización.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del proceso</label>
                <textarea
                  value={editado.descripcion ?? proceso.descripcion}
                  onChange={e => setEditado(prev => ({ ...prev, descripcion: e.target.value }))}
                  rows={6}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-slate-200 text-sm rounded-xl px-4 py-3 resize-y outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Sin este proceso: riesgos y consecuencias</label>
                <textarea
                  value={editado.sin_proceso_riesgos ?? proceso.sin_proceso_riesgos}
                  onChange={e => setEditado(prev => ({ ...prev, sin_proceso_riesgos: e.target.value }))}
                  rows={5}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-slate-200 text-sm rounded-xl px-4 py-3 resize-y outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Con este proceso: beneficios y mejoras</label>
                <textarea
                  value={editado.con_proceso_beneficios ?? proceso.con_proceso_beneficios}
                  onChange={e => setEditado(prev => ({ ...prev, con_proceso_beneficios: e.target.value }))}
                  rows={5}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-slate-200 text-sm rounded-xl px-4 py-3 resize-y outline-none transition-colors"
                />
              </div>

              <div className="bg-slate-900 border border-purple-900/40 rounded-xl p-4">
                <p className="text-sm text-purple-300 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Cuando termines de editar, la IA puede re-analizar el proceso con tus cambios y actualizar los KPIs y riesgos.
                </p>
                <button
                  onClick={reAnalizar}
                  disabled={reAnalizando}
                  className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  {reAnalizando ? <><Loader2 className="w-4 h-4 animate-spin" /> Re-analizando...</> : <><Sparkles className="w-4 h-4" /> Re-analizar con IA</>}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={guardarEdicion}
                  disabled={guardando}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar cambios
                </button>
                <button
                  onClick={() => setPaso('impacto')}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Ver análisis de impacto <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ③ Análisis de impacto */}
          {paso === 'impacto' && (
            <div className="space-y-6">
              {/* KPIs */}
              {proceso.kpis?.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-400" /> KPIs del proceso
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {proceso.kpis.map((kpi, i) => (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <p className="text-sm font-medium text-slate-200 mb-3">{kpi.nombre}</p>
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-xs text-slate-500">Actual</p>
                            <p className="text-lg font-bold text-red-400">{kpi.valor_actual} <span className="text-xs text-slate-500">{kpi.unidad}</span></p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-600 mb-1" />
                          <div>
                            <p className="text-xs text-slate-500">Objetivo</p>
                            <p className="text-lg font-bold text-emerald-400">{kpi.valor_objetivo} <span className="text-xs text-slate-500">{kpi.unidad}</span></p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Riesgos */}
              {proceso.riesgos?.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-400" /> Riesgos identificados
                  </h2>
                  <div className="space-y-3">
                    {proceso.riesgos.map((r, i) => (
                      <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-slate-200">{r.descripcion}</p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0 items-end">
                          <span className={`text-xs border px-2 py-0.5 rounded-full ${IMPACTO_COLOR[r.impacto] ?? IMPACTO_COLOR.medio}`}>
                            Impacto {r.impacto}
                          </span>
                          <span className={`text-xs ${PROB_COLOR[r.probabilidad] ?? 'text-slate-400'}`}>
                            Prob. {r.probabilidad}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!proceso.kpis?.length && !proceso.riesgos?.length && (
                <p className="text-slate-500 text-sm">No se generaron KPIs o riesgos en este análisis.</p>
              )}

              <button
                onClick={() => setPaso('aprobacion')}
                className="w-full sm:w-auto flex items-center gap-2 justify-center bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Proceder a aprobación <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ④ Aprobación digital */}
          {paso === 'aprobacion' && (
            <div className="space-y-6">
              {proceso.estado_aprobacion === 'aprobado' ? (
                <div className="space-y-5">
                  {/* Confirmación */}
                  <div className="bg-emerald-950/30 border border-emerald-800 rounded-xl p-6 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-emerald-300">¡Proceso aprobado!</h2>
                    {proceso.aprobado_at && (
                      <p className="text-slate-400 text-sm mt-2">Aprobado el {fecha(proceso.aprobado_at)}</p>
                    )}
                    {proceso.comentario_aprobacion && (
                      <p className="text-slate-300 text-sm mt-3 bg-slate-900 rounded-lg p-3">{proceso.comentario_aprobacion}</p>
                    )}
                    <p className="text-slate-400 text-sm mt-3">El equipo de consultoría fue notificado y continuará con la siguiente etapa.</p>
                  </div>

                  {/* Paso 7: ¿Qué sigue? */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-indigo-400" /> ¿Qué hacemos ahora?
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={onCerrar}
                        className="flex flex-col items-start gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-xl transition-colors text-left"
                      >
                        <Upload className="w-5 h-5" />
                        <div>
                          <p className="font-semibold text-sm">Cargar siguiente proceso</p>
                          <p className="text-xs text-indigo-200 mt-0.5">
                            {proceso.numero_en_macroproceso != null && proceso.total_en_macroproceso != null
                              ? `Proceso ${proceso.numero_en_macroproceso} de ${proceso.total_en_macroproceso} completado`
                              : 'Continúa con el siguiente documento'}
                          </p>
                        </div>
                      </button>
                      <Link
                        href="/implementacion"
                        className="flex flex-col items-start gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-5 py-4 rounded-xl transition-colors"
                      >
                        <Rocket className="w-5 h-5 text-emerald-400" />
                        <div>
                          <p className="font-semibold text-sm">Ver zona de implementación</p>
                          <p className="text-xs text-slate-400 mt-0.5">Asigna sistemas (ERP, CRM, RPA) a tus procesos aprobados</p>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : proceso.estado_aprobacion === 'rechazado' ? (
                <div className="space-y-5">
                  <div className="bg-red-950/20 border border-red-800 rounded-xl p-6 text-center">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-red-300">Observaciones enviadas</h2>
                    {proceso.comentario_aprobacion && (
                      <p className="text-slate-300 text-sm mt-3 bg-slate-900 rounded-lg p-3">{proceso.comentario_aprobacion}</p>
                    )}
                    <p className="text-slate-400 text-sm mt-4">El equipo revisará sus observaciones y volverá con una versión actualizada.</p>
                  </div>
                  <button onClick={onCerrar} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-medium border border-slate-700 transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Volver al portal
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <h2 className="text-lg font-bold text-white mb-2">Revisión y aprobación</h2>
                    <p className="text-slate-400 text-sm">
                      Al aprobar, confirmas que el análisis de este proceso es correcto y autorizas al equipo para continuar con la siguiente etapa del proyecto.
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-300">Resumen del análisis</p>
                    <div className="text-sm text-slate-400 space-y-1">
                      <p>· Proceso: <span className="text-slate-200">{proceso.nombre_proceso}</span></p>
                      {proceso.macroproceso && <p>· Macroproceso: <span className="text-slate-200">{proceso.macroproceso}</span></p>}
                      {proceso.numero_en_macroproceso != null && <p>· Posición: <span className="text-slate-200">{proceso.numero_en_macroproceso} de {proceso.total_en_macroproceso}</span></p>}
                      {proceso.kpis?.length > 0 && <p>· KPIs identificados: <span className="text-slate-200">{proceso.kpis.length}</span></p>}
                      {proceso.riesgos?.length > 0 && <p>· Riesgos identificados: <span className="text-slate-200">{proceso.riesgos.length}</span></p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Comentario (opcional)
                    </label>
                    <textarea
                      value={comentario}
                      onChange={e => setComentario(e.target.value)}
                      rows={3}
                      placeholder="Agrega observaciones, aclaraciones o contexto adicional..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-slate-200 text-sm rounded-xl px-4 py-3 resize-none outline-none transition-colors"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => aprobar('aprobar')}
                      disabled={aprobando}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                    >
                      {aprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Aprobar proceso
                    </button>
                    <button
                      onClick={() => aprobar('rechazar')}
                      disabled={aprobando}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium border border-slate-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4 text-red-400" />
                      Enviar observaciones
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Componente principal exportado ────────────────────────────────────────────
export interface JourneyPortalProps {
  proyectos: Array<{
    id: string
    nombre: string
    estado_general: string
    fase_actual: number
    updated_at: string
  }>
  nombreUsuario: string
}

export function JourneyPortal({ proyectos, nombreUsuario }: JourneyPortalProps) {
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState<string>(proyectos[0]?.id ?? '')
  const [procesos, setProcesos] = useState<ProcesoResumen[]>([])
  const [procesando, setProcesando] = useState<DocProcesando[]>([])
  const [cargandoProcesos, setCargandoProcesos] = useState(false)
  const [journeyId, setJourneyId] = useState<string | null>(null)

  const cargarProcesos = useCallback(async (pid: string) => {
    if (!pid) return
    setCargandoProcesos(true)
    try {
      const res = await fetch(`/api/portal/procesos?proyecto_id=${pid}`)
      const d = await res.json()
      setProcesos(d.procesos ?? [])
      setProcesando(d.procesando ?? [])
    } catch {
      toast.error('No se pudieron cargar los procesos')
    } finally {
      setCargandoProcesos(false)
    }
  }, [])

  useEffect(() => {
    if (proyectoSeleccionado) cargarProcesos(proyectoSeleccionado)
  }, [proyectoSeleccionado, cargarProcesos])

  // Polling mientras hay documentos procesando
  useEffect(() => {
    if (!procesando.length) return
    const t = setInterval(() => cargarProcesos(proyectoSeleccionado), 5000)
    return () => clearInterval(t)
  }, [procesando.length, proyectoSeleccionado, cargarProcesos])

  const proyecto = proyectos.find(p => p.id === proyectoSeleccionado)

  return (
    <>
      {journeyId && (
        <JourneyProceso
          procesoId={journeyId}
          onCerrar={() => { setJourneyId(null); cargarProcesos(proyectoSeleccionado) }}
        />
      )}

      <div className="space-y-8 max-w-3xl">
        {/* Saludo */}
        <div>
          <h1 className="text-2xl font-bold text-white">Hola, {nombreUsuario}</h1>
          <p className="text-slate-400 text-sm mt-1">Portal de procesos — sube, analiza y aprueba los procesos de tu organización</p>
        </div>

        {/* Selector de proyecto (si tiene más de uno) */}
        {proyectos.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {proyectos.map(p => (
              <button
                key={p.id}
                onClick={() => setProyectoSeleccionado(p.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border
                  ${proyectoSeleccionado === p.id
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Progreso del proyecto */}
        {proyecto && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">{proyecto.nombre}</p>
              <span className="text-xs text-indigo-400">Etapa {proyecto.fase_actual} de 6</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.round((proyecto.fase_actual / 6) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload */}
        {proyectoSeleccionado && (
          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">Subir documento de proceso</h2>
            <UploadZona
              proyectoId={proyectoSeleccionado}
              onSubido={() => cargarProcesos(proyectoSeleccionado)}
            />
          </section>
        )}

        {/* Lista de procesos */}
        {proyectoSeleccionado && (
          <section>
            <h2 className="text-base font-semibold text-slate-200 mb-3">
              Mis procesos
              {cargandoProcesos && <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin text-slate-500" />}
            </h2>

            {procesando.length > 0 && (
              <div className="space-y-2 mb-3">
                {procesando.map(d => <DocProcesandoCard key={d.id} doc={d} />)}
              </div>
            )}

            {procesos.length === 0 && !procesando.length && !cargandoProcesos && (
              <p className="text-slate-500 text-sm">Aún no tienes procesos analizados. Sube tu primer documento.</p>
            )}

            {procesos.length > 0 && (
              <div className="space-y-2">
                {procesos.map(p => (
                  <ProcesoCard key={p.id} proceso={p} onAbrir={() => setJourneyId(p.id)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Glosario de Roles — se muestra si hay procesos aprobados */}
        {proyectoSeleccionado && procesos.some(p => p.estado_aprobacion === 'aprobado') && (
          <GlosarioRolesSection
            proyectoId={proyectoSeleccionado}
            nombreProyecto={proyecto?.nombre ?? ''}
            procesos={procesos.filter(p => p.estado_aprobacion === 'aprobado')}
          />
        )}

        {proyectos.length === 0 && (
          <p className="text-slate-500 text-sm">Aún no tienes proyectos asignados. El equipo te notificará cuando estés listo.</p>
        )}
      </div>
    </>
  )
}

// ── Sección colapsable de Glosario de Roles ───────────────────────────────────
function GlosarioRolesSection({
  proyectoId,
  nombreProyecto,
  procesos,
}: {
  proyectoId: string
  nombreProyecto: string
  procesos: ProcesoResumen[]
}) {
  const [expandido, setExpandido] = useState(false)

  const rolesDetectados = procesos.map(p => ({
    rol: p.nombre_proceso,
    descripcion: p.macroproceso ? `Responsable del proceso "${p.nombre_proceso}" dentro del macroproceso ${p.macroproceso}` : `Responsable del proceso "${p.nombre_proceso}"`,
    procesos: [p.nombre_proceso],
  }))

  return (
    <section className="border border-indigo-900/30 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpandido(v => !v)}
        className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-indigo-950/40 to-violet-950/20 hover:from-indigo-950/60 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <BookOpen className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <p className="font-semibold text-slate-100 text-sm">Glosario de Roles</p>
            <p className="text-xs text-slate-400 mt-0.5">
              ¿Quién de tu organización debe liderar cada proceso? La IA te recomienda los responsables.
            </p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${expandido ? 'rotate-180' : ''}`} />
      </button>

      {expandido && (
        <div className="border-t border-indigo-900/20 px-5 bg-slate-950/60">
          <GlosarioRoles
            proyectoId={proyectoId}
            nombreProyecto={nombreProyecto}
            rolesDetectados={rolesDetectados}
          />
        </div>
      )}
    </section>
  )
}
