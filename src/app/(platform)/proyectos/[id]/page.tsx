import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Briefcase, ChevronLeft, AlertTriangle, CheckCircle, Clock,
  Users, Target, BarChart3, Calendar, Shield
} from 'lucide-react'
import Link from 'next/link'
import type { Proceso, Riesgo, KPI, Reunion, WorkflowEstadoTipo } from '@/types/database'
import WorkflowBoard from '@/components/pcc/WorkflowBoard'
import GanttChart from '@/components/pcc/GanttChart'
import ReunionForm from '@/components/pcc/ReunionForm'
import RiesgoForm from '@/components/pcc/RiesgoForm'
import KpiForm from '@/components/pcc/KpiForm'
import ArbolProcesos from '@/components/procesos/ArbolProcesos'
import type { NodoProceso } from '@/components/procesos/ArbolProcesos'

export const dynamic = 'force-dynamic'

const NIVEL_RIESGO_COLOR: Record<string, string> = {
  critico: 'text-red-400', alto: 'text-orange-400', medio: 'text-amber-400', bajo: 'text-slate-400',
}

interface Props { params: { id: string } }

export default async function ProyectoDetallePage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: usuario } = await admin
    .from('usuario')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (usuario?.rol !== 'super_admin') redirect('/dashboard')

  const { data: proyecto } = await admin
    .from('proyecto')
    .select('*, cliente(razon_social, industria)')
    .eq('id', params.id)
    .single()

  if (!proyecto) notFound()

  const [
    { data: procesosRaw },
    { data: workflowsRaw },
    { data: reunionesRaw },
    { data: riesgosRaw },
    { data: kpisRaw },
  ] = await Promise.all([
    admin.from('proceso').select('id, nombre, nivel, tipo, estado_oferta, orden, padre_id').eq('proyecto_id', params.id).eq('estado_oferta', 'aceptado').order('orden'),
    admin.from('workflow_estado').select('*, responsable:responsable_id(nombre)').eq('proyecto_id', params.id),
    admin.from('reunion').select('*').eq('proyecto_id', params.id).order('fecha', { ascending: false }).limit(5),
    admin.from('riesgo').select('*').eq('proyecto_id', params.id).order('created_at', { ascending: false }),
    admin.from('kpi').select('*').eq('proyecto_id', params.id).order('created_at'),
  ])

  const procesos = (procesosRaw ?? []) as Pick<Proceso, 'id' | 'nombre' | 'nivel' | 'tipo' | 'estado_oferta' | 'orden' | 'padre_id'>[]
  const workflows = (workflowsRaw ?? []) as Array<{ proceso_id: string; estado: WorkflowEstadoTipo; nivel_escalacion: string | null; fecha_cambio: string; responsable: { nombre: string } | null }>
  const reuniones = (reunionesRaw ?? []) as Reunion[]
  const riesgos = (riesgosRaw ?? []) as Riesgo[]
  const kpis = (kpisRaw ?? []) as KPI[]

  const wfPorProceso = workflows.reduce((acc, w) => { acc[w.proceso_id] = w; return acc }, {} as Record<string, typeof workflows[0]>)

  const cliente = proyecto.cliente as Record<string, unknown>
  const totalProcesos = procesos.length
  const cerrados = procesos.filter(p => wfPorProceso[p.id]?.estado === 'Closed').length
  const enAprobacion = procesos.filter(p => wfPorProceso[p.id]?.estado === 'Pending Approval').length
  const escalados = workflows.filter(w => w.nivel_escalacion).length
  const avance = totalProcesos > 0 ? Math.round((cerrados / totalProcesos) * 100) : 0

  const riesgosCriticos = riesgos.filter(r => r.nivel_riesgo === 'critico' && r.estado === 'activo').length
  const riesgosAltos = riesgos.filter(r => r.nivel_riesgo === 'alto' && r.estado === 'activo').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/proyectos" className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Project Control Center
          </Link>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            {proyecto.nombre}
          </h1>
          <p className="text-slate-400 text-sm">
            {String(cliente?.razon_social ?? '')}
            {cliente?.industria ? ` · ${String(cliente.industria)}` : ''}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded border ${proyecto.estado_general === 'activo' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
          {proyecto.estado_general}
        </span>
      </div>

      {/* KPIs ejecutivos */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Procesos', value: totalProcesos, icon: Target, color: 'text-white' },
          { label: 'Avance', value: `${avance}%`, icon: CheckCircle, color: 'text-indigo-400' },
          { label: 'En aprobación', value: enAprobacion, icon: Clock, color: 'text-amber-400' },
          { label: 'Escalados', value: escalados, icon: AlertTriangle, color: escalados > 0 ? 'text-red-400' : 'text-slate-600' },
          { label: 'Riesgos activos', value: riesgos.filter(r => r.estado === 'activo').length, icon: Shield, color: riesgosCriticos > 0 ? 'text-red-400' : 'text-orange-400' },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra global de avance */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Progreso general del proyecto</span>
          <span>{cerrados} de {totalProcesos} procesos cerrados</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-2 rounded-full transition-all" style={{ width: `${avance}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Columna izquierda: Workflow + Gantt */}
        <div className="col-span-2 space-y-6">

          {/* Árbol de procesos (arquitectura 0-4) */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Arquitectura de procesos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ArbolProcesos
                procesos={procesos as NodoProceso[]}
                titulo={undefined}
              />
            </CardContent>
          </Card>

          {/* Workflow Board */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Target className="w-4 h-4" /> Workflow de procesos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowBoard
                procesos={procesos.map(p => ({
                  id: p.id,
                  nombre: p.nombre,
                  nivel: p.nivel,
                  workflow: wfPorProceso[p.id] ?? null,
                }))}
                proyectoId={params.id}
              />
            </CardContent>
          </Card>

          {/* Gantt */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Cronograma
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GanttChart
                procesos={procesos.map(p => ({
                  id: p.id,
                  nombre: p.nombre,
                  estado: wfPorProceso[p.id]?.estado ?? null,
                  fecha_cambio: wfPorProceso[p.id]?.fecha_cambio ?? null,
                  padre_id: p.padre_id,
                }))}
                proyectoCreado={proyecto.created_at}
                showDependencies
              />
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha: Riesgos + KPIs + Reuniones */}
        <div className="space-y-6">

          {/* Riesgos */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Riesgos
                  {riesgosCriticos > 0 && (
                    <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.5 rounded-full">{riesgosCriticos} crítico{riesgosCriticos > 1 ? 's' : ''}</span>
                  )}
                </CardTitle>
                <RiesgoForm proyectoId={params.id} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {riesgos.filter(r => r.estado === 'activo').slice(0, 5).map(r => (
                <div key={r.id} className="flex items-start gap-2 text-xs">
                  <span className={`shrink-0 font-bold ${NIVEL_RIESGO_COLOR[r.nivel_riesgo] ?? 'text-slate-400'}`}>
                    ●
                  </span>
                  <span className="text-slate-300 leading-snug">{r.descripcion}</span>
                </div>
              ))}
              {riesgos.filter(r => r.estado === 'activo').length === 0 && (
                <p className="text-slate-600 text-xs">Sin riesgos activos registrados</p>
              )}
              {riesgos.filter(r => r.estado === 'activo').length > 5 && (
                <p className="text-slate-500 text-xs">+{riesgos.filter(r => r.estado === 'activo').length - 5} más</p>
              )}
            </CardContent>
          </Card>

          {/* KPIs */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> KPIs de proyecto
                </CardTitle>
                <KpiForm proyectoId={params.id} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {kpis.slice(0, 4).map(k => (
                <div key={k.id} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-xs font-medium">{k.nombre}</span>
                    <span className="text-white text-xs font-bold">{k.valor_actual ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Base: {k.linea_base ?? '—'}</span>
                    <span>Meta: {k.meta ?? '—'}</span>
                  </div>
                </div>
              ))}
              {kpis.length === 0 && <p className="text-slate-600 text-xs">Sin KPIs definidos</p>}
            </CardContent>
          </Card>

          {/* Reuniones */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Últimas reuniones
                </CardTitle>
                <ReunionForm proyectoId={params.id} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {reuniones.map(r => (
                <div key={r.id} className="space-y-0.5">
                  <p className="text-slate-200 text-xs font-medium">{r.titulo}</p>
                  <p className="text-slate-500 text-xs">
                    {new Date(r.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {r.participantes.length > 0 && ` · ${r.participantes.slice(0, 2).join(', ')}${r.participantes.length > 2 ? ` +${r.participantes.length - 2}` : ''}`}
                  </p>
                </div>
              ))}
              {reuniones.length === 0 && <p className="text-slate-600 text-xs">Sin reuniones registradas</p>}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Alerta de riesgos críticos */}
      {(riesgosCriticos > 0 || riesgosAltos > 0) && (
        <Card className="bg-red-950/20 border-red-800/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm font-medium">
                Atención: {riesgosCriticos > 0 ? `${riesgosCriticos} riesgo${riesgosCriticos > 1 ? 's' : ''} crítico${riesgosCriticos > 1 ? 's' : ''}` : ''}
                {riesgosCriticos > 0 && riesgosAltos > 0 ? ' y ' : ''}
                {riesgosAltos > 0 ? `${riesgosAltos} riesgo${riesgosAltos > 1 ? 's' : ''} alto${riesgosAltos > 1 ? 's' : ''}` : ''}
              </p>
              <p className="text-slate-400 text-xs mt-0.5">Revisar el panel de riesgos y definir controles urgentes.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
