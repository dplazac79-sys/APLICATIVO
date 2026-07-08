import { createAdminClient } from '@/lib/supabase/admin'
import {
  Layers, ChevronRight, FileText, CheckCircle, Globe, Clock,
  AlertTriangle, Brain, Zap, BarChart3, Shield, GitBranch, Users, Target, TrendingUp, ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'
import type { Proceso, Artefacto } from '@/types/database'
import { LABEL_ARTEFACTO, ORDEN_GENERACION } from '@/lib/artefactos-meta'

export const dynamic = 'force-dynamic'

const NIVEL_CONFIG = [
  { label: 'Macroproceso', color: 'text-violet-400',  dot: 'bg-violet-500',  bg: 'bg-violet-950/20 border-violet-800/30 hover:border-violet-600/50' },
  { label: 'Proceso',      color: 'text-blue-400',    dot: 'bg-blue-500',    bg: 'bg-blue-950/20 border-blue-800/30 hover:border-blue-600/50' },
  { label: 'Subproceso',   color: 'text-cyan-400',    dot: 'bg-cyan-500',    bg: 'bg-cyan-950/20 border-cyan-800/30 hover:border-cyan-600/50' },
  { label: 'Actividad',    color: 'text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-950/20 border-emerald-800/30 hover:border-emerald-600/50' },
  { label: 'Tarea',        color: 'text-slate-400',   dot: 'bg-slate-500',   bg: 'bg-slate-800/20 border-slate-700/30 hover:border-slate-600/50' },
]

const ARTEFACTO_ICON: Record<string, React.ReactNode> = {
  sipoc:          <GitBranch className="w-3 h-3" />,
  as_is:          <Clock className="w-3 h-3" />,
  bpmn:           <Layers className="w-3 h-3" />,
  raci:           <Users className="w-3 h-3" />,
  riesgo_control: <Shield className="w-3 h-3" />,
  kpi_sla:        <BarChart3 className="w-3 h-3" />,
  diagnostico:    <Zap className="w-3 h-3" />,
  to_be:          <TrendingUp className="w-3 h-3" />,
}

function derivarCodigo(p: Proceso & { documento_origen?: { nombre_archivo: string } | null }, lista: Proceso[]): string | null {
  const docNombre = (p as any).documento_origen?.nombre_archivo as string | undefined
  if (docNombre) {
    const match = docNombre.match(/^([A-Za-z]{1,6}[0-9]{1,3})/i)
    if (match) return match[1].toUpperCase()
  }
  if (p.padre_id) {
    const padre = lista.find(x => x.id === p.padre_id)
    if (padre) {
      const siglas = padre.nombre
        .split(' ')
        .filter(w => w.length > 2)
        .map(w => w[0].toUpperCase())
        .join('')
        .slice(0, 3)
      return `${siglas}${String(p.orden).padStart(2, '0')}`
    }
  }
  return null
}

export default async function ArtefactosPage() {
  const admin = createAdminClient()

  const { data: proyectos } = await admin
    .from('proyecto')
    .select('id, nombre, cliente(razon_social)')
    .eq('estado_general', 'activo')

  const { data: procesosRaw } = await admin
    .from('proceso')
    .select('*, documento_origen:documento_origen_id(nombre_archivo)')
    .order('nivel')
    .order('orden')

  const { data: artefactosRaw } = await admin
    .from('artefacto')
    .select('proceso_id, tipo, estado_validacion')
    .in('tipo', ORDEN_GENERACION)

  const procesos = (procesosRaw ?? []) as Proceso[]
  const artefactos = (artefactosRaw ?? []) as Pick<Artefacto, 'proceso_id' | 'tipo' | 'estado_validacion'>[]

  const artefactosPorProceso = artefactos.reduce((acc, a) => {
    if (!acc[a.proceso_id]) acc[a.proceso_id] = []
    acc[a.proceso_id].push(a)
    return acc
  }, {} as Record<string, typeof artefactos>)

  const procesosPorProyecto = (proyectos ?? []).map(p => ({
    ...p,
    procesos: procesos.filter(pr => pr.proyecto_id === p.id),
  }))

  const procesosAceptados = procesos.filter(p => p.estado_oferta === 'aceptado')
  const totalProcesosAceptados = procesosAceptados.length
  const idsAceptados = new Set(procesosAceptados.map(p => p.id))

  // Solo contar artefactos de procesos aceptados
  const artefactosAceptados = artefactos.filter(a => idsAceptados.has(a.proceso_id))
  const totalArtefactos = artefactosAceptados.length
  const totalAprobados = artefactosAceptados.filter(a => a.estado_validacion === 'validado' || a.estado_validacion === 'publicado').length
  // Procesos aceptados con los 8 artefactos completos
  const procesosCompletos = procesosAceptados.filter(
    p => (artefactosPorProceso[p.id]?.length ?? 0) >= ORDEN_GENERACION.length
  ).length

  function renderArbol(lista: Proceso[], padreId: string | null, nivel: number): React.ReactNode {
    const hijos = lista.filter(p => p.padre_id === padreId)
    if (!hijos.length) return null
    const hijosOrdenados = [...hijos].sort((a, b) => {
      const ca = derivarCodigo(a as any, lista) ?? ''
      const cb = derivarCodigo(b as any, lista) ?? ''
      const na = parseInt(ca.replace(/\D/g, '') || '999', 10)
      const nb = parseInt(cb.replace(/\D/g, '') || '999', 10)
      if (na !== nb) return na - nb
      return ca.localeCompare(cb)
    })
    return hijosOrdenados.map(p => {
      const cfg = NIVEL_CONFIG[nivel] ?? NIVEL_CONFIG[4]
      const arts = artefactosPorProceso[p.id] ?? []
      const total = ORDEN_GENERACION.length
      const generados = arts.length
      const publicados = arts.filter(a => a.estado_validacion === 'validado' || a.estado_validacion === 'publicado').length
      const hayIncompletos = generados < total && generados > 0
      const codigo = derivarCodigo(p as any, lista)
      const pct = total > 0 ? Math.round((generados / total) * 100) : 0

      return (
        <div key={p.id} style={{ marginLeft: `${Math.min(nivel * 16, 56)}px` }}>
          <Link href={`/artefactos/${p.id}`} className="block group">
            <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 mb-1.5 transition-all duration-200 cursor-pointer ${cfg.bg}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                {codigo && (
                  <span className={`text-[10px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded-md bg-slate-900/60 border border-slate-700/50 ${cfg.color} tracking-wide`}>
                    {codigo}
                  </span>
                )}
                <span className="text-slate-200 text-sm font-medium truncate">{p.nombre}</span>
                <span className={`text-[10px] ${cfg.color} shrink-0 opacity-50 font-medium`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                {generados === 0 && (
                  <span className="text-[11px] text-slate-600 font-medium">Sin artefactos</span>
                )}
                {generados > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-[11px] font-semibold ${pct === 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {generados}/{total}
                    </span>
                  </div>
                )}
                {publicados > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-400 font-medium">
                    <CheckCircle className="w-3 h-3" />{publicados} aprobados
                  </span>
                )}
                {hayIncompletos && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" />
                )}
                <ArrowUpRight className={`w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors`} />
              </div>
            </div>
          </Link>
          {renderArbol(lista, p.id, nivel + 1)}
        </div>
      )
    })
  }

  const stats = [
    {
      label: 'Procesos aceptados',
      value: totalProcesosAceptados,
      color: 'text-white',
      accent: 'from-slate-800/0 to-violet-900/20',
      border: 'border-slate-800 hover:border-violet-700/50',
      desc: 'Con documentación cargada',
      icon: <Layers className="w-4 h-4 text-violet-400" />,
    },
    {
      label: 'Artefactos generados',
      value: totalArtefactos,
      color: 'text-violet-300',
      accent: 'from-slate-800/0 to-violet-900/30',
      border: 'border-slate-800 hover:border-violet-600/50',
      desc: 'SIPOC, AS-IS, BPMN…',
      icon: <FileText className="w-4 h-4 text-violet-400" />,
    },
    {
      label: 'Aprobados',
      value: totalAprobados,
      color: 'text-blue-300',
      accent: 'from-slate-800/0 to-blue-900/20',
      border: 'border-slate-800 hover:border-blue-700/50',
      desc: 'Revisados y listos para entrega',
      icon: <CheckCircle className="w-4 h-4 text-blue-400" />,
    },
    {
      label: 'Procesos completos',
      value: procesosCompletos,
      color: 'text-emerald-300',
      accent: 'from-slate-800/0 to-emerald-900/20',
      border: 'border-slate-800 hover:border-emerald-700/50',
      desc: `Con los ${ORDEN_GENERACION.length} artefactos generados`,
      icon: <Target className="w-4 h-4 text-emerald-400" />,
    },
  ]

  return (
    <div className="space-y-8 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-950/60 border border-violet-800/50 flex items-center justify-center">
              <Layers className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Process Architect</h1>
          </div>
          <p className="text-slate-500 text-sm pl-[42px]">Arquitectura de procesos y artefactos metodológicos generados por IA</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div
            key={s.label}
            className={`relative rounded-2xl border bg-gradient-to-b ${s.accent} ${s.border} bg-slate-900 p-5 transition-all duration-200 overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-1.5">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Artefactos metodológicos */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
          <div className="w-1 h-4 rounded-full bg-violet-500" />
          <span className="text-slate-300 text-sm font-medium">8 artefactos metodológicos por proceso</span>
          <span className="ml-auto text-[11px] text-slate-600 font-medium bg-slate-800 px-2 py-0.5 rounded-full">Estándar AICOUNTS</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ORDEN_GENERACION.map(tipo => (
              <div
                key={tipo}
                className="flex items-center gap-2 rounded-xl bg-slate-800/40 border border-slate-700/40 px-3 py-2.5 hover:border-violet-700/40 hover:bg-slate-800/60 transition-all duration-150"
              >
                <span className="text-violet-400/80 shrink-0">
                  {ARTEFACTO_ICON[tipo] ?? <FileText className="w-3 h-3" />}
                </span>
                <span className="text-slate-300 text-xs font-medium">{LABEL_ARTEFACTO[tipo]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Árbol de procesos */}
      {procesosPorProyecto.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 py-20 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
            <Brain className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-slate-300 font-medium text-sm">No hay procesos aceptados aún</p>
          <p className="text-slate-600 text-xs text-center max-w-xs leading-relaxed">
            Acepta procesos en la vista Discovery AI para poder generar artefactos metodológicos.
          </p>
        </div>
      ) : (
        procesosPorProyecto.map(proyecto => {
          const prosProyecto = proyecto.procesos
          if (!prosProyecto.length) return null
          const cliente = proyecto.cliente as unknown as { razon_social: string } | null
          return (
            <div key={proyecto.id} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <h2 className="text-sm font-semibold text-slate-200">{proyecto.nombre}</h2>
                {cliente && (
                  <span className="text-slate-600 text-xs">· {cliente.razon_social}</span>
                )}
              </div>
              <div className="space-y-0">
                {renderArbol(prosProyecto, null, 0)}
              </div>
            </div>
          )
        })
      )}

      {/* Leyenda estados */}
      <div className="flex items-center gap-5 px-1">
        {[
          { icon: <CheckCircle className="w-3 h-3 text-emerald-400" />, label: 'Validado' },
          { icon: <CheckCircle className="w-3 h-3 text-blue-400" />, label: 'Aprobado' },
          { icon: <Clock className="w-3 h-3 text-amber-400" />, label: 'Pendiente' },
        ].map(({ icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {icon}{label}
          </span>
        ))}
      </div>
    </div>
  )
}
