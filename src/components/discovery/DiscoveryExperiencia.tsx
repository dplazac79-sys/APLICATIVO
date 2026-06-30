'use client'

import { useState } from 'react'
import {
  Brain, Sparkles, ChevronDown, ChevronUp, CheckCircle, XCircle,
  Clock, Zap, Target, AlertTriangle, TrendingUp, Users, ArrowRight,
  Activity, Shield, BarChart3, Cpu, Layers, FileText, AlertCircle, Lock
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

const CRITICIDAD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Crítica', color: 'text-red-400', bg: 'bg-red-950/40 border-red-800/50' },
  alta:    { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-950/40 border-orange-800/50' },
  media:   { label: 'Media',   color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/50' },
  baja:    { label: 'Baja',    color: 'text-slate-400', bg: 'bg-slate-800/40 border-slate-700/50' },
}

// ─── ProcesoCard ─────────────────────────────────────────────────────────────

function ProcesoCard({ proceso, esHijo = false }: { proceso: ProcesoConHijos; esHijo?: boolean }) {
  const [expandido, setExpandido] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [aprobando, setAprobando] = useState(false)
  const [estadoLocal, setEstadoLocal] = useState(proceso.estado_oferta)

  const meta = proceso.metadata_ia
  const criticidad = meta?.criticidad as string | undefined
  const critCfg = criticidad ? CRITICIDAD_CONFIG[criticidad] : null
  const saludCfg = resumen ? SALUD_CONFIG[resumen.estado_salud] ?? SALUD_CONFIG.estable : null

  async function analizarConIA() {
    if (resumen) { setExpandido(true); return }
    setAnalizando(true)
    setExpandido(true)
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

  const estadoIcon = estadoLocal === 'aceptado'
    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
    : estadoLocal === 'rechazado'
    ? <XCircle className="w-4 h-4 text-red-400" />
    : <Clock className="w-4 h-4 text-amber-400" />

  return (
    <div className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
      esHijo
        ? 'bg-slate-900/60 border-slate-700/50 hover:border-slate-600/70'
        : 'bg-slate-900/80 border-slate-700/60 hover:border-violet-700/50'
    } ${estadoLocal === 'aceptado' ? 'border-emerald-800/40' : estadoLocal === 'rechazado' ? 'border-red-900/40 opacity-60' : ''}`}>

      {/* Accent top bar por criticidad */}
      {critCfg && !esHijo && (
        <div className={`h-0.5 w-full ${
          criticidad === 'critica' ? 'bg-gradient-to-r from-red-600 to-red-400' :
          criticidad === 'alta' ? 'bg-gradient-to-r from-orange-600 to-amber-400' :
          criticidad === 'media' ? 'bg-gradient-to-r from-amber-600 to-yellow-400' :
          'bg-gradient-to-r from-slate-600 to-slate-500'
        }`} />
      )}

      <div className="p-5">
        {/* Header del proceso */}
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            estadoLocal === 'aceptado' ? 'bg-emerald-900/60 text-emerald-400' :
            estadoLocal === 'rechazado' ? 'bg-red-900/40 text-red-400' :
            'bg-violet-900/40 text-violet-300'
          }`}>
            {estadoIcon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-white font-semibold text-sm leading-snug">{proceso.nombre}</h3>
                {proceso.descripcion && (
                  <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2">{proceso.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {critCfg && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${critCfg.bg} ${critCfg.color}`}>
                    {critCfg.label}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  proceso.origen === 'detectado' ? 'bg-blue-950/50 text-blue-300 border-blue-800/50' :
                  proceso.origen === 'propuesta_ia' ? 'bg-violet-950/50 text-violet-300 border-violet-800/50' :
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {proceso.origen === 'detectado' ? '📄 Detectado' : proceso.origen === 'propuesta_ia' ? '🤖 Propuesta IA' : '✏️ Manual'}
                </span>
              </div>
            </div>

            {/* Roles */}
            {proceso.roles_involucrados?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                <Users className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                {proceso.roles_involucrados.map(r => (
                  <span key={r} className="text-xs text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{r}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
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
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {resumen ? 'Ver diagnóstico IA' : 'Diagnosticar con IA'}
              </>
            )}
          </button>

          {estadoLocal === 'propuesto' && (
            <>
              <button
                onClick={() => cambiarEstado('aceptado')}
                disabled={aprobando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/60 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Aceptar proceso
              </button>
              <button
                onClick={() => cambiarEstado('rechazado')}
                disabled={aprobando}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-950/60 transition-all disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Rechazar
              </button>
            </>
          )}

          {estadoLocal === 'aceptado' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle className="w-3.5 h-3.5" /> Proceso validado
            </span>
          )}

          {(proceso as any).hijos?.length > 0 && (
            <button
              onClick={() => setExpandido(v => !v)}
              className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {(proceso as any).hijos.length} subproceso{(proceso as any).hijos.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Panel IA */}
        {expandido && (
          <div className="mt-4 space-y-3">
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

            {resumen && saludCfg && (
              <div className={`rounded-xl border p-5 space-y-4 ${saludCfg.bg} ${saludCfg.border}`}>
                {/* Header diagnóstico */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-400" />
                    <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">Diagnóstico AICOUNTS Intelligence</span>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${saludCfg.color} bg-slate-900/60 border border-current/20`}>
                    {saludCfg.dot && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: 'currentColor' }} />}
                    {saludCfg.label}
                  </span>
                </div>

                {/* Diagnóstico */}
                <p className="text-slate-200 text-sm leading-relaxed">{resumen.diagnostico}</p>

                {/* Grid de métricas */}
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

                {/* Automatización + Siguiente paso */}
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

            {/* Subprocesos */}
            {(proceso as any).hijos?.length > 0 && (
              <div className="space-y-2 pl-4 border-l border-slate-700/50">
                {(proceso as any).hijos.map((hijo: ProcesoConHijos) => (
                  <ProcesoCard key={hijo.id} proceso={hijo} esHijo />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Estado vacío ─────────────────────────────────────────────────────────────

function EstadoVacioDiscovery({
  proyectosParaAcciones,
  documentos,
}: {
  proyectosParaAcciones: { id: string; nombre: string }[]
  documentos: DocumentoItem[]
}) {
  const listos = documentos.filter(d => d.estado_procesamiento === 'listo')
  const noListos = documentos.filter(d => d.estado_procesamiento !== 'listo')
  const tieneListos = listos.length > 0

  const [seleccionados, setSeleccionados] = useState<string[]>(listos.map(d => d.id))
  const todosSeleccionados = listos.length > 0 && seleccionados.length === listos.length

  function toggleDoc(id: string) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? [] : listos.map(d => d.id))
  }

  return (
    <div className="space-y-6">
      {/* Hero — resumen de valor */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950/40 to-slate-900 border border-violet-800/30 p-8 sm:p-10">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(to right, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-violet-900/40 border border-violet-700/50 rounded-full px-4 py-1.5 mb-5">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-violet-300 text-xs font-semibold uppercase tracking-widest">AICOUNTS Intelligence Engine</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
            La metodología AICOUNTS,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300">potenciada por inteligencia artificial</span>
          </h2>
          <p className="text-slate-300 text-base leading-relaxed mb-6">
            Nuestro framework propietario de consultoría se ejecuta sobre un motor de IA de última generación que lee tu documentación, mapea la cadena de valor completa y construye el inventario de procesos críticos, el Glosario de Roles y el roadmap de automatización con el rigor analítico de AICOUNTS — a la velocidad de la inteligencia artificial.
          </p>
          <div className="flex items-center gap-3 flex-wrap text-sm text-slate-400">
            <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" /><span>Rigor metodológico AICOUNTS</span></div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-400" /><span>Insights accionables desde el día uno</span></div>
            <div className="w-px h-4 bg-slate-700" />
            <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-400" /><span>Motor de IA de última generación</span></div>
          </div>
        </div>
      </div>

      {/* ── Paso 1: selección de documentos ── */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
            <div>
              <p className="text-white font-semibold text-sm">Define el alcance del análisis</p>
              <p className="text-slate-500 text-xs mt-0.5">Selecciona qué documentos procesados entran al motor de inteligencia.</p>
            </div>
          </div>
          {listos.length > 0 && (
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={toggleTodos} className="text-xs text-violet-300 hover:text-violet-200 font-medium transition-colors">
                {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-full px-2.5 py-1">
                {seleccionados.length}/{listos.length}
              </span>
            </div>
          )}
        </div>

        {documentos.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">Aún no hay documentos cargados</p>
            <p className="text-slate-400 text-sm">Carga tu documentación en Centro Documental para activar el motor de análisis.</p>
            <a href="/documentos" className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              <Layers className="w-4 h-4" /> Ir a Centro Documental
            </a>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {listos.map(doc => {
              const bloque = (doc.clasificacion as any)?.bloque_metodologico as string | undefined
              const elegido = seleccionados.includes(doc.id)
              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDoc(doc.id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-left ${
                    elegido
                      ? 'bg-emerald-950/20 border border-emerald-800/40 hover:border-emerald-700/60'
                      : 'bg-slate-800/30 border border-slate-700/40 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    elegido ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'
                  }`}>
                    {elegido && <CheckCircle className="w-3.5 h-3.5 text-slate-950" strokeWidth={3} />}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/50 border border-emerald-800/60 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{doc.nombre_archivo}</p>
                    {bloque && <p className="text-slate-500 text-xs truncate">{bloque}</p>}
                  </div>
                  <span className="text-xs text-emerald-400 font-medium shrink-0">Procesado</span>
                </button>
              )
            })}

            {noListos.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-slate-800/20 border border-slate-700/30 rounded-xl px-4 py-3 opacity-50">
                <div className="w-5 h-5 rounded-md border-2 border-slate-700 flex items-center justify-center shrink-0">
                  <Lock className="w-3 h-3 text-slate-600" />
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-400 text-sm truncate">{doc.nombre_archivo}</p>
                  <p className="text-slate-600 text-xs">En cola de procesamiento — aún no disponible para el análisis</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Paso 2: impacto en Glosario de Roles ── */}
      {documentos.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex items-start gap-4">
          <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/40 border border-indigo-700/40 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Construcción del Glosario de Roles</p>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                El motor mapea cada rol detectado contra los procesos donde participa y su nivel de responsabilidad, entregando una matriz organizacional accionable — la base para decisiones de gobierno y rediseño operacional.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 3: ejecutar ── */}
      <div className="bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-slate-900 border border-violet-700/40 rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <span className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-1">3</span>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/60">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg">
              {listos.length === 0 ? 'Activa el motor cuando tengas documentos procesados' : seleccionados.length > 0 ? 'Todo listo para ejecutar el análisis' : 'Define el alcance para continuar'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {listos.length === 0 ? (
                'Procesa tu documentación en Centro Documental para habilitar el motor de inteligencia AICOUNTS.'
              ) : seleccionados.length > 0 ? (
                <><span className="text-emerald-400 font-semibold">{seleccionados.length} documento{seleccionados.length !== 1 ? 's' : ''}</span> serán procesados por el motor de inteligencia para construir el inventario de procesos y el Glosario de Roles con estándar AICOUNTS.</>
              ) : (
                'Selecciona arriba los documentos que definirán el alcance del análisis.'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1 pl-11">
          {listos.length === 0 ? (
            <a href="/documentos" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600/30 hover:bg-amber-600/40 border border-amber-600/40 text-amber-300 text-sm font-medium rounded-xl transition-colors">
              <Layers className="w-4 h-4" /> Ir a Centro Documental
            </a>
          ) : (
            <>
              <DiscoveryAcciones proyectos={proyectosParaAcciones} documentoIds={seleccionados} disabled={seleccionados.length === 0} />
              <div className="text-xs text-slate-500">Análisis de alta precisión · 1–3 minutos · puedes seguir navegando</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiscoveryExperiencia({
  proyectoId, nombreProyecto, clienteNombre,
  macroprocesos, totalProcesos, aceptados, pendientes, rechazados,
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
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Process Discovery IA</h1>
                <p className="text-slate-400 text-xs">{nombreProyecto}{clienteNombre ? ` · ${clienteNombre}` : ''}</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm max-w-lg">
              Inteligencia operacional con metodología AICOUNTS: mapea, diagnostica y prioriza los procesos críticos de tu organización con rigor de consultoría de clase mundial.
            </p>
          </div>
          {totalProcesos > 0 && <DiscoveryAcciones proyectos={proyectosParaAcciones} />}
        </div>

        {/* KPI strip */}
        {totalProcesos > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Procesos detectados', value: totalProcesos, color: 'text-white', icon: Activity },
              { label: 'Validados', value: aceptados, color: 'text-emerald-400', icon: CheckCircle },
              { label: 'En revisión', value: pendientes, color: 'text-amber-400', icon: Clock },
              { label: '% aprobación', value: `${pctAprobacion}%`, color: pctAprobacion >= 80 ? 'text-emerald-400' : pctAprobacion >= 50 ? 'text-amber-400' : 'text-red-400', icon: BarChart3 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progreso aprobación */}
        {totalProcesos > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Progreso de validación</span>
              <span>{aceptados}/{totalProcesos} procesos</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${pctAprobacion}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      {totalProcesos > 0 && (
        <div className="flex gap-1 bg-slate-900/80 border border-slate-800 rounded-xl p-1 w-fit">
          {[
            { id: 'procesos', label: 'Inventario de Procesos', icon: Activity, count: totalProcesos },
            { id: 'glosario', label: 'Glosario de Roles', icon: Users, count: rolesDetectados.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'procesos' | 'glosario')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-white/20' : 'bg-slate-700 text-slate-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Contenido ── */}
      {totalProcesos === 0 ? (
        <EstadoVacioDiscovery proyectosParaAcciones={proyectosParaAcciones} documentos={documentos} />
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

          {/* Cards de procesos */}
          <div className="space-y-3">
            {macroprocesos.map(macro => (
              <ProcesoCard key={macro.id} proceso={macro} />
            ))}
          </div>

          {/* Tip inline */}
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <p className="text-slate-400 text-xs">
              Activa <span className="text-violet-300 font-medium">Diagnosticar con IA</span> en cualquier proceso para un análisis ejecutivo instantáneo de criticidad, impacto al negocio y oportunidades de automatización.
            </p>
          </div>

          {/* Botón Discovery al fondo — para no tener que subir */}
          <DiscoveryAcciones proyectos={proyectosParaAcciones} variant="bottom" />
        </div>
      ) : (
        <GlosarioRoles
          proyectoId={proyectoId}
          nombreProyecto={nombreProyecto}
          rolesDetectados={rolesDetectados}
        />
      )}
    </div>
  )
}
