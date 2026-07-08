import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  Layers, ChevronRight, FileText, CheckCircle, Globe, Clock,
  AlertTriangle, Brain, Zap, BarChart3, Shield, GitBranch, Users, Target, TrendingUp, ArrowUpRight,
  FolderOpen, History, Info
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

  // Obtener rol del usuario actual
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioData } = await admin
    .from('usuario')
    .select('rol')
    .eq('id', user?.id ?? '')
    .single()
  const rolUsuario = usuarioData?.rol ?? 'usuario_cliente'
  const esSuperAdmin = rolUsuario === 'super_admin'
  const esCliente = rolUsuario === 'sponsor_cliente' || rolUsuario === 'usuario_cliente'

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
    .select('proceso_id, tipo, estado_validacion, version, generado_por_ia')
    .in('tipo', ORDEN_GENERACION)

  const procesos = (procesosRaw ?? []) as Proceso[]
  const artefactos = (artefactosRaw ?? []) as Pick<Artefacto, 'proceso_id' | 'tipo' | 'estado_validacion' | 'version' | 'generado_por_ia'>[]

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
  const aprobados = artefactosAceptados.filter(a => a.estado_validacion === 'validado' || a.estado_validacion === 'publicado')
  const totalAprobados = aprobados.length
  // Aprobados sin cambios (solo validó, no editó — version sigue en 1 y generado_por_ia true)
  const aprobadosSinCambios = aprobados.filter(a => a.version === 1 && a.generado_por_ia).length
  // Aprobados con modificaciones del cliente (version > 1 o generado_por_ia false)
  const aprobadosConCambios = totalAprobados - aprobadosSinCambios

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
      const esMacroproceso = p.tipo === 'macroproceso' || p.nivel === 0
      const esClickable = esSuperAdmin || !esMacroproceso

      const cardContent = (
            <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 mb-1.5 transition-all duration-200 ${esClickable ? 'cursor-pointer' : 'cursor-default'} ${cfg.bg}`}>
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
                {esClickable && (
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                )}
              </div>
            </div>
      )

      return (
        <div key={p.id} style={{ marginLeft: `${Math.min(nivel * 16, 56)}px` }}>
          {esClickable ? (
            <Link href={`/artefactos/${p.id}`} className="block group">{cardContent}</Link>
          ) : (
            <div className="group">{cardContent}</div>
          )}
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
      label: 'Participación cliente',
      value: aprobadosConCambios > 0 || aprobadosSinCambios > 0
        ? `${aprobadosConCambios} editados · ${aprobadosSinCambios} sin cambios`
        : '—',
      color: 'text-emerald-300',
      accent: 'from-slate-800/0 to-emerald-900/20',
      border: 'border-slate-800 hover:border-emerald-700/50',
      desc: `De ${totalAprobados} artefactos aprobados por el cliente`,
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

      {/* Banner orientativo para clientes */}
      {esCliente && (
        <div className="rounded-2xl border border-sky-800/40 bg-sky-950/20 p-4">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1 min-w-0">
              <p className="text-sky-200 text-sm font-medium leading-snug">
                ¿Cómo trabajar con los artefactos?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-900/50 border border-sky-800/40 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sky-100 text-xs font-medium">Revisar y validar</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                      Abre cualquier proceso (SC01–SC06), revisa cada artefacto y usa el botón <span className="text-white font-medium">Validar</span> para aprobarlo.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-900/50 border border-sky-800/40 flex items-center justify-center shrink-0">
                    <History className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sky-100 text-xs font-medium">Historial de cambios en artefactos</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                      Dentro de cada artefacto, el ícono <span className="text-white font-medium">🕐</span> muestra todas las versiones anteriores y qué cambió exactamente en cada edición.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-900/50 border border-sky-800/40 flex items-center justify-center shrink-0">
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sky-100 text-xs font-medium">Control de versiones de documentos</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                      Si el documento fuente cambia, ve al{' '}
                      <Link href="/documentos" className="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors">
                        Centro Documental
                      </Link>
                      {' '}y sube la nueva versión — el sistema la vincula automáticamente al original (v1 → v2 → v3…).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Cards genéricas — las 3 primeras */}
        {stats.slice(0, 3).map(s => (
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

        {/* Card especial — Participación cliente */}
        {(() => {
          const total = aprobadosConCambios + aprobadosSinCambios
          const pctEditados = total > 0 ? Math.round((aprobadosConCambios / total) * 100) : 0
          return (
            <div className="relative rounded-2xl border border-slate-800 hover:border-emerald-700/50 bg-gradient-to-b from-slate-800/0 to-emerald-900/20 bg-slate-900 p-5 transition-all duration-200 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Participación cliente</p>
                <Target className="w-4 h-4 text-emerald-400" />
              </div>

              {total === 0 ? (
                <p className="text-slate-600 text-sm">Sin aprobaciones aún</p>
              ) : (
                <>
                  {/* Barra de proporción */}
                  <div className="h-1 rounded-full bg-slate-800 overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${pctEditados}%` }}
                    />
                  </div>

                  {/* Dos métricas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-2xl font-bold text-emerald-300 tracking-tight leading-none">{aprobadosConCambios}</p>
                      <p className="text-slate-500 text-[11px] mt-1 leading-tight">con edición</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-400 tracking-tight leading-none">{aprobadosSinCambios}</p>
                      <p className="text-slate-500 text-[11px] mt-1 leading-tight">sin cambios</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}
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
