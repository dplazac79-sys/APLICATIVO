'use client'

import type { WorkflowEstadoTipo } from '@/types/database'

interface ProcesoGantt {
  id: string
  nombre: string
  estado: WorkflowEstadoTipo | null
  fecha_cambio: string | null
}

interface Props {
  procesos: ProcesoGantt[]
  proyectoCreado: string
}

const ESTADO_BAR: Record<WorkflowEstadoTipo, string> = {
  'Scheduled':        'bg-slate-600',
  'Assigned':         'bg-blue-600',
  'In Progress':      'bg-indigo-500',
  'Pending Approval': 'bg-amber-500',
  'Approved':         'bg-emerald-500',
  'Implemented':      'bg-teal-500',
  'Closed':           'bg-slate-500',
}

const ESTADO_ORDER: Record<WorkflowEstadoTipo, number> = {
  'Scheduled': 0, 'Assigned': 1, 'In Progress': 2,
  'Pending Approval': 3, 'Approved': 4, 'Implemented': 5, 'Closed': 6,
}

export default function GanttSimple({ procesos, proyectoCreado }: Props) {
  if (procesos.length === 0) return <p className="text-slate-500 text-sm">Sin procesos para mostrar</p>

  void proyectoCreado

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Header de fechas */}
      <div className="flex text-xs text-slate-500 pl-32">
        <span className="flex-1 text-left">{new Date(proyectoCreado).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</span>
        <span className="text-center">Hoy</span>
        <span className="flex-1 text-right" />
      </div>

      {procesos.map(p => {
        const estadoOrder = p.estado ? ESTADO_ORDER[p.estado] : 0
        const pct = Math.max(5, Math.round((estadoOrder / 6) * 100))
        const barColor = p.estado ? ESTADO_BAR[p.estado] : 'bg-slate-700'

        return (
          <div key={p.id} className="flex items-center gap-2">
            <span className="w-28 text-xs text-slate-400 truncate shrink-0 text-right pr-2">
              {p.nombre}
            </span>
            <div className="flex-1 bg-slate-800 rounded h-4 relative overflow-hidden">
              <div
                className={`h-full rounded transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/70">
                {p.estado ?? 'Sin workflow'}
              </span>
            </div>
            <span className="text-xs text-slate-500 shrink-0 w-6 text-right">{pct}%</span>
          </div>
        )
      })}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 pt-2">
        {(Object.entries(ESTADO_BAR) as [WorkflowEstadoTipo, string][]).map(([estado, color]) => (
          <span key={estado} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
            {estado}
          </span>
        ))}
      </div>
    </div>
  )
}
