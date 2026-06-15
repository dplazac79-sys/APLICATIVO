import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Clock, FolderOpen } from 'lucide-react'

const FASE_LABELS: Record<number, string> = {
  1: 'Fundación',
  2: 'Discovery AI',
  3: 'Artefactos',
  4: 'Gestión Proyecto',
  5: 'Simulación Impacto',
  6: 'Automation Studio',
}

const ESTADO_CONFIG = {
  activo: { label: 'Activo', class: 'bg-emerald-950 text-emerald-400 border-emerald-800' },
  pausado: { label: 'Pausado', class: 'bg-amber-950 text-amber-400 border-amber-800' },
  cerrado: { label: 'Cerrado', class: 'bg-slate-800 text-slate-500 border-slate-700' },
} as const

export default async function ProyectosPage() {
  const supabase = createClient()

  const { data: proyectos } = await supabase
    .from('proyecto')
    .select('*, cliente(razon_social, industria)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Control Center</h1>
        <p className="text-slate-400 text-sm mt-1">M8 — Panel de control de proyectos</p>
      </div>

      {proyectos?.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400">No hay proyectos activos.</p>
            <p className="text-slate-600 text-sm mt-1">
              Los proyectos se crean desde la ficha de cada cliente.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {proyectos?.map(proyecto => {
          const estadoConf = ESTADO_CONFIG[proyecto.estado_general as keyof typeof ESTADO_CONFIG]
            ?? ESTADO_CONFIG.activo
          return (
            <Card key={proyecto.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-950 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm">{proyecto.nombre}</h3>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {proyecto.cliente?.razon_social}
                        {proyecto.cliente?.industria && ` · ${proyecto.cliente.industria}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${estadoConf.class}`}>
                    {estadoConf.label}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      Fase {proyecto.fase_actual} — {FASE_LABELS[proyecto.fase_actual] ?? ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {new Date(proyecto.created_at).toLocaleDateString('es-CL')}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Shell M8 — módulos disponibles en fases futuras */}
      <Card className="bg-slate-900 border-slate-800 border-dashed">
        <CardHeader>
          <CardTitle className="text-slate-500 text-sm">M8 — Módulos disponibles en Fase 4</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['Gantt interactivo', 'Reuniones y acuerdos', 'Entregables', 'KPIs de proyecto'].map(m => (
            <div key={m} className="bg-slate-800/50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-600">{m}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
