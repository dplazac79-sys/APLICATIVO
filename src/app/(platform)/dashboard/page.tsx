export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FileText, FolderOpen, Brain, Layers, Sparkles, ArrowRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import FaseWorkflow from '@/components/fases/FaseWorkflow'
import { getFasesProyecto } from '@/lib/fases'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: usuario } = await supabase
    .from('usuario')
    .select('nombre, rol, usuario_proyecto(proyecto_id)')
    .eq('id', user!.id)
    .single()

  const admin = createAdminClient()
  const esSuperAdmin = usuario?.rol === 'super_admin'
  const proyectoIds = (usuario?.usuario_proyecto ?? []).map((up: { proyecto_id: string }) => up.proyecto_id)

  let proyectoMeta: { id: string; nombre: string; estado_general: string; cliente: { razon_social?: string } | null } | null = null
  let fases = null

  if (esSuperAdmin) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social)')
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p as any; fases = (await getFasesProyecto(p.id)).fases }
  } else if (proyectoIds.length > 0) {
    const { data: p } = await admin
      .from('proyecto')
      .select('id, nombre, estado_general, cliente:cliente_id(razon_social)')
      .in('id', proyectoIds)
      .eq('estado_general', 'activo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (p) { proyectoMeta = p as any; fases = (await getFasesProyecto(p.id)).fases }
  }

  // Stats del proyecto activo
  let stats = { documentos: 0, procesosTotal: 0, procesosAprobados: 0, artefactos: 0 }
  if (proyectoMeta) {
    const [docsRes, procesosRes, artefactosRes] = await Promise.all([
      admin.from('documento').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id),
      admin.from('proceso').select('id, estado_oferta', { count: 'exact' }).eq('proyecto_id', proyectoMeta.id),
      admin.from('artefacto').select('id', { count: 'exact', head: true }).eq('proyecto_id', proyectoMeta.id),
    ])
    stats = {
      documentos: docsRes.count ?? 0,
      procesosTotal: procesosRes.count ?? 0,
      procesosAprobados: (procesosRes.data ?? []).filter((p: any) => p.estado_oferta === 'aceptado').length,
      artefactos: artefactosRes.count ?? 0,
    }
  }

  const faseActiva = fases?.find(f => f.status === 'activa')
  const fasesCompletadas = fases?.filter(f => f.status === 'completada').length ?? 0
  const totalFases = fases?.length ?? 6
  const pctGlobal = Math.round((fasesCompletadas / totalFases) * 100)
  const pctProcesos = stats.procesosTotal > 0 ? Math.round((stats.procesosAprobados / stats.procesosTotal) * 100) : 0

  const kpis = [
    {
      label: 'Documentos cargados',
      value: stats.documentos,
      icon: FileText,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-900/40',
      href: '/documentos',
      sub: stats.documentos === 0 ? 'Sin documentos aún' : `${stats.documentos} archivo${stats.documentos !== 1 ? 's' : ''}`,
      subColor: stats.documentos === 0 ? 'text-amber-500' : 'text-slate-500',
    },
    {
      label: 'Procesos descubiertos',
      value: stats.procesosTotal,
      icon: Brain,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-900/40',
      href: '/discovery',
      sub: stats.procesosTotal > 0 ? `${stats.procesosAprobados} aprobados (${pctProcesos}%)` : 'Ejecuta Discovery AI',
      subColor: stats.procesosTotal === 0 ? 'text-slate-500' : pctProcesos === 100 ? 'text-emerald-400' : 'text-slate-500',
    },
    {
      label: 'Artefactos generados',
      value: stats.artefactos,
      icon: Layers,
      color: 'text-violet-400',
      bg: 'bg-violet-950/40 border-violet-900/40',
      href: '/artefactos',
      sub: stats.artefactos === 0 ? 'Sin artefactos aún' : `${stats.artefactos} artefacto${stats.artefactos !== 1 ? 's' : ''} metodológico${stats.artefactos !== 1 ? 's' : ''}`,
      subColor: 'text-slate-500',
    },
    {
      label: 'Avance del proyecto',
      value: `${pctGlobal}%`,
      icon: FolderOpen,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-900/40',
      href: null,
      sub: `${fasesCompletadas} de ${totalFases} fases completadas`,
      subColor: 'text-slate-500',
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {proyectoMeta
              ? <>Proyecto: <span className="text-slate-200 font-medium">{proyectoMeta.nombre}</span>{(proyectoMeta.cliente as any)?.razon_social && <> · {(proyectoMeta.cliente as any).razon_social}</>}</>
              : `Bienvenido, ${usuario?.nombre}`
            }
          </p>
        </div>
        <Link
          href="/bienvenida"
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" /> Ver resumen del proyecto
        </Link>
      </div>

      {/* Alerta si no hay documentos */}
      {proyectoMeta && stats.documentos === 0 && (
        <div className="flex items-center gap-3 bg-amber-950/20 border border-amber-900/40 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-300 text-sm flex-1">
            Sin documentos cargados. Para ejecutar Discovery AI necesitas subir al menos un documento del proyecto.
          </p>
          <Link href="/documentos" className="text-xs text-amber-400 hover:text-amber-300 underline shrink-0 flex items-center gap-1">
            Cargar ahora <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI cards del proyecto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          const inner = (
            <div className={`bg-slate-900 border ${kpi.bg} rounded-xl p-5 space-y-3 ${kpi.href ? 'hover:border-slate-600 transition-colors' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-slate-400 text-xs uppercase tracking-wide">{kpi.label}</p>
                <Icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className={`text-xs ${kpi.subColor}`}>{kpi.sub}</p>
            </div>
          )
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href}>{inner}</Link>
          ) : (
            <div key={kpi.label}>{inner}</div>
          )
        })}
      </div>

      {/* Fase activa — próximo paso destacado */}
      {faseActiva && (
        <div className="flex items-center gap-4 bg-indigo-950/30 border border-indigo-800/40 rounded-xl px-5 py-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <span className="text-indigo-300 text-sm font-bold">F{faseActiva.id}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Fase activa ahora</p>
            <p className="text-white font-semibold text-sm">{faseActiva.nombre}</p>
            <p className="text-slate-400 text-xs truncate">{faseActiva.descripcion}</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-500">Progreso</p>
              <p className="text-indigo-300 font-semibold">{faseActiva.progreso}%</p>
            </div>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${faseActiva.progreso}%` }} />
            </div>
          </div>
          <Link
            href={faseActiva.href}
            className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            Ir al módulo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Workflow de fases */}
      {proyectoMeta && fases ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Workflow del proyecto</h2>
          <FaseWorkflow fases={fases} />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-500 text-sm">
            Sin proyecto activo asignado.{' '}
            {esSuperAdmin && (
              <Link href="/admin/onboarding" className="text-indigo-400 hover:underline">
                Crear cliente y proyecto
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
