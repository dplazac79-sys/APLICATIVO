'use client'

import { useMemo, useState } from 'react'
import type { WorkflowEstadoTipo } from '@/types/database'

interface ProcesoGantt {
  id: string
  nombre: string
  estado: WorkflowEstadoTipo | null
  fecha_cambio: string | null
  /** Id del proceso padre — usado como proxy de dependencia (hijo depende del padre). */
  padre_id?: string | null
}

interface Props {
  procesos: ProcesoGantt[]
  proyectoCreado: string
  showDependencies?: boolean
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

const ESTADO_LABEL: Record<WorkflowEstadoTipo, string> = {
  'Scheduled':        'Programado',
  'Assigned':         'Asignado',
  'In Progress':      'En progreso',
  'Pending Approval': 'En aprobación',
  'Approved':         'Aprobado',
  'Implemented':      'Implementado',
  'Closed':           'Cerrado',
}

const ESTADO_ORDER: Record<WorkflowEstadoTipo, number> = {
  'Scheduled': 0, 'Assigned': 1, 'In Progress': 2,
  'Pending Approval': 3, 'Approved': 4, 'Implemented': 5, 'Closed': 6,
}

const MS_SEMANA = 7 * 24 * 60 * 60 * 1000

// Layout (px)
const LABEL_W = 144
const ROW_H = 28
const HEADER_H = 22
const SEMANA_W = 64

interface BarraCalculada {
  proceso: ProcesoGantt
  inicioSemana: number     // semana de inicio (0-based) relativa al proyecto
  finSemana: number        // semana de fin estimada
  pct: number
}

export default function GanttChart({ procesos, proyectoCreado, showDependencies = true }: Props) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)

  const { barras, totalSemanas, hoySemana } = useMemo(() => {
    const inicioProyecto = new Date(proyectoCreado).getTime()
    const ahora = Date.now()

    const calc: BarraCalculada[] = procesos.map((p, idx) => {
      // fecha_inicio = primera asignación (fecha_cambio si existe), si no, escalonado por orden.
      const inicioMs = p.fecha_cambio ? new Date(p.fecha_cambio).getTime() : inicioProyecto + idx * MS_SEMANA
      const inicioSemana = Math.max(0, Math.floor((inicioMs - inicioProyecto) / MS_SEMANA))

      const estadoOrder = p.estado ? ESTADO_ORDER[p.estado] : -1
      const pct = estadoOrder < 0 ? 0 : Math.max(5, Math.round((estadoOrder / 6) * 100))

      // Duración estimada: más avanzado el estado => barra más corta restante.
      // Estados tempranos duran más semanas; cerrados ya están completos.
      const duracionSemanas = Math.max(1, 6 - Math.max(0, estadoOrder))
      const finSemana = inicioSemana + duracionSemanas

      return { proceso: p, inicioSemana, finSemana, pct }
    })

    const maxFin = calc.reduce((m, b) => Math.max(m, b.finSemana), 1)
    const hoySemana = Math.max(0, Math.floor((ahora - inicioProyecto) / MS_SEMANA))
    const totalSemanas = Math.max(maxFin, hoySemana + 1, 1)

    return { barras: calc, totalSemanas, hoySemana }
  }, [procesos, proyectoCreado])

  if (procesos.length === 0) return <p className="text-slate-500 text-sm">Sin procesos para mostrar</p>

  const chartW = totalSemanas * SEMANA_W
  const totalH = HEADER_H + barras.length * ROW_H

  // Mapa id -> índice de fila (para dependencias)
  const filaPorId = new Map<string, number>()
  barras.forEach((b, i) => filaPorId.set(b.proceso.id, i))

  // Conectores de dependencia (padre -> hijo)
  const conectores = showDependencies
    ? barras.flatMap((b, i) => {
        const padreId = b.proceso.padre_id
        if (!padreId || !filaPorId.has(padreId)) return []
        const padreIdx = filaPorId.get(padreId)!
        const padre = barras[padreIdx]
        const x1 = LABEL_W + padre.finSemana * SEMANA_W
        const y1 = HEADER_H + padreIdx * ROW_H + ROW_H / 2
        const x2 = LABEL_W + b.inicioSemana * SEMANA_W
        const y2 = HEADER_H + i * ROW_H + ROW_H / 2
        return [{ key: `${padreId}-${b.proceso.id}`, x1, y1, x2, y2 }]
      })
    : []

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto relative">
        <div className="relative" style={{ width: LABEL_W + chartW, minWidth: '100%' }}>
          {/* Eje X: etiquetas de semanas */}
          <div className="flex" style={{ paddingLeft: LABEL_W, height: HEADER_H }}>
            {Array.from({ length: totalSemanas }).map((_, w) => (
              <span
                key={w}
                className="text-[10px] text-slate-500 text-center shrink-0 border-l border-slate-800"
                style={{ width: SEMANA_W }}
              >
                S{w + 1}
              </span>
            ))}
          </div>

          {/* Filas */}
          {barras.map((b) => {
            const barColor = b.proceso.estado ? ESTADO_BAR[b.proceso.estado] : 'bg-slate-700'
            const label = b.proceso.estado ? ESTADO_LABEL[b.proceso.estado] : 'Sin iniciar'
            const left = b.inicioSemana * SEMANA_W
            const width = Math.max(SEMANA_W * 0.5, (b.finSemana - b.inicioSemana) * SEMANA_W)
            return (
              <div key={b.proceso.id} className="flex items-center" style={{ height: ROW_H }}>
                <span
                  className="text-xs text-slate-400 truncate shrink-0 text-right pr-2"
                  style={{ width: LABEL_W }}
                  title={b.proceso.nombre}
                >
                  {b.proceso.nombre}
                </span>
                <div className="relative" style={{ width: chartW, height: ROW_H }}>
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-4 rounded ${barColor} cursor-default`}
                    style={{ left, width }}
                    onMouseEnter={e => setHover({ id: b.proceso.id, x: e.clientX, y: e.clientY })}
                    onMouseMove={e => setHover({ id: b.proceso.id, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 px-1 truncate">
                      {label}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Overlay SVG: línea de hoy + conectores de dependencia */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={LABEL_W + chartW}
            height={totalH}
          >
            {/* Línea de "hoy" */}
            <line
              x1={LABEL_W + hoySemana * SEMANA_W}
              y1={0}
              x2={LABEL_W + hoySemana * SEMANA_W}
              y2={totalH}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
            <text x={LABEL_W + hoySemana * SEMANA_W + 3} y={10} fill="#ef4444" fontSize={9}>Hoy</text>

            {/* Conectores de dependencia */}
            {conectores.map(c => (
              <g key={c.key}>
                <path
                  d={`M ${c.x1} ${c.y1} C ${c.x1 + 20} ${c.y1}, ${c.x2 - 20} ${c.y2}, ${c.x2} ${c.y2}`}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth={1}
                />
                <circle cx={c.x2} cy={c.y2} r={2.5} fill="#64748b" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Tooltip */}
      {hover && (() => {
        const b = barras.find(x => x.proceso.id === hover.id)
        if (!b) return null
        return (
          <div
            className="fixed z-50 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <p className="text-slate-100 font-medium">{b.proceso.nombre}</p>
            <p className="text-slate-400">Estado: {b.proceso.estado ? ESTADO_LABEL[b.proceso.estado] : 'Sin iniciar'}</p>
            <p className="text-slate-400">Avance estimado: {b.pct}%</p>
          </div>
        )
      })()}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2 pt-1">
        {(Object.entries(ESTADO_BAR) as [WorkflowEstadoTipo, string][]).map(([estado, color]) => (
          <span key={estado} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`inline-block w-2 h-2 rounded-sm ${color}`} />
            {ESTADO_LABEL[estado]}
          </span>
        ))}
        {showDependencies && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="inline-block w-3 h-0.5 bg-slate-500" /> Dependencia
          </span>
        )}
      </div>
    </div>
  )
}
