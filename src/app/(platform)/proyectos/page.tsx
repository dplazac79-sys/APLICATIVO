import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import type { WorkflowEstadoTipo } from '@/types/database'

export const dynamic = 'force-dynamic'

const ESTADO_COLOR: Record<WorkflowEstadoTipo, string> = {
  'Scheduled':        'bg-slate-800 text-slate-400 border-slate-700',
  'Assigned':         'bg-blue-950 text-blue-400 border-blue-800',
  'In Progress':      'bg-indigo-950 text-indigo-400 border-indigo-800',
  'Pending Approval': 'bg-amber-950 text-amber-400 border-amber-800',
  'Approved':         'bg-emerald-950 text-emerald-400 border-emerald-800',
  'Implemented':      'bg-teal-950 text-teal-400 border-teal-800',
  'Closed':           'bg-slate-900 text-slate-500 border-slate-800',
}

// evitar warning de variable no usada — se usa como referencia de tipos
void ESTADO_COLOR

export default async function ProyectosPage() {
  const admin = createAdminClient()

  const { data: proyectos } = await admin
    .from('proyecto')
    .select('*, cliente(razon_social, industria)')
    .order('created_at', { ascending: false })

  const { data: workflows } = await admin
    .from('workflow_estado')
    .select('proyecto_id, estado, nivel_escalacion')

  const { data: riesgos } = await admin
    .from('riesgo')
    .select('proyecto_id, nivel_riesgo, estado')
    .eq('estado', 'activo')

  const wfPorProyecto = (workflows ?? []).reduce((acc, w) => {
    if (!acc[w.proyecto_id]) acc[w.proyecto_id] = []
    acc[w.proyecto_id].push(w)
    return acc
  }, {} as Record<string, Array<{ estado: string; nivel_escalacion: string | null }>>)

  const riesgosPorProyecto = (riesgos ?? []).reduce((acc, r) => {
    acc[r.proyecto_id] = (acc[r.proyecto_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-400" />
          Project Control Center
        </h1>
        <p className="text-slate-400 text-sm mt-1">Gestión de portafolio y control de proyectos</p>
      </div>

      <div className="space-y-3">
        {(proyectos ?? []).map(proyecto => {
          const cliente = proyecto.cliente as Record<string, unknown>
          const wfs = wfPorProyecto[proyecto.id] ?? []
          const total = wfs.length
          const cerrados = wfs.filter(w => w.estado === 'Closed').length
          const enAprobacion = wfs.filter(w => w.estado === 'Pending Approval').length
          const escalados = wfs.filter(w => w.nivel_escalacion).length
          const avance = total > 0 ? Math.round((cerrados / total) * 100) : 0
          const riesgosActivos = riesgosPorProyecto[proyecto.id] ?? 0

          return (
            <Link key={proyecto.id} href={`/proyectos/${proyecto.id}`} className="block">
              <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-white font-semibold text-base truncate">{proyecto.nombre}</h2>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${proyecto.estado_general === 'activo' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                          {proyecto.estado_general}
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm mt-0.5">
                        {String(cliente?.razon_social ?? '')}
                        {cliente?.industria ? ` · ${String(cliente.industria)}` : ''}
                      </p>
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Avance workflow</span>
                          <span>{avance}% ({cerrados}/{total} procesos cerrados)</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${avance}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {escalados > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />{escalados} escalado{escalados > 1 ? 's' : ''}
                        </span>
                      )}
                      {enAprobacion > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Clock className="w-3.5 h-3.5" />{enAprobacion} en aprobación
                        </span>
                      )}
                      {riesgosActivos > 0 && (
                        <span className="flex items-center gap-1 text-xs text-orange-400">
                          <AlertTriangle className="w-3.5 h-3.5" />{riesgosActivos} riesgo{riesgosActivos > 1 ? 's' : ''}
                        </span>
                      )}
                      {avance === 100 && total > 0 && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
        {!(proyectos ?? []).length && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-16 text-center">
              <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">No hay proyectos creados</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
